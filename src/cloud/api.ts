import { supabase } from './client'
import { cents, validateRoom, validateTenant } from './domain'
import type { Member, NewRoom, NewTenant, Snapshot } from './types'

function client() { if (!supabase) throw new Error('正式管理尚未连接云端，请联系管理员完成设置。'); return supabase }
export async function getMember(): Promise<Member> {
  const { data, error } = await client().from('members').select('user_id,email,role,active').eq('user_id', (await client().auth.getUser()).data.user?.id ?? '').single()
  if (error || !data?.active) throw new Error('此账号尚未获授权或已停用，请联系管理员。')
  return data as Member
}
export async function getSnapshot(role: Member['role']): Promise<Snapshot> {
  const tables = ['properties', 'rooms', 'tenants', 'tenancies', 'invoices', 'bookings'] as const
  const entries = await Promise.all(tables.map(async table => {
    const all: unknown[] = []
    for (let offset = 0;; offset += 500) {
      const { data, error } = await client().from(table).select('*').order('id').range(offset, offset + 499)
      if (error) throw error
      all.push(...data)
      if (data.length < 500) break
    }
    return [table, all] as const
  }))
  let investments: Snapshot['investments'] = []
  if (role === 'owner') {
    for (let offset = 0;; offset += 500) {
      const { data, error } = await client().from('investments').select('*').order('id').range(offset, offset + 499)
      if (error) throw error
      investments.push(...data)
      if (data.length < 500) break
    }
  }
  return { ...Object.fromEntries(entries), investments } as Snapshot
}
export async function addRoom(form: NewRoom, requestId: string) {
  validateRoom(form)
  const { data, error } = await client().rpc('add_room', { p_property_id: form.propertyId || null, p_property_name: form.propertyName.trim(), p_number: form.number.trim(), p_rent_cents: cents(form.rent), p_request_id: requestId })
  if (error) throw error
  return data as string
}
export async function addTenant(form: NewTenant, requestId: string) {
  validateTenant(form)
  const { data, error } = await client().rpc('register_tenant', { p_room_id: form.roomId, p_name: form.name.trim(), p_phone: form.phone.trim(), p_start_date: form.startDate, p_end_date: form.endDate, p_rent_cents: cents(form.rent), p_due_cents: cents(form.due), p_paid_cents: cents(form.paid), p_due_date: form.dueDate, p_request_id: requestId })
  if (error) throw error
  return data as string
}
export async function listMembers(): Promise<Member[]> {
  const { data, error } = await client().from('members').select('user_id,email,role,active').order('email')
  if (error) throw error
  return data as Member[]
}
export async function setStaffActive(userId: string, active: boolean) {
  const { error } = await client().rpc('set_staff_active', { p_user_id: userId, p_active: active })
  if (error) throw error
}
export async function inviteStaff(email: string) {
  const { data, error } = await client().functions.invoke('manage-staff', { body: { email: email.trim() } })
  if (error || data?.error) throw new Error(data?.error ?? '邀请未完成，请检查邮件配置或联系管理员。')
}
