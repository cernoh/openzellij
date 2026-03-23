import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import {
  PaneRegistryImpl,
  onActivate,
  onDeactivate,
  handleEvent,
  startPolling,
  stopPolling,
  checkPaneCompletion,
  getRegistry,
  getPollingIntervalId,
  _setDependencies,
  _resetState,
  getActivePanes,
} from '../src/lifecycle'
import type {
  PluginInput,
  PluginEventInput,
  TrackedPane,
  SessionDescriptor,
  PluginConfig,
  OpencodeClient,
} from '../src/types'
import type { ZellijPaneInfo } from '../src/utils/zellij'

vi.mock('../src/config', () => ({
  loadConfig: vi.fn(() => ({
    enableLogging: true,
    spawnDelayMs: 250,
    maxConcurrentSpawns: 1,
    paneLayout: 'tiled',
    zellijBinary: 'zellij',
    listIntervalMs: 5000,
    autoClosePanes: true,
    panePollIntervalMs: 2000,
    paneMissingGraceMs: 6000,
  })),
}))

vi.mock('../src/utils/zellij', () => ({
  ZellijCLI: vi.fn().mockImplementation(() => ({
    listPanes: vi.fn().mockResolvedValue([]),
    spawnPane: vi.fn().mockResolvedValue(undefined),
    closePane: vi.fn().mockResolvedValue(undefined),
  })),
}))

function createMockClient(): OpencodeClient {
  return {
    session: {
      status: vi.fn().mockResolvedValue({ sessions: [] }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
}

function createMockConfig(overrides: Partial<PluginConfig> = {}): PluginConfig {
  return {
    enableLogging: true,
    spawnDelayMs: 250,
    maxConcurrentSpawns: 1,
    paneLayout: 'tiled',
    zellijBinary: 'zellij',
    listIntervalMs: 5000,
    autoClosePanes: true,
    panePollIntervalMs: 2000,
    paneMissingGraceMs: 6000,
    ...overrides,
  }
}

describe('PaneRegistryImpl', () => {
  let registry: PaneRegistryImpl

  beforeEach(() => {
    registry = new PaneRegistryImpl()
  })

  it('adds a pane', () => {
    const pane: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    registry.add(pane)
    expect(registry.get('ses-1')).toEqual(pane)
  })

  it('removes a pane', () => {
    const pane: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    registry.add(pane)
    registry.remove('ses-1')
    expect(registry.get('ses-1')).toBeUndefined()
  })

  it('returns undefined for non-existent pane', () => {
    expect(registry.get('non-existent')).toBeUndefined()
  })

  it('returns all panes', () => {
    const pane1: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    const pane2: TrackedPane = {
      sessionId: 'ses-2',
      paneId: 'pane-2',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    registry.add(pane1)
    registry.add(pane2)
    expect(registry.getAll()).toHaveLength(2)
    expect(registry.getAll()).toContainEqual(pane1)
    expect(registry.getAll()).toContainEqual(pane2)
  })

  it('updates lastSeen timestamp', () => {
    const originalTime = Date.now() - 10000
    const pane: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: originalTime,
      lastUpdatedAt: originalTime,
      missingSince: originalTime,
    }
    registry.add(pane)
    registry.updateLastSeen('ses-1')
    const updated = registry.get('ses-1')!
    expect(updated.lastUpdatedAt).toBeGreaterThan(originalTime)
    expect(updated.missingSince).toBeUndefined()
  })

  it('updateLastSeen does nothing for non-existent pane', () => {
    expect(() => registry.updateLastSeen('non-existent')).not.toThrow()
  })
})

describe('onActivate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetState()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetState()
  })

  it('initializes plugin and starts polling', async () => {
    const mockClient = createMockClient()
    const input: PluginInput = {
      context: {
        client: mockClient,
        directory: '/test',
      },
    }

    const result = await onActivate(input)

    expect(result.name).toBe('openzellij')
    expect(result.event.type).toBe('custom')
    expect(mockClient.session.subscribe).toHaveBeenCalled()
    expect(getRegistry()).toBeInstanceOf(PaneRegistryImpl)
    expect(getPollingIntervalId()).not.toBeNull()
  })
})

describe('onDeactivate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetState()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetState()
  })

  it('stops polling and clears registry', async () => {
    const mockClient = createMockClient()
    const input: PluginInput = {
      context: {
        client: mockClient,
        directory: '/test',
      },
    }

    await onActivate(input)
    expect(getPollingIntervalId()).not.toBeNull()

    await onDeactivate()
    expect(getPollingIntervalId()).toBeNull()
    expect(getRegistry()).toBeNull()
  })
})

describe('handleEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetState()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetState()
  })

  it('handles session.created by spawning pane', async () => {
    const mockClient = createMockClient()
    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    const event: PluginEventInput = {
      type: 'session.created',
      session: {
        id: 'ses-1',
        status: 'running',
      },
    }

    await handleEvent(event)
    const registry = getRegistry()!
    expect(registry.get('ses-1')).toBeDefined()
    // verify logger called on spawn
    expect(mockClient.logger?.info).toHaveBeenCalledWith(
      'Spawned pane for session',
      expect.objectContaining({ sessionId: 'ses-1', paneId: expect.any(String), title: expect.any(String) })
    )
  })

  it('handles session.deleted by closing pane', async () => {
    const mockClient = createMockClient()
    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    const registry = getRegistry()!
    registry.add({
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    })

    const event: PluginEventInput = {
      type: 'session.deleted',
      session: {
        id: 'ses-1',
        status: 'completed',
      },
    }

    await handleEvent(event)
    expect(registry.get('ses-1')).toBeUndefined()
    expect(mockClient.logger?.info).toHaveBeenCalledWith(
      'Closed pane for session',
      expect.objectContaining({ sessionId: 'ses-1', paneId: 'pane-1', reason: expect.any(String) })
    )
  })

  it('handles session.updated with terminal state', async () => {
    const mockClient = createMockClient()
    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    const registry = getRegistry()!
    registry.add({
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    })

    const event: PluginEventInput = {
      type: 'session.updated',
      session: {
        id: 'ses-1',
        status: 'completed',
      },
    }

    await handleEvent(event)
    expect(registry.get('ses-1')).toBeUndefined()
  })

  it('does nothing when not initialized', async () => {
    const event: PluginEventInput = {
      type: 'session.created',
      session: {
        id: 'ses-1',
        status: 'running',
      },
    }

    await expect(handleEvent(event)).resolves.not.toThrow()
  })
})

describe('startPolling / stopPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetState()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetState()
  })

  it('starts polling with configured interval', async () => {
    const mockClient = createMockClient()
    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    expect(getPollingIntervalId()).not.toBeNull()

    const registry = getRegistry()!
    registry.add({
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    })

    vi.advanceTimersByTime(2000)
    await vi.runOnlyPendingTimersAsync()

    expect(mockClient.session.status).toHaveBeenCalled()
  })

  it('stops polling on stopPolling call', async () => {
    const mockClient = createMockClient()
    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    stopPolling()
    expect(getPollingIntervalId()).toBeNull()
  })

  it('does not start polling without config', () => {
    startPolling()
    expect(getPollingIntervalId()).toBeNull()
  })
})

describe('checkPaneCompletion', () => {
  const cfg = createMockConfig()

  it('returns pane_exited when pane has exit status', () => {
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>([
      ['pane-1', { id: 'pane-1', exit_status: 0 }],
    ])
    const sessions = new Map<string, SessionDescriptor>([
      ['ses-1', { id: 'ses-1', status: 'running' }],
    ])

    expect(checkPaneCompletion(tracked, zellijPanes, sessions, Date.now(), cfg)).toBe('pane_exited')
  })

  it('returns session_completed for completed session', () => {
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>([
      ['pane-1', { id: 'pane-1', exit_status: null }],
    ])
    const sessions = new Map<string, SessionDescriptor>([
      ['ses-1', { id: 'ses-1', status: 'completed' }],
    ])

    expect(checkPaneCompletion(tracked, zellijPanes, sessions, Date.now(), cfg)).toBe('session_completed')
  })

  it('returns session_failed for failed session', () => {
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>()
    const sessions = new Map<string, SessionDescriptor>([
      ['ses-1', { id: 'ses-1', status: 'failed' }],
    ])

    expect(checkPaneCompletion(tracked, zellijPanes, sessions, Date.now(), cfg)).toBe('session_failed')
  })

  it('returns session_idle for idle session', () => {
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>()
    const sessions = new Map<string, SessionDescriptor>([
      ['ses-1', { id: 'ses-1', status: 'idle' }],
    ])

    expect(checkPaneCompletion(tracked, zellijPanes, sessions, Date.now(), cfg)).toBe('session_idle')
  })

  it('sets missingSince on first missing session detection', () => {
    const now = Date.now()
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: now,
      lastUpdatedAt: now,
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>()
    const sessions = new Map<string, SessionDescriptor>()

    const result = checkPaneCompletion(tracked, zellijPanes, sessions, now, cfg)
    expect(result).toBeNull()
    expect(tracked.missingSince).toBe(now)
  })

  it('returns session_missing_grace_exceeded after grace period', () => {
    const startTime = Date.now()
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: startTime,
      lastUpdatedAt: startTime,
      missingSince: startTime,
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>()
    const sessions = new Map<string, SessionDescriptor>()

    const afterGrace = startTime + 6001
    const result = checkPaneCompletion(tracked, zellijPanes, sessions, afterGrace, cfg)
    expect(result).toBe('session_missing_grace_exceeded')
  })

  it('returns null within grace period', () => {
    const startTime = Date.now()
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: startTime,
      lastUpdatedAt: startTime,
      missingSince: startTime,
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>()
    const sessions = new Map<string, SessionDescriptor>()

    const withinGrace = startTime + 5000
    const result = checkPaneCompletion(tracked, zellijPanes, sessions, withinGrace, cfg)
    expect(result).toBeNull()
  })

  it('clears missingSince when session reappears', () => {
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
      missingSince: Date.now() - 1000,
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>()
    const sessions = new Map<string, SessionDescriptor>([
      ['ses-1', { id: 'ses-1', status: 'running' }],
    ])

    checkPaneCompletion(tracked, zellijPanes, sessions, Date.now(), cfg)
    expect(tracked.missingSince).toBeUndefined()
  })

  it('returns null for running session', () => {
    const tracked: TrackedPane = {
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    const zellijPanes = new Map<string, ZellijPaneInfo>([
      ['pane-1', { id: 'pane-1' }],
    ])
    const sessions = new Map<string, SessionDescriptor>([
      ['ses-1', { id: 'ses-1', status: 'running' }],
    ])

    expect(checkPaneCompletion(tracked, zellijPanes, sessions, Date.now(), cfg)).toBeNull()
  })
})

describe('polling auto-close integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetState()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetState()
  })

  it('auto-closes panes when session completes', async () => {
    const mockClient = createMockClient()
    ;(mockClient.session.status as Mock).mockResolvedValue({
      sessions: [{ id: 'ses-1', status: 'completed' }],
    })

    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    const registry = getRegistry()!
    registry.add({
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    })

    vi.advanceTimersByTime(2000)
    await vi.runOnlyPendingTimersAsync()

    expect(registry.get('ses-1')).toBeUndefined()
    // verify logging of active panes every 10 cycles — simulate 9 more cycles
    for (let i = 0; i < 9; i++) {
      vi.advanceTimersByTime(2000)
      // run pending
      // eslint-disable-next-line no-await-in-loop
      await vi.runOnlyPendingTimersAsync()
    }

    // after 10 cycles, debug should have been called with active panes (may be 'No active panes')
    expect(mockClient.logger?.debug).toHaveBeenCalled()
  })

  it('respects grace period for missing sessions', async () => {
    const baseTime = new Date('2024-01-01T00:00:00Z').getTime()
    vi.setSystemTime(baseTime)
    
    const mockClient = createMockClient()
    ;(mockClient.session.status as Mock).mockResolvedValue({ sessions: [] })

    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    const registry = getRegistry()!
    registry.add({
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    })

    await vi.advanceTimersByTimeAsync(2500)
    
    const pane1 = registry.get('ses-1')
    expect(pane1).toBeDefined()
    expect(pane1!.missingSince).toBeDefined()

    await vi.advanceTimersByTimeAsync(2500)
    
    const pane2 = registry.get('ses-1')
    expect(pane2).toBeDefined()

    await vi.advanceTimersByTimeAsync(4000)
    
    expect(registry.get('ses-1')).toBeUndefined()
  })

  it('does not auto-close when autoClosePanes is false', async () => {
    const { loadConfig } = await import('../src/config')
    ;(loadConfig as Mock).mockReturnValue({
      enableLogging: true,
      spawnDelayMs: 250,
      maxConcurrentSpawns: 1,
      paneLayout: 'tiled',
      zellijBinary: 'zellij',
      listIntervalMs: 5000,
      autoClosePanes: false,
      panePollIntervalMs: 2000,
      paneMissingGraceMs: 6000,
    })

    const mockClient = createMockClient()
    ;(mockClient.session.status as Mock).mockResolvedValue({
      sessions: [{ id: 'ses-1', status: 'completed' }],
    })

    await onActivate({
      context: { client: mockClient, directory: '/test' },
    })

    const registry = getRegistry()!
    registry.add({
      sessionId: 'ses-1',
      paneId: 'pane-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    })

    vi.advanceTimersByTime(2000)
    await vi.runOnlyPendingTimersAsync()

    expect(registry.get('ses-1')).toBeDefined()
  })
})
