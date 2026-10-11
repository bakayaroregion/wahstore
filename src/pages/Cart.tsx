import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { cartApi, read, rupiah, STATUS, useCart, useSession, write } from '../lib'
import { useT } from '../i18n'
import { Icon } from '../ui'

interface Done { order_number: string; access_token: string; grand_total: number; wa_url: string | null; warning: string | null }
interface Method { id: string; kind: 'QRIS' | 'BANK'; label: string; account_number: string | null; account_name: string | null; qr_image_url: string | null }
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PROOF_MAX = 5 * 1024 * 1024

async function sendProof(orderNo: string, methodId: string, file: File, uid: string) {
  if (!PROOF_TYPES.includes(file.type)) throw new Error('type')
  if (file.size > PROOF_MAX) throw new Error('size')
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${uid}/${orderNo}-${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('proofs').upload(path, file, { contentType: file.type })
  if (up.error) throw new Error(up.error.message)
  const { error } = await supabase.rpc('submit_payment_proof', { p_order_number: orderNo, p_method: methodId, p_path: path })
  if (error) throw new Error(error.message)
}
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
  const [methods, setMethods] = useState<Method[]>([])
  const [kind, setKind] = useState<'QRIS' | 'BANK'>('BANK')
  const [sel, setSel] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [copyKey, setCopyKey] = useState('')
  const [proofState, setProofState] = useState<'ok' | 'fail' | 'retry'>('ok')
  const [pending, setPending] = useState<{ method: string; file: File } | null>(null)
  useEffect(() => {
    if (!session) return
    supabase.from('payment_methods').select('id,kind,label,account_number,account_name,qr_image_url').eq('is_active', true).order('sort_order').then(({ data }) => {
      const m = (data ?? []) as Method[]
      setMethods(m)
      const first = m.find((x) => x.kind === 'BANK') ?? m[0]
      if (first) { setKind(first.kind); setSel(first.id) }
    })
  }, [session])
  useEffect(() => {
    if (!proof) { setPreview(''); return }
    const u = URL.createObjectURL(proof); setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [proof])
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null)
  const [cErr, setCErr] = useState('')
  const [cBusy, setCBusy] = useState(false)
  const sub = cart.reduce((a, i) => a + i.price * i.qty, 0)

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

  function pickProof(file?: File) {
    if (!file) return
    if (!PROOF_TYPES.includes(file.type)) { setErr(t('Bukti harus berupa JPG, PNG, atau WebP.')); return }
    if (file.size > PROOF_MAX) { setErr(t('Ukuran bukti maksimal 5 MB.')); return }
    setErr(''); setProof(file)
  }
  function copy(k: string, v: string) { navigator.clipboard?.writeText(v); setCopyKey(k); setTimeout(() => setCopyKey(''), 1500) }
  async function retryProof() {
    if (!pending || !done || !session) return
    setBusy(true)
    try { await sendProof(done.order_number, pending.method, pending.file, session.user.id); setProofState('ok'); setPending(null) } catch { setProofState('retry') }
    setBusy(false)
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (!f.agree) { setErr(t('Setujui syarat transaksi terlebih dahulu.')); return }
    if (!sel) { setErr(t('Pilih metode pembayaran terlebih dahulu.')); return }
    if (!proof) { setErr(t('Unggah bukti pembayaran terlebih dahulu.')); return }
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('create-order', {
      body: { name: f.name, phone: f.phone, note: f.note, coupon: f.coupon, items: cart.map((i) => ({ product_id: i.product_id, quantity: i.qty })) },
    })
    setBusy(false)
    if (error || !data?.order_number) { setErr(await errMsg(error, t('Pesanan gagal dibuat. Coba lagi.'))); return }
    const saved = read<Saved[]>('ws_orders', [])
    write('ws_orders', [{ order_number: data.order_number, token: data.access_token }, ...saved].slice(0, 20))
    cartApi.clear(); setDone(data as Done)
    try { await sendProof(data.order_number, sel, proof, session!.user.id); setProofState('ok') }
    catch { setPending({ method: sel, file: proof }); setProofState('fail') }
  }

  if (done) return (
    <section className="box">
      <h1>{t('Pesanan dibuat')}</h1>
      <p className="ok">{t('Nomor pesanan:')} <b>{done.order_number}</b></p>
      <p>{t('Total')} {rupiah(done.grand_total)}. {t(STATUS.PENDING)}, {t(STATUS.UNPAID).toLowerCase()}.</p>
      {proofState === 'ok' && <p className="ok">{t('Bukti pembayaran terkirim. Admin akan memverifikasi pembayaran Anda.')}</p>}
      {proofState !== 'ok' && <div className="paywarn"><p className="err">{t('Pesanan sudah dibuat, tetapi bukti pembayaran belum terkirim.')}</p><button className="btn" disabled={busy} onClick={retryProof}>{busy ? '...' : t('Kirim ulang bukti')}</button></div>}
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
        <h3 className="cotitle"><Icon n="receipt" size={20} /> {t('Pilih Metode Pembayaran')}</h3>
        {methods.length === 0 ? <p className="muted">{t('Metode pembayaran belum diatur oleh admin. Hubungi admin lewat WhatsApp.')}</p> : (() => {
          const hasQ = methods.some((m) => m.kind === 'QRIS'), hasB = methods.some((m) => m.kind === 'BANK')
          const list = methods.filter((m) => m.kind === kind)
          const cur = list.find((m) => m.id === sel) ?? list[0]
          const switchKind = (k: 'QRIS' | 'BANK') => { setKind(k); const first = methods.find((m) => m.kind === k); if (first) setSel(first.id) }
          return (
            <>
              <div className="paykinds" role="tablist">
                {hasQ && <button type="button" role="tab" aria-selected={kind === 'QRIS'} className={'paykind' + (kind === 'QRIS' ? ' on' : '')} onClick={() => switchKind('QRIS')}>QRIS</button>}
                {hasB && <button type="button" role="tab" aria-selected={kind === 'BANK'} className={'paykind' + (kind === 'BANK' ? ' on' : '')} onClick={() => switchKind('BANK')}>{t('Transfer Rekening')}</button>}
              </div>
              {list.length > 1 && <div className="paytabs">{list.map((m) => <button type="button" key={m.id} className={'paytab' + (cur?.id === m.id ? ' on' : '')} onClick={() => setSel(m.id)}>{m.label}</button>)}</div>}
              {cur && (
                <div className="payinfo">
                  {cur.kind === 'QRIS' ? (
                    <>
                      <p className="muted">{t('Scan QRIS di bawah dengan aplikasi bank atau e-wallet, lalu unggah bukti pembayaran.')}</p>
                      {cur.qr_image_url ? <img className="qrimg" src={cur.qr_image_url} alt="QRIS" /> : <p className="err">{t('Gambar QRIS belum diunggah admin.')}</p>}
                    </>
                  ) : (
                    <>
                      <div className="payrow"><span className="muted">{t('Bank')}</span><b>{cur.label}</b></div>
                      <div className="payrow"><span className="muted">{t('Nomor Rekening')}</span><b className="mono">{cur.account_number}</b><button type="button" className="btn ghost sm" onClick={() => copy('acc', cur.account_number ?? '')}>{copyKey === 'acc' ? t('Tersalin') : t('Salin')}</button></div>
                      <div className="payrow"><span className="muted">{t('Atas Nama')}</span><b>{cur.account_name}</b></div>
                    </>
                  )}
                  <div className="payrow"><span className="muted">{t('Jumlah Pembayaran')}</span><b className="g">{rupiah(total)}</b><button type="button" className="btn ghost sm" onClick={() => copy('amt', String(total))}>{copyKey === 'amt' ? t('Tersalin') : t('Salin')}</button></div>
                </div>
              )}
              <h4 className="proofh">{t('Upload Bukti Transfer')}</h4>
              <label className="dropzone">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickProof(e.target.files?.[0])} />
                {preview ? <img src={preview} alt={t('Pratinjau bukti')} /> : <span><Icon n="receipt" size={26} /><br />{t('Klik untuk memilih bukti pembayaran')}<br /><small className="muted">JPG, PNG, WebP • max 5MB</small></span>}
              </label>
              {proof && <button type="button" className="linkbtn muted" onClick={() => setProof(null)}>{t('Hapus bukti')}</button>}
            </>
          )
        })()}
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
      <button className="btn lg wide paybtn" disabled={busy || methods.length === 0}>{busy ? t('Membuat pesanan...') : `${t('Konfirmasi Pesanan')} ${rupiah(total)}`}</button>
      {err && <p className="err c" role="alert">{err}</p>}
      <p className="muted c">{t('Bayar dulu sesuai metode di atas, unggah buktinya, lalu tekan Konfirmasi Pesanan. Admin memverifikasi pembayaran Anda.')}</p>
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
