import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

const url = process.env.TEST_DATABASE_URL
let db: PGlite | pg.Client
const owner = '00000000-0000-0000-0000-000000000001'
const staff = '00000000-0000-0000-0000-000000000002'
const outsider = '00000000-0000-0000-0000-000000000003'
const disabled = '00000000-0000-0000-0000-000000000004'
async function query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> {
  if (db instanceof PGlite && !params) return (await db.exec(sql)).at(-1) as { rows: any[] }
  return await db.query(sql, params) as { rows: any[] }
}
async function asUser<T>(uid: string, action: () => Promise<T>): Promise<T> {
  await query("select set_config('request.jwt.claim.sub', $1, false)", [uid]); await query('set role authenticated')
  try { return await action() } finally { await query('reset role') }
}
async function room(number = randomUUID(), request = randomUUID(), propertyId: string | null = null, propertyName = `房源-${randomUUID()}`) {
  return (await query('select public.add_room($1,$2,$3,$4,$5) as id', [propertyId, propertyName, number, 80000, request])).rows[0].id as string
}
async function register(roomId: string, request = randomUUID(), paid = 20000) {
  return query("select public.register_tenant($1,'测试租客','00000000',(now() at time zone 'Asia/Kuala_Lumpur')::date,(now() at time zone 'Asia/Kuala_Lumpur')::date + 365,80000,40000,$2,(now() at time zone 'Asia/Kuala_Lumpur')::date,$3) as id", [roomId, paid, request])
}
beforeAll(async () => {
  if (url) { const client = new pg.Client({ connectionString: url }); await client.connect(); db = client } else db = new PGlite()
  await query("create schema auth; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth, public to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;")
  await query(readFileSync(new URL('../supabase/migrations/202609090001_rental_management.sql', import.meta.url), 'utf8'))
  await query('insert into auth.users(id) values ($1),($2),($3),($4)', [owner, staff, outsider, disabled])
  await query("insert into public.members(user_id,email,role,active) values ($1,'owner@example.invalid','owner',true),($2,'staff@example.invalid','staff',true),($3,'disabled@example.invalid','staff',false)", [owner, staff, disabled])
  await query("insert into public.investments(partner,rooms,month,collected_cents,rent_cost_cents,expenses_cents,partner_rate) values ('私密合作方','A','2026-09-01',10000,2000,0,0.5)")
}, 30000)
afterAll(async () => { if (db instanceof PGlite) await db.close(); else await db?.end() })

describe('数据库权限与原子保存', () => {
  it('denies anonymous reads and writes', async () => {
    await query('set role anon')
    try {
      await expect(query('select * from public.tenants')).rejects.toThrow(/permission denied/)
      await expect(room()).rejects.toThrow(/permission denied/)
    } finally { await query('reset role') }
  })
  it('denies unapproved and disabled accounts, including RPC calls', async () => {
    for (const id of [outsider, disabled]) await asUser(id, async () => {
      expect((await query('select * from public.rooms')).rows).toHaveLength(0)
      await expect(room()).rejects.toThrow(/尚未获授权|停用/)
    })
  })
  it('hides investments and other staff accounts from staff; owner can see them', async () => {
    await asUser(staff, async () => {
      expect((await query('select * from public.investments')).rows).toHaveLength(0)
      expect((await query('select * from public.members')).rows).toHaveLength(1)
      await expect(query("update public.members set role = 'owner' where user_id = $1", [staff])).rejects.toThrow(/permission denied/)
    })
    await asUser(owner, async () => {
      expect((await query('select * from public.investments')).rows).toHaveLength(1)
      expect((await query('select * from public.members')).rows).toHaveLength(3)
    })
  })
  it('creates rooms, disallows case-insensitive duplicates within a property', async () => {
    await asUser(staff, async () => {
      const id = await room('A-101')
      const property = (await query('select property_id from public.rooms where id=$1', [id])).rows[0].property_id
      await expect(room(' a-101 ', randomUUID(), property)).rejects.toThrow(/已存在/)
      await expect(room('A-101')).resolves.toBeTypeOf('string')
    })
  })
  it('rolls back a new property if room validation fails', async () => {
    const count = (await query('select count(*)::int as n from public.properties')).rows[0].n
    await asUser(staff, async () => { await expect(query("select public.add_room(null,'不会保存的房源','',80000,$1)", [randomUUID()])).rejects.toThrow() })
    expect((await query('select count(*)::int as n from public.properties')).rows[0].n).toBe(count)
  })
  it('keeps room and tenant retries idempotent', async () => {
    await asUser(staff, async () => {
      const key = randomUUID(), name = `幂等房源-${randomUUID()}`
      const id = await room('1', key, null, name)
      expect(await room('1', key, null, name)).toBe(id)
      await expect(room('2', key, null, name)).rejects.toThrow(/已保存/)
      const tenancyKey = randomUUID()
      const first = (await register(id, tenancyKey)).rows[0].id
      expect((await register(id, tenancyKey)).rows[0].id).toBe(first)
      expect((await query('select * from public.invoices where tenancy_id=$1', [first])).rows).toHaveLength(1)
      await expect(register(id)).rejects.toThrow(/已被安排入住/)
    })
  })
  it('rolls back tenant and tenancy when invoice validation fails', async () => {
    const count = (await query('select count(*)::int as n from public.tenants')).rows[0].n
    await asUser(staff, async () => {
      const id = await room()
      await expect(register(id, randomUUID(), 50000)).rejects.toThrow()
      expect((await query('select * from public.tenancies where room_id=$1', [id])).rows).toHaveLength(0)
      expect((await query('select count(*)::int as n from public.tenants')).rows[0].n).toBe(count)
      await expect(register(id)).resolves.toBeDefined()
    })
  })
  it('rejects invalid lease dates and direct table writes', async () => {
    await asUser(staff, async () => {
      await expect(query("insert into public.tenants(name,phone,created_by) values('非法','0',$1)", [staff])).rejects.toThrow(/permission denied/)
      const id = await room()
      await expect(query("select public.register_tenant($1,'租客','0',current_date + 3,current_date + 365,80000,80000,0,current_date,$2)", [id, randomUUID()])).rejects.toThrow(/入住日期/)
    })
  })
  it('only owner can disable staff; disabled tokens lose access immediately', async () => {
    await asUser(staff, async () => { await expect(query('select public.set_staff_active($1,false)', [staff])).rejects.toThrow(/仅管理员/) })
    await asUser(owner, async () => {
      await expect(query('select public.set_staff_active($1,false)', [owner])).rejects.toThrow(/管理员账号/)
      await query('select public.set_staff_active($1,false)', [staff])
    })
    await asUser(staff, async () => { expect((await query('select * from public.rooms')).rows).toHaveLength(0); await expect(room()).rejects.toThrow(/停用/) })
    await asUser(owner, async () => { await query('select public.set_staff_active($1,true)', [staff]) })
  })
  it.skipIf(!url)('serializes registrations from two independent database connections', async () => {
    const roomId = await asUser(owner, () => room())
    const compete = async (uid: string) => {
      const conn = new pg.Client({ connectionString: url }); await conn.connect()
      try {
        await conn.query('set role authenticated'); await conn.query("select set_config('request.jwt.claim.sub',$1,false)", [uid])
        return await conn.query("select public.register_tenant($1,'并发测试','0',(now() at time zone 'Asia/Kuala_Lumpur')::date,(now() at time zone 'Asia/Kuala_Lumpur')::date+365,10000,10000,0,current_date,$2)", [roomId, randomUUID()])
      } finally { await conn.end() }
    }
    const results = await Promise.allSettled([compete(owner), compete(staff)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
    expect((await query('select * from public.tenancies where room_id=$1', [roomId])).rows).toHaveLength(1)
  })
})
