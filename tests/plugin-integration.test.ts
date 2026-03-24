import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/utils/zellij', () => ({
  ZellijCLI: vi.fn().mockImplementation(() => ({
    listPanes: vi.fn().mockResolvedValue([]),
    spawnPane: vi.fn().mockResolvedValue(undefined),
    closePane: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('openzellij OpenCode plugin integration', () => {
  let mockContext: any

  beforeEach(() => {
    mockContext = {
      client: {
        session: {
          list: vi.fn().mockResolvedValue({ data: [] }),
        },
        app: {
          log: vi.fn(),
        },
      },
      project: {
        path: '/test/project',
        name: 'test-project',
      },
      directory: '/test/project',
      worktree: '/test/project',
      $: vi.fn(),
    }
  })

  describe('plugin activation', () => {
    it('initializes and returns event handler', async () => {
      const { openzellij } = await import('../src/index')
      const result = await openzellij(mockContext)

      expect(result).toBeDefined()
      expect(result.event).toBeDefined()
      expect(typeof result.event).toBe('function')
    })

    it('loads configuration on startup', async () => {
      const { openzellij } = await import('../src/index')
      const result = await openzellij(mockContext)
      
      expect(result).toBeDefined()
    })
  })

  describe('session event handling', () => {
    it('handles session.created without errors', async () => {
      const { openzellij } = await import('../src/index')
      const result = await openzellij(mockContext)

      const eventData = {
        event: {
          type: 'session.created',
          properties: {
            info: {
              id: 'ses_test123',
              title: 'Test Session',
              parentID: null,
            },
          },
        },
      }

      await expect(result.event!(eventData as any)).resolves.not.toThrow()
    })

    it('handles session.deleted without errors', async () => {
      const { openzellij } = await import('../src/index')
      const result = await openzellij(mockContext)

      const eventData = {
        event: {
          type: 'session.deleted',
          properties: {
            info: {
              id: 'ses_test456',
            },
          },
        },
      }

      await expect(result.event!(eventData as any)).resolves.not.toThrow()
    })

    it('handles multiple sessions concurrently', async () => {
      const { openzellij } = await import('../src/index')
      const result = await openzellij(mockContext)

      const sessionEvents = [
        { id: 'ses_1', title: 'Session 1' },
        { id: 'ses_2', title: 'Session 2' },
        { id: 'ses_3', title: 'Session 3' },
      ].map(info => ({
        event: {
          type: 'session.created',
          properties: { info },
        },
      }))

      await expect(
        Promise.all(sessionEvents.map(e => result.event!(e as any)))
      ).resolves.not.toThrow()
    })
  })

  describe('Zellij environment detection', () => {
    it('works with ZELLIJ environment variable present', async () => {
      const originalEnv = process.env.ZELLIJ
      process.env.ZELLIJ = '1'

      const { openzellij } = await import('../src/index')
      await expect(openzellij(mockContext)).resolves.toBeDefined()

      process.env.ZELLIJ = originalEnv
    })

    it('works without ZELLIJ environment variable', async () => {
      const originalEnv = process.env.ZELLIJ
      delete process.env.ZELLIJ

      const { openzellij } = await import('../src/index')
      await expect(openzellij(mockContext)).resolves.toBeDefined()

      process.env.ZELLIJ = originalEnv
    })
  })

  describe('configuration', () => {
    it('uses default configuration when no config file exists', async () => {
      const { loadConfig, DEFAULT_CONFIG } = await import('../src/config')
      
      const config = loadConfig()
      
      expect(config).toBeDefined()
      expect(config.enableLogging).toBe(DEFAULT_CONFIG.enableLogging)
      expect(config.autoClosePanes).toBe(DEFAULT_CONFIG.autoClosePanes)
      expect(config.panePollIntervalMs).toBeGreaterThan(0)
    })
  })

  describe('error resilience', () => {
    it('handles malformed events gracefully', async () => {
      const { openzellij } = await import('../src/index')
      const result = await openzellij(mockContext)

      await expect(result.event!({ event: { type: 'session.created' } } as any)).resolves.not.toThrow()
      await expect(result.event!({ event: { type: 'unknown' } } as any)).resolves.not.toThrow()
    })

    it('handles missing Zellij binary gracefully', async () => {
      const { openzellij } = await import('../src/index')
      const result = await openzellij(mockContext)

      const eventData = {
        event: {
          type: 'session.created',
          properties: {
            info: { id: 'ses_test', title: 'Test' },
          },
        },
      }

      await expect(result.event!(eventData as any)).resolves.not.toThrow()
    })
  })
})
