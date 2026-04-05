package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"infra-status/internal/collector"
	"infra-status/internal/config"
	"infra-status/internal/models"
	"infra-status/internal/server"
)

func main() {
	// Structured JSON logging for production — parseable by Loki, Grafana, etc.
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	configPath := flag.String("config", "config.yaml", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	slog.Info("config loaded",
		"hosts", len(cfg.Hosts),
		"projects", len(cfg.Projects),
		"infra_services", len(cfg.Infrastructure),
		"domains", len(cfg.Domains.Subdomains),
	)

	col := collector.New(cfg, *configPath)
	srv := server.New(cfg, col)

	// Wire SSE broadcasts
	col.OnChange(func(d models.Dashboard) {
		srv.Broadcast(d)
	})

	col.Start()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		slog.Info("shutting down", "signal", sig.String())

		// Give active connections 5 seconds to drain
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			slog.Error("server shutdown error", "error", err)
		}
		col.Stop()
	}()

	if err := srv.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
