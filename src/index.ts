import type { Plugin } from '@opencode-ai/plugin'
import { PaneRegistryImpl, startPolling, stopPolling, spawnPaneForSession, closePaneForSession } from './lifecycle'
import { loadConfig } from './config'
import { ZellijCLI } from './utils/zellij'
import type { SessionState, OpencodeClient } from './types'

export type { PluginConfig, TrackedPane } from './types'
export { loadConfig, DEFAULT_CONFIG } from './config'
export { ZellijCLI } from './utils/zellij'

let registry: PaneRegistryImpl | null = null
let zellijCLI: ZellijCLI | null = null
let client: OpencodeClient | null = null

export const openzellij: Plugin = async (ctx) => {
  const config = loadConfig()
  zellijCLI = new ZellijCLI(config)
  registry = new PaneRegistryImpl()
  
  client = {
    session: {
      status: async () => {
        const result = await ctx.client.session.list()
        const sessions = result.data || []
        
        return {
          sessions: sessions.map(s => ({
            id: s.id,
            title: s.title,
            parentId: s.parentID || null,
            status: 'running' as SessionState,
            metadata: {}
          }))
        }
      },
      subscribe: () => {
        return () => {}
      }
    },
    logger: {
      info: (message: string, meta?: Record<string, unknown>) => 
        console.log(`[openzellij] ${message}`, meta),
      warn: (message: string, meta?: Record<string, unknown>) => 
        console.warn(`[openzellij] ${message}`, meta),
      error: (message: string | Error, meta?: Record<string, unknown>) => 
        console.error(`[openzellij]`, message, meta),
      debug: (message: string, meta?: Record<string, unknown>) => 
        console.debug(`[openzellij] ${message}`, meta),
    }
  }
  
  const { _setDependencies } = await import('./lifecycle')
  _setDependencies({ registry, zellijCLI, client, config })
  
  startPolling()
  
  client?.logger?.info('openzellij plugin activated', { config })
  
  return {
    event: async ({ event }) => {
      if (!registry || !zellijCLI || !config || !client) {
        return
      }
      
      if (event.type === 'session.created') {
        const info = (event as any).properties.info
        const session = {
          id: info.id,
          title: info.title,
          parentId: info.parentID || null,
          status: 'running' as SessionState,
          metadata: {}
        }
        await spawnPaneForSession(session)
      } else if (event.type === 'session.deleted') {
        const info = (event as any).properties.info
        await closePaneForSession(info.id)
      }
    }
  }
}
