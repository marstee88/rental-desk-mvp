import type { Booking, InvestmentShare, Payment, PaymentStatus, Room, Tenant } from './types'

const tenants: Tenant[] = [
  { id: 't-1', name: 'Muhammad Amir', phone: '012-380 4412' },
  { id: 't-2', name: 'Lim Mei Ling', phone: '012-496 2081' },
  { id: 't-3', name: '李欣怡', phone: '012-561 7823' },
  { id: 't-4', name: 'Tan Jun Hao', phone: '012-634 1904' },
  { id: 't-5', name: 'Nur Aisyah', phone: '012-705 6380' },
  { id: 't-6', name: 'Raj Kumar', phone: '012-824 4571' },
  { id: 't-7', name: 'Siti Nurhaliza', phone: '012-915 0439' },
  { id: 't-8', name: '陈伟杰', phone: '012-238 6701' },
  { id: 't-9', name: '黄俊豪', phone: '012-347 9256' },
  { id: 't-10', name: 'Priya Devi', phone: '012-452 1168' },
]

const properties = ['Austin Heights', 'Taman Mount Austin', 'Setia Indah', 'Permas Jaya']
const rents = [850, 950, 1050, 1150, 1250, 1350, 1450, 1550]

export const rooms: Room[] = Array.from({ length: 400 }, (_, index) => {
  const number = index + 1
  const propertyIndex = Math.floor(index / 100)
  const occupied = !(number % 12 === 0 || number % 29 === 0)
  const tenant = occupied ? tenants[index % tenants.length] : undefined
  const prefix = String.fromCharCode(65 + propertyIndex)
  return {
    id: `${prefix}-${String((index % 100) + 1).padStart(3, '0')}`,
    property: properties[propertyIndex],
    rent: rents[index % rents.length],
    occupied,
    tenant: tenant && { ...tenant, id: `${tenant.id}-${number}`, name: number > 10 ? `${tenant.name} · ${number}` : tenant.name },
    contractEnd: occupied ? `2026-${String(9 + (index % 3)).padStart(2, '0')}-${String(10 + (index % 19)).padStart(2, '0')}` : undefined,
  }
})

export const payments: Payment[] = rooms
  .filter((room) => room.occupied)
  .map((room, index) => {
    const status: PaymentStatus = index % 11 === 0 ? 'outstanding' : index % 7 === 0 ? 'partial' : 'paid'
    const paid = status === 'paid' ? room.rent : status === 'partial' ? room.rent / 2 : 0
    const overdue = index % 11 === 0 || index % 7 === 0
    return { roomId: room.id, due: room.rent, paid, dueDate: overdue ? '2026-09-05' : '2026-09-15', status }
  })

export const bookings: Booking[] = [
  { roomId: 'D-068', tenant: 'Wong Kai Wen', moveIn: '2026-09-18', depositDue: 500, depositPaid: 0 },
  { roomId: 'D-069', tenant: '林芷晴', moveIn: '2026-09-20', depositDue: 500, depositPaid: 500 },
  { roomId: 'D-070', tenant: 'Nur Farah', moveIn: '2026-09-22', depositDue: 600, depositPaid: 0 },
]

export const investments: InvestmentShare[] = [
  { partner: '合作方 A（示例）', rooms: 'A-051、A-052', collected: 2200, rentCost: 1400, expenses: 150, partnerRate: 0.2 },
  { partner: '合作方 B（示例）', rooms: 'B-051、B-052', collected: 3000, rentCost: 1700, expenses: 200, partnerRate: 0.35 },
  { partner: '合作方 C（示例）', rooms: 'C-051、C-052', collected: 2200, rentCost: 1300, expenses: 100, partnerRate: 0.5 },
]
