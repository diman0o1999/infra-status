from uptime_kuma_api import UptimeKumaApi, MonitorType

api = UptimeKumaApi("http://localhost:3003")
api.login("admin", "UptimeK$2026!")

existing = api.get_monitors()
existing_names = [m["name"] for m in existing]
print(f"Existing monitors: {len(existing)}")

monitors = [
    # Projects - Web
    {"name": "Cargo Web", "type": MonitorType.HTTP, "url": "https://cargo.core-stack.ru", "interval": 60},
    {"name": "Cargo API", "type": MonitorType.HTTP, "url": "https://cargo-api.core-stack.ru", "interval": 60},
    {"name": "Fabro Web", "type": MonitorType.HTTP, "url": "https://fabro.core-stack.ru", "interval": 60},
    {"name": "Fabro API", "type": MonitorType.HTTP, "url": "https://fabro-api.core-stack.ru", "interval": 60},
    {"name": "Puls Web", "type": MonitorType.HTTP, "url": "https://puls.core-stack.ru", "interval": 60},
    {"name": "Puls API", "type": MonitorType.HTTP, "url": "https://puls-api.core-stack.ru", "interval": 60},
    {"name": "Skazki Web", "type": MonitorType.HTTP, "url": "https://skazki.core-stack.ru", "interval": 60},
    {"name": "Skazki API", "type": MonitorType.HTTP, "url": "https://skazki-api.core-stack.ru", "interval": 60},
    {"name": "Kraeved Web", "type": MonitorType.HTTP, "url": "https://kraeved.core-stack.ru", "interval": 60},
    {"name": "Kraeved API", "type": MonitorType.HTTP, "url": "https://kraeved-api.core-stack.ru", "interval": 60},
    {"name": "Logist23 Web", "type": MonitorType.HTTP, "url": "https://logist23.core-stack.ru", "interval": 60},
    {"name": "Logist23 API", "type": MonitorType.HTTP, "url": "https://logist23-api.core-stack.ru", "interval": 60},
    # Infra services - HTTP
    {"name": "Info Dashboard", "type": MonitorType.HTTP, "url": "http://info.core-stack.ru", "interval": 60},
    {"name": "Grafana", "type": MonitorType.HTTP, "url": "http://localhost:3001", "interval": 120},
    {"name": "GlitchTip", "type": MonitorType.HTTP, "url": "http://localhost:3002", "interval": 120},
    {"name": "Meilisearch", "type": MonitorType.HTTP, "url": "http://localhost:7700", "interval": 120},
    {"name": "MinIO Console", "type": MonitorType.HTTP, "url": "http://localhost:9001", "interval": 120},
    {"name": "Ollama WebUI", "type": MonitorType.HTTP, "url": "http://localhost:8080", "interval": 120},
    {"name": "Loki", "type": MonitorType.HTTP, "url": "http://localhost:3100/ready", "interval": 120},
    # Infrastructure - TCP ports
    {"name": "PostgreSQL (infra)", "type": MonitorType.PORT, "hostname": "127.0.0.1", "port": 5432, "interval": 60},
    {"name": "Redis (infra)", "type": MonitorType.PORT, "hostname": "127.0.0.1", "port": 6379, "interval": 60},
    {"name": "PostgreSQL (dev)", "type": MonitorType.PORT, "hostname": "192.168.1.112", "port": 5432, "interval": 60},
    {"name": "Redis (dev)", "type": MonitorType.PORT, "hostname": "192.168.1.112", "port": 6379, "interval": 60},
    {"name": "nginx (dev)", "type": MonitorType.PORT, "hostname": "192.168.1.112", "port": 80, "interval": 60},
    # Hosts - Ping
    {"name": "prox-host (Proxmox)", "type": MonitorType.PING, "hostname": "192.168.1.71", "interval": 60},
    {"name": "prox-dev (VM100)", "type": MonitorType.PING, "hostname": "192.168.1.112", "interval": 60},
    {"name": "prox-infra (VM300)", "type": MonitorType.PING, "hostname": "127.0.0.1", "interval": 60},
]

added = 0
for mon in monitors:
    mon_name = mon["name"]
    if mon_name in existing_names:
        print(f"  skip: {mon_name} (exists)")
        continue
    try:
        api.add_monitor(**mon)
        print(f"  + {mon_name}")
        added += 1
    except Exception as e:
        print(f"  ! {mon_name}: {e}")

print(f"\nDone: {added} added, {len(existing)} existed")
api.disconnect()
