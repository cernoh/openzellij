import { describe, expect, it, vi } from 'vitest'
import { writeFileSync, mkdtempSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('config loader', () => {
  it('returns defaults when file absent', async () => {
    const original = process.env.XDG_CONFIG_HOME
    const dir = mkdtempSync(join(tmpdir(), 'openzellij-'))
    process.env.XDG_CONFIG_HOME = dir

    vi.resetModules()
    const { loadConfig, DEFAULT_CONFIG } = await import('../src/config')
    const config = loadConfig()
    expect(config.enableLogging).toBe(DEFAULT_CONFIG.enableLogging)

    process.env.XDG_CONFIG_HOME = original
  })

  it('parses file', async () => {
    const original = process.env.XDG_CONFIG_HOME
    const dir = mkdtempSync(join(tmpdir(), 'openzellij-'))
    process.env.XDG_CONFIG_HOME = dir

    const cfgPath = join(dir, 'opencode', 'openzellij.json')
    mkdirSync(join(dir, 'opencode'), { recursive: true })
    writeFileSync(cfgPath, JSON.stringify({ spawnDelayMs: 10 }))

    vi.resetModules()
    const { loadConfig } = await import('../src/config')
    const config = loadConfig()
    expect(config.spawnDelayMs).toBe(10)

    process.env.XDG_CONFIG_HOME = original
  })
})
