import { describe, expect, it, vi } from 'vitest'
import { parseJson } from '../src/utils/zellij'

describe('parseJson', () => {
  it('parses valid json', () => {
    const input = '{"panes": []}'
    expect(parseJson(input)).toEqual({ panes: [] })
  })

  it('throws on invalid json', () => {
    expect(() => parseJson('not json')).toThrow(/Failed to parse/)
  })
})
