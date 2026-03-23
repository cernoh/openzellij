# Configuration Reference

## Config File Location

The plugin reads configuration from:
- `$XDG_CONFIG_HOME/opencode/openzellij.json` (if `XDG_CONFIG_HOME` is set)
- `~/.config/opencode/openzellij.json` (default)

If the config file doesn't exist, default values are used.

## Full Schema

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableLogging` | boolean | `true` | Enable structured logging for plugin operations |
| `spawnDelayMs` | number | `250` | Delay between spawning multiple panes (ms) |
| `maxConcurrentSpawns` | number | `1` | Maximum panes to spawn simultaneously |
| `paneLayout` | string | `"tiled"` | Zellij pane layout: `"tiled"`, `"vertical"`, or `"horizontal"` |
| `zellijBinary` | string | `"zellij"` | Path to zellij binary |
| `listIntervalMs` | number | `5000` | Interval for listing panes (legacy, unused) |
| `autoClosePanes` | boolean | `true` | Automatically close panes when agents complete |
| `panePollIntervalMs` | number | `2000` | Polling interval for checking pane status (ms) |
| `paneMissingGraceMs` | number | `6000` | Grace period before closing missing sessions (ms) |

## Example Configuration

### Default (All Options)

```json
{
  "enableLogging": true,
  "spawnDelayMs": 250,
  "maxConcurrentSpawns": 1,
  "paneLayout": "tiled",
  "zellijBinary": "zellij",
  "listIntervalMs": 5000,
  "autoClosePanes": true,
  "panePollIntervalMs": 2000,
  "paneMissingGraceMs": 6000
}
```

### Minimal (Override Defaults)

```json
{
  "autoClosePanes": false,
  "panePollIntervalMs": 5000
}
```

### Fast Response

For minimal latency, reduce polling interval:

```json
{
  "panePollIntervalMs": 1000,
  "paneMissingGraceMs": 3000
}
```

### Low Resource Usage

For CPU-constrained systems, increase intervals:

```json
{
  "panePollIntervalMs": 10000,
  "paneMissingGraceMs": 15000
}
```

### Custom Zellij Location

If zellij is not in PATH:

```json
{
  "zellijBinary": "/usr/local/bin/zellij"
}
```

## Option Details

### `enableLogging`

**Type**: boolean  
**Default**: `true`

Controls structured logging output. When enabled, the plugin logs:
- Pane spawn events
- Pane close events with reasons
- Active panes summary (every 10 poll cycles)

**Example**:
```json
{ "enableLogging": false }
```

**When to adjust**: Disable to reduce log noise in production environments.

---

### `spawnDelayMs`

**Type**: number (non-negative integer)  
**Default**: `250`

Delay in milliseconds between spawning multiple panes. Prevents overwhelming Zellij with rapid pane creation.

**Example**:
```json
{ "spawnDelayMs": 500 }
```

**When to adjust**: Increase if Zellij becomes unresponsive when spawning many agents.

---

### `maxConcurrentSpawns`

**Type**: number (positive integer)  
**Default**: `1`

Maximum number of panes to spawn concurrently. Additional spawn requests are queued.

**Example**:
```json
{ "maxConcurrentSpawns": 3 }
```

**When to adjust**: Increase for parallel agent workflows, but be mindful of system resources.

---

### `paneLayout`

**Type**: string (enum)  
**Default**: `"tiled"`  
**Values**: `"tiled"`, `"vertical"`, `"horizontal"`

Controls how Zellij arranges spawned panes.

**Example**:
```json
{ "paneLayout": "vertical" }
```

**When to adjust**: Change based on screen size and workflow preferences.

---

### `zellijBinary`

**Type**: string  
**Default**: `"zellij"`

Path to the zellij executable. Uses PATH resolution by default.

**Example**:
```json
{ "zellijBinary": "/nix/store/.../bin/zellij" }
```

**When to adjust**: Set absolute path if zellij is not in PATH or you need a specific version.

---

### `listIntervalMs`

**Type**: number (positive integer)  
**Default**: `5000`

**Legacy option** - not currently used by the plugin. Reserved for future features.

---

### `autoClosePanes`

**Type**: boolean  
**Default**: `true`

Automatically close panes when their associated OpenCode sessions complete, fail, or become idle.

**Example**:
```json
{ "autoClosePanes": false }
```

**When to adjust**: 
- Set to `false` if you want to manually review agent output after completion
- Useful for debugging or learning from agent behavior

---

### `panePollIntervalMs`

**Type**: number (positive integer)  
**Default**: `2000` (2 seconds)

Interval in milliseconds between status checks. The plugin polls:
1. OpenCode session status (running/completed/failed/idle)
2. Zellij pane status (running/exited)

**Example**:
```json
{ "panePollIntervalMs": 1000 }
```

**When to adjust**:
- **Decrease (1000ms)**: Faster pane closure, more CPU usage
- **Increase (5000ms)**: Lower CPU usage, slower response
- **Sweet spot**: 2000-3000ms for most use cases

**Impact**:
- Lower values = faster auto-close response
- Higher values = reduced CPU and API calls

---

### `paneMissingGraceMs`

**Type**: number (non-negative integer)  
**Default**: `6000` (6 seconds)

Grace period before closing panes whose sessions are missing from OpenCode status. Prevents premature closure during brief disconnections or API delays.

**Example**:
```json
{ "paneMissingGraceMs": 10000 }
```

**When to adjust**:
- **Increase (10000ms+)**: Network-heavy environments, slow OpenCode API
- **Decrease (3000ms)**: Fast local setups, immediate cleanup desired

**Formula**: Should be at least `3 × panePollIntervalMs` to allow multiple failed checks before closure.

## Advanced Usage

### Debugging Agent Lifecycle

Enable detailed logging and disable auto-close:

```json
{
  "enableLogging": true,
  "autoClosePanes": false,
  "panePollIntervalMs": 5000
}
```

### Production Deployment

Optimize for stability:

```json
{
  "enableLogging": false,
  "autoClosePanes": true,
  "panePollIntervalMs": 3000,
  "paneMissingGraceMs": 10000,
  "maxConcurrentSpawns": 2
}
```

### Local Development

Fast feedback loop:

```json
{
  "enableLogging": true,
  "autoClosePanes": true,
  "panePollIntervalMs": 1000,
  "paneMissingGraceMs": 3000
}
```

## Validation

The plugin uses Zod schema validation. Invalid config values will:
1. Log an error
2. Fall back to default values
3. Continue plugin execution

Check OpenCode logs for validation errors.

## Environment Variables

The plugin respects:
- `XDG_CONFIG_HOME` - Config directory location
- `ZELLIJ_SESSION_NAME` - Current Zellij session (auto-detected)
- `ZELLIJ` - Zellij socket path (auto-detected)

## Config Precedence

1. User config file (`~/.config/opencode/openzellij.json`)
2. Default values (from plugin)

There is no project-level config override (by design).
