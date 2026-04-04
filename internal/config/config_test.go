package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// writeTemp creates a temporary YAML file with the given content and returns its path.
func writeTemp(t *testing.T, content string) string {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "config-*.yaml")
	if err != nil {
		t.Fatalf("create temp file: %v", err)
	}
	if _, err := f.WriteString(content); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	f.Close()
	return f.Name()
}

// TestLoad_ValidConfig verifies that a well-formed config file is parsed correctly.
func TestLoad_ValidConfig(t *testing.T) {
	yaml := `
server:
  port: 9090
  refresh_interval: 30s
  env: prod
  allowed_origins:
    - "https://example.com"

hosts:
  - name: web01
    host: 10.0.0.1
    ssh_user: ubuntu
    ssh_key: ~/.ssh/id_rsa
    type: vm
    thresholds:
      cpu_warn: 70
      cpu_crit: 90
      ram_warn: 80
      ram_crit: 95
      disk_warn: 80
      disk_crit: 95

ollama:
  enabled: false
  url: ""
  model: ""
`
	path := writeTemp(t, yaml)
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Server.Port != 9090 {
		t.Errorf("port: want 9090, got %d", cfg.Server.Port)
	}
	if cfg.Server.Env != "prod" {
		t.Errorf("env: want prod, got %q", cfg.Server.Env)
	}
	if cfg.Server.RefreshInterval != 30*time.Second {
		t.Errorf("refresh_interval: want 30s, got %v", cfg.Server.RefreshInterval)
	}
	if len(cfg.Server.AllowedOrigins) != 1 || cfg.Server.AllowedOrigins[0] != "https://example.com" {
		t.Errorf("allowed_origins: unexpected value %v", cfg.Server.AllowedOrigins)
	}
	if len(cfg.Hosts) != 1 || cfg.Hosts[0].Name != "web01" {
		t.Errorf("hosts: unexpected value %v", cfg.Hosts)
	}
}

// TestLoad_DefaultPort verifies that an omitted port defaults to 3301.
func TestLoad_DefaultPort(t *testing.T) {
	yaml := `
server:
  env: dev
`
	path := writeTemp(t, yaml)
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Server.Port != 3301 {
		t.Errorf("default port: want 3301, got %d", cfg.Server.Port)
	}
	if cfg.Server.RefreshInterval != 10*time.Second {
		t.Errorf("default refresh_interval: want 10s, got %v", cfg.Server.RefreshInterval)
	}
}

// TestLoad_MissingFile verifies that a non-existent path returns an error.
func TestLoad_MissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "does-not-exist.yaml")
	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}

// TestLoad_InvalidYAML verifies that malformed YAML returns a parse error.
func TestLoad_InvalidYAML(t *testing.T) {
	path := writeTemp(t, "server: [unclosed")
	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for invalid YAML, got nil")
	}
}

// TestLoad_EmptyFile verifies that an empty file loads without error and uses defaults.
func TestLoad_EmptyFile(t *testing.T) {
	path := writeTemp(t, "")
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error for empty file: %v", err)
	}
	if cfg.Server.Port != 3301 {
		t.Errorf("empty file default port: want 3301, got %d", cfg.Server.Port)
	}
}
