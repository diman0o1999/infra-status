package collector

import (
	"log"
	"sync"
	"time"

	"infra-status/internal/config"
	"infra-status/internal/models"
)

// Collector orchestrates all data collection
type Collector struct {
	cfg     *config.Config
	ssh     *SSHCollector
	http    *HTTPChecker
	kuma    *KumaCollector
	mu      sync.RWMutex
	state   models.Dashboard
	onChange func(models.Dashboard)
}

func New(cfg *config.Config) *Collector {
	c := &Collector{
		cfg:  cfg,
		ssh:  NewSSHCollector(cfg.Hosts),
		http: NewHTTPChecker(),
	}
	if cfg.Kuma.Enabled && cfg.Kuma.URL != "" {
		c.kuma = NewKumaCollector(cfg.Kuma.URL, cfg.Kuma.Slug)
	}
	return c
}

func (c *Collector) OnChange(fn func(models.Dashboard)) {
	c.onChange = fn
}

func (c *Collector) State() models.Dashboard {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state
}

func (c *Collector) Start() {
	c.collect() // initial collection
	go func() {
		ticker := time.NewTicker(c.cfg.Server.RefreshInterval)
		defer ticker.Stop()
		for range ticker.C {
			c.collect()
		}
	}()
}

func (c *Collector) collect() {
	start := time.Now()

	var wg sync.WaitGroup
	var dashboard models.Dashboard

	// Collect host metrics
	var hostsMu sync.Mutex
	for _, host := range c.cfg.Hosts {
		wg.Add(1)
		go func(h config.HostConfig) {
			defer wg.Done()
			m := c.ssh.CollectHost(h)
			hostsMu.Lock()
			dashboard.Hosts = append(dashboard.Hosts, m)
			hostsMu.Unlock()
		}(host)
	}

	// Collect project statuses
	var projMu sync.Mutex
	for _, proj := range c.cfg.Projects {
		wg.Add(1)
		go func(p config.ProjectConfig) {
			defer wg.Done()
			ps := c.collectProject(p)
			projMu.Lock()
			dashboard.Projects = append(dashboard.Projects, ps)
			projMu.Unlock()
		}(proj)
	}

	// Collect infrastructure services
	var infraMu sync.Mutex
	for _, infra := range c.cfg.Infrastructure {
		wg.Add(1)
		go func(i config.InfraConfig) {
			defer wg.Done()
			is := c.collectInfra(i)
			infraMu.Lock()
			dashboard.Infrastructure = append(dashboard.Infrastructure, is)
			infraMu.Unlock()
		}(infra)
	}

	wg.Wait()

	// Kuma monitors
	if c.kuma != nil {
		kumaData, err := c.kuma.Collect()
		if err != nil {
			log.Printf("Kuma collect error: %v", err)
		} else {
			for _, km := range kumaData {
				dashboard.Kuma = append(dashboard.Kuma, models.KumaMonitor{
					ID:     km.ID,
					Name:   km.Name,
					Type:   km.Type,
					Group:  km.Group,
					Up:     km.Up,
					Status: km.Status,
					Ping:   km.Ping,
					Uptime: km.Uptime,
					Msg:    km.Msg,
				})
			}
		}
	}

	// Domains
	dashboard.Domains = c.collectDomains()
	dashboard.UpdatedAt = time.Now()
	dashboard.Alive = true

	c.mu.Lock()
	c.state = dashboard
	c.mu.Unlock()

	if c.onChange != nil {
		c.onChange(dashboard)
	}

	log.Printf("Collection done in %s", time.Since(start))
}

func (c *Collector) collectProject(p config.ProjectConfig) models.ProjectStatus {
	ps := models.ProjectStatus{
		Name:        p.Name,
		Icon:        p.Icon,
		Description: p.Description,
		WebURL:      p.URLs.Web,
		ApiURL:      p.URLs.API,
	}

	// HTTP health checks
	webResult := c.http.Check(p.URLs.Web)
	apiResult := c.http.Check(p.URLs.API)
	ps.WebUp = webResult.Up
	ps.ApiUp = apiResult.Up
	ps.WebStatus = webResult.Status
	ps.ApiStatus = apiResult.Status

	// Service checks
	allServices := make([]models.ServiceStatus, 0)

	for _, svc := range p.Services.System {
		st := c.ssh.CheckService(p.Host, svc, "system")
		allServices = append(allServices, st)
	}
	for _, svc := range p.Services.User {
		st := c.ssh.CheckService(p.Host, svc, "user")
		allServices = append(allServices, st)
	}
	ps.Services = allServices

	// Sum memory across all services
	var totalMem uint64
	for _, svc := range allServices {
		totalMem += svc.Memory
	}
	ps.MemoryTotal = totalMem

	// Determine overall status
	ps.Status = "ok"
	if !ps.WebUp || !ps.ApiUp {
		ps.Status = "degraded"
	}
	allDown := !ps.WebUp && !ps.ApiUp
	for _, svc := range allServices {
		if !svc.Active {
			ps.Status = "degraded"
		}
	}
	if allDown {
		ps.Status = "down"
	}

	return ps
}

func (c *Collector) collectInfra(i config.InfraConfig) models.InfraService {
	st := c.ssh.CheckService(i.Host, i.Service, i.Level)
	return models.InfraService{
		Name:     i.Name,
		Service:  i.Service,
		Port:     i.Port,
		Active:   st.Active,
		State:    st.State,
		Optional: i.Optional,
		Memory:   st.Memory,
	}
}

func (c *Collector) collectDomains() []models.DomainInfo {
	domains := make([]models.DomainInfo, 0, len(c.cfg.Domains.Subdomains))
	for _, sub := range c.cfg.Domains.Subdomains {
		fqdn := sub.Name + "." + c.cfg.Domains.Base
		domains = append(domains, models.DomainInfo{
			Name:        sub.Name,
			FQDN:        fqdn,
			Description: sub.Description,
			Reachable:   true, // DNS is configured, actual check optional
		})
	}
	return domains
}

func (c *Collector) Stop() {
	c.ssh.Close()
}
