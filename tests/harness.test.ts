/**
 * Tests for the headless test harness.
 *
 * These tests serve a dual purpose:
 *   1. Validate that the harness itself is correct.
 *   2. Show AI agents (and humans) exactly how to drive the plugin
 *      programmatically — no real Zellij or OpenCode needed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createTestHarness,
  HeadlessZellijCLI,
  MockOpencodeClient,
} from '../src/testing'
import type { TestHarness } from '../src/testing'

// ---------------------------------------------------------------------------
// HeadlessZellijCLI unit tests
// ---------------------------------------------------------------------------

describe('HeadlessZellijCLI', () => {
  let cli: HeadlessZellijCLI

  beforeEach(() => {
    cli = new HeadlessZellijCLI()
  })

  it('records detectSessionName call', async () => {
    const name = await cli.detectSessionName()
    expect(name).toBe('headless-session')
    expect(cli.calls).toContainEqual({ op: 'detectSessionName' })
  })

  it('records listPanes call and returns current panes', async () => {
    cli.panes = [{ id: 'p1', exit_status: null }]
    const result = await cli.listPanes()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(cli.calls).toContainEqual({ op: 'listPanes' })
  })

  it('records spawnPane call and adds pane to list', async () => {
    await cli.spawnPane('opencode session attach ses-1', { title: 'My Session' })
    expect(cli.calls).toContainEqual(
      expect.objectContaining({ op: 'spawnPane', command: 'opencode session attach ses-1' }),
    )
    expect(cli.panes).toHaveLength(1)
    expect(cli.panes[0].name).toBe('My Session')
    expect(cli.panes[0].exit_status).toBeNull()
  })

  it('records closePane call and removes pane from list', async () => {
    await cli.spawnPane('opencode session attach ses-1', { title: 'My Session' })
    const paneId = cli.panes[0].id
    await cli.closePane(paneId)
    expect(cli.calls).toContainEqual(
      expect.objectContaining({ op: 'closePane', paneId }),
    )
    expect(cli.panes).toHaveLength(0)
  })

  it('generates unique pane IDs for successive spawns', async () => {
    await cli.spawnPane('cmd-a')
    await cli.spawnPane('cmd-b')
    const ids = cli.panes.map(p => p.id)
    expect(ids[0]).not.toBe(ids[1])
    expect(ids[0]).toMatch(/^headless-pane-/)
    expect(ids[1]).toMatch(/^headless-pane-/)
  })

  it('reads ZELLIJ_SESSION_NAME env var for session name', async () => {
    const original = process.env.ZELLIJ_SESSION_NAME
    process.env.ZELLIJ_SESSION_NAME = 'my-zellij'
    const name = await cli.detectSessionName()
    expect(name).toBe('my-zellij')
    process.env.ZELLIJ_SESSION_NAME = original
  })
})

// ---------------------------------------------------------------------------
// MockOpencodeClient unit tests
// ---------------------------------------------------------------------------

describe('MockOpencodeClient', () => {
  it('returns configured sessions from status()', async () => {
    const client = new MockOpencodeClient()
    client.sessions = [{ id: 'ses-1', status: 'running' }]
    const result = await client.session.status()
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0].id).toBe('ses-1')
  })

  it('records log entries at the correct level', () => {
    const client = new MockOpencodeClient()
    client.logger.info('hello', { x: 1 })
    client.logger.warn('warning')
    client.logger.error(new Error('boom'))
    client.logger.debug('trace')

    expect(client.logEntries).toHaveLength(4)
    expect(client.logEntries[0]).toMatchObject({ level: 'info', message: 'hello', meta: { x: 1 } })
    expect(client.logEntries[1]).toMatchObject({ level: 'warn', message: 'warning' })
    expect(client.logEntries[2]).toMatchObject({ level: 'error', message: 'boom' })
    expect(client.logEntries[3]).toMatchObject({ level: 'debug', message: 'trace' })
  })

  it('subscribe returns an unsubscribe function', () => {
    const client = new MockOpencodeClient()
    const unsub = client.session.subscribe(() => {})
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// createTestHarness integration tests
// ---------------------------------------------------------------------------

describe('createTestHarness', () => {
  let harness: TestHarness

  beforeEach(async () => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    vi.useRealTimers()
    if (harness) await harness.dispose()
  })

  it('creates harness with default config', async () => {
    harness = await createTestHarness()
    expect(harness.config.autoClosePanes).toBe(true)
    expect(harness.config.panePollIntervalMs).toBe(50)
    expect(harness.config.paneMissingGraceMs).toBe(100)
  })

  it('allows config overrides', async () => {
    harness = await createTestHarness({ config: { autoClosePanes: false } })
    expect(harness.config.autoClosePanes).toBe(false)
  })

  it('pre-loads sessions from options', async () => {
    harness = await createTestHarness({
      sessions: [{ id: 'ses-pre', status: 'running' }],
    })
    const statusResult = await harness.opencodeClient.session.status()
    expect(statusResult.sessions[0].id).toBe('ses-pre')
  })

  // ------------------------------------------------------------------
  // fireEvent
  // ------------------------------------------------------------------

  describe('fireEvent', () => {
    it('session.created spawns a pane', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })

      expect(harness.getTrackedPanes()).toHaveLength(1)
      expect(harness.getTrackedPanes()[0].sessionId).toBe('ses-1')

      const spawns = harness.getCallLog().filter(c => c.op === 'spawnPane')
      expect(spawns).toHaveLength(1)
      expect((spawns[0] as any).command).toContain('ses-1')
    })

    it('session.deleted closes the tracked pane', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })
      expect(harness.getTrackedPanes()).toHaveLength(1)

      await harness.fireEvent({
        type: 'session.deleted',
        session: { id: 'ses-1', status: 'completed' },
      })
      expect(harness.getTrackedPanes()).toHaveLength(0)

      const closes = harness.getCallLog().filter(c => c.op === 'closePane')
      expect(closes).toHaveLength(1)
    })

    it('session.updated with terminal state auto-closes the pane', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })
      await harness.fireEvent({
        type: 'session.updated',
        session: { id: 'ses-1', status: 'completed' },
      })

      expect(harness.getTrackedPanes()).toHaveLength(0)
    })

    it('session.idle with terminal state auto-closes the pane', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-2', status: 'running' },
      })
      await harness.fireEvent({
        type: 'session.idle',
        session: { id: 'ses-2', status: 'idle' },
      })

      expect(harness.getTrackedPanes()).toHaveLength(0)
    })

    it('does not spawn duplicate panes for the same session', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({ type: 'session.created', session: { id: 'ses-dup', status: 'running' } })
      await harness.fireEvent({ type: 'session.created', session: { id: 'ses-dup', status: 'running' } })

      expect(harness.getTrackedPanes()).toHaveLength(1)
      const spawns = harness.getCallLog().filter(c => c.op === 'spawnPane')
      expect(spawns).toHaveLength(1)
    })

    it('handles multiple concurrent sessions independently', async () => {
      harness = await createTestHarness()

      await Promise.all([
        harness.fireEvent({ type: 'session.created', session: { id: 'ses-a', status: 'running' } }),
        harness.fireEvent({ type: 'session.created', session: { id: 'ses-b', status: 'running' } }),
        harness.fireEvent({ type: 'session.created', session: { id: 'ses-c', status: 'running' } }),
      ])

      expect(harness.getTrackedPanes()).toHaveLength(3)
    })
  })

  // ------------------------------------------------------------------
  // poll()
  // ------------------------------------------------------------------

  describe('poll()', () => {
    it('auto-closes a pane when session becomes completed', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })
      expect(harness.getTrackedPanes()).toHaveLength(1)

      // Signal to the mock client that the session is now complete
      harness.opencodeClient.sessions = [{ id: 'ses-1', status: 'completed' }]

      await harness.poll()

      expect(harness.getTrackedPanes()).toHaveLength(0)
    })

    it('does not auto-close when autoClosePanes is false', async () => {
      harness = await createTestHarness({ config: { autoClosePanes: false } })

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })
      harness.opencodeClient.sessions = [{ id: 'ses-1', status: 'completed' }]

      await harness.poll()

      expect(harness.getTrackedPanes()).toHaveLength(1)
    })

    it('auto-closes a pane when the Zellij pane exits', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })

      // Keep session alive but mark the Zellij pane as exited
      const trackedPaneId = harness.getTrackedPanes()[0].paneId
      harness.zellijCLI.panes = [{ id: trackedPaneId, exit_status: 0 }]
      harness.opencodeClient.sessions = [{ id: 'ses-1', status: 'running' }]

      await harness.poll()

      expect(harness.getTrackedPanes()).toHaveLength(0)
    })

    it('respects grace period before closing a missing session', async () => {
      harness = await createTestHarness({ config: { paneMissingGraceMs: 500 } })

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })

      // Session disappears from OpenCode — grace period should prevent immediate close
      harness.opencodeClient.sessions = []
      await harness.poll()

      // Still tracked — within grace period
      expect(harness.getTrackedPanes()).toHaveLength(1)
      expect(harness.getTrackedPanes()[0].missingSince).toBeDefined()
    })

    it('closes pane after grace period expires', async () => {
      // Grace period of 0 ms means the first poll sets missingSince to `now`,
      // and any subsequent poll finds (now - missingSince) >= 0, so it closes.
      harness = await createTestHarness({ config: { paneMissingGraceMs: 0 } })

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })

      harness.opencodeClient.sessions = []
      // First poll — sets missingSince; grace already exceeded (0 ms)
      await harness.poll()
      // Second poll — grace definitely expired, pane should close
      await harness.poll()

      expect(harness.getTrackedPanes()).toHaveLength(0)
    })

    it('enforces a realistic grace period using fake timers', async () => {
      // Grace of 200 ms — use vi.setSystemTime to advance past it
      harness = await createTestHarness({ config: { paneMissingGraceMs: 200 } })

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })

      harness.opencodeClient.sessions = []

      // Poll 1: sets missingSince = now
      await harness.poll()
      expect(harness.getTrackedPanes()).toHaveLength(1)

      // Advance clock by 100 ms — still within grace period
      vi.advanceTimersByTime(100)
      await harness.poll()
      expect(harness.getTrackedPanes()).toHaveLength(1)

      // Advance clock past the 200 ms grace period
      vi.advanceTimersByTime(150)
      await harness.poll()
      expect(harness.getTrackedPanes()).toHaveLength(0)
    })

    it('is a no-op when no panes are tracked', async () => {
      harness = await createTestHarness()
      await expect(harness.poll()).resolves.not.toThrow()
    })
  })

  // ------------------------------------------------------------------
  // getCallLog / getLogEntries
  // ------------------------------------------------------------------

  describe('getCallLog()', () => {
    it('returns a snapshot, not a live reference', async () => {
      harness = await createTestHarness()
      const log1 = harness.getCallLog()

      await harness.fireEvent({ type: 'session.created', session: { id: 'ses-1', status: 'running' } })

      const log2 = harness.getCallLog()
      expect(log1.length).toBeLessThan(log2.length)
    })
  })

  describe('getLogEntries()', () => {
    it('captures plugin log output', async () => {
      harness = await createTestHarness()

      await harness.fireEvent({
        type: 'session.created',
        session: { id: 'ses-1', status: 'running' },
      })

      const entries = harness.getLogEntries()
      const infoEntries = entries.filter(e => e.level === 'info')
      expect(infoEntries.length).toBeGreaterThan(0)
      expect(infoEntries.some(e => e.message.includes('Spawned pane'))).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // dispose()
  // ------------------------------------------------------------------

  describe('dispose()', () => {
    it('cleans up state so subsequent tests start fresh', async () => {
      const h1 = await createTestHarness()
      await h1.fireEvent({ type: 'session.created', session: { id: 'ses-1', status: 'running' } })
      expect(h1.getTrackedPanes()).toHaveLength(1)

      await h1.dispose()

      // Create a new harness — should start with zero panes
      const h2 = await createTestHarness()
      harness = h2
      expect(h2.getTrackedPanes()).toHaveLength(0)
    })
  })
})
