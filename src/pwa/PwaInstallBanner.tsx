import { Download, X } from 'lucide-react'

interface PwaInstallBannerProps {
  onInstall: () => void
  onDismiss: () => void
}

export function PwaInstallBanner({ onInstall, onDismiss }: PwaInstallBannerProps) {
  return (
    <aside className="pwa-banner" aria-label="Install app banner">
      <div className="pwa-banner__info">
        <span className="pwa-banner__icon" aria-hidden="true">
          <Download size={15} />
        </span>
        <div className="pwa-banner__text">
          <strong>Install Winter Arc</strong>
          <span>Add to home screen for full focus</span>
        </div>
      </div>
      <div className="pwa-banner__actions">
        <button type="button" className="pwa-banner__install-btn" onClick={onInstall}>
          Install
        </button>
        <button
          type="button"
          className="pwa-banner__close-btn"
          onClick={onDismiss}
          aria-label="Dismiss install banner"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
