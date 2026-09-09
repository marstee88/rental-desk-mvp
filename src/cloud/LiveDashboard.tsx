import { useEffect, useMemo, useState } from 'react'
import { getMember, getSnapshot } from './api'
import { addDays, currency, malaysiaToday, messageOf, summarize } from './domain'
import { RoomForm, TenantForm } from './Forms'
import { Modal } from './Modal'
import { StaffPanel } from './StaffPanel'
import type { Member, Snapshot } from './types'

export function LiveDashboard({ onLogout }: { onLogout: () => void }) {
  const [state, setState] = useState<{ member: Member; data: Snapshot } | null>(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [today, setToday] = useState(malaysiaToday())
  const [month, setMonth] = useState(today.slice(0, 7))
  const [section, setSection] = useState('overview')
  const [form, setForm] = useState<'room' | 'tenant' | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [property, setProperty] = useState('all'), [status, setStatus] = useState('all'), [query, setQuery] = useState(''), [expiring, setExpiring] = useState(false)
  useEffect(() => {
    let cancelled = false
    setState(null); setError('')
    async function load() {
      try { const member = await getMember(); const data = await getSnapshot(member.role); if (!cancelled) setState({ member, data }) }
      catch (reason) { if (!cancelled) setError(messageOf(reason)) }
    }
    void load()
    return () => { cancelled = true }
  }, [revision])
  useEffect(() => {
    const update = () => setToday(malaysiaToday())
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  const metrics = useMemo(() => state ? summarize(state.data, month, today) : null, [state, month, today])
  const refresh = () => { setForm(null); setSelected(null); setRevision(r => r + 1) }
  const saved = (message: string) => { setNotice(`${message} 若本月看不到该账单，可切换到付款到期日所在月份。`); refresh() }
  if (!state || !metrics) return <main className="live-dashboard"><div className="toolbar"><h1>租房管理</h1><button onClick={onLogout}>退出登录</button></div>{notice && <p className="success-note" role="status">{notice}</p>}{error ? <section className="panel management-panel"><p role="alert">{error}</p><button className="primary" onClick={refresh}>重新加载</button></section> : <p role="status">正在读取云端资料…</p>}</main>
  const { data, member } = state
  const propertyName = (id: string) => data.properties.find(p => p.id === id)?.name ?? '房源'
  const roomName = (id: string) => { const room = data.rooms.find(r => r.id === id); return room ? `${propertyName(room.property_id)} · ${room.number}` : '房间' }
  const occupied = new Set(data.tenancies.map(t => t.room_id))
  const monthInvoices = data.invoices.filter(i => i.month === `${month}-01`)
  const ledger = monthInvoices.filter(i => i.paid_cents < i.due_cents).flatMap(invoice => {
    const tenancy = data.tenancies.find(t => t.id === invoice.tenancy_id)
    const room = data.rooms.find(r => r.id === tenancy?.room_id)
    const tenant = data.tenants.find(t => t.id === tenancy?.tenant_id)
    if (!tenancy || !room || !tenant) return []
    return [{ invoice, tenancy, room, tenant }]
  }).filter(({ invoice, tenancy, room, tenant }) => (property === 'all' || room.property_id === property)
    && (status === 'all' || (status === 'overdue' && invoice.due_date < today) || (status === 'partial' && invoice.paid_cents > 0))
    && (!expiring || (tenancy.end_date >= today && tenancy.end_date <= addDays(today, 30)))
    && `${room.number} ${propertyName(room.property_id)} ${tenant.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.invoice.due_date.localeCompare(b.invoice.due_date) || (b.invoice.due_cents - b.invoice.paid_cents) - (a.invoice.due_cents - a.invoice.paid_cents))
  const detail = data.tenancies.find(t => t.tenant_id === selected)
  const detailTenant = data.tenants.find(t => t.id === selected)
  const detailInvoices = data.invoices.filter(i => i.tenancy_id === detail?.id)
  const cards = [ ['房间总数', metrics.total], ['已出租', metrics.occupied], ['空房', metrics.vacant], ['本月应收', currency(metrics.due)], ['本月已收', currency(metrics.collected)], ['本月未收', currency(metrics.outstanding)], ['本月逾期租客', metrics.overdue], ['30 天内合约到期', metrics.expiring] ]
  return <main className="live-dashboard">
    <header className="page-header"><div><p className="eyebrow">正式管理 · 云端同步</p><h1>租房管理工作台</h1><p className="muted account-label">{member.email} · {member.role === 'owner' ? '管理员' : '员工'}</p></div><div className="toolbar"><button onClick={refresh}>刷新资料</button><button onClick={onLogout}>退出登录</button></div></header>
    <div className="action-heading"><div><h2>房间和租客，一处管理</h2><p className="muted">先新增房间，再安排租客入住。</p></div><div className="toolbar"><button onClick={() => setForm('room')}>＋ 新增房间</button><button className="primary" onClick={() => setForm('tenant')}>＋ 新增租客</button></div></div>
    {notice && <p className="success-note" role="status">{notice}<button className="text-button" onClick={() => setNotice('')}>关闭提示</button></p>}
    <nav className="section-tabs" aria-label="管理页面">{[['overview', '总览'], ['rooms', '房间管理'], ['tenants', '租客管理'], ...(member.role === 'owner' ? [['staff', '员工管理']] : [])].map(([id, name]) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{name}</button>)}</nav>
    {section === 'overview' && <>
      <div className="month-toolbar"><label>账单月份<input aria-label="账单月份" type="month" required value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value) }} /></label><span className="muted">今日 {today} · 马来西亚时间 · 入住及到期统计为当前状态</span></div>
      <section className="metric-grid" aria-label="正式租房指标">{cards.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="collection-card"><div><h2>{month} 收租进度</h2><strong>{currency(metrics.collected)}</strong><span>入住率 {metrics.occupancy.toFixed(1)}%</span></div><div className="progress-wrap"><b>{metrics.rate.toFixed(1)}%</b><div className="progress"><i style={{ width: `${metrics.rate}%` }} /></div><small>本期账单按付款到期日归入月份</small></div></section>
      <section className="split-grid">
        <article className="panel"><div className="panel-heading"><h2>房间预订</h2><span>{data.bookings.length} 条记录</span></div>{data.bookings.length ? <div className="table-scroll"><table><thead><tr><th>房间 / 租客</th><th>入住日期</th><th>应付 / 已付定金</th></tr></thead><tbody>{data.bookings.map(b => <tr key={b.id}><td>{roomName(b.room_id)}<br />{b.tenant_name}</td><td>{b.move_in}</td><td>{currency(b.deposit_due_cents)} / {currency(b.deposit_paid_cents)}</td></tr>)}</tbody></table></div> : <p className="empty-state">暂无预订记录。</p>}</article>
        {member.role === 'owner' && <article className="panel"><div className="panel-heading"><h2>合作投资分成</h2><span>仅管理员可见 · {month}</span></div>{data.investments.filter(i => i.month === `${month}-01`).length ? <div className="table-scroll"><table><thead><tr><th>合作方 / 房间</th><th>净收益</th><th>合作方分成</th></tr></thead><tbody>{data.investments.filter(i => i.month === `${month}-01`).map(i => { const net = i.collected_cents - i.rent_cost_cents - i.expenses_cents; return <tr key={i.id}><td>{i.partner}<br />{i.rooms}</td><td>{currency(net)}</td><td>{currency(Math.round(net * i.partner_rate))}</td></tr> })}</tbody></table></div> : <p className="empty-state">本月暂无合作分成记录。</p>}</article>}
      </section>
      <section className="ledger panel"><div className="panel-heading"><h2>欠款租客 <em>{ledger.length}</em></h2></div>
        <div className="ledger-filters"><label>房源<select value={property} onChange={e => setProperty(e.target.value)}><option value="all">全部房源</option>{data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>付款状态<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">全部欠款</option><option value="overdue">已逾期</option><option value="partial">部分付款</option></select></label><label className="search-filter">查找租客<input placeholder="房号或租客姓名" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="check-filter"><input type="checkbox" checked={expiring} onChange={e => setExpiring(e.target.checked)} />30 天内到期</label><button onClick={() => { setProperty('all'); setStatus('all'); setQuery(''); setExpiring(false) }}>清除筛选</button></div>
        <div className="table-scroll"><table><thead><tr><th>房间</th><th>租客</th><th>应收</th><th>已付</th><th>欠款</th><th>付款到期日</th><th>状态</th></tr></thead><tbody>{ledger.length ? ledger.map(({ invoice: i, room, tenant }) => <tr key={i.id}><td>{roomName(room.id)}</td><td><button className="tenant-button" onClick={() => setSelected(tenant.id)}>{tenant.name}</button></td><td>{currency(i.due_cents)}</td><td>{currency(i.paid_cents)}</td><td className="balance">{currency(i.due_cents - i.paid_cents)}</td><td>{i.due_date}</td><td>{i.due_date < today ? '已逾期' : '未到期'}</td></tr>) : <tr><td colSpan={7} className="empty-state">没有符合条件的欠款租客。</td></tr>}</tbody></table></div>
      </section>
    </>}
    {section === 'rooms' && <section className="panel"><div className="panel-heading"><h2>房间管理 <em>{data.rooms.length}</em></h2><span>包括空房和已出租房间</span></div><div className="table-scroll"><table><thead><tr><th>房源</th><th>房号</th><th>月租</th><th>状态</th><th>租客</th></tr></thead><tbody>{data.rooms.length ? data.rooms.map(r => { const tenancy = data.tenancies.find(t => t.room_id === r.id); const tenant = data.tenants.find(t => t.id === tenancy?.tenant_id); return <tr key={r.id}><td>{propertyName(r.property_id)}</td><td>{r.number}</td><td>{currency(tenancy?.rent_cents ?? r.rent_cents)}</td><td><mark className="ok">{occupied.has(r.id) ? '已出租' : '空房'}</mark></td><td>{tenant ? <button className="tenant-button" onClick={() => setSelected(tenant.id)}>{tenant.name}</button> : '—'}</td></tr> }) : <tr><td colSpan={5} className="empty-state">还没有房间，点击上方「新增房间」开始。</td></tr>}</tbody></table></div></section>}
    {section === 'tenants' && <section className="panel"><div className="panel-heading"><h2>租客管理 <em>{data.tenants.length}</em></h2><span>已付清的租客也保留在此</span></div><div className="table-scroll"><table><thead><tr><th>租客</th><th>电话</th><th>房间</th><th>入住日期</th><th>合约到期日</th><th>全部账单欠款</th></tr></thead><tbody>{data.tenants.length ? data.tenants.map(t => { const lease = data.tenancies.find(l => l.tenant_id === t.id); const balance = data.invoices.filter(i => i.tenancy_id === lease?.id).reduce((sum, i) => sum + i.due_cents - i.paid_cents, 0); return <tr key={t.id}><td><button className="tenant-button" onClick={() => setSelected(t.id)}>{t.name}</button></td><td>{t.phone}</td><td>{lease ? roomName(lease.room_id) : '—'}</td><td>{lease?.start_date}</td><td>{lease?.end_date}</td><td>{currency(balance)}</td></tr> }) : <tr><td colSpan={6} className="empty-state">还没有租客，新增房间后即可安排入住。</td></tr>}</tbody></table></div></section>}
    {section === 'staff' && member.role === 'owner' && <StaffPanel />}
    {form === 'room' && <RoomForm data={data} onClose={() => setForm(null)} onSaved={saved} />}
    {form === 'tenant' && <TenantForm data={data} onClose={() => setForm(null)} onSaved={saved} />}
    {detail && detailTenant && <Modal title="租客明细" onClose={() => setSelected(null)}><h3>{detailTenant.name}</h3><dl className="detail-list"><dt>联系电话</dt><dd>{detailTenant.phone}</dd><dt>房间</dt><dd>{roomName(detail.room_id)}</dd><dt>租期</dt><dd>{detail.start_date} 至 {detail.end_date}</dd><dt>约定月租</dt><dd>{currency(detail.rent_cents)}</dd></dl><h3>账单记录</h3>{detailInvoices.map(i => <div className="invoice-detail" key={i.id}><b>{i.month.slice(0, 7)}</b><p>应收 {currency(i.due_cents)} · 已付 {currency(i.paid_cents)}</p><p>欠款 {currency(i.due_cents - i.paid_cents)} · 付款到期 {i.due_date}</p></div>)}</Modal>}
    <footer>资料已保存于云端 · 其他设备打开后点击「刷新资料」即可读取最新记录</footer>
  </main>
}
