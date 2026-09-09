export type Role = 'owner' | 'staff'
export interface Member { user_id: string; email: string; role: Role; active: boolean }
export interface Property { id: string; name: string }
export interface CloudRoom { id: string; property_id: string; number: string; rent_cents: number }
export interface CloudTenant { id: string; name: string; phone: string }
export interface Tenancy { id: string; room_id: string; tenant_id: string; start_date: string; end_date: string; rent_cents: number; status: 'active' }
export interface Invoice { id: string; tenancy_id: string; month: string; due_cents: number; paid_cents: number; due_date: string }
export interface CloudBooking { id: string; room_id: string; tenant_name: string; move_in: string; deposit_due_cents: number; deposit_paid_cents: number }
export interface CloudInvestment { id: string; partner: string; rooms: string; month: string; collected_cents: number; rent_cost_cents: number; expenses_cents: number; partner_rate: number }
export interface Snapshot { properties: Property[]; rooms: CloudRoom[]; tenants: CloudTenant[]; tenancies: Tenancy[]; invoices: Invoice[]; bookings: CloudBooking[]; investments: CloudInvestment[] }
export interface NewRoom { propertyId: string; propertyName: string; number: string; rent: string }
export interface NewTenant { roomId: string; name: string; phone: string; startDate: string; endDate: string; rent: string; due: string; paid: string; dueDate: string }
export const emptySnapshot = (): Snapshot => ({ properties: [], rooms: [], tenants: [], tenancies: [], invoices: [], bookings: [], investments: [] })
