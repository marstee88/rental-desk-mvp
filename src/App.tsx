import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import DemoDashboard from './DemoDashboard'
import { supabase, appUrl } from './cloud/client'
import { messageOf } from './cloud/domain'
import { LiveDashboard } from './cloud/LiveDashboard'
import './cloud/cloud.css'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [mode, setMode] = useState<'demo' | 'login'>('demo')
  const [setup, setSetup] = useState(new URLSearchParams(window.location.search).get('account') === 'setup')
  const [logoutError, setLogoutError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let alive = true
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return
      setSession(next); setLoading(false)
      if (event === 'PASSWORD_RECOVERY' || (next?.user.invited_at && !next.user.user_metadata.password_set)) setSetup(true)
      if (next) setMode('login')
    })
    supabase.auth.getSession().then(({ data, error }) => { if (alive) { setSession(error ? null : data.session); setLoading(false) } }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  async function logout() {
    setSession(null); setSetup(false); setMode('login'); setLogoutError('')
    const result = await supabase?.auth.signOut({ scope: 'local' })
    if (result?.error) setLogoutError('页面资料已清除，但退出请求未完成，请检查网络后再次退出。')
  }
  if (loading) return <main><p role="status">正在检查登录状态…</p></main>
  if (session && setup) return <PasswordSetup onDone={() => { setSetup(false); window.history.replaceState(null, '', appUrl()) }} onLogout={logout} />
  if (session) return <LiveDashboard key={session.user.id} onLogout={logout} />
  if (mode === 'demo') return <><div className="mode-bar"><span>公开演示 · 仅含模拟资料</span><button className="primary" onClick={() => setMode('login')}>登录正式管理</button></div><DemoDashboard /></>
  return <main className="login-page"><section className="panel login-card"><p className="eyebrow">租房管理工作台</p><h1>登录正式管理</h1><p className="muted">登录后可新增房间和租客，资料在手机与电脑同步。</p>
    {logoutError && <p role="alert" className="form-error">{logoutError}<button onClick={logout}>再次退出</button></p>}
    {supabase ? <LoginForm /> : <p role="status" className="setup-note">正式管理尚未启用。管理员完成云端连接后，即可在这里登录使用。</p>}
    <button className="text-button" onClick={() => setMode('demo')}>返回公开演示</button>
  </section></main>
}

function LoginForm() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error }
    catch (reason) { setError(messageOf(reason)) } finally { setBusy(false) }
  }
  async function reset() {
    if (!email.trim()) { setError('请先填写邮箱。'); return }
    setBusy(true); setError(''); setNotice('')
    try { const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${appUrl()}?account=setup` }); if (error) throw error; setNotice('若此邮箱已有账号，将收到密码重设邮件，请检查收件箱。') }
    catch (reason) { setError(messageOf(reason)) } finally { setBusy(false) }
  }
  return <form onSubmit={login}><fieldset disabled={busy} className="entry-fields"><label>邮箱<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label><label>密码<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label></fieldset>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button className="primary wide" disabled={busy}>{busy ? '请稍候…' : '登录'}</button><button className="text-button" type="button" disabled={busy} onClick={reset}>忘记密码</button></form>
}

function PasswordSetup({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function save(e: FormEvent) {
    e.preventDefault(); setError('')
    if (password.length < 12 || password !== confirm) { setError('密码至少 12 个字符，且两次输入必须一致。'); return }
    setBusy(true)
    try { const { error } = await supabase!.auth.updateUser({ password, data: { password_set: true } }); if (error) throw error; onDone() }
    catch (reason) { setError(messageOf(reason)) } finally { setBusy(false) }
  }
  return <main className="login-page"><section className="panel login-card"><h1>设置登录密码</h1><form onSubmit={save}><fieldset disabled={busy} className="entry-fields"><label>新密码<input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><label>确认新密码<input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label></fieldset>{error && <p role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? '保存中…' : '保存密码并继续'}</button></form><button className="text-button" disabled={busy} onClick={onLogout}>退出登录</button></section></main>
}
