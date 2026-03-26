package server

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"sync"

	"infra-status/internal/collector"
	"infra-status/internal/models"
)

//go:embed all:web
var webFS embed.FS

type Server struct {
	port      int
	collector *collector.Collector
	clients   map[chan models.Dashboard]struct{}
	mu        sync.Mutex
}

func New(port int, col *collector.Collector) *Server {
	return &Server{
		port:      port,
		collector: col,
		clients:   make(map[chan models.Dashboard]struct{}),
	}
}

func (s *Server) Broadcast(d models.Dashboard) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.clients {
		select {
		case ch <- d:
		default:
			// slow client, skip
		}
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	// SSE endpoint
	mux.HandleFunc("/sse", s.handleSSE)

	// API endpoint (one-shot JSON)
	mux.HandleFunc("/api/status", s.handleAPI)

	// Static files (embedded)
	webContent, err := fs.Sub(webFS, "web")
	if err != nil {
		return fmt.Errorf("embed web: %w", err)
	}
	mux.Handle("/", http.FileServer(http.FS(webContent)))

	addr := fmt.Sprintf(":%d", s.port)
	log.Printf("Server starting on %s", addr)
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
	w.Header().Set("Access-Control-Allow-Origin", "*")

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

	// Send current state immediately
	state := s.collector.State()
	data, _ := json.Marshal(state)
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()

	// Stream updates
	for {
		select {
		case d := <-ch:
			data, _ := json.Marshal(d)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	state := s.collector.State()
	json.NewEncoder(w).Encode(state)
}
