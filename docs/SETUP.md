# Kanakku — Setup Guide

> **Start here.** This page tells you what to install on your machine before anything else works. Once prerequisites are met, follow the links to [docs/running.md](running.md) for how to actually start the stack.

---

## Which scenario are you?

| Scenario | You have… | Best path |
|----------|-----------|-----------|
| **Local PC — dev** | A Windows or macOS machine you code on | [→ Local PC setup](#scenario-a-local-pc-windowsmacos) |
| **Raspberry Pi 5** | A Pi 5 (8 GB recommended) on your home network | [→ Pi 5 setup](#scenario-b-raspberry-pi-5) |
| **Cloud VPS** | A rented server (Ubuntu) with a domain name | [→ Cloud VPS setup](#scenario-c-cloud-vps-ubuntu-2204--2404) |

All three scenarios end up running the same `docker-compose.yml` — only what you install on the host and what goes in `.env` differs.

---

## Scenario A: Local PC (Windows/macOS)

**Use this when:** you want to develop the app or just try it on your own machine without a separate server.

### What you need

| Tool | Why | Min version |
|------|-----|-------------|
| Git | clone the repo | any |
| Docker Desktop | runs the whole stack | 4.x |
| Python 3.12 + uv | **only if** running backend natively (not via Docker) | 3.12 |
| Bun | **only if** running frontend natively (not via Docker) | 1.3 |

### Install on Windows

```powershell
# 1. Git
winget install Git.Git

# 2. Docker Desktop (restart required after install)
winget install Docker.DockerDesktop

# 3. [Optional] Python 3.12 + uv — only for native backend dev
winget install Python.Python.3.12
pip install uv

# 4. [Optional] Bun — only for native frontend dev
irm bun.sh/install.ps1 | iex
```

After installing Docker Desktop, open it once and let it finish setup before continuing.

### Install on macOS

```bash
# 1. Git (usually pre-installed; if not:)
brew install git

# 2. Docker Desktop
brew install --cask docker
# Or download from https://docker.com and drag to Applications

# 3. [Optional] Python 3.12 + uv — only for native backend dev
brew install python@3.12
pip install uv

# 4. [Optional] Bun — only for native frontend dev
curl -fsSL https://bun.sh/install | bash
```

### Verify

```bash
git --version        # git 2.x
docker --version     # Docker 24+
docker compose version  # 2.x
```

### Next step

→ **[docs/running.md — Option 1 (native) or Option 2 (Docker)](running.md)**

---

## Scenario B: Raspberry Pi 5

**Use this when:** you have a Pi 5 at home and want a private, always-on personal finance server.

**Recommended spec:** Pi 5 with 8 GB RAM. 4 GB may work but Ollama will be tight.
**OS:** Raspberry Pi OS 64-bit (Bookworm, released 2023+). Use the full desktop image or the lite image — either works.

### What you need

| Tool | Why |
|------|-----|
| Docker | runs everything |
| Git | clone and update the repo |
| `openssl` | generate JWT secret |

`openssl` is pre-installed on Raspberry Pi OS. Docker and Git are the only installs.

### SSH into your Pi, then run:

```bash
# 1. Update packages
sudo apt update && sudo apt upgrade -y

# 2. Install Git
sudo apt install -y git

# 3. Install Docker (official one-liner — handles ARM64 automatically)
curl -fsSL https://get.docker.com | sh

# 4. Add your user to the docker group so you don't need sudo every time
sudo usermod -aG docker $USER

# 5. Log out and back in (or run this to activate the group now):
newgrp docker

# 6. Verify
docker --version          # Docker 24+
docker compose version    # 2.x
git --version
```

> **Note:** Do not install Docker via `apt install docker.io` — that package is outdated and doesn't include the Compose plugin. Use `get.docker.com` as above.

### Generate a secure JWT secret (do this now, you'll need it in `.env`)

```bash
openssl rand -hex 32
# Copy the output — paste it as JWT_SECRET in .env
```

### Next step

→ **[docs/running.md — Option 3a (Pi 5 deployment)](running.md#option-3a-deploy-to-raspberry-pi-5)**

---

## Scenario C: Cloud VPS (Ubuntu 22.04 / 24.04)

**Use this when:** you want to access Kanakku from anywhere via a real domain + HTTPS.

### What you need before starting

| Requirement | Details |
|-------------|---------|
| Ubuntu 22.04 or 24.04 VPS | ≥ 2 GB RAM recommended (1 GB works without Ollama) |
| A domain name | Pointed at the VPS IP — an A record for e.g. `kanakku.yourdomain.com` |
| Ports 80 and 443 open | Check your hosting provider's firewall / security group rules |
| SSH access | Root or a sudo user |

### Install on the VPS

```bash
# 1. Update
sudo apt update && sudo apt upgrade -y

# 2. Install Git and openssl
sudo apt install -y git openssl

# 3. Install Docker (official one-liner)
curl -fsSL https://get.docker.com | sh

# 4. Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# 5. Verify
docker --version
docker compose version
```

### DNS — point your domain at the server

In your DNS provider's control panel, add:
```
A    kanakku    <your-vps-ip>
```
Wait for DNS to propagate (usually < 10 min on most providers). You can check with:
```bash
dig kanakku.yourdomain.com +short
```

### Generate secrets

```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 16   # → POSTGRES_PASSWORD
```

Caddy (included in the compose stack) handles Let's Encrypt TLS automatically — no Certbot or extra setup needed, as long as port 80 and 443 are reachable.

### Next step

→ **[docs/running.md — Option 3b (Cloud VPS deployment)](running.md#option-3b-deploy-to-cloud-vps)**

---

## Cloning the repo (all scenarios)

Once your prerequisites are installed:

```bash
git clone https://github.com/induviduality/kanakku.git
cd kanakku
```

Then follow the scenario-specific run instructions in [docs/running.md](running.md).

---

## Not sure what you need?

- Just want to **try it out quickly** → [Local PC + Docker](running.md#option-2-docker-full-stack-local)
- Want to **develop / change code** → [Local PC + native processes](running.md#option-1-local-dev-native-no-docker)
- Want it **running 24/7 at home** → [Pi 5](running.md#option-3a-deploy-to-raspberry-pi-5)
- Want it **accessible from anywhere** → [Cloud VPS](running.md#option-3b-deploy-to-cloud-vps)
