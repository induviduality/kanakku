# Dev Mode Configuration

Toggle dev mode across backend, frontend, and infrastructure with a single config file.

## Quick Start

Edit `.dev-config.yml` in the project root and set your desired preset:

```yaml
preset: all  # Options: all, be_only, fe_only, infra_only
```

Then load the config into your shell:

### Bash / Zsh
```bash
source <(python infra/load-dev-config.py)
```

### PowerShell
```powershell
python infra/load-dev-config.py | Invoke-Expression
```

Then run your app normally:
```bash
docker compose -f infra/docker-compose.yml up
# or for backend only: cd backend && uvicorn app.main:app --reload
```

## Presets

### `all` (default)
Enables dev mode for:
- **Backend**: X-Dev-User-ID header auth bypass, seeded user (dev@kanakku.local / dev-password)
- **Frontend**: Hot module reload (HMR), debug tools
- **Infra**: Docker volumes for live reload, etc.

### `be_only`
Backend dev mode only. Good for testing backend changes without frontend dev overhead.

### `fe_only`
Frontend dev mode only. Good for UI development with production backend.

### `infra_only`
Infrastructure dev mode only (docker-compose volumes, etc.). Useful for container testing.

## Fine-Grained Control

Instead of using presets, you can set individual flags in `.dev-config.yml`:

```yaml
dev_mode_backend: true
dev_mode_frontend: false
dev_mode_infra: true
```

## Environment Variables

The `load-dev-config.py` script exports:
- `DEV_MODE_BACKEND` — enables backend dev features
- `DEV_MODE_FRONTEND` — enables frontend dev features
- `DEV_MODE_INFRA` — enables infra dev features
- `DEV_MODE` — set to same value as `DEV_MODE_BACKEND` (backward compat)

You can also set these directly in your shell or `.env` file to override the config.

## Backend Dev Mode Details

When `DEV_MODE_BACKEND=true`:
- A seeded user is created on startup: `dev@kanakku.local` / `dev-password`
- You can pass `X-Dev-User-ID: 11111111-1111-1111-1111-111111111111` header to bypass JWT auth
- Useful for testing auth flows and bypassing token issues

To use in requests:
```bash
curl -H "X-Dev-User-ID: 11111111-1111-1111-1111-111111111111" http://localhost:8000/api/v1/me
```

Or log in normally with dev@kanakku.local / dev-password.
