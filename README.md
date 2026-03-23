# openzellij

OpenCode plugin for Zellij integration - automatically manages background agent panes in Zellij terminal sessions.

## Features

- **Auto-spawning panes**: Background OpenCode agents automatically open in Zellij floating panes
- **Auto-close on completion**: Panes automatically close when agents finish (configurable)
- **Agent visibility**: Track all active agent panes with logging
- **Configurable behavior**: Fine-tune polling intervals, grace periods, and pane layout
- **Cross-platform**: Works on NixOS, Linux, macOS via npm

## Installation

### NixOS (Flakes)

```bash
# Add to your flake.nix inputs
inputs.openzellij.url = "path:/home/da/openzellij";

# In your system configuration
environment.systemPackages = [
  inputs.openzellij.packages.${system}.default
];
```

### NixOS (Traditional)

```nix
# In your configuration.nix
environment.systemPackages = let
  openzellij = pkgs.callPackage /path/to/openzellij/nix/default.nix {};
in [
  openzellij
];
```

### npm (Cross-platform)

```bash
# Global installation
npm install -g openzellij

# Project-local
npm install openzellij
```

## Quick Start

1. Install the plugin (see Installation above)
2. Ensure Zellij is installed and in your PATH
3. Start a Zellij session: `zellij`
4. Launch OpenCode with background agents
5. Agent panes will automatically appear in Zellij
6. Panes auto-close when agents complete (default behavior)

## Configuration

Create `~/.config/opencode/openzellij.json`:

```json
{
  "autoClosePanes": true,
  "panePollIntervalMs": 2000,
  "paneMissingGraceMs": 6000,
  "paneLayout": "tiled",
  "enableLogging": true
}
```

See [docs/CONFIG.md](docs/CONFIG.md) for full configuration reference.

## Documentation

- [Installation Guide](docs/INSTALL.md) - Detailed installation steps
- [Configuration Reference](docs/CONFIG.md) - All config options

## Requirements

- Zellij >= 0.30.0
- OpenCode >= 1.0.0
- Node.js >= 18 or Bun >= 1.0

## License

MIT
