#!/usr/bin/env bash
# Pull the LLM model into the running Ollama container.
# Run once after first `make up`, or after wiping the ollama volume.
# Usage: bash infra/scripts/init-ollama.sh [model]

set -euo pipefail

MODEL="${1:-qwen2.5:1.5b}"

echo "Waiting for Ollama to be ready..."
for i in $(seq 1 30); do
  if docker compose exec ollama ollama list > /dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Ollama did not become ready in time. Is the stack running? (make up)"
    exit 1
  fi
  sleep 2
done

echo "Pulling model: ${MODEL}"
docker compose exec ollama ollama pull "${MODEL}"
echo "Done. Verify with: make ollama-shell → ollama list"
