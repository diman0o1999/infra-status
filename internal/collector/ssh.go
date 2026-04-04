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

	// Thermal (CPU package temp, fans) — only for bare-metal proxmox hosts
	if host.Type == "proxmox" {
		m.Thermal = c.collectThermal(client)
	}

	// Swap usage
	swapOut, err := c.runCommand(client, `free -b | awk '/Swap:/ {printf "%d %d", $2, $3}'`)
	if err == nil {
		parts := strings.Fields(swapOut)
		if len(parts) == 2 {
			total, _ := strconv.ParseUint(parts[0], 10, 64)
			used, _ := strconv.ParseUint(parts[1], 10, 64)
			if total > 0 {
				m.Swap = models.SwapInfo{
					Total:   total,
					Used:    used,
					Percent: float64(used) / float64(total) * 100,
				}
			}
		}
	}

	// Process count
	procsOut, err := c.runCommand(client, `ps aux --no-heading 2>/dev/null | wc -l`)
	if err == nil {
		if v, e := strconv.Atoi(strings.TrimSpace(procsOut)); e == nil {
			m.Procs = v
		}
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

// collectThermal parses full `sensors` output: CPU, fans, board temps, NVMe, voltages, network, ACPI
func (c *SSHCollector) collectThermal(client *ssh.Client) models.ThermalInfo {
	info := models.ThermalInfo{}

	out, err := c.runCommand(client, "sensors 2>/dev/null")
	if err != nil || strings.TrimSpace(out) == "" {
		return info
	}

	// Track which adapter block we are currently in
	// Possible values: "nct6798", "coretemp", "nvme", "acpitz", "r8169", ""
	currentAdapter := ""

	// Board sensor names we want to capture (from nct6798)
	boardSensorNames := map[string]bool{
		"SYSTIN": true, "CPUTIN": true,
		"AUXTIN0": true, "AUXTIN1": true, "AUXTIN2": true,
		"AUXTIN3": true, "AUXTIN4": true,
	}

	for _, line := range strings.Split(out, "\n") {
		trimmed := strings.TrimSpace(line)

		if trimmed == "" {
			continue
		}

		// Chip name lines contain adapter type markers like "-isa-", "-pci-", "-acpi-", "-mdio-", "-virtual-"
		// These are the block header lines: "nct6798-isa-0290", "coretemp-isa-0000", "nvme-pci-0200", etc.
		lower := strings.ToLower(trimmed)
		isChipLine := strings.Contains(lower, "-isa-") || strings.Contains(lower, "-pci-") ||
			strings.Contains(lower, "-acpi-") || strings.Contains(lower, "-mdio-") ||
			strings.Contains(lower, "-virtual-")

		if isChipLine {
			if strings.Contains(lower, "nct6798") {
				currentAdapter = "nct6798"
			} else if strings.Contains(lower, "coretemp") {
				currentAdapter = "coretemp"
			} else if strings.Contains(lower, "nvme") {
				currentAdapter = "nvme"
			} else if strings.Contains(lower, "acpitz") {
				currentAdapter = "acpitz"
			} else if strings.Contains(lower, "r8169") || strings.Contains(lower, "iwlwifi") {
				currentAdapter = "network"
			} else {
				currentAdapter = "other"
			}
			continue
		}

		// Skip "Adapter: ..." description lines
		if strings.HasPrefix(trimmed, "Adapter:") {
			continue
		}

		switch currentAdapter {
		case "coretemp":
			// CPU Package temp: "Package id 0:  +51.0°C ..."
			if strings.HasPrefix(trimmed, "Package id 0:") {
				if temp := parseTempValue(trimmed); temp > 0 {
					info.CPUPackage = temp
				}
			}
			// Per-core temps: "Core 0:  +45.0°C ..."
			if strings.HasPrefix(trimmed, "Core ") {
				if temp := parseTempValue(trimmed); temp > 0 {
					info.CPUCores = append(info.CPUCores, temp)
				}
			}

		case "nct6798":
			// Fan RPMs: "fan1:  1221 RPM  (min = 0 RPM)"
			if strings.Contains(trimmed, " RPM") {
				parts := strings.Fields(trimmed)
				if len(parts) >= 3 {
					name := strings.TrimSuffix(parts[0], ":")
					if rpm, err2 := strconv.Atoi(parts[1]); err2 == nil && rpm > 0 {
						info.Fans = append(info.Fans, models.FanInfo{Name: name, RPM: rpm})
					}
				}
			}

			// Board temps: "SYSTIN:  +32.0°C  (high = +80.0°C, ...)"
			colonIdx := strings.Index(trimmed, ":")
			if colonIdx > 0 {
				name := strings.TrimSpace(trimmed[:colonIdx])
				if boardSensorNames[name] {
					if temp := parseTempValue(trimmed); temp >= 10 && temp < 120 {
						sr := models.SensorReading{Name: name, Value: temp}
						sr.High = parseLimitValue(trimmed, "high")
						sr.Crit = parseLimitValue(trimmed, "crit")
						info.Board = append(info.Board, sr)
					}
				}
				// PECI Agent: line like "PECI Agent 0 Calibration:  +32.0°C ..."
				if strings.HasPrefix(name, "PECI Agent") {
					if temp := parseTempValue(trimmed); temp > 0 {
						sr := models.SensorReading{Name: "PECI Agent 0", Value: temp}
						sr.High = parseLimitValue(trimmed, "high")
						info.Board = append(info.Board, sr)
					}
				}
			}

			// Voltages: "in0:  1.34 V  ..." or "in1:  1000.00 mV ..."
			if strings.HasPrefix(trimmed, "in") {
				colonIdx2 := strings.Index(trimmed, ":")
				if colonIdx2 > 0 {
					name := strings.TrimSpace(trimmed[:colonIdx2])
					rest := strings.TrimSpace(trimmed[colonIdx2+1:])
					var volts float64
					if strings.Contains(rest, " mV") {
						// parse millivolts
						parts := strings.Fields(rest)
						if len(parts) >= 2 {
							if v, e := strconv.ParseFloat(parts[0], 64); e == nil {
								volts = v / 1000.0
							}
						}
					} else if strings.Contains(rest, " V") {
						parts := strings.Fields(rest)
						if len(parts) >= 2 {
							if v, e := strconv.ParseFloat(parts[0], 64); e == nil {
								volts = v
							}
						}
					}
					if volts >= 0.05 {
						info.Voltages = append(info.Voltages, models.SensorReading{
							Name:  name,
							Value: volts,
						})
					}
				}
			}

		case "nvme":
			// "Composite:  +39.9°C  (low = -273.1°C, high = +80.8°C)"
			// "Sensor 1:  +48.9°C  ..."
			// Skip if temp is -273 (no data sentinel)
			colonIdx := strings.Index(trimmed, ":")
			if colonIdx > 0 {
				name := strings.TrimSpace(trimmed[:colonIdx])
				if temp := parseTempValue(trimmed); temp > -270 && temp != 0 {
					sr := models.SensorReading{Name: name, Value: temp}
					sr.High = parseLimitValue(trimmed, "high")
					if sr.High > 200 {
						sr.High = 0 // sentinel value (65261.8°C = no limit set)
					}
					sr.Crit = parseLimitValue(trimmed, "crit")
					info.NVMe = append(info.NVMe, sr)
				}
			}
			// NVMe crit is sometimes on the NEXT line: "(crit = +84.8°C)"
			// Handle by appending to last NVMe entry if it starts with "("
			if strings.HasPrefix(trimmed, "(crit") && len(info.NVMe) > 0 {
				if crit := parseLimitValue(trimmed, "crit"); crit > 0 {
					info.NVMe[len(info.NVMe)-1].Crit = crit
				}
			}

		case "acpitz":
			// "temp1:  +27.8°C"
			if strings.HasPrefix(trimmed, "temp") {
				if temp := parseTempValue(trimmed); temp > 0 {
					info.ACPI = temp
				}
			}

		case "network":
			// "temp1:  +36.5°C  (high = +120.0°C)" — but only if it has a real value (not N/A)
			if strings.HasPrefix(trimmed, "temp") && !strings.Contains(trimmed, "N/A") {
				colonIdx := strings.Index(trimmed, ":")
				if colonIdx > 0 {
					name := strings.TrimSpace(trimmed[:colonIdx])
					if temp := parseTempValue(trimmed); temp > 0 {
						sr := models.SensorReading{Name: name, Value: temp}
						sr.High = parseLimitValue(trimmed, "high")
						info.Network = append(info.Network, sr)
					}
				}
			}
		}
	}

	return info
}

// parseLimitValue extracts a named limit like "high = +80.0°C" or "crit = +100.0°C" from a sensors line
func parseLimitValue(line, limitName string) float64 {
	needle := limitName + " = +"
	idx := strings.Index(line, needle)
	if idx < 0 {
		return 0
	}
	sub := line[idx+len(needle):]
	end := strings.IndexAny(sub, "°C ,)")
	if end < 0 {
		return 0
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(sub[:end]), 64)
	if err != nil {
		return 0
	}
	return v
}

// parseTempValue extracts temperature float from a sensors line like "+51.0°C"
func parseTempValue(line string) float64 {
	idx := strings.Index(line, "+")
	if idx < 0 {
		return 0
	}
	sub := line[idx+1:] // skip the +
	// Find degree sign or end markers
	end := strings.Index(sub, "°")
	if end < 0 {
		end = strings.IndexAny(sub, " 	(")
	}
	if end < 0 {
		return 0
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(sub[:end]), 64)
	if err != nil {
		return 0
	}
	return v
}

func (c *SSHCollector) Close() {
	for _, client := range c.clients {
		client.Close()
	}
}
