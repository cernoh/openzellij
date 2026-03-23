import { existsSync, readFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { z } from 'zod'
import type { PluginConfig } from './types'

const configSchema = z.object({
  enableLogging: z.boolean().default(true),
  spawnDelayMs: z.number().int().nonnegative().default(250),
  maxConcurrentSpawns: z.number().int().positive().default(1),
  paneLayout: z.enum(['tiled', 'vertical', 'horizontal']).default('tiled'),
  zellijBinary: z.string().default('zellij'),
  listIntervalMs: z.number().int().positive().default(5000),
  autoClosePanes: z.boolean().default(true),
  panePollIntervalMs: z.number().int().positive().default(2000),
  paneMissingGraceMs: z.number().int().nonnegative().default(6000)
})

export const DEFAULT_CONFIG = configSchema.parse({})

const resolveConfigPath = () => {
  const baseDir = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'opencode')
    : join(process.env.HOME || process.cwd(), '.config', 'opencode')
  return join(baseDir, 'openzellij.json')
}

export function loadConfig(): PluginConfig {
  const configPath = resolveConfigPath()
  if (!existsSync(configPath)) {
    ensureConfigDir(configPath)
    return DEFAULT_CONFIG
  }

  const rawText = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(rawText)
  return configSchema.parse(parsed)
}

function ensureConfigDir(filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export { configSchema }
