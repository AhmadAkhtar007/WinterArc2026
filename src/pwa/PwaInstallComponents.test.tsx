import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PwaInstallBanner } from './PwaInstallBanner'
import { PwaInstallModal } from './PwaInstallModal'

describe('PWA Install UI components', () => {
  it('renders PwaInstallBanner and triggers callbacks', () => {
    const onInstall = vi.fn()
    const onDismiss = vi.fn()
    render(<PwaInstallBanner onInstall={onInstall} onDismiss={onDismiss} />)

    expect(screen.getByText('Install Winter Arc')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(onInstall).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss install banner' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders PwaInstallModal with iOS instructions when isIos is true', () => {
    const onClose = vi.fn()
    render(<PwaInstallModal isOpen={true} isIos={true} onClose={onClose} />)

    expect(screen.getByRole('heading', { name: 'Install Winter Arc' })).toBeInTheDocument()
    expect(screen.getByText('Tap the Share button')).toBeInTheDocument()
    expect(screen.getByText('Select "Add to Home Screen"')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders PwaInstallModal with Android/browser instructions when isIos is false', () => {
    const onClose = vi.fn()
    render(<PwaInstallModal isOpen={true} isIos={false} onClose={onClose} />)

    expect(screen.getByText('Open browser menu')).toBeInTheDocument()
    expect(screen.getByText('Select "Install app"')).toBeInTheDocument()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<PwaInstallModal isOpen={false} isIos={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
