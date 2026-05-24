# Kanakku Operations Runbook

This document covers day-to-day operations for a deployed Kanakku instance: backups, monitoring, log access, common issues, and Tailscale remote-access setup.

---

## Backups

### Manual backup

```bash
# Dump to a timestamped file in /var/backups/kanakku
BACKUP_DIR=/var/backups/kanakku \
DATABASE_URL=postgresql://kanakku:<password>@localhost:5432/kanakku \
bash /opt/kanakku/infra/scripts/backup.sh
```

When running against the Docker Compose stack, use the `db` container hostname:
```bash
DATABASE_URL=postgresql://kanakku:<password>@db:5432/kanakku \
BACKUP_DIR=/var/backups/kanakku \
bash /opt/kanakku/infra/scripts/backup.sh
```

Or via Docker:
```bash
cd /opt/kanakku/infra
docker compose exec -T db pg_dump -U kanakku -d kanakku --format=custom \
  > /var/backups/kanakku/kanakku_$(date +%Y%m%dT%H%M%SZ).dump
```

### Restore from backup

```bash
BACKUP_FILE=/var/backups/kanakku/kanakku_20260101T030000Z.dump \
DATABASE_URL=postgresql://kanakku:<password>@localhost:5432/kanakku \
bash /opt/kanakku/infra/scripts/restore.sh
```

**Warning:** `restore.sh` drops the public schema and recreates it. All existing data will be lost.

### Automated nightly backup with rotation

Install and schedule `auto-backup.sh`:

```bash
# 1. Copy the script (already in the repo at infra/scripts/auto-backup.sh)
#    Ensure it's executable:
chmod +x /opt/kanakku/infra/scripts/auto-backup.sh

# 2. Create backup directory
mkdir -p /var/backups/kanakku

# 3. Add cron entry (runs at 03:00 every day)
crontab -e
```

Cron entry to add:
```
0 3 * * * BACKUP_DIR=/var/backups/kanakku DATABASE_URL=postgresql://kanakku:<password>@localhost:5432/kanakku /opt/kanakku/infra/scripts/auto-backup.sh >> /var/log/kanakku-backup.log 2>&1
```

Rotation policy (configurable via env vars):

| Env var | Default | Description |
|---------|---------|-------------|
| `KEEP_DAILY` | 7 | Daily backups to keep |
| `KEEP_WEEKLY` | 4 | Monday backups to keep |
| `KEEP_MONTHLY` | 12 | 1st-of-month backups to keep |

### JSON archive export (in-app)

Users can also export a portable JSON archive from Settings → Data Export. This is independent of the PostgreSQL dump and can be used to migrate between instances.

---

## Log Access

### Docker Compose logs

```bash
cd /opt/kanakku/infra

# All services
docker compose logs -f

# API only (most relevant)
docker compose logs -f api

# Worker (ARQ background jobs)
docker compose logs -f worker

# Caddy (access logs + TLS events)
docker compose logs -f caddy
```

### Log locations (inside containers)

| Service | Log location |
|---------|-------------|
| api | stdout (captured by Docker) |
| worker | stdout (captured by Docker) |
| caddy | stdout — access log format JSON |
| postgres | stdout — controlled by `log_min_messages` |

To increase API log verbosity, set `DEBUG=true` in `.env` and restart:
```bash
docker compose restart api
```

---

## Health Checks

The API exposes a health endpoint:
```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

Via Caddy (when running):
```bash
curl http://<your-domain>/health
```

Docker healthcheck status:
```bash
docker compose ps   # shows Up (healthy) or Up (unhealthy)
```

---

## Updates

```bash
cd /opt/kanakku

# 1. Pull latest code
git pull

# 2. Rebuild images
cd infra
docker compose -f docker-compose.yml build

# 3. Restart services (production — skips override file)
docker compose -f docker-compose.yml up -d

# 4. Run any new migrations
docker compose -f docker-compose.yml exec api alembic upgrade head
```

Always take a manual backup before updating:
```bash
bash infra/scripts/backup.sh
```

---

## Common Issues

### API returns 500 on startup

**Symptom:** `GET /health` returns 500 or connection refused immediately after `docker compose up`.

**Cause:** API started before database was ready.

**Fix:** The compose healthcheck handles this — wait 30–60 seconds for the `start_period` to expire and the API to come up healthy. If it stays unhealthy:
```bash
docker compose logs api   # check for migration errors
docker compose exec api alembic upgrade head
docker compose restart api
```

### Caddy not serving / TLS not provisioning

**Symptom:** Port 80/443 unreachable; Caddy logs show certificate errors.

**Checks:**
1. `PUBLIC_DOMAIN` in `.env` matches the actual domain DNS resolves to.
2. Port 80 and 443 are open in the firewall / VPS security group.
3. Let's Encrypt rate limits: max 5 certs per domain per week.

For LAN / local testing, set `PUBLIC_DOMAIN=localhost` — Caddy serves HTTP only with no TLS.

### Database connection refused

**Symptom:** `DATABASE_URL` connection errors in API logs.

**Fix:**
```bash
docker compose ps db    # check db is healthy
docker compose restart db
docker compose restart api
```

### Out of disk space (backups)

**Symptom:** Backup script fails with "No space left on device".

**Fix:**
```bash
df -h /var/backups/kanakku
ls -lhS /var/backups/kanakku  # find large files
# Remove oldest backups manually, then fix cron rotation config
```

### ARQ worker not processing jobs

**Symptom:** PDF imports / exports stuck in "processing" state.

**Fix:**
```bash
docker compose logs worker   # check for errors
docker compose restart worker
```

---

## Tailscale (Recommended for Remote Access)

Tailscale provides a zero-config VPN for accessing the Pi from outside your home network — safer than exposing ports publicly.

### Install on the Pi

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

This gives the Pi a stable `*.ts.net` hostname and IP within your Tailscale network.

### Configure Kanakku to use the Tailscale hostname

In `/opt/kanakku/infra/.env`:
```dotenv
PUBLIC_DOMAIN=kanakku.your-tailnet-name.ts.net
PUBLIC_BASE_URL=https://kanakku.your-tailnet-name.ts.net
```

Enable HTTPS certificates for your Tailscale hostname (requires Tailscale v1.32+):
```bash
sudo tailscale cert kanakku.your-tailnet-name.ts.net
```

Caddy will then use the Tailscale-issued certificate automatically — no Let's Encrypt required and no ports need to be opened to the internet.

### Access from phone / laptop

Install the Tailscale app on all devices and join the same account. The Pi is then reachable at its Tailscale hostname from anywhere on the planet.

---

## Security Notes

- **Never** expose PostgreSQL (5432) or Redis (6379) ports to the internet. The production `docker-compose.yml` removes their host port bindings.
- Rotate `JWT_SECRET` and `POSTGRES_PASSWORD` by updating `.env` and restarting services.
- Caddy handles TLS — do not put a separate nginx or Apache in front of it.
- The `app_readonly` Postgres role used by the Reports query endpoint has SELECT-only access. It cannot write data even if a query is injected.
