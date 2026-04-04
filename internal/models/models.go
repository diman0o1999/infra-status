package models

import "time"


type ThermalInfo struct {
	CPUPackage float64   `json:"cpu_package"`
	CPUCores   []float64 `json:"cpu_cores,omitempty"`
	Fans       []FanInfo `json:"fans,omitempty"`
}

type FanInfo struct {
	Name string `json:"name"`
	RPM  int    `json:"rpm"`
}

type SwapInfo struct {
	Total   uint64  `json:"total"`
	Used    uint64  `json:"used"`
	Percent float64 `json:"percent"`
}

// HostMetrics holds system-level metrics collected via SSH
type HostMetrics struct {
	Name       string  `json:"name"`
	Host       string  `json:"host"`
	Type       string  `json:"type"`
	Online     bool    `json:"online"`
	CPU        float64 `json:"cpu"`
	RAM        RAMInfo `json:"ram"`
	Disk       DiskInfo `json:"disk"`
	Load       string  `json:"load"`
	Uptime     string  `json:"uptime"`
	Thermal    ThermalInfo `json:"thermal"`
	Swap       SwapInfo    `json:"swap"`
	Procs      int         `json:"procs"`
	Status     string  `json:"status"` // ok, warn, crit, offline
	CollectedAt time.Time `json:"collected_at"`
}

type RAMInfo struct {
	Total   uint64  `json:"total"`
	Used    uint64  `json:"used"`
	Percent float64 `json:"percent"`
}

type DiskInfo struct {
	Total   uint64  `json:"total"`
	Used    uint64  `json:"used"`
	Percent float64 `json:"percent"`
}

// ServiceStatus holds the status of a systemd service
type ServiceStatus struct {
	Name   string `json:"name"`
	Active bool   `json:"active"`
	State  string `json:"state"` // active, inactive, failed
	Host   string `json:"host"`
	Level  string `json:"level"` // system, user
	Memory uint64 `json:"memory"` // bytes (MemoryCurrent from systemd)
}

// ProjectStatus holds the combined status of a project
type ProjectStatus struct {
	Name        string          `json:"name"`
	Icon        string          `json:"icon"`
	Description string          `json:"description"`
	Purpose     string          `json:"purpose"`
	Login       string          `json:"login,omitempty"`
	Password    string          `json:"password,omitempty"`
	WebURL      string          `json:"web_url"`
	ApiURL      string          `json:"api_url"`
	LocalWeb    string          `json:"local_web,omitempty"`
	LocalAPI    string          `json:"local_api,omitempty"`
	WebUp       bool            `json:"web_up"`
	ApiUp       bool            `json:"api_up"`
	WebStatus   int             `json:"web_status"`
	ApiStatus   int             `json:"api_status"`
	Services    []ServiceStatus `json:"services"`
	MemoryTotal uint64          `json:"memory_total"`
	Status      string          `json:"status"`
	Accounts    []Account       `json:"accounts,omitempty"`
}

// InfraService holds status of an infrastructure service
type InfraService struct {
	Name     string `json:"name"`
	Service  string `json:"service"`
	Port     int    `json:"port,omitempty"`
	Active   bool   `json:"active"`
	State    string `json:"state"`
	Optional bool   `json:"optional"`
	Memory   uint64 `json:"memory"` // bytes
}

// DomainInfo holds DNS subdomain info
type DomainInfo struct {
	Name        string `json:"name"`
	FQDN        string `json:"fqdn"`
	URL         string `json:"url,omitempty"`
	Description string `json:"description"`
	Reachable   bool   `json:"reachable"`
	Host        string `json:"host,omitempty"`
	Local       bool   `json:"local,omitempty"`
	Login       string `json:"login,omitempty"`
	Password    string `json:"password,omitempty"`
}

// KumaMonitor holds Uptime Kuma monitor data
type KumaMonitor struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	Type   string  `json:"type"`
	Group  string  `json:"group"`
	Up     bool    `json:"up"`
	Status int     `json:"status"`
	Ping   int     `json:"ping"`
	Uptime float64 `json:"uptime"`
	Msg    string  `json:"msg"`
}

// Dashboard is the full state sent via SSE
type Dashboard struct {
	Hosts          []HostMetrics   `json:"hosts"`
	Projects       []ProjectStatus `json:"projects"`
	Infrastructure []InfraService  `json:"infrastructure"`
	Domains        []DomainInfo    `json:"domains"`
	Kuma           []KumaMonitor   `json:"kuma"`
	UpdatedAt      time.Time       `json:"updated_at"`
	Alive          bool            `json:"alive"`
	Env            string          `json:"env"` // "dev" or "prod"
	Ollama         OllamaInfo      `json:"ollama"`
	GPU            GPUInfo         `json:"gpu"`
}


type Account struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
	Note     string `json:"note"`
}
// OllamaModel — одна модель Ollama
type OllamaModel struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

// OllamaInfo — статус Ollama
type OllamaInfo struct {
	Online bool          `json:"online"`
	Models []OllamaModel `json:"models"`
}

// GPUInfo — GPU метрики (nvidia-smi)
type GPUInfo struct {
	Online      bool   `json:"online"`
	Name        string `json:"name"`
	TempC       int    `json:"temp_c"`
	UtilPct     int    `json:"util_pct"`
	VRAMUsedMB  int    `json:"vram_used_mb"`
	VRAMTotalMB int    `json:"vram_total_mb"`
	Host        string `json:"host"`
}
