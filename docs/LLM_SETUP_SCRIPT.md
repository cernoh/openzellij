# LLM Setup Script — openzellij Plugin

> Purpose: guide an LLM-driven assistant through a deterministic sequence for installing, configuring, and validating the openzellij OpenCode plugin that manages Zellij panes for background agents.

---

## 1. Runbook Usage

1. Read this file top-to-bottom before issuing any commands.
2. Confirm the user's operating environment and toolchain (Node/Bun versions).
3. Execute each numbered step in order, reporting results and capturing errors verbatim.
4. Never skip a verification command—report failures immediately and branch into Troubleshooting.

---

## 2. Project Context

- Repository: `cernoh/openzellij`
- Plugin role: auto-spawn & auto-close OpenCode agent panes inside Zellij sessions
- Minimum versions: Zellij ≥ 0.30.0, OpenCode ≥ 1.0.0, Node.js ≥ 18 (or Bun ≥ 1.0.0)

---

## 3. Requirements Checklist (run & record output)

```bash
zellij --version
opencode --version
node --version    # or bun --version
```

- If any command is missing or version too low, halt and instruct the user to install/upgrade before proceeding.

---

## 4. Setup Flow

### Step 4.1 – Install via npm/bun

```bash
# Global installation (recommended)
npm install -g openzellij

# Or using bun
bun install -g openzellij

# For project-local installation
npm install openzellij
# or
bun install openzellij
```

Capture output. Verify installation:
```bash
npm list -g openzellij
# or
bun pm ls -g openzellij
```

### Step 4.2 – Configure plugin behavior

1. Create `~/.config/opencode/openzellij.json` (or `$XDG_CONFIG_HOME/opencode/openzellij.json`).
2. Populate with at least the defaults:
   ```json
   {
     "autoClosePanes": true,
     "panePollIntervalMs": 2000,
     "paneMissingGraceMs": 6000,
     "paneLayout": "tiled",
     "enableLogging": true
   }
   ```
3. Optional advanced keys:
   - `spawnDelayMs` (default 250)
   - `maxConcurrentSpawns` (default 1)
   - `zellijBinary` (override path)

### Step 4.3 – Activate plugin in OpenCode

1. Confirm plugin discovery paths: `~/.config/opencode/plugins/`, project `.opencode/plugins/`, or npm-managed auto discovery.
2. If manual activation needed, edit `~/.config/opencode/config.json`:
   ```json
   {
     "plugin": ["openzellij"]
   }
   ```
3. Restart any running `opencode` sessions.

### Step 4.4 – Functional verification

Run inside an active Zellij session:
```bash
zellij
opencode "Create a temporary note describing my dev environment"
```
- Expectation: a floating/tiled pane spawns for the agent, logs show `[openzellij] spawning pane`.
- After agent completes, pane should auto-close within ~2s (given default `panePollIntervalMs`).

### Step 4.5 – Logging & diagnostics

```bash
# Check OpenCode logs
tail -f ~/.local/share/opencode/logs/latest.log
# or
journalctl --user -u opencode.service -f  # if running via systemd
```
- Confirm entries such as `openzellij: pane attached`, `openzellij: pane closed`.

---

## 5. Troubleshooting Playbook

| Symptom | Checks | Remediation |
|---------|--------|-------------|
| Plugin not discovered | `opencode --list-plugins` output missing `openzellij` | Ensure installation path is on `PATH` (npm) or included in environment; add explicit entry to OpenCode config |
| Panes never spawn | Verify `zellijBinary` path, confirm `$ZELLIJ` env var is set inside session | Set `zellijBinary` to absolute path or run `eval $(zellij setup --generate-auto-start zsh)` |
| Panes stay open | Ensure `autoClosePanes: true`, inspect logs for polling errors | Increase `paneMissingGraceMs`; manually close pane while root cause is investigated |
| Permission errors | Can't create config directory | Run `mkdir -p ~/.config/opencode && chmod 700 ~/.config/opencode` |
| npm install fails | Network issues or permission problems | Try with `sudo` for global install, or use project-local install instead |

---

## 6. Reporting Template

When finishing, respond with:

```
Setup Summary:
- Install method: <npm global | npm local | bun global | bun local>
- Config file created: <yes/no>
- Verification result: <success/failure + key log line>
Issues Encountered:
- <list or "none">
Next Actions:
- <e.g., monitor logs, restart session>
```

Ensure any failure includes the exact command output and which checklist item needs attention.
