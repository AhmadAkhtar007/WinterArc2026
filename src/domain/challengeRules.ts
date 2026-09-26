import type { Challenge, ScoringProfile } from './types'

export const SEASON_START = '2026-09-23'
export const SEASON_DAYS = 100
export const SEASON_TIMEZONE = 'Asia/Karachi'
export const SEASON_KEY = '2026-season'

export const WATER_STEP_ML = 250
export const WATER_CEILING_ML = 4000
export const PULLUP_TARGET_OPTIONS = [8, 20]

type ScoredChallenge = Pick<Challenge, 'scoringProfile' | 'progress' | 'target' | 'points'>

function karachiParts(now: Date): { year: number; month: number; day: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEASON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [year, month, day] = formatted.split('-').map(Number)
  return { year, month, day }
}

export function scoringProfileFor(challenge: Pick<Challenge, 'scoringProfile'>): ScoringProfile {
  return challenge.scoringProfile ?? 'standard'
}

export function localDayKey(now: Date = new Date()): string {
  const { year, month, day } = karachiParts(now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function weeklyKey(now: Date = new Date()): string {
  const { year, month, day } = karachiParts(now)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayNumber = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function periodKeyFor(challenge: Pick<Challenge, 'frequency'>, now: Date = new Date()): string {
  if (challenge.frequency === 'weekly') return weeklyKey(now)
  if (challenge.frequency === 'once') return SEASON_KEY
  return localDayKey(now)
}

export function seasonDay(now: Date = new Date()): number {
  const [year, month, day] = localDayKey(now).split('-').map(Number)
  const today = Date.UTC(year, month - 1, day)
  const [startYear, startMonth, startDay] = SEASON_START.split('-').map(Number)
  const start = Date.UTC(startYear, startMonth - 1, startDay)
  const dayNumber = Math.floor((today - start) / 86_400_000) + 1
  return Math.max(0, Math.min(SEASON_DAYS, dayNumber))
}

export function personalArcDay(startDate: string | Date, now: Date = new Date()): {
  dayNumber: number
  daysRemaining: number
  totalDays: number
} {
  const startKey = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? startDate
    : localDayKey(new Date(startDate))
  const todayKey = localDayKey(now)
  const [sy, sm, sd] = startKey.split('-').map(Number)
  const [ty, tm, td] = todayKey.split('-').map(Number)
  const startTime = Date.UTC(sy, sm - 1, sd)
  const todayTime = Date.UTC(ty, tm - 1, td)
  const elapsedDays = Math.floor((todayTime - startTime) / 86_400_000)
  const dayNumber = Math.max(1, Math.min(SEASON_DAYS, elapsedDays + 1))
  const daysRemaining = SEASON_DAYS - dayNumber
  return { dayNumber, daysRemaining, totalDays: SEASON_DAYS }
}

export function personalArcDayKey(startDate: string | Date, dayIndex: number): string {
  const startKey = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? startDate
    : localDayKey(new Date(startDate))
  const [sy, sm, sd] = startKey.split('-').map(Number)
  const date = new Date(Date.UTC(sy, sm - 1, sd))
  date.setUTCDate(date.getUTCDate() + dayIndex)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function pullupBasePoints(target: number): number {
  return target >= 20 ? 12 : 5
}

export function scoringBreakdown(
  profile: ScoringProfile,
  target: number,
  fallbackPoints = 0,
): { base: number; bonus: number; total: number } {
  if (profile === 'gym') {
    const base = target * 10
    return { base, bonus: 50, total: base + 50 }
  }
  if (profile === 'pushups') {
    const base = Math.floor(target / 10)
    return { base, bonus: 0, total: base }
  }
  if (profile === 'pullups') {
    const base = pullupBasePoints(target)
    return { base, bonus: 0, total: base }
  }
  if (profile === 'water') {
    const base = Math.floor(target / WATER_STEP_ML)
    return { base, bonus: 0, total: base }
  }
  return { base: fallbackPoints, bonus: 0, total: fallbackPoints }
}

export function progressCap(profile: ScoringProfile, target: number): number {
  if (profile === 'pushups' || profile === 'pullups') return target * 2
  if (profile === 'water') return WATER_CEILING_ML
  return target
}

export function earnedPoints(challenge: ScoredChallenge): number {
  const progress = challenge.progress ?? 0
  const target = challenge.target ?? 1
  const profile = scoringProfileFor(challenge)
  if (progress <= target) return challenge.points
  if (profile === 'pushups') return Math.floor(progress / 10)
  if (profile === 'pullups') return Math.floor((Math.min(progress, target * 2) * pullupBasePoints(target)) / target)
  if (profile === 'water') return Math.floor(Math.min(progress, WATER_CEILING_ML) / WATER_STEP_ML)
  return challenge.points
}

export function maxPeriodPoints(profile: ScoringProfile, target: number, fallbackPoints = 0): number {
  if (profile === 'pushups') return Math.floor((target * 2) / 10)
  if (profile === 'pullups') return pullupBasePoints(target) * 2
  if (profile === 'water') return Math.floor(WATER_CEILING_ML / WATER_STEP_ML)
  return scoringBreakdown(profile, target, fallbackPoints).total
}
