export function registerServiceWorker(
  isProduction = import.meta.env.PROD,
  navigatorRef: Pick<Navigator, 'serviceWorker'> = navigator,
): void {
  if (!isProduction || !('serviceWorker' in navigatorRef)) return
  window.addEventListener('load', () => { void navigatorRef.serviceWorker.register('/sw.js') })
}
