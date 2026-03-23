export type SessionLifecycleEvent =
  | 'session.created'
  | 'session.updated'
  | 'session.idle'
  | 'session.deleted'
  | 'session.logs'
  | 'session.progress'

export interface PluginContext {
  client: OpencodeClient
  directory: string
  serverUrl?: string
}

export interface OpencodeClient {
  session: {
    status(options?: { includeLogs?: boolean }): Promise<SessionStatusResponse>
    subscribe(listener: SessionSubscriptionHandler): () => void
  }
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void
    warn(message: string, meta?: Record<string, unknown>): void
    error(message: string | Error, meta?: Record<string, unknown>): void
    debug?(message: string, meta?: Record<string, unknown>): void
  }
}

export interface SessionStatusResponse {
  sessions: SessionDescriptor[]
}

export type SessionSubscriptionHandler = (event: PluginEventInput) => void | Promise<void>

export interface SessionDescriptor {
  id: string
  title?: string
  parentId?: string | null
  status: SessionState
  metadata?: Record<string, unknown>
}

export type SessionState = 'running' | 'idle' | 'completed' | 'failed' | 'unknown'

export interface PluginEventInput {
  type: SessionLifecycleEvent
  session: SessionDescriptor
}

export interface PluginInstance {
  name: string
  event: (input: PluginEventInput) => Promise<void>
  dispose?: () => Promise<void>
}

export interface TrackedPane {
  sessionId: string
  paneId: string
  processId?: number
  createdAt: number
  lastUpdatedAt: number
  title?: string
  exitStatus?: number | null
  missingSince?: number
}

export interface PaneRegistry {
  sessions: Map<string, TrackedPane>
  add(pane: TrackedPane): void
  remove(sessionId: string): void
  get(sessionId: string): TrackedPane | undefined
  getAll(): TrackedPane[]
  updateLastSeen(sessionId: string): void
}

export interface PluginConfig {
  enableLogging: boolean
  spawnDelayMs: number
  maxConcurrentSpawns: number
  paneLayout: 'tiled' | 'vertical' | 'horizontal'
  zellijBinary: string
  listIntervalMs: number
  autoClosePanes: boolean
  panePollIntervalMs: number
  paneMissingGraceMs: number
}

export interface PluginInput {
  context: PluginContext
}

export interface PluginOutput {
  name: string
  event: SessionEvent
}

export type SessionEvent = 
  | { type: 'custom'; payload: Record<string, unknown> }
  | { type: 'pane.spawned'; sessionId: string; paneId: string }
  | { type: 'pane.closed'; sessionId: string; paneId: string }
