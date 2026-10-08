import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { cartApi, read, rupiah, STATUS, useCart, write } from '../lib'

interface Done { order_number: string; access_token: string; grand_total: number; wa_url: string | null; warning: string | null }
interface Saved { order_number: string; token: string }

async function errMsg(error: unknown, fallback: string) {
  try { const j = await (error as { context: Response }).context.json(); return (j.error as string) || fallback } catch { return fallback }
}

export function Cart() {
  const cart = useCart()
  const [f, setF] = useState({ name: '', phone: '', email: '', note: '', coupon: '', agree: false })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [copied, setCopied] = useState(false)
  const sub = cart.reduce((a, i) => a + i.price * i.qty, 0)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (!f.agree) { setErr('Setujui syarat transaksi terlebih dahulu.'); return }
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('create-order', {
      body: { name: f.name, phone: f.phone, email: f.email, note: f.note, coupon: f.coupon, items: cart.map((i) => ({ product_id: i.product_id, quantity: i.qty })) },
    })
    setBusy(false)
    if (error || !data?.order_number) { setErr(await errMsg(error, 'Pesanan gagal dibuat. Coba lagi.')); return }
    const saved = read<Saved[]>('ws_orders', [])
    write('ws_orders', [{ order_number: data.order_number, token: data.access_token }, ...saved].slice(0, 20))
    cartApi.clear(); setDone(data as Done)
  }

  if (done) return (
    <section className="box">
      <h1>Pesanan dibuat</h1>
      <p className="ok">Nomor pesanan: <b>{done.order_number}</b></p>
      <p>Total {rupiah(done.grand_total)}. Status awal: {STATUS.PENDING}, {STATUS.UNPAID.toLowerCase()}. Pesanan baru dianggap lunas setelah admin memverifikasi pembayaran.</p>
      {done.wa_url
        ? <a className="btn" href={done.wa_url} target="_blank" rel="noopener noreferrer">Lanjutkan ke WhatsApp</a>
        : <p className="err">{done.warning ?? 'Tautan WhatsApp belum tersedia.'}</p>}
      <div className="row">
        <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(done.order_number); setCopied(true) }}>{copied ? 'Tersalin' : 'Salin nomor pesanan'}</button>
        <Link className="btn ghost" to={`/cek#no=${encodeURIComponent(done.order_number)}&t=${encodeURIComponent(done.access_token)}`}>Cek status pesanan</Link>
      </div>
      <p className="muted">Simpan nomor pesanan. WhatsApp hanya terbuka, pesan tidak terkirim otomatis. Anda yang menekan kirim.</p>
    </section>
  )

  if (cart.length === 0) return <section className="box"><h1>Keranjang kosong</h1><p>Pilih produk dulu. <Link to="/">Lihat produk</Link></p></section>

  return (
    <div className="two">
      <section className="box"><h1>Keranjang</h1>
        {cart.map((i) => (
          <div className="line" key={i.product_id}>
            <div><b>{i.name}</b><div className="muted">{rupiah(i.price)}</div></div>
            <div className="row">
              <button className="btn ghost sm" aria-label="Kurangi" onClick={() => cartApi.setQty(i.product_id, i.qty - 1)}>-</button>
              <span>{i.qty}</span>
              <button className="btn ghost sm" aria-label="Tambah" onClick={() => cartApi.setQty(i.product_id, i.qty + 1)}>+</button>
              <button className="btn ghost sm" onClick={() => cartApi.remove(i.product_id)}>Hapus</button>
            </div>
          </div>
        ))}
        <p className="total">Subtotal perkiraan: {rupiah(sub)}</p>
        <p className="muted">Total final, diskon kupon, dan stok dihitung server saat pesanan dibuat.</p>
      </section>
      <form className="box" onSubmit={submit}>
        <h2>Data pembeli</h2>
        <label>Nama<input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Nomor WhatsApp<input required inputMode="tel" placeholder="08xxxxxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label>Email (opsional)<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Kode kupon (opsional)<input value={f.coupon} onChange={(e) => setF({ ...f, coupon: e.target.value })} /></label>
        <label>Catatan<input maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <label className="chk"><input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />Saya setuju dengan syarat transaksi toko.</label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Membuat pesanan...' : 'Buat pesanan'}</button>
      </form>
    </div>
  )
}

interface Result { order_number: string; created_at: string; grand_total: number; order_status: string; payment_status: string; fulfillment_status: string; public_note: string | null; items: { name: string; variant: string | null; qty: number; total: number }[] }

export function Check() {
  const [no, setNo] = useState('')
  const [tok, setTok] = useState('')
  const [res, setRes] = useState<Result | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const saved = read<Saved[]>('ws_orders', [])

  async function load(n: string, t: string) {
    setErr(''); setRes(null); setBusy(true)
    const { data, error } = await supabase.functions.invoke('check-order', { body: { order_number: n.trim(), token: t.trim() } })
    setBusy(false)
    if (error || !data?.order_number) { setErr('Pesanan tidak ditemukan. Periksa nomor pesanan dan kode akses.'); return }
    setRes(data as Result)
  }
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1)); const n = h.get('no'), t = h.get('t')
    if (n && t) { setNo(n); setTok(t); load(n, t) }
  }, [])

  return (
    <section className="box"><h1>Cek pesanan</h1>
      <form onSubmit={(e) => { e.preventDefault(); load(no, tok) }}>
        <label>Nomor pesanan<input required value={no} onChange={(e) => setNo(e.target.value)} /></label>
        <label>Kode akses<input required value={tok} onChange={(e) => setTok(e.target.value)} /></label>
        <button className="btn" disabled={busy}>{busy ? 'Mencari...' : 'Cek status'}</button>
      </form>
      {saved.length > 0 && <><h3>Pesanan di perangkat ini</h3><div className="chips">{saved.map((s) => <button key={s.order_number} className="chip" onClick={() => { setNo(s.order_number); setTok(s.token); load(s.order_number, s.token) }}>{s.order_number}</button>)}</div></>}
      {err && <p className="err" role="alert">{err}</p>}
      {res && (
        <div className="result">
          <p><b>{res.order_number}</b> · {new Date(res.created_at).toLocaleString('id-ID')}</p>
          {res.items.map((i, k) => <div className="line" key={k}><span>{i.name}{i.variant ? ` (${i.variant})` : ''} x{i.qty}</span><span>{rupiah(i.total)}</span></div>)}
          <p className="total">Total {rupiah(res.grand_total)}</p>
          <p>Pesanan: <b>{STATUS[res.order_status]}</b> · Pembayaran: <b>{STATUS[res.payment_status]}</b> · Pemrosesan: <b>{STATUS[res.fulfillment_status]}</b></p>
          {res.public_note && <p>Catatan admin: {res.public_note}</p>}
          <p className="muted">Ada kendala? Hubungi admin lewat WhatsApp dan sebutkan nomor pesanan.</p>
        </div>
      )}
    </section>
  )
}
