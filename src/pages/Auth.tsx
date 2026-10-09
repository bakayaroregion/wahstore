import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { rupiah, STATUS, useSession } from '../lib'

export function Register() {
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', phone: '', email: '', pw: '' })
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.pw,
      options: { data: { full_name: f.name.trim(), phone: f.phone.trim() }, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) { setErr(/registered|exists/i.test(error.message) ? 'Email ini sudah terdaftar. Silakan masuk.' : 'Pendaftaran gagal: ' + error.message); return }
    if (data.session) nav('/'); else setInfo(`Pendaftaran berhasil. Kami mengirim tautan verifikasi ke ${f.email}. Buka email Anda, klik tautannya, lalu masuk.`)
  }
  if (info) return <section className="box login"><h1>Cek email Anda</h1><p className="ok">{info}</p><Link className="btn" to="/masuk">Ke halaman masuk</Link></section>
  return (
    <form className="box login" onSubmit={go}>
      <h1>Daftar akun</h1>
      <label>Nama<input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Nomor WhatsApp<input required inputMode="tel" placeholder="08xxxxxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label>Kata sandi (min. 8 karakter)<input type="password" required minLength={8} autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Mendaftar...' : 'Daftar'}</button>
      <p className="muted">Sudah punya akun? <Link to="/masuk">Masuk</Link></p>
    </form>
  )
}

export function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  async function go(e: FormEvent) {
    e.preventDefault(); setErr(''); setInfo('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    if (error) setErr('Email atau kata sandi salah, atau email belum diverifikasi.'); else nav('/')
  }
  async function forgot() {
    setErr(''); setInfo('')
    if (!email.trim()) { setErr('Isi email Anda dulu, lalu tekan Lupa kata sandi.'); return }
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/akun' })
    setInfo('Jika email terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.')
  }
  return (
    <form className="box login" onSubmit={go}>
      <h1>Masuk</h1>
      <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Kata sandi<input type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      {info && <p className="ok">{info}</p>}
      <div className="row"><button className="btn">Masuk</button><button type="button" className="linkbtn" onClick={forgot}>Lupa kata sandi?</button></div>
      <p className="muted">Belum punya akun? <Link to="/daftar">Daftar</Link></p>
    </form>
  )
}

interface MyOrder { order_number: string; created_at: string; grand_total: number; loyalty_discount: number; order_status: string; payment_status: string; fulfillment_status: string; public_note: string | null; items: { name: string; qty: number }[] }
interface Tier { months: number; percent: number }

export function Account() {
  const session = useSession()
  const [loy, setLoy] = useState<{ streak: number; percent: number } | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [orders, setOrders] = useState<MyOrder[] | null>(null)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!session) return
    supabase.rpc('my_loyalty').then(({ data }) => { if (data) setLoy(data as { streak: number; percent: number }) })
    supabase.rpc('my_orders').then(({ data }) => setOrders((data ?? []) as MyOrder[]))
    supabase.from('store_settings').select('value').eq('key', 'loyalty_tiers').maybeSingle().then(({ data }) => { if (Array.isArray(data?.value)) setTiers(data.value as Tier[]) })
  }, [session])
  if (session === undefined) return <p className="muted">Memuat...</p>
  if (!session) return <Navigate to="/masuk" replace />
  async function changePw(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? 'Gagal: ' + error.message : 'Kata sandi diperbarui.'); if (!error) setPw('')
  }
  const name = String(session.user.user_metadata?.full_name ?? '')
  return (
    <>
      <section className="box"><h1>Akun saya</h1><p>{name && <b>{name} · </b>}{session.user.email}</p></section>
      <section className="box">
        <h2>Diskon pelanggan setia</h2>
        <p>Belanja setiap bulan dan diskon naik. Pesanan yang <b>selesai</b> pada bulan-bulan berturut-turut dihitung sampai bulan lalu.</p>
        {loy && <p className="ok">Rangkaian Anda: {loy.streak} bulan. Diskon saat ini: {loy.percent}%.</p>}
        {tiers.length > 0 && <ul>{tiers.map((t) => <li key={t.months}>{t.months} bulan berturut-turut: diskon {t.percent}%</li>)}</ul>}
      </section>
      <section className="box">
        <h2>Pesanan saya</h2>
        {orders === null && <p className="muted">Memuat...</p>}
        {orders?.length === 0 && <p className="muted">Belum ada pesanan. <Link to="/produk">Lihat produk</Link></p>}
        {orders?.map((o) => (
          <div className="line" key={o.order_number}>
            <div><b>{o.order_number}</b><div className="muted">{new Date(o.created_at).toLocaleString('id-ID')} · {o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}</div>
              <div>{STATUS[o.order_status]} · {STATUS[o.payment_status]} · {STATUS[o.fulfillment_status]}</div>{o.public_note && <div className="muted">Catatan admin: {o.public_note}</div>}</div>
            <div><b>{rupiah(o.grand_total)}</b>{o.loyalty_discount > 0 && <div className="muted">hemat loyalitas {rupiah(o.loyalty_discount)}</div>}</div>
          </div>
        ))}
      </section>
      <form className="box" onSubmit={changePw}>
        <h2>Ubah kata sandi</h2>
        <label>Kata sandi baru (min. 8 karakter)<input type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {msg && <p role="status">{msg}</p>}
        <button className="btn">Simpan</button>
      </form>
    </>
  )
}
