import type { Payment, Room } from './types'

export const money = (value: number) => `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function getMetrics(rooms: Room[], payments: Payment[]) {
  const occupied = rooms.filter((room) => room.occupied).length
  const due = payments.reduce((sum, payment) => sum + payment.due, 0)
  const collected = payments.reduce((sum, payment) => sum + payment.paid, 0)
  const outstanding = due - collected
  const outstandingPayments = payments.filter((payment) => payment.paid < payment.due)
  const overdue = outstandingPayments.filter((payment) => payment.dueDate < '2026-09-09').length
  const expiring = rooms.filter((room) => room.contractEnd && room.contractEnd <= '2026-10-09').length
  return { total: rooms.length, occupied, vacant: rooms.length - occupied, due, collected, outstanding, overdue, expiring, outstandingPayments: outstandingPayments.length }
}
