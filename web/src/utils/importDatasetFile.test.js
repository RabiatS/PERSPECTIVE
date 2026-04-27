import { describe, expect, it } from 'vitest'
import { importDatasetFile } from './importDatasetFile.js'

describe('importDatasetFile', () => {
  it('rejects unsupported extensions', async () => {
    const file = new File(['x'], 'test.txt', { type: 'text/plain' })
    await expect(importDatasetFile(file)).rejects.toThrow(/Supported/)
  })
})
