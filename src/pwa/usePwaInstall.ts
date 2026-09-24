import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'winter-arc-pwa-dismissed'

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const matchMediaMatches =
    typeof window.matchMedia === 'function' &&
    Boolean(window.matchMedia('(display-mode: standalone)')?.matches)
  const navStandalone =
    typeof navigator !== 'undefined' &&
    Boolean((navigator as unknown as { standalone?: boolean }).standalone)
  const referrerApp =
    typeof document !== 'undefined' &&
    Boolean(document.referrer?.includes('android-app://'))
  return matchMediaMatches || navStandalone || referrerApp
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userAgent) return false
  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua)
}

export function usePwaInstall() {
  const [standalone, setStandalone] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(true)
  const [isIos, setIsIos] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)

  useEffect(() => {
    const runningStandalone = isStandalone()
    setStandalone(runningStandalone)
    setIsIos(isIosDevice())

    if (runningStandalone) return

    const dismissed = typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === 'true'
    setIsDismissed(dismissed)

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const triggerInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      setShowIosModal(true)
    }
  }

  const dismissBanner = () => {
    setIsDismissed(true)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, 'true')
    }
  }

  const canShowBanner = !standalone && !isDismissed

  return {
    standalone,
    canShowBanner,
    canInstall: !standalone,
    isIos,
    showIosModal,
    setShowIosModal,
    triggerInstall,
    dismissBanner,
  }
}
