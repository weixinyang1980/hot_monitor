import { describe, expect, it } from 'vitest'
import { getNextHalfHour } from '../src/schedule.js'

describe('half-hour schedule', () => {
  it('returns the next :30 from a time before the half hour', () => {
    const next = getNextHalfHour(new Date('2026-08-19T08:12:42.000Z'))
    expect(next.toISOString()).toBe('2026-08-19T08:30:00.000Z')
  })

  it('returns the next hour when already after :30', () => {
    const next = getNextHalfHour(new Date('2026-08-19T08:45:42.000Z'))
    expect(next.toISOString()).toBe('2026-08-19T09:00:00.000Z')
  })

  it('runs immediately when the process starts exactly on a half hour', () => {
    const next = getNextHalfHour(new Date('2026-08-19T08:30:00.000Z'))
    expect(next.toISOString()).toBe('2026-08-19T08:30:00.000Z')
  })
})
