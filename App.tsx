import { useMemo, useState } from 'react'
import { payments, rooms } from './data'
import { getMetrics, money } from './metrics'
import './styles.css'

const metrics = getMetrics(rooms, payments)
const ledger = payments.filter((payment) => payment.paid < payment.due).map((payment) => ({ payment, room: rooms.find((room) => room.id === payment.roomId)! }))

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return <article className={`metric-card ${alert ? 'alert' : ''}`}><span>{label}</span><strong>{value}</strong></article>
}

export default function App() {
  const [property, setProperty] = useState('all')
  const [status, setStatus] = useState('all')
  const [expiring, setExpiring] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filtered = useMemo(() => ledger.filter(({ room, payment }) => {
    const searchable = `${room.id} ${room.tenant?.name}`.toLowerCase().includes(query.toLowerCase())
    const matchesProperty = property === 'all' || room.property === property
    const matchesStatus = status === 'all' || (status === 'overdue' ? payment.dueDate < '2026-09-09' : payment.status === status)
    const matchesExpiry = !expiring || Boolean(room.contractEnd && room.contractEnd <= '2026-10-09')
    return searchable && matchesProperty && matchesStatus && matchesExpiry
  }), [property, status, expiring, query])
  const selected = ledger.find(({ room }) => room.id === selectedId)
  const reset = () => { setProperty('all'); setStatus('all'); setExpiring(false); setQuery(''); setSelectedId(null) }
  return <main>
    <header className="page-header"><div><p className="eyebrow">Rental Desk <span>Interactive review branch</span></p><h1>租房管理总览</h1></div><p className="demo-note">演示模式 · 模拟资料<br />2026 年 9 月 · MYR</p></header>
    <section className="hero"><p>掌握出租情况，让每一笔租金都清楚。</p><span>数据截至 2026-09-09</span></section>
    <section className="metric-grid"><Metric label="Total Rooms / 房间总数" value={String(metrics.total)} /><Metric label="Occupied / 已出租" value={String(metrics.occupied)} /><Metric label="Collected / 本月已收" value={money(metrics.collected)} /><Metric label="Outstanding / 本月未收" value={money(metrics.outstanding)} alert /></section>
    <section className="ledger panel"><div className="panel-heading"><div><p className="eyebrow">Outstanding Ledger</p><h2>欠款租客 <em>{filtered.length}</em></h2></div><span>筛选结果 · 点击租客查看明细</span></div>
      <div style={{display:'flex',gap:10,padding:'0 22px 18px',flexWrap:'wrap'}}><input aria-label="搜索房号或租客" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索房号或租客" style={{padding:'9px 11px',border:'1px solid #dce5df',borderRadius:8}} /><select aria-label="房源筛选" value={property} onChange={(event) => setProperty(event.target.value)}><option value="all">全部房源</option>{[...new Set(rooms.map((room) => room.property))].map((name) => <option key={name}>{name}</option>)}</select><select aria-label="付款状态筛选" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部付款状态</option><option value="overdue">已逾期</option><option value="partial">部分付款</option><option value="outstanding">未付款</option></select><label style={{display:'flex',alignItems:'center',gap:6,fontSize:13}}><input type="checkbox" checked={expiring} onChange={(event) => setExpiring(event.target.checked)} />30 天内到期</label><button onClick={reset}>清除筛选</button></div>
      <div className="table-scroll"><table><thead><tr><th>房号 / Room</th><th>租客 / Tenant</th><th>欠款</th><th>付款到期日</th><th>状态</th></tr></thead><tbody>{filtered.length ? filtered.map(({ room, payment }) => { const overdue = payment.dueDate < '2026-09-09'; return <tr key={room.id}><td><b>{room.id}</b><br /><span>{room.property}</span></td><td><button onClick={() => setSelectedId(room.id)} style={{border:0,background:'none',padding:0,color:'#176848',cursor:'pointer',fontWeight:700}}>{room.tenant?.name}</button></td><td className="balance">{money(payment.due - payment.paid)}</td><td>{payment.dueDate}</td><td><mark className={overdue ? 'late' : 'ok'}>{overdue ? '已逾期' : '未到期'}</mark></td></tr> }) : <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'#82968d'}}>没有符合条件的租客。请调整或清除筛选。</td></tr>}</tbody></table></div>
    </section>
    {selected && <aside role="dialog" aria-label="租客明细" style={{position:'fixed',right:20,bottom:20,width:'min(360px,calc(100vw - 40px))',padding:22,background:'#fff',border:'1px solid #dce5df',borderRadius:14,boxShadow:'0 16px 48px rgba(15,50,39,.2)'}}><button onClick={() => setSelectedId(null)} style={{float:'right',border:0,background:'none',fontSize:18}}>×</button><p className="eyebrow">Tenant detail</p><h2>{selected.room.tenant?.name}</h2><p>{selected.room.id} · {selected.room.property}</p><p>联系电话：{selected.room.tenant?.phone}</p><p>欠款：<b>{money(selected.payment.due - selected.payment.paid)}</b></p><p>到期日：{selected.payment.dueDate}</p><p>合约到期：{selected.room.contractEnd}</p></aside>}
  </main>
}
