import { test, expect, type Page } from '@playwright/test'

// Contract-mocked browser tests. Real Auth/mail verification is a separate release check.
async function mockCloud(page: Page, role: 'owner' | 'staff') {
  const user = { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: `${role}@example.invalid`, app_metadata: {}, user_metadata: {}, created_at: '2026-09-09T00:00:00Z' }
  const data: Record<string, any[]> = { properties: [], rooms: [], tenants: [], tenancies: [], invoices: [], bookings: [], investments: [] }
  let roomCalls = 0, failNext = true
  await page.route('https://cloud-test.supabase.co/**', async route => {
    const url = new URL(route.request().url())
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (url.pathname.endsWith('/token')) return json({ access_token: 'mock-jwt', token_type: 'bearer', expires_in: 3600, refresh_token: 'mock-refresh', user })
    if (url.pathname.endsWith('/user')) return json(user)
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
    if (url.pathname.endsWith('/members')) return json({ user_id: user.id, email: user.email, role, active: true })
    if (url.pathname.endsWith('/rpc/add_room')) {
      roomCalls++
      if (failNext) { failNext = false; return route.abort('failed') }
      const body = route.request().postDataJSON()
      data.properties.push({ id: 'p', name: body.p_property_name })
      data.rooms.push({ id: 'r', property_id: 'p', number: body.p_number, rent_cents: body.p_rent_cents })
      return json('r')
    }
    if (url.pathname.endsWith('/rpc/register_tenant')) {
      const b = route.request().postDataJSON()
      data.tenants.push({ id: 't', name: b.p_name, phone: b.p_phone })
      data.tenancies.push({ id: 'l', tenant_id: 't', room_id: 'r', start_date: b.p_start_date, end_date: b.p_end_date, rent_cents: b.p_rent_cents, status: 'active' })
      data.invoices.push({ id: 'i', tenancy_id: 'l', month: b.p_due_date.slice(0, 7) + '-01', due_date: b.p_due_date, due_cents: b.p_due_cents, paid_cents: b.p_paid_cents })
      return json('l')
    }
    return json(data[url.pathname.split('/').at(-1)!] ?? [])
  })
  return { roomCalls: () => roomCalls }
}
async function login(page: Page) {
  await page.goto('./'); await page.getByRole('button', { name: '登录正式管理' }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('staff@example.invalid')
  await page.getByLabel('密码', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '租房管理工作台' })).toBeVisible()
}
for (const width of [1280, 390]) test(`staff creates and finds rooms and paid tenants at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const api = await mockCloud(page, 'staff')
  await login(page)
  await expect(page.getByRole('button', { name: '员工管理', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '合作投资分成' })).toHaveCount(0)
  await page.getByRole('button', { name: '＋ 新增房间', exact: true }).click()
  await page.getByLabel('新房源名称').fill('测试公寓')
  await page.getByLabel('房号', { exact: true }).fill('A-101')
  await page.getByLabel('月租（MYR）', { exact: true }).fill('800')
  await page.getByRole('button', { name: '保存房间', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('网络连接失败')
  await expect(page.getByLabel('房号', { exact: true })).toHaveValue('A-101')
  await page.getByRole('button', { name: '保存房间', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(api.roomCalls()).toBe(2)
  await page.getByRole('button', { name: '房间管理', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'A-101', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '＋ 新增租客', exact: true }).click()
  await page.getByLabel('入住空房').selectOption('r')
  await page.getByLabel('租客姓名').fill('浏览器测试租客')
  await page.getByLabel('联系电话').fill('00000000')
  await page.getByLabel('合约到期日').fill('2099-12-31')
  await page.getByLabel('首期应收（MYR）').fill('350')
  await page.getByLabel('首期已付（MYR）').fill('350')
  await page.getByRole('button', { name: '保存租客与首期账单' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '租客管理', exact: true }).click()
  await page.getByRole('button', { name: '浏览器测试租客' }).click()
  await expect(page.getByRole('dialog')).toContainText('350.00')
  await page.getByRole('button', { name: '关闭租客明细' }).click()
  await page.reload()
  await page.getByRole('button', { name: '租客管理', exact: true }).click()
  await expect(page.getByRole('button', { name: '浏览器测试租客' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '登录正式管理' })).toBeVisible()
  await expect(page.getByText('浏览器测试租客')).toHaveCount(0)
})
test('owner sees private panels and demo is still accessible', async ({ page }) => {
  await mockCloud(page, 'owner'); await page.goto('./')
  await expect(page.getByRole('heading', { name: '租房管理总览' })).toBeVisible()
  await login(page)
  await expect(page.getByRole('button', { name: '员工管理', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '合作投资分成' })).toBeVisible()
})
