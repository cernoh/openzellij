/**
 * openzellij test harness
 *
 * Provides a fully programmatic, headless way to exercise the plugin without
 * needing real Zellij or OpenCode binaries.  Intended for:
 *
 *   - vitest unit/integration tests  (`npm test`)
 *   - nix checks                     (`nix check`)
 *   - AI-agent-driven iteration loops
 *
 * @example
 * ```ts
 * import { createTestHarness } from 'openzellij/testing'
 *
 * const harness = await createTestHarness()
 *
 * // Simulate OpenCode creating a session
 * await harness.fireEvent({
 *   type: 'session.created',
 *   session: { id: 'ses-abc', status: 'running' },
 * })
 *
 * // Plugin should have recorded a spawnPane call
 * console.log(harness.getCallLog())
 * // [ { op: 'spawnPane', command: 'opencode session attach ses-abc', ... } ]
 *
 * // Plugin should be tracking the pane
 * console.log(harness.getTrackedPanes())
 * // [ { sessionId: 'ses-abc', paneId: 'headless-pane-1', ... } ]
 *
 * await harness.dispose()
 * ```
 */

import type { ZellijPaneInfo, ZellijCLI } from './utils/zellij'
import type {
  PluginConfig,
  OpencodeClient,
  SessionDescriptor,
  PluginEventInput,
  SessionStatusResponse,
  TrackedPane,
} from './types'
import { DEFAULT_CONFIG } from './config'
import {
  PaneRegistryImpl,
  _setDependencies,
  _resetState,
  stopPolling,
  handleEvent,
  pollPaneStatus,
} from './lifecycle'

// ---------------------------------------------------------------------------
// Call-log types
// ---------------------------------------------------------------------------

export type HarnessCallRecord =
  | { op: 'spawnPane'; command: string; options: Record<string, unknown> }
  | { op: 'closePane'; paneId: string; options: Record<string, unknown> }
  | { op: 'listPanes' }
  | { op: 'detectSessionName' }

// ---------------------------------------------------------------------------
// HeadlessZellijCLI
// ---------------------------------------------------------------------------

/**
 * A no-op Zellij CLI that records every call instead of running the binary.
 *
 * Mutate `.panes` to control what `listPanes()` returns and simulate various
 * Zellij states (e.g. a pane that exited, or no panes at all).
 *
 * Read `.calls` after each test step to assert what the plugin did.
 */
export class HeadlessZellijCLI {
  /** All CLI calls made by the plugin, in order. */
  public readonly calls: HarnessCallRecord[] = []

  /**
   * The simulated pane list returned by `listPanes`.
   * Mutate between events / poll ticks to drive different outcomes.
   */
  public panes: ZellijPaneInfo[] = []

  private paneIdCounter = 0

  async detectSessionName(): Promise<string> {
    this.calls.push({ op: 'detectSessionName' })
    return process.env.ZELLIJ_SESSION_NAME ?? 'headless-session'
  }

  async listPanes(): Promise<ZellijPaneInfo[]> {
    this.calls.push({ op: 'listPanes' })
    return [...this.panes]
  }

  async spawnPane(
    command: string,
    options: { sessionName?: string; title?: string } = {},
  ): Promise<void> {
    this.calls.push({ op: 'spawnPane', command, options: options as Record<string, unknown> })
    // Simulate the new pane appearing in the list
    const id = `headless-pane-${++this.paneIdCounter}`
    this.panes.push({ id, name: options.title, exit_status: null })
  }

  async closePane(paneId: string, options: { sessionName?: string } = {}): Promise<void> {
    this.calls.push({ op: 'closePane', paneId, options: options as Record<string, unknown> })
    this.panes = this.panes.filter(p => p.id !== paneId)
  }
}

// ---------------------------------------------------------------------------
// MockOpencodeClient
// ---------------------------------------------------------------------------

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  meta?: Record<string, unknown>
}

/**
 * Controllable mock of the OpenCode client used inside the plugin.
 *
 * Set `.sessions` to control what the plugin sees during its polling cycle.
 * Read `.logEntries` to assert on plugin-emitted log output.
 */
export class MockOpencodeClient implements OpencodeClient {
  /** Sessions visible to the plugin on the next `session.status()` call. */
  public sessions: SessionDescriptor[] = []

  /** All log messages emitted by the plugin. */
  public readonly logEntries: LogEntry[] = []

  private _log(level: LogEntry['level']) {
    return (message: string | Error, meta?: Record<string, unknown>) => {
      const msg = message instanceof Error ? message.message : message
      this.logEntries.push({ level, message: msg, meta })
    }
  }

  readonly logger = {
    info: this._log('info'),
    warn: this._log('warn'),
    error: this._log('error'),
    debug: this._log('debug'),
  }

  session = {
    status: async (_opts?: { includeLogs?: boolean }): Promise<SessionStatusResponse> => {
      return { sessions: [...this.sessions] }
    },
    subscribe: (
      _listener: (event: PluginEventInput) => void | Promise<void>,
    ): (() => void) => {
      return () => {}
    },
  }
}

// ---------------------------------------------------------------------------
// TestHarness
// ---------------------------------------------------------------------------

export interface HarnessOptions {
  /**
   * Override any subset of the default plugin config.
   *
   * Note: `panePollIntervalMs` and `paneMissingGraceMs` are set to very small
   * values (50 ms and 100 ms respectively) by default so tests are fast.
   * Pass explicit values here to override them — e.g.
   * `{ paneMissingGraceMs: 500 }` to test a real grace-period window.
   */
  config?: Partial<PluginConfig>
  /** Sessions pre-loaded into the mock OpenCode client. */
  sessions?: SessionDescriptor[]
}

export interface TestHarness {
  /** Headless Zellij CLI — inspect `.calls`, mutate `.panes`. */
  zellijCLI: HeadlessZellijCLI
  /** Mock OpenCode client — mutate `.sessions`, read `.logEntries`. */
  opencodeClient: MockOpencodeClient
  /** Plugin pane registry. */
  registry: PaneRegistryImpl
  /** Config in effect for this harness. */
  config: PluginConfig

  /**
   * Fire a session lifecycle event directly into the plugin.
   * This is the primary driver for simulating OpenCode activity.
   */
  fireEvent(event: PluginEventInput): Promise<void>

  /**
   * Run one polling tick synchronously.
   * Drives auto-close, grace-period, and session-missing logic without
   * needing real timers.
   */
  poll(): Promise<void>

  /** All panes currently tracked by the plugin. */
  getTrackedPanes(): TrackedPane[]

  /** All Zellij CLI calls recorded so far. */
  getCallLog(): HarnessCallRecord[]

  /** All log entries emitted by the plugin so far. */
  getLogEntries(): LogEntry[]

  /** Tear down the harness — stops polling, resets plugin state. */
  dispose(): Promise<void>
}

/**
 * Create a fully wired, headless test harness for the openzellij plugin.
 *
 * No real Zellij binary or OpenCode server is required.
 *
 * The harness wires `HeadlessZellijCLI` and `MockOpencodeClient` into the
 * plugin's lifecycle module so you can fire events and poll without any
 * external processes.
 */
export async function createTestHarness(options: HarnessOptions = {}): Promise<TestHarness> {
  // Reset any leftover state from a previous harness in the same process
  _resetState()

  const config: PluginConfig = {
    ...DEFAULT_CONFIG,
    // Speed up timing-sensitive paths for tests
    panePollIntervalMs: 50,
    paneMissingGraceMs: 100,
    ...options.config,
  }

  const zellijCLI = new HeadlessZellijCLI()
  const opencodeClient = new MockOpencodeClient()

  if (options.sessions) {
    opencodeClient.sessions = [...options.sessions]
  }

  const registry = new PaneRegistryImpl()

  // Wire the lifecycle module with our headless fakes
  _setDependencies({
    registry,
    zellijCLI: zellijCLI as unknown as ZellijCLI,
    client: opencodeClient,
    config,
  })

  return {
    zellijCLI,
    opencodeClient,
    registry,
    config,

    async fireEvent(event: PluginEventInput): Promise<void> {
      await handleEvent(event)
    },

    async poll(): Promise<void> {
      await pollPaneStatus()
    },

    getTrackedPanes(): TrackedPane[] {
      return registry.getAll()
    },

    getCallLog(): HarnessCallRecord[] {
      return [...zellijCLI.calls]
    },

    getLogEntries(): LogEntry[] {
      return [...opencodeClient.logEntries]
    },

    async dispose(): Promise<void> {
      stopPolling()
      _resetState()
    },
  }
}
