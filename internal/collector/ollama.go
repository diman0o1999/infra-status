package collector

import (
	"encoding/json"
	"net/http"
	"time"

	"infra-status/internal/models"
)

type OllamaStatusCollector struct {
	url    string
	client *http.Client
}

func NewOllamaStatusCollector(url string) *OllamaStatusCollector {
	return &OllamaStatusCollector{
		url:    url,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (o *OllamaStatusCollector) Collect() models.OllamaInfo {
	info := models.OllamaInfo{}

	resp, err := o.client.Get(o.url + "/api/tags")
	if err != nil {
		return info
	}
	defer resp.Body.Close()

	var result struct {
		Models []struct {
			Name    string `json:"name"`
			Size    int64  `json:"size"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return info
	}

	info.Online = true
	for _, m := range result.Models {
		info.Models = append(info.Models, models.OllamaModel{
			Name: m.Name,
			Size: m.Size,
		})
	}

	return info
}
