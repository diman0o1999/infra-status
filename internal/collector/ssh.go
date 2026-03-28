package collector

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
	"infra-status/internal/config"
	"infra-status/internal/models"
)

type SSHCollector struct {
	hosts   []config.HostConfig
	clients map[string]*ssh.Client
}

func NewSSHCollector(hosts []config.HostConfig) *SSHCollector {
	return &SSHCollector{
		hosts:   hosts,
		clients: make(map[string]*ssh.Client),
	}
}

func (c *SSHCollector) getClient(host config.HostConfig) (*ssh.Client, error) {
	if client, ok := c.clients[host.Name]; ok {
		// Test if connection is still alive
		_, _, err := client.SendRequest("keepalive@openssh.com", true, nil)
		if err == nil {
			return client, nil
		}
		client.Close()
		delete(c.clients, host.Name)
	}

	keyPath := host.SSHKey
	if strings.HasPrefix(keyPath, "~") {
		home, _ := os.UserHomeDir()
		keyPath = filepath.Join(home, keyPath[1:])
	}

	key, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("read key %s: %w", keyPath, err)
	}

	signer, err := ssh.ParsePrivateKey(key)
	if err != nil {
		return nil, fmt.Errorf("parse key: %w", err)
	}

	cfg := &ssh.ClientConfig{
		User:            host.SSHUser,
		Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	client, err := ssh.Dial("tcp", host.Host+":22", cfg)
	if err != nil {
		return nil, fmt.Errorf("ssh dial %s: %w", host.Host, err)
	}

	c.clients[host.Name] = client
	return client, nil
}

func (c *SSHCollector) runCommand(client *ssh.Client, cmd string) (string, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.CombinedOutput(cmd)
	if err != nil {
		return string(out), err
	}
	return strings.TrimSpace(string(out)), nil
}

func (c *SSHCollector) CollectHost(host config.HostConfig) models.HostMetrics {
	m := models.HostMetrics{
		Name:        host.Name,
		Host:        host.Host,
		Type:        host.Type,
		CollectedAt: time.Now(),
	}

	client, err := c.getClient(host)
	if err != nil {
		m.Status = "offline"
		return m
	}

	m.Online = true

	// CPU usage (average across cores)
	cpuOut, err := c.runCommand(client, `top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1`)
	if err == nil {
		if v, e := strconv.ParseFloat(strings.Replace(cpuOut, ",", ".", 1), 64); e == nil {
			m.CPU = v
		}
	}

	// RAM
	ramOut, err := c.runCommand(client, `free -b | awk '/Mem:/ {printf "%d %d", $2, $3}'`)
	if err == nil {
		parts := strings.Fields(ramOut)
		if len(parts) == 2 {
			total, _ := strconv.ParseUint(parts[0], 10, 64)
			used, _ := strconv.ParseUint(parts[1], 10, 64)
			m.RAM = models.RAMInfo{
				Total:   total,
				Used:    used,
				Percent: float64(used) / float64(total) * 100,
			}
		}
	}

	// Disk
	diskOut, err := c.runCommand(client, `df -B1 / | awk 'NR==2 {printf "%d %d", $2, $3}'`)
	if err == nil {
		parts := strings.Fields(diskOut)
		if len(parts) == 2 {
			total, _ := strconv.ParseUint(parts[0], 10, 64)
			used, _ := strconv.ParseUint(parts[1], 10, 64)
			m.Disk = models.DiskInfo{
				Total:   total,
				Used:    used,
				Percent: float64(used) / float64(total) * 100,
			}
		}
	}

	// Load average
	loadOut, err := c.runCommand(client, `cat /proc/loadavg | awk '{print $1, $2, $3}'`)
	if err == nil {
		m.Load = loadOut
	}

	// Uptime
	uptimeOut, err := c.runCommand(client, `uptime -p`)
	if err == nil {
		m.Uptime = strings.TrimPrefix(uptimeOut, "up ")
	}

	// Determine status based on thresholds
	m.Status = "ok"
	if m.CPU >= host.Thresholds.CPUWarn || m.RAM.Percent >= host.Thresholds.RAMWarn || m.Disk.Percent >= host.Thresholds.DiskWarn {
		m.Status = "warn"
	}
	if m.CPU >= host.Thresholds.CPUCrit || m.RAM.Percent >= host.Thresholds.RAMCrit || m.Disk.Percent >= host.Thresholds.DiskCrit {
		m.Status = "crit"
	}

	return m
}

func (c *SSHCollector) CollectAll() []models.HostMetrics {
	results := make([]models.HostMetrics, 0, len(c.hosts))
	for _, host := range c.hosts {
		results = append(results, c.CollectHost(host))
	}
	return results
}

// CheckService checks a systemd service status via SSH
func (c *SSHCollector) CheckService(hostName, service, level string) models.ServiceStatus {
	st := models.ServiceStatus{
		Name:  service,
		Host:  hostName,
		Level: level,
	}

	var host config.HostConfig
	for _, h := range c.hosts {
		if h.Name == hostName {
			host = h
			break
		}
	}
	if host.Host == "" {
		st.State = "unknown"
		return st
	}

	client, err := c.getClient(host)
	if err != nil {
		st.State = "unreachable"
		return st
	}

	prefix := "systemctl"
	if level == "user" {
		prefix = "systemctl --user"
	}

	out, _ := c.runCommand(client, fmt.Sprintf("%s is-active %s", prefix, service))
	st.State = out
	st.Active = out == "active"

	// Collect memory usage
	if st.Active {
		memOut, err := c.runCommand(client, fmt.Sprintf("%s show %s --property=MemoryCurrent", prefix, service))
		if err == nil {
			memOut = strings.TrimPrefix(memOut, "MemoryCurrent=")
			if memOut != "[not set]" && memOut != "infinity" {
				if v, e := strconv.ParseUint(memOut, 10, 64); e == nil {
					st.Memory = v
				}
			}
		}
	}

	return st
}

// CollectNginxDomains scans nginx sites-enabled for active server_name entries on a host
func (c *SSHCollector) CollectNginxDomains(host config.HostConfig) []string {
	client, err := c.getClient(host)
	if err != nil {
		return nil
	}
	out, err := c.runCommand(client,
		`grep -rh 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null | grep -v '#' | sed 's/server_name//g;s/;//g' | tr ' \t' '\n\n' | grep '\.' | grep -v '^_' | sort -u`,
	)
	if err != nil {
		return nil
	}
	var domains []string
	for _, d := range strings.Split(out, "\n") {
		if d = strings.TrimSpace(d); d != "" {
			domains = append(domains, d)
		}
	}
	return domains
}

func (c *SSHCollector) Close() {
	for _, client := range c.clients {
		client.Close()
	}
}
