import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { cartApi, read, rupiah, STATUS, useCart, useSession, write } from '../lib'
import { useT } from '../i18n'
import { Icon } from '../ui'

interface Done { order_number: string; access_token: string; grand_total: number; wa_url: string | null; warning: string | null }
interface Saved { order_number: string; token: string }

async function errMsg(error: unknown, fallback: string) {
  try { const j = await (error as { context: Response }).context.json(); return (j.error as string) || fallback } catch { return fallback }
}

export function Cart() {
  const t = useT()
  const cart = useCart()
  const session = useSession()
  const [loy, setLoy] = useState(0)
  const [f, setF] = useState({ name: '', phone: '', note: '', coupon: '', agree: false })
  useEffect(() => {
    if (!session) return
    const m = session.user.user_metadata ?? {}
    setF((x) => ({ ...x, name: x.name || String(m.full_name ?? ''), phone: x.phone || String(m.phone ?? '') }))
    supabase.rpc('my_loyalty').then(({ data }) => setLoy(Number(data?.percent ?? 0)))
  }, [session])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null)
  const [cErr, setCErr] = useState('')
  const [cBusy, setCBusy] = useState(false)
  const sub = cart.reduce((a, i) => a + i.price * i.qty, 0)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (!f.agree) { setErr(t('Setujui syarat transaksi terlebih dahulu.')); return }
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('create-order', {
      body: { name: f.name, phone: f.phone, note: f.note, coupon: f.coupon, items: cart.map((i) => ({ product_id: i.product_id, quantity: i.qty })) },
    })
    setBusy(false)
    if (error || !data?.order_number) { setErr(await errMsg(error, t('Pesanan gagal dibuat. Coba lagi.'))); return }
    const saved = read<Saved[]>('ws_orders', [])
    write('ws_orders', [{ order_number: data.order_number, token: data.access_token }, ...saved].slice(0, 20))
    cartApi.clear(); setDone(data as Done)
  }

  if (done) return (
    <section className="box">
      <h1>{t('Pesanan dibuat')}</h1>
      <p className="ok">{t('Nomor pesanan:')} <b>{done.order_number}</b></p>
      <p>{t('Total')} {rupiah(done.grand_total)}. {t(STATUS.PENDING)}, {t(STATUS.UNPAID).toLowerCase()}.</p>
      {done.wa_url
        ? <a className="btn" href={done.wa_url} target="_blank" rel="noopener noreferrer">{t('Lanjutkan ke WhatsApp')}</a>
        : <p className="err">{done.warning ?? 'Tautan WhatsApp belum tersedia.'}</p>}
      <div className="row">
        <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(done.order_number); setCopied(true) }}>{copied ? t('Tersalin') : t('Salin nomor pesanan')}</button>
        <Link className="btn ghost" to={`/cek#no=${encodeURIComponent(done.order_number)}&t=${encodeURIComponent(done.access_token)}`}>{t('Cek status pesanan')}</Link>
      </div>
      <p className="muted">{t('Simpan nomor pesanan. WhatsApp hanya terbuka, pesan tidak terkirim otomatis. Anda yang menekan kirim.')}</p>
    </section>
  )

  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <section className="box"><h1>{t('Masuk dulu')}</h1><p>{t('Untuk berbelanja, Anda perlu akun dengan email yang terdaftar.')}</p><div className="row"><Link className="btn" to="/masuk">{t('Masuk')}</Link><Link className="btn ghost" to="/daftar">{t('Daftar')}</Link></div></section>

  if (cart.length === 0) return <section className="box"><h1>{t('Keranjang kosong')}</h1><p>{t('Pilih produk dulu.')} <Link to="/produk">{t('Lihat produk')}</Link></p></section>

  const couponDisc = applied ? applied.discount : 0
  const loyDisc = Math.floor((sub - couponDisc) * loy / 100)
  const total = Math.max(0, sub - couponDisc - loyDisc)

  async function applyCoupon() {
    const code = f.coupon.trim()
    if (!code) return
    setCErr(''); setCBusy(true)
    const { data, error } = await supabase.rpc('check_coupon', { p_code: code, p_subtotal: sub })
    setCBusy(false)
    if (error || !data) { setCErr(t('Kupon gagal dicek. Coba lagi.')); return }
    const r = data as { ok: boolean; reason?: string; discount?: number; min?: number }
    if (!r.ok) {
      setApplied(null)
      setCErr(r.reason === 'EXHAUSTED' ? t('Kupon sudah habis dipakai.') : r.reason === 'MIN_PURCHASE' ? `${t('Belanja minimal')} ${rupiah(r.min ?? 0)} ${t('untuk kupon ini.')}` : t('Kode kupon tidak valid atau sudah kedaluwarsa.'))
      return
    }
    setApplied({ code, discount: Number(r.discount) })
  }
  useEffect(() => { if (applied) applyCoupon() }, [sub])

  return (
    <form className="checkout" onSubmit={submit}>
      <h1 className="cohead">{t('Checkout Pesanan')}</h1>

      <section className="box">
        <h3>{t('Detail Pesanan')}</h3>
        {cart.map((i) => (
          <div className="coitem" key={i.product_id}>
            <span className={'cotile' + (i.logo_url ? ' white' : '')}>{i.logo_url ? <img src={i.logo_url} alt="" /> : <Icon n="pkg" size={26} />}</span>
            <div className="coinfo">
              <b>{i.name}</b>
              {i.desc && <div className="muted">{i.desc}</div>}
              <div className="tags pills">{i.labels?.map((l) => <span className="tag" key={l}>{l}</span>)}</div>
            </div>
            <div className="coqty">
              <div className="row">
                <button type="button" className="btn ghost sm" aria-label={t('Kurangi')} onClick={() => cartApi.setQty(i.product_id, i.qty - 1)}>-</button>
                <span>{i.qty}</span>
                <button type="button" className="btn ghost sm" aria-label={t('Tambah')} onClick={() => cartApi.setQty(i.product_id, i.qty + 1)}>+</button>
              </div>
              <div className="muted">{rupiah(i.price * i.qty)}</div>
              <button type="button" className="linkbtn muted" onClick={() => cartApi.remove(i.product_id)}>{t('Hapus')}</button>
            </div>
          </div>
        ))}
        <div className="cototal"><span>{t('Total Pembayaran')}</span><b className="g">{rupiah(total)}</b></div>
      </section>

      <section className="box">
        <h3 className="cotitle"><Icon n="receipt" size={20} /> {t('Metode Pembayaran')}</h3>
        <p className="muted">{t('Pesanan dicatat dulu, lalu lanjutkan ke WhatsApp untuk petunjuk pembayaran. Pembayaran diverifikasi admin.')}</p>
        <div className="paymethod">
          <span className="paybadge">{t('Utama')}</span>
          <b><Icon n="chat" size={16} /> {t('Konfirmasi via WhatsApp')}</b>
          <div className="muted">{t('Transfer / QRIS • diverifikasi admin')}</div>
        </div>
        <div className="paysum">
          <div className="line"><span>{t('Subtotal perkiraan:')}</span><span>{rupiah(sub)}</span></div>
          {couponDisc > 0 && <div className="line"><span>{t('Diskon kupon')}</span><span>- {rupiah(couponDisc)}</span></div>}
          {loyDisc > 0 && <div className="line"><span>{t('Diskon pelanggan setia')} {loy}%</span><span>- {rupiah(loyDisc)}</span></div>}
          <div className="line total"><span>{t('Total bayar')}</span><span>{rupiah(total)}</span></div>
        </div>
        <p className="muted">{t('Total final, diskon kupon, dan stok dihitung server saat pesanan dibuat.')}</p>
      </section>

      <section className="box">
        <h3>{t('Data pembeli')}</h3>
        <label>{t('Nama')}<input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>{t('Nomor WhatsApp')}<input required inputMode="tel" placeholder="08xxxxxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <p className="muted">{t('Pesanan atas akun')} {session?.user.email}</p>
      </section>

      <section className="box">
        <h3 className="cotitle"><Icon n="percent" size={20} /> {t('Kode Kupon')}</h3>
        <div className="couponrow">
          <input className="mono" placeholder={t('Masukkan kode kupon')} value={f.coupon} onChange={(e) => { setF({ ...f, coupon: e.target.value.toUpperCase() }); setApplied(null); setCErr('') }} />
          <button type="button" className="btn" disabled={cBusy || !f.coupon.trim()} onClick={applyCoupon}>{cBusy ? '...' : t('Terapkan')}</button>
        </div>
        {applied && <p className="ok">{t('Kupon dipakai')}: {applied.code} (- {rupiah(applied.discount)})</p>}
        {cErr && <p className="err" role="alert">{cErr}</p>}
      </section>

      <section className="box">
        <h3>{t('Catatan (Opsional)')}</h3>
        <textarea rows={4} maxLength={500} placeholder={t('Masukkan email/username yang akan digunakan, atau catatan lainnya...')} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </section>

      <label className="chk"><input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />{t('Saya setuju dengan syarat transaksi toko.')}</label>
      <button className="btn lg wide paybtn" disabled={busy}>{busy ? t('Membuat pesanan...') : `${t('Buat Pesanan')} ${rupiah(total)}`}</button>
      {err && <p className="err c" role="alert">{err}</p>}
      <p className="muted c">{t('Setelah pesanan dibuat, Anda mendapat nomor pesanan dan kode akses untuk lanjut ke WhatsApp.')}</p>
    </form>
  )
}

interface Result { order_number: string; created_at: string; grand_total: number; order_status: string; payment_status: string; fulfillment_status: string; public_note: string | null; items: { name: string; variant: string | null; qty: number; total: number }[] }

export function Check() {
  const t = useT()
  const session = useSession()
  const [no, setNo] = useState('')
  const [tok, setTok] = useState('')
  const [res, setRes] = useState<Result | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const saved = read<Saved[]>('ws_orders', [])

  async function load(n: string, tk: string) {
    setErr(''); setRes(null); setBusy(true)
    const { data, error } = await supabase.functions.invoke('check-order', { body: { order_number: n.trim(), token: tk.trim() } })
    setBusy(false)
    if (error || !data?.order_number) { setErr(t('Pesanan tidak ditemukan. Periksa nomor pesanan dan kode akses.')); return }
    setRes(data as Result)
  }
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1)); const n = h.get('no'), tk = h.get('t')
    if (n && tk) { setNo(n); setTok(tk); load(n, tk) }
  }, [])

  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <section className="box"><h1>{t('Masuk dulu')}</h1><p>{t('Untuk berbelanja, Anda perlu akun dengan email yang terdaftar.')}</p><div className="row"><Link className="btn" to="/masuk">{t('Masuk')}</Link><Link className="btn ghost" to="/daftar">{t('Daftar')}</Link></div></section>
  return (
    <section className="box"><h1>{t('Cek pesanan')}</h1>
      <form onSubmit={(e) => { e.preventDefault(); load(no, tok) }}>
        <label>{t('Nomor pesanan')}<input required value={no} onChange={(e) => setNo(e.target.value)} /></label>
        <label>{t('Kode akses')}<input required value={tok} onChange={(e) => setTok(e.target.value)} /></label>
        <button className="btn" disabled={busy}>{busy ? t('Mencari...') : t('Cek status')}</button>
      </form>
      {saved.length > 0 && <><h3>{t('Pesanan di perangkat ini')}</h3><div className="chips">{saved.map((s) => <button key={s.order_number} className="chip" onClick={() => { setNo(s.order_number); setTok(s.token); load(s.order_number, s.token) }}>{s.order_number}</button>)}</div></>}
      {err && <p className="err" role="alert">{err}</p>}
      {res && (
        <div className="result">
          <p><b>{res.order_number}</b> · {new Date(res.created_at).toLocaleString('id-ID')}</p>
          {res.items.map((i, k) => <div className="line" key={k}><span>{i.name}{i.variant ? ` (${i.variant})` : ''} x{i.qty}</span><span>{rupiah(i.total)}</span></div>)}
          <p className="total">{t('Total')} {rupiah(res.grand_total)}</p>
          <p>{t('Pesanan:')} <b>{t(STATUS[res.order_status])}</b> · {t('Pembayaran:')} <b>{t(STATUS[res.payment_status])}</b> · {t('Pemrosesan:')} <b>{t(STATUS[res.fulfillment_status])}</b></p>
          {res.public_note && <p>{t('Catatan admin:')} {res.public_note}</p>}
          <p className="muted">{t('Ada kendala? Hubungi admin lewat WhatsApp dan sebutkan nomor pesanan.')}</p>
        </div>
      )}
    </section>
  )
}
