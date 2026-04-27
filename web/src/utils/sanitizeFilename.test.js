import { describe, expect, it } from 'vitest'
import { sanitizeFilename } from './sanitizeFilename.js'

describe('sanitizeFilename', () => {
  it('strips path segments and illegal chars', () => {
    expect(sanitizeFilename('C:\\tmp\\foo<bar>.csv', 'x')).toBe('foo_bar_.csv')
  })

  it('removes control characters', () => {
    expect(sanitizeFilename('a\u0000b', 'fb')).toBe('ab')
  })

  it('uses fallback when empty', () => {
    expect(sanitizeFilename('   ', 'fallback')).toBe('fallback')
  })
})
