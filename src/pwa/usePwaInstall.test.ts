import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isIosDevice, isStandalone, usePwaInstall } from './usePwaInstall'

describe('usePwaInstall', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('detects standalone mode when display-mode matches', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    expect(isStandalone()).toBe(true)
  })

  it('detects iOS user agent strings', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    expect(isIosDevice()).toBe(true)
  })

  it('handles banner dismissal and persists in localStorage', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))

    const { result } = renderHook(() => usePwaInstall())
    expect(result.current.canShowBanner).toBe(true)

    act(() => {
      result.current.dismissBanner()
    })

    expect(result.current.canShowBanner).toBe(false)
    expect(localStorage.getItem('winter-arc-pwa-dismissed')).toBe('true')
  })
})
