package collector

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// KumaCollector fetches monitor data from Uptime Kuma public status page API
type KumaCollector struct {
	baseURL string
	slug    string
	client  *http.Client
}

type KumaStatusPage struct {
	Config         json.RawMessage    `json:"config"`
	PublicGroupList []KumaGroup       `json:"publicGroupList"`
}

type KumaGroup struct {
	Name        string        `json:"name"`
	MonitorList []KumaMonitor `json:"monitorList"`
}

type KumaMonitor struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	SendURL int    `json:"sendUrl"`
}

type KumaHeartbeatResponse struct {
	HeartbeatList map[string][]KumaHeartbeat `json:"heartbeatList"`
	UptimeList    map[string]float64         `json:"uptimeList"`
}

type KumaHeartbeat struct {
	Status int      `json:"status"` // 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE
	Time   string   `json:"time"`
	Ping   *float64 `json:"ping"`
	Msg    string   `json:"msg"`
}

// KumaMonitorStatus is what we expose to the dashboard
type KumaMonitorStatus struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	Type   string  `json:"type"`
	Group  string  `json:"group"`
	Up     bool    `json:"up"`
	Status int     `json:"status"` // 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE
	Ping   int     `json:"ping"`
	Uptime float64 `json:"uptime"` // 24h uptime percentage
	Msg    string  `json:"msg"`
}

func NewKumaCollector(baseURL, slug string) *KumaCollector {
	return &KumaCollector{
		baseURL: baseURL,
		slug:    slug,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (k *KumaCollector) Collect() ([]KumaMonitorStatus, error) {
	// Fetch status page config (monitor names + groups)
	pageURL := fmt.Sprintf("%s/api/status-page/%s", k.baseURL, k.slug)
	pageData, err := k.fetch(pageURL)
	if err != nil {
		return nil, fmt.Errorf("fetch status page: %w", err)
	}

	var page KumaStatusPage
	if err := json.Unmarshal(pageData, &page); err != nil {
		return nil, fmt.Errorf("parse status page: %w", err)
	}

	// Fetch heartbeat data
	hbURL := fmt.Sprintf("%s/api/status-page/heartbeat/%s", k.baseURL, k.slug)
	hbData, err := k.fetch(hbURL)
	if err != nil {
		return nil, fmt.Errorf("fetch heartbeat: %w", err)
	}

	var hb KumaHeartbeatResponse
	if err := json.Unmarshal(hbData, &hb); err != nil {
		return nil, fmt.Errorf("parse heartbeat: %w", err)
	}

	// Merge data
	var results []KumaMonitorStatus
	for _, group := range page.PublicGroupList {
		for _, mon := range group.MonitorList {
			ms := KumaMonitorStatus{
				ID:    mon.ID,
				Name:  mon.Name,
				Type:  mon.Type,
				Group: group.Name,
			}

			// Get latest heartbeat
			key := fmt.Sprintf("%d", mon.ID)
			if beats, ok := hb.HeartbeatList[key]; ok && len(beats) > 0 {
				last := beats[len(beats)-1]
				ms.Status = last.Status
				ms.Up = last.Status == 1
				ms.Msg = last.Msg
				if last.Ping != nil {
					ms.Ping = int(*last.Ping)
				}
			}

			// Get 24h uptime
			uptimeKey := fmt.Sprintf("%d_24", mon.ID)
			if up, ok := hb.UptimeList[uptimeKey]; ok {
				ms.Uptime = up * 100 // convert to percentage
			}

			results = append(results, ms)
		}
	}

	return results, nil
}

const maxKumaResponseBytes = 2 * 1024 * 1024 // 2 MB

func (k *KumaCollector) fetch(url string) ([]byte, error) {
	resp, err := k.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	return io.ReadAll(io.LimitReader(resp.Body, maxKumaResponseBytes))
}
