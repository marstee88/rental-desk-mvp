import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null)
  const headingId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => { document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
    <div className="form-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId} ref={dialog} tabIndex={-1} onKeyDown={e => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() }
      if (e.key !== 'Tab') return
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') ?? [])
      const first = elements[0], last = elements[elements.length - 1]
      if (!first) { e.preventDefault(); return }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus() }
    }}>
      <div className="form-title"><h2 id={headingId}>{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={`关闭${title}`}>×</button></div>
      {children}
    </div>
  </div>
}
