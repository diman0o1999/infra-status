package server

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"infra-status/internal/collector"
	"infra-status/internal/config"
	"infra-status/internal/models"
)

//go:embed all:web
var webFS embed.FS

type Server struct {
	port           int
	allowedOrigins []string
	collector      *collector.Collector
	clients        map[chan models.Dashboard]struct{}
	mu             sync.Mutex
	ollamaURL      string
	ollamaModel    string
	ollamaOn       bool
	httpClient     *http.Client
}

func New(cfg *config.Config, col *collector.Collector) *Server {
	transport := &http.Transport{
		MaxIdleConns:        4,
		MaxIdleConnsPerHost: 4,
		IdleConnTimeout:     120 * time.Second,
		DisableCompression:  true, // streaming — do not compress
	}

	origins := cfg.Server.AllowedOrigins
	if len(origins) == 0 {
		origins = []string{"*"} // safe default for local dev
	}

	return &Server{
		port:           cfg.Server.Port,
		allowedOrigins: origins,
		collector:      col,
		clients:        make(map[chan models.Dashboard]struct{}),
		ollamaURL:      cfg.Ollama.URL,
		ollamaModel:    cfg.Ollama.Model,
		ollamaOn:       cfg.Ollama.Enabled,
		httpClient:     &http.Client{Transport: transport, Timeout: 0}, // 0 = no timeout for streaming
	}
}

// writeJSON serialises v as JSON with the given status code.
// Any encoding error is logged — the response headers are already sent at that point.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to write JSON response", "error", err)
	}
}

// setCORSHeaders sets Access-Control-Allow-Origin when the request origin matches
// the configured allowlist. A wildcard entry "*" permits every origin.
func (s *Server) setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	for _, allowed := range s.allowedOrigins {
		if allowed == "*" || allowed == origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			break
		}
	}
}

func (s *Server) Broadcast(d models.Dashboard) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.clients {
		select {
		case ch <- d:
		default:
			// slow client — skip rather than block
		}
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// SSE endpoint
	mux.HandleFunc("/sse", s.handleSSE)

	// API endpoint (one-shot JSON snapshot)
	mux.HandleFunc("/api/status", s.handleAPI)

	// Config hot-reload
	mux.HandleFunc("/api/reload", s.handleReload)

	// Service control: start / stop / restart / logs
	// Registered as a prefix so /api/projects/{name}/{action} is routed here.
	mux.HandleFunc("/api/projects/", s.handleProjectRoute)

	// AI Chat (RAG over infra state)
	mux.HandleFunc("/api/chat", s.handleChat)

	// Static files (embedded)
	webContent, err := fs.Sub(webFS, "web")
	if err != nil {
		return fmt.Errorf("embed web: %w", err)
	}
	mux.Handle("/", http.FileServer(http.FS(webContent)))

	addr := fmt.Sprintf(":%d", s.port)
	slog.Info("server starting", "addr", addr)
	return http.ListenAndServe(addr, mux)
}

func (s *Server) handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	s.setCORSHeaders(w, r)

	ch := make(chan models.Dashboard, 1)
	s.mu.Lock()
	s.clients[ch] = struct{}{}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.clients, ch)
		s.mu.Unlock()
		close(ch)
	}()

	// Send current state immediately on connect
	state := s.collector.State()
	data, err := json.Marshal(state)
	if err != nil {
		slog.Error("failed to marshal initial SSE state", "error", err)
		return
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
		return
	}
	flusher.Flush()

	// Stream subsequent updates
	for {
		select {
		case d := <-ch:
			data, err := json.Marshal(d)
			if err != nil {
				slog.Error("failed to marshal SSE update", "error", err)
				continue
			}
			if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
				return
			}
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	s.setCORSHeaders(w, r)
	state := s.collector.State()
	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handleReload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.setCORSHeaders(w, r)
	if err := s.collector.Reload(); err != nil {
		slog.Error("config reload failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	slog.Info("config reloaded via API")
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
