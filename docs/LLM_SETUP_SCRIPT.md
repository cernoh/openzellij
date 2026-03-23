# LLM Setup Script — openzellij Plugin

> Purpose: guide an LLM-driven assistant through a deterministic sequence for installing, configuring, and validating the openzellij OpenCode plugin that manages Zellij panes for background agents.

---

## 1. Runbook Usage

1. Read this file top-to-bottom before issuing any commands.
2. Confirm the user's operating environment (Nix/Home Manager vs generic npm) and toolchain (Node/Bun versions).
3. Execute each numbered step in order, reporting results and capturing errors verbatim.
4. Never skip a verification command—report failures immediately and branch into Troubleshooting.

---

## 2. Project Context

- Repository: `cernoh/openzellij`
- Plugin role: auto-spawn & auto-close OpenCode agent panes inside Zellij sessions
- Minimum versions: Zellij ≥ 0.30.0, OpenCode ≥ 1.0.0, Node.js ≥ 18 (or Bun ≥ 1.0.0 when using npm installs)

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

### Step 4.1 – Select installation path

Ask which target applies and follow the matching subsection:

#### A) Home Manager (flakes)
1. Ensure `flake.nix` includes:
   ```nix
   inputs.openzellij.url = "github:cernoh/openzellij";
   ```
2. Add to home-manager configuration:
   ```nix
   { inputs, ... }: {
     imports = [ inputs.openzellij.homeManagerModules.default ];
     programs.openzellij.enable = true;
   }
   ```
3. Apply configuration: `home-manager switch` (capture output).

#### B) NixOS system (flakes)
1. Add the same `inputs.openzellij` entry to `flake.nix`.
2. In `configuration.nix`, include:
   ```nix
   environment.systemPackages = [ inputs.openzellij.packages.${system}.default ];
   ```
3. Rebuild: `sudo nixos-rebuild switch`.

#### C) NixOS traditional (no flakes)
1. Reference plugin via `pkgs.callPackage /path/to/openzellij/nix/default.nix {}`.
2. Append the resulting derivation to `environment.systemPackages`.
3. Run `sudo nixos-rebuild switch`.

#### D) npm / Bun (cross-platform)
```bash
# pick global install unless user insists on local
npm install -g openzellij
# or
bun install -g openzellij
```
- For local installs, run `npm install openzellij` inside the project.

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
journalctl --user -u opencode.service -f  # if running via systemd
# or inspect ~/.local/share/opencode/logs/latest.log
```
- Confirm entries such as `openzellij: pane attached`, `openzellij: pane closed`.

---

## 5. Troubleshooting Playbook

| Symptom | Checks | Remediation |
|---------|--------|-------------|
| Plugin not discovered | `opencode --list-plugins` output missing `openzellij` | Ensure installation path is on `PATH` (npm) or included in Nix environment; add explicit entry to OpenCode config |
| Panes never spawn | Verify `zellijBinary` path, confirm `$ZELLIJ` env var is set inside session | Set `zellijBinary` to absolute path or run `eval $(zellij setup --generate-auto-start zsh)` |
| Panes stay open | Ensure `autoClosePanes: true`, inspect logs for polling errors | Increase `paneMissingGraceMs`; manually close pane while root cause is investigated |
| Build failures (Nix) | Nix complains about dirty tree | Run `git init && git add .` before `nix build` to satisfy flake purity |

---

## 6. Reporting Template

When finishing, respond with:

```
Setup Summary:
- Install path: <Home Manager | NixOS | npm>
- Config file updated: <yes/no>
- Verification result: <success/failure + key log line>
Issues Encountered:
- <list or "none">
Next Actions:
- <e.g., monitor logs, restart session>
```

Ensure any failure includes the exact command output and which checklist item needs attention.
