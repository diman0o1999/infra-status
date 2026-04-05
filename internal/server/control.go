package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
)

// ControlResponse is the envelope returned by start/stop/restart endpoints.
type ControlResponse struct {
	Success bool            `json:"success"`
	Results []ServiceResult `json:"results"`
	Error   string          `json:"error,omitempty"`
}

// ServiceResult holds the outcome of a single systemctl operation.
type ServiceResult struct {
	Service string `json:"service"`
	Action  string `json:"action"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
	Success bool   `json:"success"`
}

// LogsResponse is returned by the logs endpoint.
type LogsResponse struct {
	Service string   `json:"service"`
	Lines   []string `json:"lines"`
	Error   string   `json:"error,omitempty"`
}

// controlRequest is the expected POST body for mutating actions.
// The caller must set confirm:true to guard against accidental triggers.
type controlRequest struct {
	Confirm bool `json:"confirm"`
}

// handleProjectRoute dispatches /api/projects/{name}/{action} requests.
// It is registered on the prefix "/api/projects/" in server.go.
func (s *Server) handleProjectRoute(w http.ResponseWriter, r *http.Request) {
	s.setCORSHeaders(w, r)

	// Handle pre-flight OPTIONS for CORS.
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Path after the prefix: "{name}/{action}" or "{name}/logs"
	// Strip the "/api/projects/" prefix.
	suffix := strings.TrimPrefix(r.URL.Path, "/api/projects/")
	// suffix is now something like "Fabro/restart" or "Fabro/logs"
	suffix = strings.Trim(suffix, "/")

	parts := strings.SplitN(suffix, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": "path must be /api/projects/{name}/{start|stop|restart|logs}",
		})
		return
	}

	projectName := parts[0]
	action := parts[1]

	switch action {
	case "start", "stop", "restart":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
				"error": "use POST for " + action,
			})
			return
		}
		s.handleProjectAction(w, r, projectName, action)

	case "logs":
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
				"error": "use GET for logs",
			})
			return
		}
		s.handleProjectLogs(w, r, projectName)

	default:
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": "unknown action: " + action,
		})
	}
}

// handleProjectAction executes start, stop, or restart for all services of a project.
func (s *Server) handleProjectAction(w http.ResponseWriter, r *http.Request, projectName, action string) {
	// Enforce confirmation to prevent accidental state changes.
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	var req controlRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || !req.Confirm {
		writeJSON(w, http.StatusBadRequest, ControlResponse{
			Error: `set "confirm": true in the request body to confirm this action`,
		})
		return
	}

	hostName, systemSvcs, userSvcs, found := s.collector.FindProject(projectName)
	if !found {
		writeJSON(w, http.StatusNotFound, ControlResponse{
			Error: "project not found: " + projectName,
		})
		return
	}

	if len(systemSvcs)+len(userSvcs) == 0 {
		writeJSON(w, http.StatusUnprocessableEntity, ControlResponse{
			Error: "project has no services configured",
		})
		return
	}

	type serviceSpec struct {
		name  string
		level string
	}

	specs := make([]serviceSpec, 0, len(systemSvcs)+len(userSvcs))
	for _, svc := range systemSvcs {
		specs = append(specs, serviceSpec{svc, "system"})
	}
	for _, svc := range userSvcs {
		specs = append(specs, serviceSpec{svc, "user"})
	}

	results := make([]ServiceResult, 0, len(specs))
	allOK := true

	for _, spec := range specs {
		out, err := s.collector.RunServiceAction(hostName, spec.name, spec.level, action)
		res := ServiceResult{
			Service: spec.name,
			Action:  action,
			Output:  out,
			Success: err == nil,
		}
		if err != nil {
			res.Error = err.Error()
			allOK = false
			slog.Warn("service action failed",
				"project", projectName,
				"service", spec.name,
				"action", action,
				"error", err,
			)
		} else {
			slog.Info("service action executed",
				"project", projectName,
				"service", spec.name,
				"action", action,
			)
		}
		results = append(results, res)
	}

	status := http.StatusOK
	if !allOK {
		status = http.StatusMultiStatus // 207 — partial success
	}
	writeJSON(w, status, ControlResponse{
		Success: allOK,
		Results: results,
	})
}

// handleProjectLogs fetches journalctl lines for a specific service of a project.
// Query params:
//
//	service — the systemd service name (required)
//	lines   — number of log lines to fetch (default 50, max 500)
func (s *Server) handleProjectLogs(w http.ResponseWriter, r *http.Request, projectName string) {
	serviceName := strings.TrimSpace(r.URL.Query().Get("service"))
	if serviceName == "" {
		writeJSON(w, http.StatusBadRequest, LogsResponse{
			Error: `query param "service" is required`,
		})
		return
	}

	lines := 50
	if raw := r.URL.Query().Get("lines"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			lines = v
		}
	}

	hostName, systemSvcs, userSvcs, found := s.collector.FindProject(projectName)
	if !found {
		writeJSON(w, http.StatusNotFound, LogsResponse{
			Service: serviceName,
			Error:   "project not found: " + projectName,
		})
		return
	}

	// Determine service level by checking which list it belongs to.
	level := serviceLevel(serviceName, systemSvcs, userSvcs)
	if level == "" {
		writeJSON(w, http.StatusNotFound, LogsResponse{
			Service: serviceName,
			Error:   "service " + serviceName + " is not configured for project " + projectName,
		})
		return
	}

	logLines, err := s.collector.GetServiceLogs(hostName, serviceName, level, lines)
	if err != nil {
		slog.Warn("get service logs failed",
			"project", projectName,
			"service", serviceName,
			"error", err,
		)
		writeJSON(w, http.StatusInternalServerError, LogsResponse{
			Service: serviceName,
			Error:   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, LogsResponse{
		Service: serviceName,
		Lines:   logLines,
	})
}

// serviceLevel returns "system", "user", or "" if the service is not found.
func serviceLevel(name string, system, user []string) string {
	for _, s := range system {
		if s == name {
			return "system"
		}
	}
	for _, s := range user {
		if s == name {
			return "user"
		}
	}
	return ""
}
