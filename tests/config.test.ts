import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('config loader', () => {
  it('returns defaults when file absent', () => {
    const original = process.env.XDG_CONFIG_HOME
    const dir = mkdtempSync(join(tmpdir(), 'openzellij-'))
    process.env.XDG_CONFIG_HOME = dir

    const config = loadConfig()
    expect(config.enableLogging).toBe(true)

    process.env.XDG_CONFIG_HOME = original
  })

  it('parses file', () => {
    const original = process.env.XDG_CONFIG_HOME
    const dir = mkdtempSync(join(tmpdir(), 'openzellij-'))
    process.env.XDG_CONFIG_HOME = dir

    const cfgPath = join(dir, 'opencode', 'openzellij.json')
    require('fs').mkdirSync(join(dir, 'opencode'), { recursive: true })
    writeFileSync(cfgPath, JSON.stringify({ spawnDelayMs: 10 }))

    const config = loadConfig()
    expect(config.spawnDelayMs).toBe(10)

    process.env.XDG_CONFIG_HOME = original
  })
})
