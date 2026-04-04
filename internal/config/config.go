package config

import (
	"os"
	"time"

	"gopkg.in/yaml.v3"
)


type Account struct {
	Email    string `yaml:"email"`
	Password string `yaml:"password"`
	Role     string `yaml:"role"`
	Note     string `yaml:"note"`
}
type Config struct {
	Server         ServerConfig      `yaml:"server"`
	Hosts          []HostConfig      `yaml:"hosts"`
	Projects       []ProjectConfig   `yaml:"projects"`
	Infrastructure []InfraConfig     `yaml:"infrastructure"`
	Domains        DomainsConfig     `yaml:"domains"`
	Kuma           KumaConfig        `yaml:"kuma"`
	Ollama         OllamaConfig      `yaml:"ollama"`
	GPU            GPUConfig         `yaml:"gpu"`
}

type OllamaConfig struct {
	Enabled bool   `yaml:"enabled"`
	URL     string `yaml:"url"`
	Model   string `yaml:"model"`
}

type KumaConfig struct {
	Enabled bool   `yaml:"enabled"`
	URL     string `yaml:"url"`
	Slug    string `yaml:"slug"`
}

type ServerConfig struct {
	Port            int           `yaml:"port"`
	RefreshInterval time.Duration `yaml:"refresh_interval"`
	Env             string        `yaml:"env"` // "dev" or "prod"
	AllowedOrigins  []string      `yaml:"allowed_origins"`
}

type HostConfig struct {
	Name       string          `yaml:"name"`
	Host       string          `yaml:"host"`
	SSHUser    string          `yaml:"ssh_user"`
	SSHKey     string          `yaml:"ssh_key"`
	Type       string          `yaml:"type"`
	Thresholds ThresholdConfig `yaml:"thresholds"`
}

type ThresholdConfig struct {
	CPUWarn  float64 `yaml:"cpu_warn"`
	CPUCrit  float64 `yaml:"cpu_crit"`
	RAMWarn  float64 `yaml:"ram_warn"`
	RAMCrit  float64 `yaml:"ram_crit"`
	DiskWarn float64 `yaml:"disk_warn"`
	DiskCrit float64 `yaml:"disk_crit"`
}

type ProjectConfig struct {
	Name        string          `yaml:"name"`
	Icon        string          `yaml:"icon"`
	Description string          `yaml:"description"`
	Purpose     string          `yaml:"purpose"`
	Login       string          `yaml:"login"`
	Password    string          `yaml:"password"`
	URLs        ProjectURLs     `yaml:"urls"`
	LocalURLs   ProjectURLs     `yaml:"local_urls"`
	Services    ProjectServices `yaml:"services"`
	Host        string          `yaml:"host"`
	Accounts    []Account       `yaml:"accounts"`
}

type ProjectURLs struct {
	Web string `yaml:"web"`
	API string `yaml:"api"`
}

type ProjectServices struct {
	System []string `yaml:"system"`
	User   []string `yaml:"user"`
}

type InfraConfig struct {
	Name     string `yaml:"name"`
	Service  string `yaml:"service"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Level    string `yaml:"level"`
	Optional bool   `yaml:"optional"`
}

type DomainsConfig struct {
	Base       string             `yaml:"base"`
	IP         string             `yaml:"ip"`
	Subdomains []SubdomainConfig  `yaml:"subdomains"`
	Custom     []CustomDomain     `yaml:"custom"`
}

type SubdomainConfig struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Login       string `yaml:"login"`
	Password    string `yaml:"password"`
}

type CustomDomain struct {
	Name        string `yaml:"name"`
	FQDN        string `yaml:"fqdn"`
	URL         string `yaml:"url"`
	Description string `yaml:"description"`
	Local       bool   `yaml:"local"`
	Login       string `yaml:"login"`
	Password    string `yaml:"password"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	if cfg.Server.Port == 0 {
		cfg.Server.Port = 3301
	}
	if cfg.Server.RefreshInterval == 0 {
		cfg.Server.RefreshInterval = 10 * time.Second
	}

	return &cfg, nil
}

type GPUConfig struct {
	Enabled bool   `yaml:"enabled"`
	Host    string `yaml:"host"` // имя хоста из hosts list
}
