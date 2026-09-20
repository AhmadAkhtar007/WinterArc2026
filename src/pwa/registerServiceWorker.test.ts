import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './registerServiceWorker'

describe('registerServiceWorker', () => {
  it('registers on window load in production', () => {
    const register = vi.fn().mockResolvedValue(undefined)
    registerServiceWorker(true, { serviceWorker: { register } as unknown as ServiceWorkerContainer })
    window.dispatchEvent(new Event('load'))
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('does not register outside production', () => {
    const register = vi.fn()
    registerServiceWorker(false, { serviceWorker: { register } as unknown as ServiceWorkerContainer })
    window.dispatchEvent(new Event('load'))
    expect(register).not.toHaveBeenCalled()
  })
})
