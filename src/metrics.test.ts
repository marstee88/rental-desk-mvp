import { describe, expect, it } from 'vitest'
import { getMetrics } from './metrics'
import type { Payment, Room } from './types'

describe('getMetrics', () => {
  it('derives collection and outstanding totals from payments', () => {
    const rooms: Room[] = [
      { id: 'A-001', property: 'Austin Heights', rent: 1000, occupied: true, contractEnd: '2026-09-30' },
      { id: 'A-002', property: 'Austin Heights', rent: 900, occupied: false },
    ]
    const payments: Payment[] = [
      { roomId: 'A-001', due: 1000, paid: 400, dueDate: '2026-09-05', status: 'partial' },
    ]
    expect(getMetrics(rooms, payments)).toMatchObject({ total: 2, occupied: 1, vacant: 1, due: 1000, collected: 400, outstanding: 600, overdue: 1, expiring: 1 })
  })
})
