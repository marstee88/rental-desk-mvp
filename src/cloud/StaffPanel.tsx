import { useEffect, useState, type FormEvent } from 'react'
import { inviteStaff, listMembers, setStaffActive } from './api'
import { messageOf } from './domain'
import type { Member } from './types'

export function StaffPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(true)
  useEffect(() => { let cancelled = false; listMembers().then(data => { if (!cancelled) setMembers(data) }).catch(e => { if (!cancelled) setError(messageOf(e)) }).finally(() => { if (!cancelled) setBusy(false) }); return () => { cancelled = true } }, [])
  async function invite(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await inviteStaff(email); setEmail(''); setNotice('邀请邮件已发出，员工可通过邮件设置密码。'); setMembers(await listMembers()) }
    catch (reason) { setError(messageOf(reason)) } finally { setBusy(false) }
  }
  async function toggle(member: Member) {
    setBusy(true); setError(''); setNotice('')
    try { await setStaffActive(member.user_id, !member.active); setNotice(member.active ? '员工已停用，后续请求无法读取或新增资料。' : '员工已启用。'); setMembers(await listMembers()) }
    catch (reason) { setError(messageOf(reason)) } finally { setBusy(false) }
  }
  return <section className="panel management-panel"><h2>员工管理</h2><p className="muted">员工可查看全部房源、租客和租金并新增资料。合作分成和账号管理仅管理员可见。</p>
    <form className="invite-form" onSubmit={invite}><label>员工邮箱<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label><button className="primary" disabled={busy}>发送员工邀请</button></form>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <ul className="member-list">{members.map(m => <li key={m.user_id}><span>{m.email}<small>{m.role === 'owner' ? '管理员' : m.active ? '员工 · 已启用' : '员工 · 已停用'}</small></span>{m.role === 'staff' && <button disabled={busy} onClick={() => toggle(m)}>{m.active ? '停用账号' : '启用账号'}</button>}</li>)}</ul>
  </section>
}
