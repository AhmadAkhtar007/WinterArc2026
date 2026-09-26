import { describe, expect, it } from 'vitest'
import {
  localDayKey,
  periodKeyFor,
  personalArcDay,
  personalArcDayKey,
  seasonDay,
  weeklyKey,
} from './challengeRules'

describe('challengeRules', () => {
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
