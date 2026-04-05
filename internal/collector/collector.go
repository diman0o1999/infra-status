package collector

import (
	"log/slog"
	"strings"
	"sync"
	"time"

	"infra-status/internal/config"
	"infra-status/internal/models"
)

// Collector orchestrates all data collection
type Collector struct {
	cfg          *config.Config
	cfgPath      string
	ssh          *SSHCollector
	http         *HTTPChecker
	kuma         *KumaCollector
	ollamaStatus *OllamaStatusCollector
	mu       sync.RWMutex
	state    models.Dashboard
	onChange func(models.Dashboard)
	stopOnce sync.Once
}

func New(cfg *config.Config, cfgPath string) *Collector {
	c := &Collector{
		cfg:          cfg,
		cfgPath:      cfgPath,
		ssh:          NewSSHCollector(cfg.Hosts),
		http:         NewHTTPChecker(),
		ollamaStatus: NewOllamaStatusCollector(cfg.Ollama.URL),
	}
	if cfg.Kuma.Enabled && cfg.Kuma.URL != "" {
		c.kuma = NewKumaCollector(cfg.Kuma.URL, cfg.Kuma.Slug)
	}
	return c
}

// Reload re-reads config.yaml from disk and hot-swaps it without restart
func (c *Collector) Reload() error {
	cfg, err := config.Load(c.cfgPath)
	if err != nil {
		return err
	}
	newSSH := NewSSHCollector(cfg.Hosts)
	c.mu.Lock()
	oldSSH := c.ssh
	c.cfg = cfg
	c.ssh = newSSH
	c.ollamaStatus = NewOllamaStatusCollector(cfg.Ollama.URL)
	if cfg.Kuma.Enabled && cfg.Kuma.URL != "" {
		c.kuma = NewKumaCollector(cfg.Kuma.URL, cfg.Kuma.Slug)
	} else {
		c.kuma = nil
	}
	c.mu.Unlock()
	oldSSH.Close()
	go c.collect()
	return nil
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

	// GPU metrics
	if c.cfg.GPU.Enabled && c.cfg.GPU.Host != "" {
		dashboard.GPU = c.ssh.CollectGPU(c.cfg.GPU.Host)
	}

	// Ollama status
	if c.cfg.Ollama.Enabled && c.cfg.Ollama.URL != "" && c.ollamaStatus != nil {
		dashboard.Ollama = c.ollamaStatus.Collect()
	}

	// Kuma monitors
	if c.kuma != nil {
		kumaData, err := c.kuma.Collect()
		if err != nil {
			slog.Warn("kuma collect failed", "error", err)
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
	dashboard.Env = c.cfg.Server.Env

	c.mu.Lock()
	c.state = dashboard
	c.mu.Unlock()

	if c.onChange != nil {
		c.onChange(dashboard)
	}

	slog.Info("collection complete", "duration_ms", time.Since(start).Milliseconds())
}

func (c *Collector) collectProject(p config.ProjectConfig) models.ProjectStatus {
	ps := models.ProjectStatus{
		Name:        p.Name,
		Icon:        p.Icon,
		Description: p.Description,
		Purpose:     p.Purpose,
		Login:       p.Login,
		Password:    p.Password,
		WebURL:      p.URLs.Web,
		ApiURL:      p.URLs.API,
		LocalWeb:    p.LocalURLs.Web,
		LocalAPI:    p.LocalURLs.API,
	}
	for _, a := range p.Accounts {
		ps.Accounts = append(ps.Accounts, models.Account{
			Email:    a.Email,
			Password: a.Password,
			Role:     a.Role,
			Note:     a.Note,
		})
	}

	// HTTP health checks — prefer local URLs (public URLs fail due to hairpin NAT)
	webCheckURL := p.LocalURLs.Web
	if webCheckURL == "" {
		webCheckURL = p.URLs.Web
	}
	apiCheckURL := p.LocalURLs.API
	if apiCheckURL == "" {
		apiCheckURL = p.URLs.API
	}
	webResult := c.http.Check(webCheckURL)
	apiResult := c.http.Check(apiCheckURL)
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
	// Build description/credentials lookup from static config
	descMap := make(map[string]string)
	loginMap := make(map[string]string)
	passMap := make(map[string]string)
	for _, sub := range c.cfg.Domains.Subdomains {
		fqdn := sub.Name + "." + c.cfg.Domains.Base
		descMap[fqdn] = sub.Description
		loginMap[fqdn] = sub.Login
		passMap[fqdn] = sub.Password
	}

	// Discover nginx domains from all hosts concurrently
	type hostResult struct {
		hostName string
		domains  []string
	}
	resCh := make(chan hostResult, len(c.cfg.Hosts))
	var wg sync.WaitGroup
	for _, host := range c.cfg.Hosts {
		wg.Add(1)
		go func(h config.HostConfig) {
			defer wg.Done()
			resCh <- hostResult{h.Name, c.ssh.CollectNginxDomains(h)}
		}(host)
	}
	wg.Wait()
	close(resCh)

	seen := make(map[string]bool)
	var domains []models.DomainInfo
	for r := range resCh {
		for _, fqdn := range r.domains {
			if seen[fqdn] {
				continue
			}
			seen[fqdn] = true
			name := fqdn
			if parts := strings.SplitN(fqdn, ".", 2); len(parts) > 0 {
				name = parts[0]
			}
			domains = append(domains, models.DomainInfo{
				Name:        name,
				FQDN:        fqdn,
				Description: descMap[fqdn],
				Reachable:   true,
				Host:        r.hostName,
				Login:       loginMap[fqdn],
				Password:    passMap[fqdn],
			})
		}
	}

	// Add config-only entries not found in any nginx
	for _, sub := range c.cfg.Domains.Subdomains {
		fqdn := sub.Name + "." + c.cfg.Domains.Base
		if !seen[fqdn] {
			domains = append(domains, models.DomainInfo{
				Name:        sub.Name,
				FQDN:        fqdn,
				Description: sub.Description,
				Reachable:   false,
				Login:       sub.Login,
				Password:    sub.Password,
			})
		}
	}

	// Add custom (local/LAN) domains from config
	for _, cd := range c.cfg.Domains.Custom {
		if seen[cd.FQDN] {
			continue
		}
		seen[cd.FQDN] = true
		domains = append(domains, models.DomainInfo{
			Name:        cd.Name,
			FQDN:        cd.FQDN,
			URL:         cd.URL,
			Description: cd.Description,
			Reachable:   true,
			Local:       cd.Local,
			Login:       cd.Login,
			Password:    cd.Password,
		})
	}

	return domains
}

func (c *Collector) Stop() {
	c.stopOnce.Do(func() {
		c.ssh.Close()
	})
}

// RunServiceAction delegates to the SSH collector to execute a systemctl action
// on the named host. It acquires a read lock so config is stable during the call.
func (c *Collector) RunServiceAction(hostName, service, level, action string) (string, error) {
	c.mu.RLock()
	ssh := c.ssh
	c.mu.RUnlock()
	return ssh.RunServiceAction(hostName, service, level, action)
}

// GetServiceLogs delegates to the SSH collector to retrieve journalctl output
// for a service on the named host.
func (c *Collector) GetServiceLogs(hostName, service, level string, lines int) ([]string, error) {
	c.mu.RLock()
	ssh := c.ssh
	c.mu.RUnlock()
	return ssh.GetServiceLogs(hostName, service, level, lines)
}

// FindProject returns the ProjectConfig for the given project name (case-insensitive)
// and a boolean indicating whether it was found. Used by control handlers.
func (c *Collector) FindProject(name string) (projectHost string, systemServices []string, userServices []string, found bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	nameLower := strings.ToLower(name)
	for _, p := range c.cfg.Projects {
		if strings.ToLower(p.Name) == nameLower {
			return p.Host, p.Services.System, p.Services.User, true
		}
	}
	return "", nil, nil, false
}
