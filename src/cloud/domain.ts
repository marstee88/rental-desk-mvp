import type { NewRoom, NewTenant, Snapshot } from './types'

export function malaysiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function cents(value: string): number {
  const text = value.trim()
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) throw new Error('金额必须为非负数字，最多两位小数且小于一千万 MYR。')
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
export const currency = (amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'MYR' }).format(amount / 100)
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export function validateRoom(form: NewRoom) {
  if (!form.propertyId && !form.propertyName.trim()) throw new Error('请选择房源或填写新房源名称。')
  if (!form.number.trim()) throw new Error('请填写房号。')
  if (form.number.trim().length > 50 || form.propertyName.trim().length > 120) throw new Error('房号最多 50 字，房源名称最多 120 字。')
  if (cents(form.rent) <= 0) throw new Error('月租必须大于零。')
}
export function validateTenant(form: NewTenant, today = malaysiaToday()) {
  if (!form.roomId || !form.name.trim() || !form.phone.trim()) throw new Error('请选择空房并填写租客姓名和电话。')
  if (form.name.trim().length > 120 || form.phone.trim().length > 40) throw new Error('姓名最多 120 字，电话最多 40 字。')
  if (![form.startDate, form.endDate, form.dueDate].every(validDate)) throw new Error('请填写有效的入住、合约到期和付款日期。')
  if (form.endDate < form.startDate || form.endDate < today) throw new Error('合约到期日不得早于入住日期或今天。')
  if (form.startDate > today) throw new Error('此表登记已入住租客，入住日期不能晚于今天。')
  if (cents(form.rent) <= 0) throw new Error('约定月租必须大于零。')
  if (cents(form.paid) > cents(form.due)) throw new Error('首期已付金额不能超过应收金额。')
}
export function summarize(data: Snapshot, month: string, today: string) {
  const invoices = data.invoices.filter(i => i.month === `${month}-01`)
  const active = data.tenancies.filter(t => t.status === 'active')
  const due = invoices.reduce((sum, i) => sum + i.due_cents, 0)
  const collected = invoices.reduce((sum, i) => sum + i.paid_cents, 0)
  const occupied = new Set(active.map(t => t.room_id)).size
  return { total: data.rooms.length, occupied, vacant: data.rooms.length - occupied, due, collected, outstanding: due - collected,
    rate: due ? collected / due * 100 : 0,
    occupancy: data.rooms.length ? occupied / data.rooms.length * 100 : 0,
    overdue: new Set(invoices.filter(i => i.paid_cents < i.due_cents && i.due_date < today).map(i => i.tenancy_id)).size,
    expiring: active.filter(t => t.end_date >= today && t.end_date <= addDays(today, 30)).length }
}
export function messageOf(error: unknown): string {
  const value = error as { message?: string; code?: string }
  if (value?.code === '23505') return '房源或房号已存在，请检查后重试。'
  const message = value?.message ?? ''
  if (/[\u3400-\u9fff]/.test(message)) return message
  if (/invalid login/i.test(message)) return '邮箱或密码不正确。'
  if (/fetch|network/i.test(message)) return '网络连接失败，请检查网络后重试；填写内容已保留。'
  if (/jwt|permission|unauthorized/i.test(message)) return '登录已失效或没有操作权限，请重新登录。'
  return '操作未完成，请稍后重试；如持续失败，请联系管理员。'
}
