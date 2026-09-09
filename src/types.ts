export type PaymentStatus = 'paid' | 'partial' | 'outstanding'

export interface Tenant {
  id: string
  name: string
  phone: string
}

export interface Room {
  id: string
  property: string
  rent: number
  occupied: boolean
  tenant?: Tenant
  contractEnd?: string
}

export interface Payment {
  roomId: string
  due: number
  paid: number
  dueDate: string
  status: PaymentStatus
}

export interface Booking {
  roomId: string
  tenant: string
  moveIn: string
  depositDue: number
  depositPaid: number
}

export interface InvestmentShare {
  partner: string
  rooms: string
  collected: number
  rentCost: number
  expenses: number
  partnerRate: number
}
