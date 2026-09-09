// Opt-in smoke test against a provisioned project with disposable qa-* accounts.
// Creates test records; remove those records and accounts after verification.
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const make = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const owner = make(), staff = make(), anon = make()
const ok = result => { if (result.error) throw new Error(result.error.message); return result.data }
for (const [client, email] of [[owner, process.env.QA_OWNER_EMAIL], [staff, process.env.QA_STAFF_EMAIL]]) {
  assert.match(email, /^qa-.*@example\.invalid$/)
  ok(await client.auth.signInWithPassword({ email, password: process.env.QA_PASSWORD }))
}
assert.equal(ok(await owner.from('members').select('role').eq('email', process.env.QA_OWNER_EMAIL).single()).role, 'owner')
assert.equal(ok(await staff.from('members').select('role').single()).role, 'staff')
assert.ok((await anon.from('tenants').select('id')).error)
assert.equal(ok(await staff.from('investments').select('id')).length, 0)
const params = { p_property_id: null, p_property_name: `QA-云端验收-${randomUUID()}`, p_number: 'QA-101', p_rent_cents: 80000, p_request_id: randomUUID() }
const roomId = ok(await staff.rpc('add_room', params))
assert.equal(ok(await staff.rpc('add_room', params)), roomId)
const room = ok(await owner.from('rooms').select('*').eq('id', roomId).single())
assert.equal(room.rent_cents, 80000)
assert.ok((await staff.rpc('add_room', { ...params, p_property_id: room.property_id, p_request_id: randomUUID() })).error)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const leaseParams = { p_room_id: roomId, p_name: 'QA云端测试租客', p_phone: '00000000', p_start_date: today, p_end_date: '2099-12-31', p_rent_cents: 80000, p_due_cents: 35000, p_paid_cents: 35000, p_due_date: today, p_request_id: randomUUID() }
const leaseId = ok(await staff.rpc('register_tenant', leaseParams))
assert.equal(ok(await staff.rpc('register_tenant', leaseParams)), leaseId)
assert.ok((await owner.rpc('register_tenant', { ...leaseParams, p_request_id: randomUUID() })).error)
const invoice = ok(await owner.from('invoices').select('*').eq('tenancy_id', leaseId).single())
assert.equal(invoice.due_cents, 35000); assert.equal(invoice.paid_cents, 35000)
const staffInvoke = await staff.functions.invoke('manage-staff', { body: { email: '' } })
assert.equal(staffInvoke.error?.context?.status, 403)
const ownerInvoke = await owner.functions.invoke('manage-staff', { body: { email: '' } })
assert.equal(ownerInvoke.error?.context?.status, 400)
const staffUserId = ok(await staff.auth.getUser()).user.id
ok(await owner.rpc('set_staff_active', { p_user_id: staffUserId, p_active: false }))
assert.equal(ok(await staff.from('rooms').select('id')).length, 0)
assert.ok((await staff.rpc('add_room', { ...params, p_number: 'QA-blocked', p_request_id: randomUUID() })).error)
ok(await owner.rpc('set_staff_active', { p_user_id: staffUserId, p_active: true }))
await owner.auth.signOut(); await staff.auth.signOut()
console.log('PASS: real Auth, owner/staff RLS, atomic room/tenant/invoice, retry, duplicate room, role-restricted Edge Function, disable/re-enable. QA rows require cleanup.')
