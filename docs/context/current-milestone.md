# Current Task: Task 0.4 — Docker Compose Dev Setup

## What I'm implementing
Single docker-compose.yml in infra/ with: postgres:16, redis:7, api (backend), worker (ARQ), frontend, ollama. Env.example with all vars. Makefile with up/down/logs/shells. init-ollama.sh to pull qwen2.5:1.5b.

## Files I'm working in
infra/

## Key constraints to remember
- Same compose file for dev AND production (NFR-1.1)
- ARM64-compatible images (Pi 5 target)
- Ollama: OLLAMA_MAX_LOADED_MODELS=1

## Already decided (see decisions/log.md for full context)
- No code changes between home server and cloud — env vars only

## Tests to write first (TDD)
- `make up` → all services start
- /health reachable at http://localhost:8000/health
- Frontend reachable at http://localhost:5173
- `ollama list` shows qwen2.5:1.5b after init

## Definition of done
All services start cleanly; ollama has model loaded