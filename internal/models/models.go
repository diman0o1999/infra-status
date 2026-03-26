package models

import "time"

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
	WebURL      string          `json:"web_url"`
	ApiURL      string          `json:"api_url"`
	WebUp       bool            `json:"web_up"`
	ApiUp       bool            `json:"api_up"`
	WebStatus   int             `json:"web_status"`
	ApiStatus   int             `json:"api_status"`
	Services    []ServiceStatus `json:"services"`
	MemoryTotal uint64          `json:"memory_total"` // sum of all services RAM
	Status      string          `json:"status"`       // ok, degraded, down
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
	Description string `json:"description"`
	Reachable   bool   `json:"reachable"`
}

// Dashboard is the full state sent via SSE
type Dashboard struct {
	Hosts          []HostMetrics   `json:"hosts"`
	Projects       []ProjectStatus `json:"projects"`
	Infrastructure []InfraService  `json:"infrastructure"`
	Domains        []DomainInfo    `json:"domains"`
	UpdatedAt      time.Time       `json:"updated_at"`
	Alive          bool            `json:"alive"`
}
