import { useRef, useState, type FormEvent } from 'react'
import { addRoom, addTenant } from './api'
import { malaysiaToday, messageOf, validateRoom, validateTenant } from './domain'
import { Modal } from './Modal'
import type { NewRoom, NewTenant, Snapshot } from './types'

type Props = { data: Snapshot; onClose: () => void; onSaved: (message: string) => void }

function useSave(onSaved: Props['onSaved']) {
  const id = useRef(crypto.randomUUID())
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent, action: (requestId: string) => Promise<unknown>, message: string) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await action(id.current); onSaved(message) }
    catch (reason) { setError(messageOf(reason)) }
    finally { lock.current = false; setBusy(false) }
  }
  return { busy, error, save }
}
const amountProps = { type: 'number', min: '0', max: '9999999.99', step: '0.01', required: true, inputMode: 'decimal' as const }

export function RoomForm({ data, onClose, onSaved }: Props) {
  const [form, setForm] = useState<NewRoom>({ propertyId: data.properties[0]?.id ?? '', propertyName: '', number: '', rent: '' })
  const { busy, error, save } = useSave(onSaved)
  const set = (key: keyof NewRoom, value: string) => setForm(f => ({ ...f, [key]: value }))
  return <Modal title="新增房间" onClose={onClose} busy={busy}>
    <form onSubmit={e => save(e, async id => { validateRoom(form); return addRoom(form, id) }, '房间已保存到云端。')}>
      <fieldset disabled={busy} className="entry-fields">
        <label>所属房源<select value={form.propertyId} onChange={e => set('propertyId', e.target.value)}>{data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="">＋ 新建房源</option></select></label>
        {!form.propertyId && <label>新房源名称<input required maxLength={120} value={form.propertyName} onChange={e => set('propertyName', e.target.value)} placeholder="例如：新山一号公寓" /></label>}
        <label>房号<input required maxLength={50} value={form.number} onChange={e => set('number', e.target.value)} placeholder="例如：A-101" /></label>
        <label>月租（MYR）<input {...amountProps} min="0.01" value={form.rent} onChange={e => set('rent', e.target.value)} /></label>
      </fieldset>
      <p className="muted">保存后列为空房，之后可在「新增租客」中安排入住。</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy}>{busy ? '保存中…' : '保存房间'}</button></div>
    </form>
  </Modal>
}

export function TenantForm({ data, onClose, onSaved }: Props) {
  const today = malaysiaToday()
  const occupied = new Set(data.tenancies.map(t => t.room_id))
  const available = data.rooms.filter(r => !occupied.has(r.id))
  const [form, setForm] = useState<NewTenant>({ roomId: '', name: '', phone: '', startDate: today, endDate: '', rent: '', due: '', paid: '0', dueDate: today })
  const { busy, error, save } = useSave(onSaved)
  const set = (key: keyof NewTenant, value: string) => setForm(f => ({ ...f, [key]: value }))
  return <Modal title="新增租客" onClose={onClose} busy={busy}>
    {!available.length ? <p role="status" className="empty-state">目前没有空房。请先新增房间。</p> : <form onSubmit={e => save(e, async id => { validateTenant(form); return addTenant(form, id) }, '租客、入住资料和首期账单已保存到云端。')}>
      <fieldset disabled={busy} className="entry-fields two-columns">
        <label className="full-width">入住空房<select required value={form.roomId} onChange={e => { const room = available.find(r => r.id === e.target.value); setForm(f => ({ ...f, roomId: e.target.value, rent: room ? (room.rent_cents / 100).toFixed(2) : '' })) }}><option value="">请选择空房</option>{available.map(r => <option key={r.id} value={r.id}>{data.properties.find(p => p.id === r.property_id)?.name} · {r.number}</option>)}</select></label>
        <label>租客姓名<input required maxLength={120} autoComplete="off" value={form.name} onChange={e => set('name', e.target.value)} /></label>
        <label>联系电话<input required type="tel" maxLength={40} autoComplete="off" value={form.phone} onChange={e => set('phone', e.target.value)} /></label>
        <label>实际入住日期<input required type="date" max={today} value={form.startDate} onChange={e => set('startDate', e.target.value)} /></label>
        <label>合约到期日<input required type="date" min={form.startDate > today ? form.startDate : today} value={form.endDate} onChange={e => set('endDate', e.target.value)} /></label>
        <label>约定月租（MYR）<input {...amountProps} min="0.01" value={form.rent} onChange={e => set('rent', e.target.value)} /></label>
        <label>首期付款到期日<input required type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></label>
        <label>首期应收（MYR）<input {...amountProps} value={form.due} onChange={e => set('due', e.target.value)} /></label>
        <label>首期已付（MYR）<input {...amountProps} value={form.paid} onChange={e => set('paid', e.target.value)} /></label>
      </fieldset>
      <p className="muted">首期金额请自行确认，不足月租金不会自动折算。账单归入付款到期日所在月份；此表用于登记已入住租客。</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy}>{busy ? '保存中…' : '保存租客与首期账单'}</button></div>
    </form>}
  </Modal>
}
