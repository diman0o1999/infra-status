package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"infra-status/internal/collector"
	"infra-status/internal/config"
	"infra-status/internal/models"
	"infra-status/internal/server"
)

func main() {
	configPath := flag.String("config", "config.yaml", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Loaded config: %d hosts, %d projects, %d infra services, %d domains",
		len(cfg.Hosts), len(cfg.Projects), len(cfg.Infrastructure), len(cfg.Domains.Subdomains))

	col := collector.New(cfg)
	defer col.Stop()

	srv := server.New(cfg.Server.Port, col)

	// Wire SSE broadcasts
	col.OnChange(func(d models.Dashboard) {
		srv.Broadcast(d)
	})

	col.Start()

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		col.Stop()
		os.Exit(0)
	}()

	if err := srv.Start(); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
