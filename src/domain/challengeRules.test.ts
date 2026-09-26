import { describe, expect, it } from 'vitest'
import {
  earnedPoints,
  localDayKey,
  maxPeriodPoints,
  periodKeyFor,
  personalArcDay,
  personalArcDayKey,
  progressCap,
  scoringBreakdown,
  scoringProfileFor,
  seasonDay,
  weeklyKey,
} from './challengeRules'

describe('challengeRules', () => {
  it('scores a gym split as 10 XP per session plus a 50 XP completion bonus', () => {
    expect(scoringBreakdown('gym', 4)).toEqual({ base: 40, bonus: 50, total: 90 })
    expect(scoringBreakdown('gym', 5)).toEqual({ base: 50, bonus: 50, total: 100 })
  })

  it('scores pushups as one XP per ten reps and caps the bonus at double the baseline', () => {
    expect(scoringBreakdown('pushups', 100)).toEqual({ base: 10, bonus: 0, total: 10 })
    expect(scoringBreakdown('pushups', 150)).toEqual({ base: 15, bonus: 0, total: 15 })
    expect(progressCap('pushups', 100)).toBe(200)
    expect(progressCap('gym', 4)).toBe(4)
    expect(progressCap('standard', 3)).toBe(3)
    expect(maxPeriodPoints('pushups', 100)).toBe(20)
    expect(maxPeriodPoints('pushups', 150)).toBe(30)
  })

  it('falls back to the challenge points unless progress exceeds a pushup baseline', () => {
    const pushups = { scoringProfile: 'pushups' as const, points: 10, target: 100, progress: 0 }
    expect(earnedPoints(pushups)).toBe(10)
    expect(earnedPoints({ ...pushups, progress: 50 })).toBe(10)
    expect(earnedPoints({ ...pushups, progress: 100 })).toBe(10)
    expect(earnedPoints({ ...pushups, progress: 120 })).toBe(12)

    const gym = { scoringProfile: 'gym' as const, points: 90, target: 4, progress: 4 }
    expect(earnedPoints(gym)).toBe(90)
    expect(earnedPoints({ scoringProfile: 'standard' as const, points: 20, target: 1, progress: 1 })).toBe(20)
  })

  it('defaults an unlabelled challenge to the standard profile instead of guessing from its title', () => {
    expect(scoringProfileFor({})).toBe('standard')
    expect(scoringProfileFor({ scoringProfile: 'gym' })).toBe('gym')
  })

  it('uses the ISO week year so it matches the database across a year boundary', () => {
    expect(weeklyKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01')
    expect(weeklyKey(new Date('2026-12-31T12:00:00Z'))).toBe('2026-W53')
    // The calendar year is 2027 but the ISO week year is still 2026.
    expect(weeklyKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53')
  })

  it('builds day keys in the season time zone rather than the machine time zone', () => {
    expect(localDayKey(new Date('2026-09-24T20:00:00Z'))).toBe('2026-09-25')
    expect(localDayKey(new Date('2026-09-24T10:00:00Z'))).toBe('2026-09-24')
  })

  it('maps each cadence to the same period key the database would use', () => {
    const now = new Date('2026-09-24T12:00:00Z')
    expect(periodKeyFor({ frequency: 'daily' }, now)).toBe('2026-09-24')
    expect(periodKeyFor({ frequency: 'weekly' }, now)).toBe('2026-W39')
    expect(periodKeyFor({ frequency: 'once' }, now)).toBe('2026-season')
  })

  it('counts season days from the season start and clamps to the season length', () => {
    expect(seasonDay(new Date('2026-09-22T12:00:00Z'))).toBe(0)
    expect(seasonDay(new Date('2026-09-23T12:00:00Z'))).toBe(1)
    expect(seasonDay(new Date('2026-12-31T12:00:00Z'))).toBe(100)
  })

  it('calculates personal evergreen arc day numbers from registration date', () => {
    const signupDate = '2026-10-15'
    expect(personalArcDay(signupDate, new Date('2026-10-15T12:00:00Z'))).toEqual({
      dayNumber: 1,
      daysRemaining: 99,
      totalDays: 100,
    })
    expect(personalArcDay(signupDate, new Date('2026-10-17T12:00:00Z'))).toEqual({
      dayNumber: 3,
      daysRemaining: 97,
      totalDays: 100,
    })
    expect(personalArcDayKey(signupDate, 0)).toBe('2026-10-15')
    expect(personalArcDayKey(signupDate, 2)).toBe('2026-10-17')
  })
})
