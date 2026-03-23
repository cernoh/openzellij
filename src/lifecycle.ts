import type {
  PluginInput,
  PluginOutput,
  PluginEventInput,
  SessionEvent,
  PaneRegistry,
  TrackedPane,
  PluginConfig,
  OpencodeClient,
  SessionDescriptor,
  SessionState,
} from './types'
import { loadConfig } from './config'
import { ZellijCLI, type ZellijPaneInfo } from './utils/zellij'

let pollingIntervalId: ReturnType<typeof setInterval> | null = null
let registry: PaneRegistryImpl | null = null
let zellijCLI: ZellijCLI | null = null
let client: OpencodeClient | null = null
let config: PluginConfig | null = null
let unsubscribe: (() => void) | null = null
let pollCycleCount = 0

const TERMINAL_STATES: SessionState[] = ['completed', 'failed', 'idle']

export class PaneRegistryImpl implements PaneRegistry {
  public sessions: Map<string, TrackedPane> = new Map()

  add(pane: TrackedPane): void {
    this.sessions.set(pane.sessionId, pane)
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  get(sessionId: string): TrackedPane | undefined {
    return this.sessions.get(sessionId)
  }

  getAll(): TrackedPane[] {
    return Array.from(this.sessions.values())
  }

  updateLastSeen(sessionId: string): void {
    const pane = this.sessions.get(sessionId)
    if (pane) {
      pane.lastUpdatedAt = Date.now()
      pane.missingSince = undefined
    }
  }
}

export async function onActivate(input: PluginInput): Promise<PluginOutput> {
  config = loadConfig()
  zellijCLI = new ZellijCLI(config)
  registry = new PaneRegistryImpl()
  client = input.context.client
  
  unsubscribe = client.session.subscribe((event: PluginEventInput) => {
    handleEvent(event).catch((err) => {
      client?.logger?.error(err instanceof Error ? err : new Error(String(err)), {
        context: 'session subscription handler'
      })
    })
  })
  
  startPolling()
  
  client?.logger?.info('openzellij plugin activated', { config })
  
  return {
    name: 'openzellij',
    event: { type: 'custom', payload: { message: 'activated' } } as SessionEvent
  }
}

export async function onDeactivate(): Promise<void> {
  stopPolling()
  
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  
  if (config?.autoClosePanes && registry && zellijCLI) {
    const panes = registry.getAll()
    for (const pane of panes) {
      try {
        await closePaneForSession(pane.sessionId)
      } catch (err) {
        client?.logger?.warn(`Failed to close pane for session ${pane.sessionId}`, {
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }
  
  if (registry) {
    registry.sessions.clear()
  }
  
  registry = null
  zellijCLI = null
  config = null
  client = null
}

export async function handleEvent(event: PluginEventInput): Promise<void> {
  if (!registry || !zellijCLI || !config || !client) {
    return
  }
  
  const { type, session } = event
  
  client?.logger?.debug?.(`Received event: ${type}`, { sessionId: session.id })
  
  switch (type) {
    case 'session.created':
      await spawnPaneForSession(session)
      break
      
    case 'session.deleted':
      await closePaneForSession(session.id)
      break
      
    case 'session.idle':
    case 'session.updated':
      registry.updateLastSeen(session.id)
      if (TERMINAL_STATES.includes(session.status) && config.autoClosePanes) {
        await closePaneForSession(session.id)
      }
      break
      
    case 'session.logs':
    case 'session.progress':
      registry.updateLastSeen(session.id)
      break
  }
}

export function startPolling(): void {
  if (pollingIntervalId !== null) {
    return
  }
  
  if (!config) {
    return
  }
  
  pollingIntervalId = setInterval(() => {
    pollPaneStatus().catch((err) => {
      client?.logger?.error(err instanceof Error ? err : new Error(String(err)), {
        context: 'polling loop'
      })
    })
  }, config.panePollIntervalMs)
}

export function stopPolling(): void {
  if (pollingIntervalId !== null) {
    clearInterval(pollingIntervalId)
    pollingIntervalId = null
  }
}

async function pollPaneStatus(): Promise<void> {
  if (!registry || !zellijCLI || !config || !client) {
    return
  }

  // increment cycle counter and periodically log active panes
  pollCycleCount += 1
  if (pollCycleCount % 10 === 0) {
    client?.logger?.debug?.(getActivePanes(registry))
  }
  
  const trackedPanes = registry.getAll()
  if (trackedPanes.length === 0) {
    return
  }
  
  try {
    const statusResponse = await client.session.status()
    const sessionMap = new Map(
      statusResponse.sessions.map(s => [s.id, s])
    )
    
    const zellijPanes = await zellijCLI.listPanes()
    const zellijPaneMap = new Map(
      zellijPanes.map(p => [p.id, p])
    )
    
    const now = Date.now()
    
    for (const tracked of trackedPanes) {
      const shouldClose = checkPaneCompletion(
        tracked,
        zellijPaneMap,
        sessionMap,
        now,
        config
      )
      
      if (shouldClose && config.autoClosePanes) {
        client?.logger?.info(`Auto-closing pane for session ${tracked.sessionId}`, {
          reason: shouldClose
        })
        await closePaneForSession(tracked.sessionId)
      }
    }
  } catch (err) {
    client?.logger?.warn('Polling iteration failed', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function spawnPaneForSession(session: SessionDescriptor): Promise<void> {
  if (!registry || !zellijCLI || !config || !client) {
    return
  }
  
  if (registry.get(session.id)) {
    client?.logger?.debug?.(`Pane already exists for session ${session.id}`)
    return
  }
  
  try {
    const command = `opencode session attach ${session.id}`
    const title = session.title || `opencode-${session.id.slice(0, 8)}`
    
    await zellijCLI.spawnPane(command, { title })
    
    const panes = await zellijCLI.listPanes()
    const latestPane = panes[panes.length - 1]
    
    const trackedPane: TrackedPane = {
      sessionId: session.id,
      paneId: latestPane?.id || `unknown-${Date.now()}`,
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
      title,
    }
    
    registry.add(trackedPane)
    
    client?.logger?.info('Spawned pane for session', {
      sessionId: session.id,
      paneId: trackedPane.paneId,
      title,
    })
  } catch (err) {
    client?.logger?.error(err instanceof Error ? err : new Error(String(err)), {
      context: `spawning pane for session ${session.id}`
    })
  }
}

export async function closePaneForSession(sessionId: string): Promise<void> {
  if (!registry || !zellijCLI) {
    return
  }
  
  const tracked = registry.get(sessionId)
  if (!tracked) {
    return
  }
  
  try {
    await zellijCLI.closePane(tracked.paneId)
    const reason = 'closed'
    client?.logger?.info('Closed pane for session', {
      sessionId,
      paneId: tracked.paneId,
      reason,
    })
  } catch {
    client?.logger?.warn(`Failed to close pane for session ${sessionId}`, {
      paneId: tracked.paneId
    })
  } finally {
    registry.remove(sessionId)
  }
}

export function checkPaneCompletion(
  tracked: TrackedPane,
  zellijPanes: Map<string, ZellijPaneInfo>,
  sessions: Map<string, SessionDescriptor>,
  now: number,
  cfg: PluginConfig
): string | null {
  const zellijPane = zellijPanes.get(tracked.paneId)
  const session = sessions.get(tracked.sessionId)
  
  if (zellijPane && zellijPane.exit_status !== null && zellijPane.exit_status !== undefined) {
    return 'pane_exited'
  }
  
  if (session && TERMINAL_STATES.includes(session.status)) {
    return `session_${session.status}`
  }
  
  if (!session) {
    if (!tracked.missingSince) {
      tracked.missingSince = now
      return null
    }
    
    const missingDuration = now - tracked.missingSince
    if (missingDuration >= cfg.paneMissingGraceMs) {
      return 'session_missing_grace_exceeded'
    }
  } else {
    tracked.missingSince = undefined
  }
  
  return null
}

export function getRegistry(): PaneRegistryImpl | null {
  return registry
}

export function getPollingIntervalId(): ReturnType<typeof setInterval> | null {
  return pollingIntervalId
}

export function getActivePanes(reg?: PaneRegistryImpl): string {
  const r = reg || registry
  if (!r) return 'No active panes'
  const panes = r.getAll()
  if (panes.length === 0) return 'No active panes'

  const entries = panes.map(p => {
    const title = p.title ?? 'no-title'
    const duration = Math.floor((Date.now() - p.createdAt) / 1000)
    return `${p.sessionId} → ${p.paneId} (${title}, duration: ${duration}s)`
  })

  return `Active panes: [${entries.join(', ')}]`
}

export function _setDependencies(deps: {
  registry?: PaneRegistryImpl
  zellijCLI?: ZellijCLI
  client?: OpencodeClient
  config?: PluginConfig
}): void {
  if (deps.registry !== undefined) registry = deps.registry
  if (deps.zellijCLI !== undefined) zellijCLI = deps.zellijCLI
  if (deps.client !== undefined) client = deps.client
  if (deps.config !== undefined) config = deps.config
}

export function _resetState(): void {
  stopPolling()
  registry = null
  zellijCLI = null
  client = null
  config = null
  unsubscribe = null
}
