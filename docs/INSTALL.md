# Installation Guide

## Prerequisites

### Required
- **Zellij** >= 0.30.0 - Terminal multiplexer
- **OpenCode** >= 1.0.0 - AI coding assistant
- **Node.js** >= 18 or **Bun** >= 1.0 (for npm installation)

### Verification
```bash
zellij --version  # Should show 0.30.0 or higher
opencode --version  # Should show 1.0.0 or higher
```

## Home Manager Installation (Recommended)

### Using Flakes

Add openzellij to your flake inputs:

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    openzellij.url = "github:cernoh/openzellij";
  };

  outputs = { self, nixpkgs, home-manager, openzellij, ... }: {
    homeConfigurations.your-user = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      modules = [
        openzellij.homeManagerModules.default
        {
          programs.openzellij = {
            enable = true;
            settings = {
              autoClosePanes = true;
              panePollIntervalMs = 2000;
              paneMissingGraceMs = 6000;
              paneLayout = "tiled";
              enableLogging = true;
            };
          };
        }
      ];
    };
  };
}
```

Then rebuild:
```bash
home-manager switch --flake .#your-user
```

### Standalone Home Manager

In your `home.nix`:

```nix
{ inputs, pkgs, ... }: {
  imports = [ inputs.openzellij.homeManagerModules.default ];

  programs.openzellij = {
    enable = true;
    # Optional: customize package
    package = inputs.openzellij.packages.${pkgs.system}.default;
    # Optional: configure settings
    settings = {
      autoClosePanes = true;
      panePollIntervalMs = 2000;
      paneMissingGraceMs = 6000;
      paneLayout = "tiled";
      enableLogging = true;
    };
  };
}
```

### Configuration Options

The home-manager module provides:

- `programs.openzellij.enable` - Enable the plugin (default: false)
- `programs.openzellij.package` - Package to install (default: from flake)
- `programs.openzellij.settings` - Settings object written to `~/.config/opencode/openzellij.json`

Available settings:
- `autoClosePanes` (bool) - Auto-close panes on completion
- `panePollIntervalMs` (int) - Polling interval in milliseconds
- `paneMissingGraceMs` (int) - Grace period before closing
- `paneLayout` (string) - Layout mode: "floating", "tiled", etc.
- `enableLogging` (bool) - Enable debug logging

## NixOS Installation

### Method 1: Using Flakes (Recommended)

Add openzellij to your flake inputs:

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    openzellij.url = "github:cernoh/openzellij";
  };

  outputs = { self, nixpkgs, openzellij, ... }: {
    nixosConfigurations.your-host = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        {
          environment.systemPackages = [
            openzellij.packages.x86_64-linux.default
          ];
        }
      ];
    };
  };
}
```

Then rebuild:
```bash
sudo nixos-rebuild switch --flake .#your-host
```

### Method 2: Using configuration.nix

```nix
# configuration.nix
{ config, pkgs, ... }:
let
  openzellij = pkgs.callPackage /path/to/openzellij/nix/default.nix {};
in
{
  environment.systemPackages = [
    openzellij
    pkgs.zellij
  ];
}
```

Then rebuild:
```bash
sudo nixos-rebuild switch
```

### Method 3: Using nix-env

```bash
# Install from local path
nix-env -f /path/to/openzellij/nix/default.nix -i

# Or with flakes
nix profile install /path/to/openzellij
```

### Development Environment

Use the dev shell for contributing:

```bash
# With flakes
nix develop

# Or legacy
nix-shell
```

This provides Node.js, TypeScript, and Vitest.

## npm Installation

### Global Installation (Recommended)

```bash
npm install -g openzellij
```

OpenCode will automatically discover the plugin.

### Project-Local Installation

```bash
cd your-project
npm install openzellij
```

Then add to OpenCode config:
```json
{
  "plugin": ["openzellij"]
}
```

### Verification

```bash
# Check if installed
npm list -g openzellij

# Or for local
npm list openzellij
```

## Plugin Activation

OpenCode automatically discovers plugins in:
- **Global**: `~/.config/opencode/plugins/`
- **Project**: `.opencode/plugins/`
- **npm packages**: Listed in config or auto-discovered

### Manual Activation

If auto-discovery fails, add to `~/.config/opencode/config.json`:

```json
{
  "plugin": ["openzellij"]
}
```

## Post-Install Verification

### 1. Check Plugin Loaded

Start OpenCode and look for log message:
```
[openzellij] Plugin activated
```

### 2. Test Pane Spawning

In a Zellij session:
```bash
# Start OpenCode with a background task
opencode "Create a new file with hello world"
```

You should see a floating pane appear for the background agent.

### 3. Test Auto-Close

Wait for the agent to complete. The pane should automatically close after ~2 seconds (default poll interval).

### 4. Check Active Panes

OpenCode logs will show:
```
[openzellij] Spawned pane for session {"sessionId":"ses_...", "paneId":"1", ...}
[openzellij] Active panes: [ses_... → 1 (agent-name, duration: 5s)]
[openzellij] Closed pane for session {"sessionId":"ses_...", "reason":"session_completed"}
```

## Troubleshooting

### Plugin Not Found

**Symptom**: OpenCode doesn't load openzellij

**Solutions**:
1. Verify installation: `npm list -g openzellij`
2. Check OpenCode config: `~/.config/opencode/config.json`
3. Manually add plugin: `{ "plugin": ["openzellij"] }`
4. Restart OpenCode

### Panes Not Spawning

**Symptom**: No Zellij panes appear for agents

**Solutions**:
1. Verify Zellij is running: `echo $ZELLIJ`
2. Check zellij binary path in config: `"zellijBinary": "zellij"`
3. Check logs for errors
4. Try manual pane creation: `zellij action new-pane`

### Panes Not Closing

**Symptom**: Panes remain open after agent completes

**Solutions**:
1. Check `autoClosePanes` config (default: `true`)
2. Verify polling is working (check logs every 2 seconds)
3. Increase poll interval if too fast: `"panePollIntervalMs": 5000`
4. Check grace period: `"paneMissingGraceMs": 6000`

### Build Errors (Nix)

**Symptom**: `nix build` fails

**Common Issues**:
- **Not a git repo**: Run `git init && git add .` before building
- **Architecture mismatch**: Build on matching platform (x86_64-linux vs aarch64-linux)
- **npmDepsHash invalid**: Regenerate with `nix run nixpkgs#prefetch-npm-deps -- package-lock.json`

### Permission Errors

**Symptom**: Can't create config directory

**Solution**:
```bash
mkdir -p ~/.config/opencode
chmod 700 ~/.config/opencode
```

## Uninstallation

### npm
```bash
npm uninstall -g openzellij
```

### NixOS
Remove from `environment.systemPackages` and rebuild:
```bash
sudo nixos-rebuild switch
```

### nix-env
```bash
nix-env -e openzellij
```

## Next Steps

- Configure the plugin: [CONFIG.md](CONFIG.md)
- Check logs for activity: `~/.config/opencode/logs/`
- Report issues: [GitHub Issues](https://github.com/your-org/openzellij/issues)
