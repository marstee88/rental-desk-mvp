// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomForm, TenantForm } from '../src/cloud/Forms'
import { addRoom, addTenant } from '../src/cloud/api'
import { addDays, malaysiaToday } from '../src/cloud/domain'
import { emptySnapshot } from '../src/cloud/types'

vi.mock('../src/cloud/api', () => ({ addRoom: vi.fn(), addTenant: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const sample = () => ({ ...emptySnapshot(), properties: [{ id: 'p', name: '测试公寓' }], rooms: [{ id: 'r', property_id: 'p', number: '101', rent_cents: 80000 }] })

describe('新增表单', () => {
  it('cancels without saving and returns focus to the opener', async () => {
    const close = vi.fn()
    const button = document.createElement('button'); document.body.append(button); button.focus()
    const view = render(<RoomForm data={sample()} onClose={close} onSaved={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(close).toHaveBeenCalledOnce(); expect(addRoom).not.toHaveBeenCalled()
    view.unmount(); expect(document.activeElement).toBe(button); button.remove()
  })
  it('retains values on network failure, reuses the request id, disables saving', async () => {
    const done = vi.fn()
    vi.mocked(addRoom).mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce('new-room')
    render(<RoomForm data={sample()} onClose={vi.fn()} onSaved={done} />)
    await userEvent.type(screen.getByLabelText('房号'), '102')
    await userEvent.type(screen.getByLabelText('月租（MYR）'), '900')
    await userEvent.click(screen.getByRole('button', { name: '保存房间' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('网络连接失败'))
    expect((screen.getByLabelText('房号') as HTMLInputElement).value).toBe('102')
    await userEvent.click(screen.getByRole('button', { name: '保存房间' }))
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(vi.mocked(addRoom).mock.calls[0][1]).toBe(vi.mocked(addRoom).mock.calls[1][1])
  })
  it('does not duplicate requests while one is pending', async () => {
    let resolve!: (id: string) => void
    vi.mocked(addRoom).mockImplementation(() => new Promise(r => { resolve = r }))
    render(<RoomForm data={sample()} onClose={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('房号'), '103'); await userEvent.type(screen.getByLabelText('月租（MYR）'), '800')
    const form = screen.getByRole('button', { name: '保存房间' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(addRoom).toHaveBeenCalledOnce()
    expect((screen.getByRole('button', { name: '保存中…' }) as HTMLButtonElement).disabled).toBe(true)
    resolve('id'); await waitFor(() => expect(screen.queryByText('保存中…')).toBeNull())
  })
  it('shows an empty-room message and hides occupied rooms', () => {
    const data = sample()
    data.tenancies.push({ id: 'l', room_id: 'r', tenant_id: 't', start_date: '2026-01-01', end_date: '2027-01-01', rent_cents: 80000, status: 'active' })
    render(<TenantForm data={data} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toContain('没有空房')
    expect(screen.queryByRole('button', { name: '保存租客与首期账单' })).toBeNull()
  })
  it('records full payment and explicit first-period amounts, without proration', async () => {
    vi.mocked(addTenant).mockResolvedValue('lease')
    const done = vi.fn()
    render(<TenantForm data={sample()} onClose={vi.fn()} onSaved={done} />)
    await userEvent.selectOptions(screen.getByLabelText('入住空房'), 'r')
    await userEvent.type(screen.getByLabelText('租客姓名'), '测试租客')
    await userEvent.type(screen.getByLabelText('联系电话'), '00000000')
    fireEvent.change(screen.getByLabelText('合约到期日'), { target: { value: addDays(malaysiaToday(), 365) } })
    await userEvent.type(screen.getByLabelText('首期应收（MYR）'), '350')
    await userEvent.clear(screen.getByLabelText('首期已付（MYR）'))
    await userEvent.type(screen.getByLabelText('首期已付（MYR）'), '350')
    await userEvent.click(screen.getByRole('button', { name: '保存租客与首期账单' }))
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(vi.mocked(addTenant).mock.calls[0][0]).toMatchObject({ roomId: 'r', rent: '800.00', due: '350', paid: '350' })
  })
})
