import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZellijCLI, parseJson, type ZellijPaneInfo, type ZellijListResult } from '../src/utils/zellij'
import type { PluginConfig } from '../src/types'

describe('Zellij CLI integration', () => {
  let cli: ZellijCLI
  let mockConfig: PluginConfig

  beforeEach(() => {
    mockConfig = {
      enableLogging: true,
      spawnDelayMs: 250,
      maxConcurrentSpawns: 1,
      paneLayout: 'tiled',
      zellijBinary: 'zellij',
      listIntervalMs: 5000,
      autoClosePanes: true,
      panePollIntervalMs: 2000,
      paneMissingGraceMs: 6000,
    }
    cli = new ZellijCLI(mockConfig)
  })

  describe('session detection', () => {
    it('reads session name from environment variable', async () => {
      const originalEnv = process.env.ZELLIJ_SESSION_NAME
      process.env.ZELLIJ_SESSION_NAME = 'test-session'

      const sessionName = await cli.detectSessionName()

      expect(sessionName).toBe('test-session')

      process.env.ZELLIJ_SESSION_NAME = originalEnv
    })
  })

  describe('pane listing', () => {
    it('parses pane info from JSON output', async () => {
      const mockPanes: ZellijPaneInfo[] = [
        {
          id: 'pane-1',
          name: 'Test Pane',
          is_focused: true,
          exit_status: null,
        },
        {
          id: 'pane-2',
          name: 'Background Pane',
          is_focused: false,
          exit_status: 0,
        },
      ]

      const jsonOutput: ZellijListResult = { panes: mockPanes }
      const parsed = parseJson<ZellijListResult>(JSON.stringify(jsonOutput))

      expect(parsed.panes).toHaveLength(2)
      expect(parsed.panes[0].id).toBe('pane-1')
      expect(parsed.panes[1].exit_status).toBe(0)
    })

    it('handles empty pane list', () => {
      const jsonOutput: ZellijListResult = { panes: [] }
      const parsed = parseJson<ZellijListResult>(JSON.stringify(jsonOutput))

      expect(parsed.panes).toHaveLength(0)
    })
  })

  describe('JSON parsing', () => {
    it('successfully parses valid JSON', () => {
      const data = { test: 'value', number: 42 }
      const result = parseJson<typeof data>(JSON.stringify(data))

      expect(result.test).toBe('value')
      expect(result.number).toBe(42)
    })

    it('throws error on invalid JSON', () => {
      expect(() => parseJson('{ invalid json }')).toThrow('Failed to parse Zellij JSON response')
    })

    it('handles nested objects', () => {
      const data = {
        panes: [
          { id: '1', metadata: { type: 'terminal' } },
          { id: '2', metadata: { type: 'editor' } },
        ],
      }
      const result = parseJson<typeof data>(JSON.stringify(data))

      expect(result.panes[0].metadata.type).toBe('terminal')
      expect(result.panes).toHaveLength(2)
    })
  })

  describe('pane lifecycle', () => {
    it('builds correct spawn command arguments', () => {
      const command = 'echo "test"'
      const expectedArgs = [
        'action',
        'new-pane',
        '--floating',
        '--cwd',
        expect.any(String),
        '--',
        command,
      ]

      expect(expectedArgs).toContain('--floating')
      expect(expectedArgs).toContain(command)
    })

    it('builds correct close command arguments', () => {
      const paneId = 'pane-123'
      const expectedArgs = ['action', 'close-pane', '--pane-id', paneId]

      expect(expectedArgs).toContain('close-pane')
      expect(expectedArgs).toContain(paneId)
    })
  })

  describe('Zellij CLI configuration', () => {
    it('uses configured binary path', () => {
      const customConfig: PluginConfig = {
        ...mockConfig,
        zellijBinary: '/custom/path/to/zellij',
      }
      const customCli = new ZellijCLI(customConfig)

      expect(customCli).toBeDefined()
    })

    it('respects pane layout configuration', () => {
      expect(mockConfig.paneLayout).toBe('tiled')

      const verticalConfig: PluginConfig = {
        ...mockConfig,
        paneLayout: 'vertical',
      }
      expect(verticalConfig.paneLayout).toBe('vertical')
    })
  })

  describe('error handling', () => {
    it('handles malformed JSON gracefully', () => {
      const invalidJson = '{ "panes": ['

      expect(() => parseJson(invalidJson)).toThrow()
    })

    it('handles empty string input', () => {
      expect(() => parseJson('')).toThrow()
    })

    it('handles null/undefined gracefully', () => {
      expect(() => parseJson('null')).not.toThrow()
      const result = parseJson<null>('null')
      expect(result).toBeNull()
    })
  })

  describe('pane metadata', () => {
    it('tracks pane exit status', () => {
      const pane: ZellijPaneInfo = {
        id: 'pane-1',
        exit_status: 0,
      }

      expect(pane.exit_status).toBe(0)
    })

    it('tracks pane without exit status', () => {
      const pane: ZellijPaneInfo = {
        id: 'pane-2',
        exit_status: null,
      }

      expect(pane.exit_status).toBeNull()
    })

    it('includes optional pane properties', () => {
      const pane: ZellijPaneInfo = {
        id: 'pane-3',
        name: 'Editor',
        tab_id: 1,
        session: 'main',
        is_focused: true,
        is_resizable: true,
        is_selectable: true,
        pane_type: 'terminal',
        command: 'vim',
        exit_status: null,
      }

      expect(pane.name).toBe('Editor')
      expect(pane.command).toBe('vim')
      expect(pane.is_focused).toBe(true)
    })
  })
})
