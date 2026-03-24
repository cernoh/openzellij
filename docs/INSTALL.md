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
node --version  # Should show 18.0.0 or higher
```

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

### Using Bun

```bash
# Global installation
bun install -g openzellij

# Project-local
bun install openzellij
```

### Verification

```bash
# Check if installed globally
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

### Bun
```bash
bun remove -g openzellij
```

## Development Environment

### Setup

```bash
# Clone the repository
git clone https://github.com/cernoh/openzellij.git
cd openzellij

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev
```

### Project Structure

```
openzellij/
├── src/           # TypeScript source files
├── dist/          # Built output (generated)
├── docs/          # Documentation
├── scripts/       # Build scripts
├── package.json   # npm configuration
└── tsconfig.json  # TypeScript configuration
```

## Next Steps

- Configure the plugin: [CONFIG.md](CONFIG.md)
- Check logs for activity: `~/.config/opencode/logs/`
- Report issues: [GitHub Issues](https://github.com/cernoh/openzellij/issues)
