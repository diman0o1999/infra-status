package collector

import (
	"fmt"
	"strings"

	"infra-status/internal/config"
)

// RunServiceAction executes a systemctl action (start|stop|restart) for a single
// service on the named host via SSH. level must be "system" or "user".
// Returns the combined stdout+stderr output from the remote command.
func (c *SSHCollector) RunServiceAction(hostName, service, level, action string) (string, error) {
	host, ok := c.findHost(hostName)
	if !ok {
		return "", fmt.Errorf("host %q not found in config", hostName)
	}

	client, err := c.getClient(host)
	if err != nil {
		return "", fmt.Errorf("ssh connect to %s: %w", hostName, err)
	}

	cmd := systemctlCmd(level, action, service)
	out, err := c.runCommand(client, cmd)
	if err != nil {
		// runCommand returns (output, err); include the remote output in the error
		// message so callers can surface the actual failure reason.
		if strings.TrimSpace(out) != "" {
			return out, fmt.Errorf("systemctl %s %s on %s: %s", action, service, hostName, strings.TrimSpace(out))
		}
		return "", fmt.Errorf("systemctl %s %s on %s: %w", action, service, hostName, err)
	}
	return out, nil
}

// GetServiceLogs fetches the last n lines from journalctl for a service via SSH.
// For user-level services it uses --user --user-unit; for system-level it uses -u.
// Returns output split into individual lines.
func (c *SSHCollector) GetServiceLogs(hostName, service, level string, lines int) ([]string, error) {
	host, ok := c.findHost(hostName)
	if !ok {
		return nil, fmt.Errorf("host %q not found in config", hostName)
	}

	client, err := c.getClient(host)
	if err != nil {
		return nil, fmt.Errorf("ssh connect to %s: %w", hostName, err)
	}

	if lines <= 0 {
		lines = 50
	}
	if lines > 500 {
		lines = 500
	}

	var unitFlag string
	if level == "user" {
		unitFlag = fmt.Sprintf("--user --user-unit %s", service)
	} else {
		unitFlag = fmt.Sprintf("-u %s", service)
	}

	// 2>&1 ensures stderr (e.g. "No entries") is included in the output.
	cmd := fmt.Sprintf("journalctl %s --no-pager -n %d --output=short-iso 2>&1", unitFlag, lines)
	out, err := c.runCommand(client, cmd)
	if err != nil && strings.TrimSpace(out) == "" {
		return nil, fmt.Errorf("journalctl for %s on %s: %w", service, hostName, err)
	}

	var result []string
	for _, line := range strings.Split(out, "\n") {
		if line != "" {
			result = append(result, line)
		}
	}
	return result, nil
}

// findHost returns the HostConfig for the given name. The second return value
// indicates whether the host was found.
func (c *SSHCollector) findHost(name string) (config.HostConfig, bool) {
	for _, h := range c.hosts {
		if h.Name == name {
			return h, true
		}
	}
	return config.HostConfig{}, false
}

// systemctlCmd builds the correct systemctl invocation for the given level.
// System-level services require sudo because the SSH session runs as a
// non-root user. User-level services use --user and never need sudo.
func systemctlCmd(level, action, service string) string {
	if level == "user" {
		return fmt.Sprintf("systemctl --user %s %s", action, service)
	}
	return fmt.Sprintf("sudo systemctl %s %s", action, service)
}
