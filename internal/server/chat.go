package server

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"infra-status/internal/models"
)

const systemPrompt = `Ты ИИ-ассистент по мониторингу инфраструктуры core-stack.ru.
Отвечай кратко и по делу, на русском языке.
Ниже — актуальное состояние серверов и сервисов на момент вопроса.
`

const maxChatBodyBytes = 4096 // 4 KB — sufficient for any reasonable message

func buildInfraContext(state models.Dashboard) string {
	var sb strings.Builder
	sb.WriteString("\n=== СОСТОЯНИЕ ИНФРАСТРУКТУРЫ ===\n")

	sb.WriteString("\nХОСТЫ:\n")
	for _, h := range state.Hosts {
		status := "online"
		if !h.Online {
			status = "OFFLINE"
		}
		fmt.Fprintf(&sb, "- %s: %s | CPU %.0f%% | RAM %.0f%% | Disk %.0f%%\n",
			h.Name, status, h.CPU, h.RAM.Percent, h.Disk.Percent)
	}

	sb.WriteString("\nПРОЕКТЫ:\n")
	for _, p := range state.Projects {
		fmt.Fprintf(&sb, "- %s: %s | web=%v api=%v | RAM %d MB\n",
			p.Name, p.Status, p.WebUp, p.ApiUp, p.MemoryTotal/1024/1024)
		for _, svc := range p.Services {
			if !svc.Active {
				fmt.Fprintf(&sb, "  ! %s: %s\n", svc.Name, svc.State)
			}
		}
	}

	sb.WriteString("\nИНФРАСТРУКТУРА:\n")
	for _, i := range state.Infrastructure {
		mark := "✓"
		if !i.Active {
			mark = "✗"
		}
		fmt.Fprintf(&sb, "- %s %s: %s\n", mark, i.Name, i.State)
	}

	down := 0
	for _, d := range state.Domains {
		if !d.Reachable {
			down++
		}
	}
	fmt.Fprintf(&sb, "\nДОМЕНЫ: всего %d, недоступных %d\n", len(state.Domains), down)

	return sb.String()
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !s.ollamaOn {
		http.Error(w, `{"error":"ollama disabled"}`, http.StatusServiceUnavailable)
		return
	}

	// Enforce a request body size limit to prevent abuse
	r.Body = http.MaxBytesReader(w, r.Body, maxChatBodyBytes)

	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	state := s.collector.State()
	context := buildInfraContext(state)

	payload := map[string]interface{}{
		"model": s.ollamaModel,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt + context},
			{"role": "user", "content": req.Message},
		},
		"stream": true,
		"think":  false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		slog.Error("failed to marshal ollama payload", "error", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, s.ollamaURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		slog.Error("failed to build ollama request", "error", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		slog.Warn("ollama request failed", "error", err)
		http.Error(w, `{"error":"ollama unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	s.setCORSHeaders(w, r)

	type ollamaChunk struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		Done bool `json:"done"`
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var chunk ollamaChunk
		if err := json.Unmarshal(line, &chunk); err != nil {
			continue
		}
		if chunk.Message.Content != "" {
			token, err := json.Marshal(chunk.Message.Content)
			if err != nil {
				slog.Error("failed to marshal chat token", "error", err)
				continue
			}
			if _, err := fmt.Fprintf(w, "data: %s\n\n", token); err != nil {
				return
			}
			flusher.Flush()
		}
		if chunk.Done {
			if _, err := fmt.Fprintf(w, "data: [DONE]\n\n"); err != nil {
				return
			}
			flusher.Flush()
			break
		}
	}
	if err := scanner.Err(); err != nil {
		slog.Warn("ollama scanner error", "error", err)
	}
}
