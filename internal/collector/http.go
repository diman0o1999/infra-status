package collector

import (
	"crypto/tls"
	"net/http"
	"time"
)

type HTTPChecker struct {
	client *http.Client
}

func NewHTTPChecker() *HTTPChecker {
	return &HTTPChecker{
		client: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

type HealthResult struct {
	URL    string `json:"url"`
	Up     bool   `json:"up"`
	Status int    `json:"status"`
	Latency time.Duration `json:"latency"`
}

func (h *HTTPChecker) Check(url string) HealthResult {
	r := HealthResult{URL: url}
	if url == "" {
		return r
	}

	start := time.Now()
	resp, err := h.client.Get(url)
	r.Latency = time.Since(start)

	if err != nil {
		return r
	}
	defer resp.Body.Close()

	r.Status = resp.StatusCode
	r.Up = resp.StatusCode >= 200 && resp.StatusCode < 500
	return r
}
