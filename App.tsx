import { bookings, investments, payments, rooms } from './data'
import { getMetrics, money } from './metrics'
import './styles.css'

const metrics = getMetrics(rooms, payments)
const outstanding = payments
  .filter((payment) => payment.paid < payment.due)
  .map((payment) => ({ payment, room: rooms.find((room) => room.id === payment.roomId)! }))
  .sort((a, b) => a.payment.dueDate.localeCompare(b.payment.dueDate) || b.payment.due - a.payment.due)

function MetricCard({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'alert' | 'accent' }) {
  return <article className={`metric-card ${tone ?? ''}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>
}

export default function App() {
  const collectionRate = (metrics.collected / metrics.due) * 100
  return <main>
    <header className="page-header">
      <div><p className="eyebrow">Rental Desk <span>房源管理工作台 / Overview</span></p><h1>租房管理总览</h1></div>
      <p className="demo-note">演示模式 · 模拟资料<br />2026 年 9 月 · MYR</p>
    </header>

    <section className="hero"><p>掌握出租情况，让每一笔租金都清楚。</p><span>数据截至 2026-09-09</span></section>

    <section className="metric-grid" aria-label="租房核心指标">
      <MetricCard label="Total Rooms / 房间总数" value={String(metrics.total)} />
      <MetricCard label="Occupied / 已出租" value={String(metrics.occupied)} note={`${((metrics.occupied / metrics.total) * 100).toFixed(1)}% 入住率`} tone="accent" />
      <MetricCard label="Vacant / 空房" value={String(metrics.vacant)} />
      <MetricCard label="Monthly Rent Due / 本月应收" value={money(metrics.due)} />
      <MetricCard label="Collected / 本月已收" value={money(metrics.collected)} tone="accent" />
      <MetricCard label="Outstanding / 本月未收" value={money(metrics.outstanding)} note="待跟进" tone="alert" />
      <MetricCard label="Overdue Tenants / 逾期租客" value={String(metrics.overdue)} tone="alert" />
      <MetricCard label="Expiring Contracts / 30 天内到期" value={String(metrics.expiring)} />
    </section>

    <section className="collection-card">
      <div><p className="eyebrow">September Collection</p><h2>本月收租进度</h2><strong>{money(metrics.collected)}</strong><span>已收 · 尚有 {metrics.outstandingPayments} 位租客未结清</span></div>
      <div className="progress-wrap"><b>{collectionRate.toFixed(1)}%</b><div className="progress"><i style={{ width: `${collectionRate}%` }} /></div><small>其中 {metrics.overdue} 位已超过付款日期</small></div>
    </section>

    <section className="split-grid">
      <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Bookings</p><h2>房间预订 <em>{bookings.length}</em></h2></div><span>待付定金 2 位 · 已确认 1 位</span></div><BookingTable /></article>
      <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Partner Returns</p><h2>合作投资分成</h2></div><span>按净收益分成</span></div><InvestmentTable /></article>
    </section>

    <section className="ledger panel"><div className="panel-heading"><div><p className="eyebrow">Outstanding Ledger</p><h2>欠款租客 <em>{outstanding.length}</em></h2></div><span>按付款到期日、欠款金额排列</span></div><LedgerTable /></section>
    <footer>Rental Desk · {metrics.total} 间房，一目了然。所有姓名、房间与金额均为模拟资料。</footer>
  </main>
}

function BookingTable() { return <div className="table-scroll"><table><thead><tr><th>房号 / 租客</th><th>计划入住</th><th>应付 / 已收定金</th><th>预订状态</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.roomId}><td><b>{booking.roomId}</b><br /><span>{booking.tenant}</span></td><td>{booking.moveIn}</td><td>{money(booking.depositDue)}<br /><span>已收 {money(booking.depositPaid)}</span></td><td><mark className={booking.depositPaid ? 'ok' : ''}>{booking.depositPaid ? '已确认 · 待入住' : '待付定金'}</mark></td></tr>)}</tbody></table></div> }

function InvestmentTable() { return <div className="table-scroll"><table><thead><tr><th>合作方 / 房间</th><th>已收租金</th><th>成本 / 费用</th><th>可分净收益</th><th>合作方分成</th></tr></thead><tbody>{investments.map((item) => { const net = item.collected - item.rentCost - item.expenses; return <tr key={item.partner}><td><b>{item.partner}</b><br /><span>{item.rooms}</span></td><td>{money(item.collected)}</td><td>{money(item.rentCost)}<br /><span>费用 {money(item.expenses)}</span></td><td>{money(net)}</td><td>{money(net * item.partnerRate)}<br /><span>净收益 × {item.partnerRate * 100}%</span></td></tr> })}</tbody></table></div> }

function LedgerTable() { return <div className="table-scroll"><table><thead><tr><th>房号 / Room</th><th>租客 / Tenant</th><th>应收</th><th>已付</th><th>欠款</th><th>付款到期日</th><th>状态</th></tr></thead><tbody>{outstanding.map(({ payment, room }) => { const balance = payment.due - payment.paid; const overdue = payment.dueDate < '2026-09-09'; return <tr key={room.id}><td><b>{room.id}</b><br /><span>{room.property}</span></td><td>{room.tenant?.name}</td><td>{money(payment.due)}</td><td>{money(payment.paid)}</td><td className="balance">{money(balance)}</td><td>{payment.dueDate}</td><td><mark className={overdue ? 'late' : 'ok'}>{overdue ? '已逾期' : '未到期'}</mark></td></tr> })}</tbody></table></div> }
