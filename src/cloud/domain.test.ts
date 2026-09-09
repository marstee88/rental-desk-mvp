import { describe, expect, it } from 'vitest'
import { cents, malaysiaToday, summarize, validateRoom, validateTenant } from './domain'
import { emptySnapshot, type NewTenant } from './types'

const tenant: NewTenant = { roomId: 'r1', name: '测试租客', phone: '000', startDate: '2026-09-09', endDate: '2027-09-08', rent: '800', due: '300', paid: '100', dueDate: '2026-09-15' }
describe('正式管理日期及金额', () => {
  it('uses Kuala Lumpur day even before UTC midnight', () => expect(malaysiaToday(new Date('2026-09-08T18:00:00Z'))).toBe('2026-09-09'))
  it('parses cents exactly and rejects invalid or oversized amounts', () => {
    expect(cents('123.45')).toBe(12345)
    for (const value of ['-1', '', '1e3', '0.001', '10000000', 'NaN']) expect(() => cents(value)).toThrow()
  })
  it('validates room and tenancy input before saving', () => {
    expect(() => validateRoom({ propertyId: '', propertyName: '', number: '1', rent: '10' })).toThrow()
    expect(() => validateRoom({ propertyId: 'p', propertyName: '', number: '  ', rent: '10' })).toThrow()
    expect(() => validateTenant(tenant, '2026-09-09')).not.toThrow()
    for (const change of [{ paid: '301' }, { endDate: '2026-09-08' }, { startDate: '2026-09-10' }, { dueDate: '2026-02-30' }, { name: ' ' }]) expect(() => validateTenant({ ...tenant, ...change }, '2026-09-09')).toThrow()
  })
  it('handles an empty real database without NaN', () => expect(summarize(emptySnapshot(), '2026-09', '2026-09-09')).toMatchObject({ total: 0, vacant: 0, due: 0, rate: 0, occupancy: 0 }))
  it('filters invoices by month and contracts by inclusive 30-day boundaries', () => {
    const data = emptySnapshot()
    data.rooms = ['a', 'b', 'c', 'd'].map(id => ({ id, property_id: 'p', number: id, rent_cents: 10000 }))
    data.tenancies = ['2026-09-08', '2026-09-09', '2026-10-09'].map((end_date, i) => ({ id: String(i), room_id: data.rooms[i].id, tenant_id: String(i), start_date: '2026-01-01', end_date, rent_cents: 10000, status: 'active' }))
    data.invoices = [{ id: 'i', tenancy_id: '1', month: '2026-09-01', due_cents: 10000, paid_cents: 4000, due_date: '2026-09-08' }, { id: 'j', tenancy_id: '2', month: '2026-10-01', due_cents: 20000, paid_cents: 0, due_date: '2026-10-01' }]
    expect(summarize(data, '2026-09', '2026-09-09')).toMatchObject({ total: 4, occupied: 3, vacant: 1, due: 10000, collected: 4000, outstanding: 6000, rate: 40, overdue: 1, expiring: 2 })
  })
})
