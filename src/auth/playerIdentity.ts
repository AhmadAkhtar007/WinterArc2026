export function normalizePlayerCode(value: string): string {
  const match = value.trim().toLowerCase().replace(/[\s_-]+/g, '').match(/^player0*(\d+)$/)
  const number = match ? Number(match[1]) : 0
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Enter a valid Player ID.')
  return `player${String(number).padStart(3, '0')}`
}

export function formatPlayerCode(value: string): string {
  const normalized = normalizePlayerCode(value)
  return `PLAYER ${normalized.slice(6)}`
}
