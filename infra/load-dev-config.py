#!/usr/bin/env python3
"""
Load dev config and export environment variables.

Usage:
  python infra/load-dev-config.py        # Prints shell-ready exports
  source <(python infra/load-dev-config.py)  # (bash/zsh) source into shell
  & (python infra/load-dev-config.py | Invoke-Expression)  # (powershell)
"""

import os
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Error: pyyaml not found. Install with: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

CONFIG_PATH = Path(__file__).parent.parent / ".dev-config.yml"

PRESETS = {
    "all": {
        "dev_mode_backend": True,
        "dev_mode_frontend": True,
        "dev_mode_infra": True,
    },
    "be_only": {
        "dev_mode_backend": True,
        "dev_mode_frontend": False,
        "dev_mode_infra": False,
    },
    "fe_only": {
        "dev_mode_backend": False,
        "dev_mode_frontend": True,
        "dev_mode_infra": False,
    },
    "infra_only": {
        "dev_mode_backend": False,
        "dev_mode_frontend": False,
        "dev_mode_infra": True,
    },
}


def load_config() -> dict:
    """Load .dev-config.yml and return dev mode flags."""
    if not CONFIG_PATH.exists():
        # Default to all off
        return {
            "dev_mode_backend": False,
            "dev_mode_frontend": False,
            "dev_mode_infra": False,
        }

    with open(CONFIG_PATH) as f:
        config = yaml.safe_load(f) or {}

    # If preset is specified, use it
    if "preset" in config:
        preset = config["preset"]
        if preset in PRESETS:
            return PRESETS[preset]
        else:
            print(
                f"Warning: unknown preset '{preset}'. Valid presets: {', '.join(PRESETS.keys())}",
                file=sys.stderr,
            )

    # Otherwise use fine-grained settings
    return {
        "dev_mode_backend": config.get("dev_mode_backend", False),
        "dev_mode_frontend": config.get("dev_mode_frontend", False),
        "dev_mode_infra": config.get("dev_mode_infra", False),
    }


def format_for_shell() -> str:
    """Format env vars for shell sourcing."""
    config = load_config()
    lines = []
    for key, value in config.items():
        # Convert Python bool to shell bool (true/false lowercase)
        val_str = "true" if value else "false"
        lines.append(f"export {key.upper()}={val_str}")

    # For backward compat, also export DEV_MODE = dev_mode_backend
    lines.append(f"export DEV_MODE={'true' if config['dev_mode_backend'] else 'false'}")

    return "\n".join(lines)


if __name__ == "__main__":
    print(format_for_shell())
