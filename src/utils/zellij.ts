import { execa } from 'execa'
import type { PluginConfig } from '../types'

export interface ZellijPaneInfo {
  id: string
  name?: string
  tab_id?: number
  session?: string
  is_focused?: boolean
  is_resizable?: boolean
  is_selectable?: boolean
  pane_type?: string
  command?: string
  exit_status?: number | null
}

export interface ZellijListResult {
  panes: ZellijPaneInfo[]
}

const DEFAULT_SESSION_ENV = 'ZELLIJ_SESSION_NAME'

export class ZellijCLI {
  constructor(private readonly config: PluginConfig) {}

  async detectSessionName(): Promise<string> {
    const envName = process.env[DEFAULT_SESSION_ENV]
    if (envName) return envName
    const { stdout } = await this.run(['action', 'current-session'])
    return stdout.trim()
  }

  async listPanes(options: { sessionName?: string } = {}): Promise<ZellijPaneInfo[]> {
    const args = ['action', 'list-panes', '--json']
    if (options.sessionName) args.push('--session', options.sessionName)
    const { stdout } = await this.run(args)
    const result = parseJson<ZellijListResult>(stdout)
    return result.panes ?? []
  }

  async spawnPane(command: string, options: { sessionName?: string; title?: string } = {}) {
    const args = ['action', 'new-pane', '--floating', '--cwd', process.cwd(), '--', command]
    if (options.sessionName) args.unshift('--session', options.sessionName)
    if (options.title) args.unshift('--title', options.title)
    await this.run(args)
  }

  async closePane(paneId: string, options: { sessionName?: string } = {}) {
    const args = ['action', 'close-pane', '--pane-id', paneId]
    if (options.sessionName) args.unshift('--session', options.sessionName)
    await this.run(args)
  }

  private run(args: string[]) {
    const binary = this.config.zellijBinary
    return execa(binary, args, { env: process.env })
  }
}

export function parseJson<T>(input: string): T {
  try {
    return JSON.parse(input) as T
  } catch (error) {
    throw new Error(`Failed to parse Zellij JSON response: ${(error as Error).message}`)
  }
}
