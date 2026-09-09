import { createClient } from 'npm:@supabase/supabase-js@2'

const siteUrl = Deno.env.get('APP_URL') ?? 'https://marstee88.github.io/rental-desk-mvp/'
const allowedOrigins = new Set([new URL(siteUrl).origin, ...(Deno.env.get('EXTRA_ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean)])

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? ''
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : '', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers })
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: '来源未获授权。' })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, { error: '不支持此操作。' })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    // Service role is restricted to the Edge Function; never bundled in Vite.
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return reply(401, { error: '请重新登录。' })
    const { data: actor } = await admin.from('members').select('role,active').eq('user_id', user.id).single()
    if (actor?.role !== 'owner' || !actor.active) return reply(403, { error: '仅管理员可以邀请员工。' })
    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(400, { error: '请输入有效的员工邮箱。' })
    const { data: existing, error: lookupError } = await admin.from('members').select('user_id').eq('email', email).maybeSingle()
    if (lookupError) return reply(500, { error: '读取员工资料失败，请重试。' })
    if (existing) return reply(409, { error: '该员工已存在；可使用登录页的「忘记密码」设置密码。' })
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}?account=setup` })
    if (inviteError || !invited.user) return reply(400, { error: '邀请未发出。请检查邮件发送配置和账号是否已存在。' })
    const { error: memberError } = await admin.from('members').insert({ user_id: invited.user.id, email, role: 'staff', active: true })
    // An auth-only account has zero business access until the membership succeeds.
    if (memberError) return reply(500, { error: '邀请已发出，但员工权限尚未建立。请让项目管理员检查此账号的 members 记录。' })
    return reply(200, { ok: true })
  } catch {
    return reply(500, { error: '邀请服务暂时不可用，请稍后重试。' })
  }
})
