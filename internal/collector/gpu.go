package collector

import (
	"strconv"
	"strings"

	"infra-status/internal/config"
	"infra-status/internal/models"
)

// CollectGPU queries nvidia-smi on the specified host via SSH
func (c *SSHCollector) CollectGPU(hostName string) models.GPUInfo {
	info := models.GPUInfo{Host: hostName}

	var host config.HostConfig
	for _, h := range c.hosts {
		if h.Name == hostName {
			host = h
			break
		}
	}
	if host.Host == "" {
		return info
	}

	client, err := c.getClient(host)
	if err != nil {
		return info
	}

	out, err := c.runCommand(client,
		"nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null",
	)
	if err != nil || strings.TrimSpace(out) == "" {
		return info
	}

	parts := strings.Split(out, ",")
	if len(parts) < 5 {
		return info
	}

	info.Online = true
	info.Name = strings.TrimSpace(parts[0])
	info.TempC, _ = strconv.Atoi(strings.TrimSpace(parts[1]))
	info.UtilPct, _ = strconv.Atoi(strings.TrimSpace(parts[2]))
	info.VRAMUsedMB, _ = strconv.Atoi(strings.TrimSpace(parts[3]))
	info.VRAMTotalMB, _ = strconv.Atoi(strings.TrimSpace(parts[4]))

	return info
}
