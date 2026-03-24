import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tool } from '@opencode-ai/plugin'

describe('OpenCode plugin tool hooks', () => {
  describe('tool.execute.before hook', () => {
    it('can intercept tool execution before it runs', async () => {
      const beforeHook = vi.fn(async (input, output) => {
        if (input.tool === 'bash') {
          output.args.command = `echo "intercepted: ${output.args.command}"`
        }
      })

      const mockInput = {
        tool: 'bash',
        args: { command: 'ls -la' },
      }
      const mockOutput = {
        args: { command: 'ls -la' },
      }

      await beforeHook(mockInput, mockOutput)

      expect(mockOutput.args.command).toBe('echo "intercepted: ls -la"')
      expect(beforeHook).toHaveBeenCalledWith(mockInput, mockOutput)
    })

    it('can prevent dangerous operations', async () => {
      const beforeHook = vi.fn(async (input, output) => {
        if (input.tool === 'edit' && output.args.filePath.includes('.env')) {
          throw new Error('Cannot edit .env files')
        }
      })

      const mockInput = {
        tool: 'edit',
        args: { filePath: '/project/.env' },
      }
      const mockOutput = {
        args: { filePath: '/project/.env', content: 'API_KEY=test' },
      }

      await expect(beforeHook(mockInput, mockOutput)).rejects.toThrow('Cannot edit .env files')
    })

    it('can modify tool arguments dynamically', async () => {
      const beforeHook = vi.fn(async (input, output) => {
        if (input.tool === 'read') {
          output.args.limit = Math.min(output.args.limit || 1000, 100)
        }
      })

      const mockInput = {
        tool: 'read',
        args: { filePath: '/test.txt', limit: 5000 },
      }
      const mockOutput = {
        args: { filePath: '/test.txt', limit: 5000 },
      }

      await beforeHook(mockInput, mockOutput)

      expect(mockOutput.args.limit).toBe(100)
    })
  })

  describe('tool.execute.after hook', () => {
    it('can process tool results after execution', async () => {
      const afterHook = vi.fn(async (input, output) => {
        if (input.tool === 'bash' && output.exitCode !== 0) {
          output.stderr = `[Plugin] Command failed with exit code ${output.exitCode}\n${output.stderr}`
        }
      })

      const mockInput = {
        tool: 'bash',
        args: { command: 'exit 1' },
      }
      const mockOutput = {
        stdout: '',
        stderr: 'command failed',
        exitCode: 1,
      }

      await afterHook(mockInput, mockOutput)

      expect(mockOutput.stderr).toContain('[Plugin] Command failed with exit code 1')
    })

    it('can log tool execution metrics', async () => {
      const metrics: any[] = []
      const afterHook = vi.fn(async (input, output) => {
        metrics.push({
          tool: input.tool,
          duration: output.duration || 0,
          success: !output.error,
        })
      })

      const mockInput = { tool: 'read', args: { filePath: '/test.txt' } }
      const mockOutput = { content: 'test content', duration: 42 }

      await afterHook(mockInput, mockOutput)

      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        tool: 'read',
        duration: 42,
        success: true,
      })
    })
  })

  describe('custom tool definition', () => {
    it('creates tool with schema validation', () => {
      const customTool = tool({
        description: 'Test custom tool',
        args: {
          message: tool.schema.string(),
          count: tool.schema.number().optional(),
        },
        async execute(args, context) {
          return `${args.message} (repeated ${args.count || 1} times)`
        },
      })

      expect(customTool).toBeDefined()
      expect(customTool.description).toBe('Test custom tool')
    })

    it('executes custom tool with context', async () => {
      const customTool = tool({
        description: 'Directory info tool',
        args: {},
        async execute(args, context) {
          return `Working in: ${context.directory}, Worktree: ${context.worktree}`
        },
      })

      const mockContext = {
        directory: '/test/project',
        worktree: '/test/project/.git/worktrees/feature',
      }

      const result = await customTool.execute({}, mockContext as any)
      expect(result).toBe('Working in: /test/project, Worktree: /test/project/.git/worktrees/feature')
    })
  })

  describe('shell.env hook', () => {
    it('injects environment variables', async () => {
      const envHook = vi.fn(async (input, output) => {
        output.env.MY_PLUGIN_VAR = 'test-value'
        output.env.PROJECT_ROOT = input.cwd
      })

      const mockInput = {
        cwd: '/test/project',
        command: 'npm test',
      }
      const mockOutput = {
        env: {} as Record<string, string>,
      }

      await envHook(mockInput, mockOutput)

      expect(mockOutput.env.MY_PLUGIN_VAR).toBe('test-value')
      expect(mockOutput.env.PROJECT_ROOT).toBe('/test/project')
    })
  })
})
