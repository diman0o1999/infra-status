package main

import (
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

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
	defer col.Stop()

	srv := server.New(cfg, col)

	// Wire SSE broadcasts
	col.OnChange(func(d models.Dashboard) {
		srv.Broadcast(d)
	})

	col.Start()

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		slog.Info("shutting down", "signal", sig.String())
		col.Stop()
		os.Exit(0)
	}()

	if err := srv.Start(); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}
