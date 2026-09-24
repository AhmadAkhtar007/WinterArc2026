import { Share, PlusSquare, X } from 'lucide-react'

interface PwaInstallModalProps {
  isOpen: boolean
  isIos: boolean
  onClose: () => void
}

export function PwaInstallModal({ isOpen, isIos, onClose }: PwaInstallModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwa-modal-title">
      <div className="pwa-modal">
        <header className="pwa-modal__header">
          <h2 id="pwa-modal-title">Install Winter Arc</h2>
          <button
            type="button"
            className="pwa-modal__close"
            onClick={onClose}
            aria-label="Close installation guide"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <p className="pwa-modal__desc">
          Install the app on your home screen for full-screen focus, instant launch, and offline tracking.
        </p>

        {isIos ? (
          <ol className="pwa-modal__steps">
            <li>
              <span className="pwa-step-icon">
                <Share size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>Tap the Share button</strong>
                <span>Located in the bottom Safari toolbar.</span>
              </div>
            </li>
            <li>
              <span className="pwa-step-icon">
                <PlusSquare size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>Select "Add to Home Screen"</strong>
                <span>Scroll down the share sheet and tap the option.</span>
              </div>
            </li>
            <li>
              <span className="pwa-step-num">3</span>
              <div>
                <strong>Tap "Add"</strong>
                <span>Confirm in the top-right corner to place Winter Arc on your home screen.</span>
              </div>
            </li>
          </ol>
        ) : (
          <ol className="pwa-modal__steps">
            <li>
              <span className="pwa-step-num">1</span>
              <div>
                <strong>Open browser menu</strong>
                <span>Tap the three dots (⋮) in the top-right corner of your browser.</span>
              </div>
            </li>
            <li>
              <span className="pwa-step-num">2</span>
              <div>
                <strong>Select "Install app"</strong>
                <span>Or "Add to Home screen" to install Winter Arc.</span>
              </div>
            </li>
          </ol>
        )}

        <button type="button" className="secondary-button pwa-modal__done" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
