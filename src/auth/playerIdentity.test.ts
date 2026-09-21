import { describe, expect, it } from 'vitest'
import { formatPlayerCode, normalizePlayerCode } from './playerIdentity'

describe('player identity formatting', () => {
  it('normalizes friendly player id input for login', () => {
    expect(normalizePlayerCode(' PLAYER 7 ')).toBe('player007')
    expect(normalizePlayerCode('player0012')).toBe('player012')
  })

  it('rejects malformed player ids', () => {
    expect(() => normalizePlayerCode('legend')).toThrow('Enter a valid Player ID.')
    expect(() => normalizePlayerCode('player000')).toThrow('Enter a valid Player ID.')
  })

  it('formats the permanent id for display', () => {
    expect(formatPlayerCode('player007')).toBe('PLAYER 007')
  })
})
