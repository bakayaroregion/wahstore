import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { rupiah, slugify, STATUS } from '../lib'

interface Order {
  id: string; order_number: string; customer_name: string; customer_phone: string; grand_total: number; created_at: string
  order_status: string; payment_status: string; fulfillment_status: string
  order_items: { name_snapshot: string; quantity: number }[]
}
interface Prod { id?: string; name: string; slug: string; sku: string; category_id: string | null; price: number; compare_at_price: number | null
  short_description: string; description: string; labels: string; fulfillment_mode: string; is_active: boolean; logo_url: string }
const blank: Prod = { name: '', slug: '', sku: '', category_id: null, price: 0, compare_at_price: null, short_description: '', description: '', labels: '', fulfillment_mode: 'MANUAL', is_active: false, logo_url: '' }
const mask = (p: string) => p.length > 6 ? p.slice(0, 4) + '****' + p.slice(-2) : '****'

export default function Admin() {
  const [sess, setSess] = useState<Session | null | undefined>(undefined)
  const [roles, setRoles] = useState<string[] | null>(null)
  const [tab, setTab] = useState<'dash' | 'orders' | 'products' | 'content'>('dash')
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSess(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSess(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!sess) { setRoles(null); return }
    supabase.from('user_roles').select('role').then(({ data }) => setRoles((data ?? []).map((r) => r.role as string)))
  }, [sess])

  if (sess === undefined) return <p className="wrap muted">Memuat...</p>
  if (!sess) return <Login />
  if (roles === null) return <p className="wrap muted">Memeriksa akses...</p>
  if (roles.length === 0) return <div className="wrap box"><h1>Tidak ada akses</h1><p>Akun ini belum memiliki role admin.</p><button className="btn" onClick={() => supabase.auth.signOut()}>Keluar</button></div>
  const manage = roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN')
  const ops = manage || roles.includes('ORDER_OPERATOR')

  return (
    <div className="wrap adm">
      <header className="bar"><b>Admin WAHYU STORE</b><span><Link to="/">Lihat toko</Link> <button className="btn ghost sm" onClick={() => supabase.auth.signOut()}>Keluar</button></span></header>
      <nav className="chips">
        <button className="chip" aria-pressed={tab === 'dash'} onClick={() => setTab('dash')}>Dashboard</button>
        <button className="chip" aria-pressed={tab === 'orders'} onClick={() => setTab('orders')}>Pesanan</button>
        {manage && <button className="chip" aria-pressed={tab === 'products'} onClick={() => setTab('products')}>Produk</button>}
        {manage && <button className="chip" aria-pressed={tab === 'content'} onClick={() => setTab('content')}>Konten</button>}
      </nav>
      {tab === 'dash' && <Orders ops={ops} summaryOnly />}
      {tab === 'orders' && <Orders ops={ops} />}
      {tab === 'products' && manage && <Products />}
      {tab === 'content' && manage && <Content />}
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  async function go(e: FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr('Email atau kata sandi salah.')
  }
  return (
    <form className="box login" onSubmit={go}><h1>Masuk admin</h1>
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Kata sandi<input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn">Masuk</button>
    </form>
  )
}

function Orders({ ops, summaryOnly }: { ops: boolean; summaryOnly?: boolean }) {
  const [rows, setRows] = useState<Order[] | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    supabase.from('orders').select('id,order_number,customer_name,customer_phone,grand_total,created_at,order_status,payment_status,fulfillment_status,order_items(name_snapshot,quantity)')
      .order('created_at', { ascending: false }).limit(500).then(({ data, error }) => { if (error) setErr('Pesanan gagal dimuat.'); else setRows(data as unknown as Order[]) })
  }, [])
  useEffect(load, [load])

  async function act(o: Order, kind: string, to: string, label: string, needReason = false) {
    let note: string | null = null
    if (needReason) { note = window.prompt(`Alasan ${label.toLowerCase()} (wajib):`); if (!note?.trim()) return }
    else if (!window.confirm(`${label} untuk ${o.order_number}?`)) return
    const { error } = await supabase.rpc('admin_transition', { p_order: o.id, p_kind: kind, p_new: to, p_note: note })
    if (error) window.alert('Gagal: ' + error.message); else load()
  }

  if (err) return <p className="err">{err}</p>
  if (!rows) return <p className="muted">Memuat...</p>
  const paid = rows.filter((o) => o.payment_status === 'PAID')
  const stats: [string, string | number][] = [
    ['Pesanan baru (belum dikonfirmasi)', rows.filter((o) => o.order_status === 'PENDING').length],
    ['Menunggu pembayaran', rows.filter((o) => ['UNPAID', 'AWAITING_VERIFICATION'].includes(o.payment_status) && !['CANCELLED'].includes(o.order_status)).length],
    ['Perlu diproses', rows.filter((o) => o.payment_status === 'PAID' && ['NOT_STARTED', 'FAILED'].includes(o.fulfillment_status)).length],
    ['Pesanan selesai', rows.filter((o) => o.order_status === 'COMPLETED').length],
    ['Pembayaran terverifikasi', rupiah(paid.reduce((a, o) => a + o.grand_total, 0))],
    ['Nilai pesanan dibuat (semua)', rupiah(rows.reduce((a, o) => a + o.grand_total, 0))],
  ]
  const list = summaryOnly ? rows.slice(0, 8) : rows
  return (
    <>
      {summaryOnly && <><div className="stats">{stats.map(([k, v]) => <div className="card" key={k}><span className="muted">{k}</span><b className="big-n">{v}</b></div>)}</div>
        <p className="muted">Dihitung dari 500 pesanan terakhir. Pesanan belum dibayar tidak masuk pembayaran terverifikasi.</p><h2>Pesanan terbaru</h2></>}
      <div className="tw"><table>
        <thead><tr><th>Pesanan</th><th>Pembeli</th><th>Produk</th><th>Total</th><th>Status</th>{!summaryOnly && <th>Tindakan</th>}</tr></thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id}>
              <td>{o.order_number}<div className="muted">{new Date(o.created_at).toLocaleString('id-ID')}</div></td>
              <td>{o.customer_name}<div className="muted">{mask(o.customer_phone)}</div></td>
              <td>{o.order_items.map((i) => `${i.name_snapshot} x${i.quantity}`).join(', ')}</td>
              <td>{rupiah(o.grand_total)}</td>
              <td><div>Pesanan: {STATUS[o.order_status]}</div><div>Bayar: {STATUS[o.payment_status]}</div><div>Proses: {STATUS[o.fulfillment_status]}</div></td>
              {!summaryOnly && <td><div className="acts">
                <a className="btn ghost sm" href={`https://wa.me/${o.customer_phone}`} target="_blank" rel="noopener noreferrer">Buka WhatsApp</a>
                {ops && o.order_status === 'PENDING' && <button className="btn sm" onClick={() => act(o, 'order', 'CONFIRMED', 'Konfirmasi pesanan')}>Konfirmasi</button>}
                {ops && ['UNPAID', 'AWAITING_VERIFICATION'].includes(o.payment_status) && o.order_status !== 'CANCELLED' && <button className="btn sm" onClick={() => act(o, 'payment', 'PAID', 'Tandai pembayaran terverifikasi')}>Pembayaran terverifikasi</button>}
                {ops && o.payment_status === 'PAID' && ['NOT_STARTED', 'FAILED'].includes(o.fulfillment_status) && <button className="btn sm" onClick={() => act(o, 'fulfillment', 'PROCESSING', 'Mulai proses')}>Mulai proses</button>}
                {ops && o.fulfillment_status === 'PROCESSING' && <button className="btn sm" onClick={() => act(o, 'fulfillment', 'DELIVERED', 'Tandai terkirim')}>Tandai terkirim</button>}
                {ops && o.order_status === 'CONFIRMED' && o.payment_status === 'PAID' && o.fulfillment_status === 'DELIVERED' && <button className="btn sm" onClick={() => act(o, 'order', 'COMPLETED', 'Selesaikan pesanan')}>Selesaikan</button>}
                {ops && ['PENDING', 'CONFIRMED'].includes(o.order_status) && o.payment_status !== 'PAID' && <button className="btn bad sm" onClick={() => act(o, 'order', 'CANCELLED', 'Pembatalan', true)}>Batalkan</button>}
                {ops && o.payment_status === 'PAID' && o.order_status !== 'COMPLETED' && <button className="btn bad sm" onClick={() => act(o, 'payment', 'REFUNDED', 'Refund', true)}>Refund</button>}
              </div></td>}
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={6} className="muted">Belum ada pesanan.</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

function Products() {
  const [rows, setRows] = useState<(Prod & { id: string })[] | null>(null)
  const [cats, setCats] = useState<{ id: string; name: string }[]>([])
  const [f, setF] = useState<Prod | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    supabase.from('products').select('*').order('created_at', { ascending: false }).then(({ data }) =>
      setRows((data ?? []).map((p) => ({ ...p, labels: (p.labels ?? []).join(', '), short_description: p.short_description ?? '', description: p.description ?? '', logo_url: p.logo_url ?? '' })) as (Prod & { id: string })[]))
    supabase.from('categories').select('id,name').order('sort_order').then(({ data }) => setCats(data ?? []))
  }, [])
  useEffect(load, [load])

  async function save(e: FormEvent) {
    e.preventDefault(); if (!f) return; setErr('')
    const { id, ...rest } = f
    if (f.logo_url.trim() && !/^https:\/\//i.test(f.logo_url.trim())) { setErr('URL logo harus diawali https://'); return }
    const body = { ...rest, slug: f.slug || slugify(f.name), labels: f.labels.split(',').map((s) => s.trim()).filter(Boolean), compare_at_price: f.compare_at_price || null, logo_url: f.logo_url.trim() || null }
    const { error } = id ? await supabase.from('products').update(body).eq('id', id) : await supabase.from('products').insert(body)
    if (error) { setErr('Gagal menyimpan: ' + error.message); return }
    setF(null); load()
  }
  async function del(id: string) {
    if (!window.confirm('Hapus produk ini? Pesanan lama tetap menyimpan nama dan harganya.')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) window.alert('Gagal menghapus: ' + error.message); else load()
  }
  const set = (k: keyof Prod, v: unknown) => setF((x) => (x ? { ...x, [k]: v } : x))

  return (
    <>
      <button className="btn" onClick={() => setF(blank)}>Tambah produk</button>
      {f && (
        <form className="box formgrid" onSubmit={save}>
          <label>Nama<input required value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Slug (kosong = otomatis)<input value={f.slug} onChange={(e) => set('slug', e.target.value)} /></label>
          <label>SKU<input required value={f.sku} onChange={(e) => set('sku', e.target.value)} /></label>
          <label>Kategori<select value={f.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}><option value="">Tanpa kategori</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Harga (Rp)<input type="number" min={0} required value={f.price} onChange={(e) => set('price', Number(e.target.value))} /></label>
          <label>Harga coret (Rp)<input type="number" min={0} value={f.compare_at_price ?? ''} onChange={(e) => set('compare_at_price', e.target.value ? Number(e.target.value) : null)} /></label>
          <label>Pemenuhan<select value={f.fulfillment_mode} onChange={(e) => set('fulfillment_mode', e.target.value)}><option value="MANUAL">Manual</option><option value="DIGITAL_STOCK">Stok digital</option></select></label>
          <label>Label (pisahkan koma)<input value={f.labels} onChange={(e) => set('labels', e.target.value)} placeholder="POPULER, NEW" /></label>
          <label className="wide">URL logo atau gambar (opsional, https). Pakai logo yang Anda berhak menggunakannya.<input value={f.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://..." /></label>
          <label className="wide">Deskripsi singkat<input value={f.short_description} onChange={(e) => set('short_description', e.target.value)} /></label>
          <label className="wide">Deskripsi<textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
          <label className="chk"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />Tampilkan di toko</label>
          {err && <p className="err wide" role="alert">{err}</p>}
          <div className="row wide"><button className="btn">Simpan</button><button type="button" className="btn ghost" onClick={() => setF(null)}>Batal</button></div>
        </form>
      )}
      <div className="tw"><table>
        <thead><tr><th>Produk</th><th>SKU</th><th>Harga</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(rows ?? []).map((p) => (
            <tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{rupiah(p.price)}</td><td>{p.is_active ? 'Tampil' : 'Disembunyikan'}</td>
              <td><div className="acts"><button className="btn ghost sm" onClick={() => setF(p)}>Ubah</button><button className="btn bad sm" onClick={() => del(p.id)}>Hapus</button></div></td></tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={5} className="muted">Belum ada produk. Tekan Tambah produk.</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

interface Rev { id?: string; name: string; product_label: string; rating: number; body: string; is_published: boolean; sort_order: number }
const blankRev: Rev = { name: '', product_label: '', rating: 5, body: '', is_published: false, sort_order: 0 }

function Content() {
  const [hours, setHours] = useState('')
  const [hl, setHl] = useState('')
  const [msg, setMsg] = useState('')
  const [rows, setRows] = useState<(Rev & { id: string })[] | null>(null)
  const [f, setF] = useState<Rev | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    supabase.from('store_settings').select('key,value').in('key', ['operating_hours', 'highlights']).then(({ data }) => {
      ;(data ?? []).forEach((r) => {
        if (r.key === 'operating_hours') setHours(String(r.value ?? ''))
        if (r.key === 'highlights' && Array.isArray(r.value)) setHl((r.value as string[]).join('\n'))
      })
    })
    supabase.from('testimonials').select('*').order('sort_order').order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as (Rev & { id: string })[]))
  }, [])
  useEffect(load, [load])

  async function saveSettings(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const { error } = await supabase.from('store_settings').upsert([
      { key: 'operating_hours', value: hours.trim(), is_public: true },
      { key: 'highlights', value: hl.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10), is_public: true },
    ], { onConflict: 'key' })
    setMsg(error ? 'Gagal menyimpan: ' + error.message : 'Tersimpan.')
  }
  async function saveRev(e: FormEvent) {
    e.preventDefault(); if (!f) return; setErr('')
    const { id, ...body } = f
    const { error } = id ? await supabase.from('testimonials').update(body).eq('id', id) : await supabase.from('testimonials').insert(body)
    if (error) { setErr('Gagal menyimpan: ' + error.message); return }
    setF(null); load()
  }
  async function delRev(id: string) {
    if (!window.confirm('Hapus testimoni ini?')) return
    const { error } = await supabase.from('testimonials').delete().eq('id', id)
    if (error) window.alert('Gagal menghapus: ' + error.message); else load()
  }
  const set = (k: keyof Rev, v: unknown) => setF((x) => (x ? { ...x, [k]: v } : x))

  return (
    <>
      <form className="box" onSubmit={saveSettings}>
        <h2>Jam operasional dan keunggulan</h2>
        <label>Jam operasional<input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Setiap hari, 24 jam" /></label>
        <label>Poin keunggulan (satu per baris, maks. 10)<textarea rows={6} value={hl} onChange={(e) => setHl(e.target.value)} /></label>
        <p className="muted">Tulis hanya yang benar-benar Anda penuhi. Janji seperti garansi uang kembali atau waktu aktivasi harus bisa Anda tepati.</p>
        {msg && <p role="status">{msg}</p>}
        <button className="btn">Simpan</button>
      </form>

      <h2>Testimoni</h2>
      <p className="muted">Isi hanya ulasan asli dari pelanggan. Ulasan karangan menyesatkan pembeli. Angka pesanan selesai dan rating di beranda dihitung otomatis dari data ini.</p>
      <button className="btn" onClick={() => setF(blankRev)}>Tambah testimoni</button>
      {f && (
        <form className="box formgrid" onSubmit={saveRev}>
          <label>Nama pelanggan<input required maxLength={60} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Produk yang dibeli<input value={f.product_label} onChange={(e) => set('product_label', e.target.value)} /></label>
          <label>Rating<select value={f.rating} onChange={(e) => set('rating', Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} bintang</option>)}</select></label>
          <label>Urutan<input type="number" value={f.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} /></label>
          <label className="wide">Isi ulasan<textarea required maxLength={400} rows={3} value={f.body} onChange={(e) => set('body', e.target.value)} /></label>
          <label className="chk"><input type="checkbox" checked={f.is_published} onChange={(e) => set('is_published', e.target.checked)} />Tampilkan di beranda</label>
          {err && <p className="err wide" role="alert">{err}</p>}
          <div className="row wide"><button className="btn">Simpan</button><button type="button" className="btn ghost" onClick={() => setF(null)}>Batal</button></div>
        </form>
      )}
      <div className="tw"><table>
        <thead><tr><th>Nama</th><th>Rating</th><th>Ulasan</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.id}><td>{r.name}<div className="muted">{r.product_label}</div></td><td>{r.rating}/5</td><td>{r.body}</td><td>{r.is_published ? 'Tampil' : 'Disembunyikan'}</td>
              <td><div className="acts"><button className="btn ghost sm" onClick={() => setF(r)}>Ubah</button><button className="btn bad sm" onClick={() => delRev(r.id)}>Hapus</button></div></td></tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={5} className="muted">Belum ada testimoni.</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}
