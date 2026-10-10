import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { rupiah, STATUS, useBrand, useSession } from '../lib'
import { Icon, Logo, type IconName } from '../ui'
import { useT } from '../i18n'

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 1 1 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 1 0 44 24c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  )
}

function Field({ icon, label, children, aside }: { icon: IconName; label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="fld">
      <div className="fldhead"><span>{label}</span>{aside}</div>
      <div className="fldbox"><span className="fldic"><Icon n={icon} size={17} /></span>{children}</div>
    </div>
  )
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const nav = useNavigate()
  const t = useT()
  const brand = useBrand()
  const [f, setF] = useState({ name: '', phone: '', email: '', pw: '' })
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState('')
  const reg = mode === 'register'
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function go(e: FormEvent) {
    e.preventDefault(); setErr(''); setInfo(''); setBusy(true)
    if (reg) {
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim(), password: f.pw,
        options: { data: { full_name: f.name.trim(), phone: f.phone.trim() }, emailRedirectTo: window.location.origin },
      })
      setBusy(false)
      if (error) { setErr(/registered|exists/i.test(error.message) ? t('Email ini sudah terdaftar. Silakan masuk.') : t('Pendaftaran gagal') + ': ' + error.message); return }
      if (data.session) { rememberChoice(true); nav('/') } else setSent(f.email.trim())
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.pw })
      setBusy(false)
      if (error) { setErr(t('Email atau kata sandi salah, atau email belum diverifikasi.')); return }
      rememberChoice(remember); nav('/')
    }
  }
  async function forgot() {
    setErr(''); setInfo('')
    if (!f.email.trim()) { setErr(t('Isi email Anda dulu, lalu tekan Lupa kata sandi.')); return }
    await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: window.location.origin + '/akun' })
    setInfo(t('Jika email terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.'))
  }
  async function google() {
    setErr('')
    // Cek dulu apakah Google sudah diaktifkan di Supabase, supaya pelanggan tidak terlempar ke halaman error.
    try {
      const base = import.meta.env.VITE_SUPABASE_URL as string
      const r = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string } })
      const j = await r.json()
      if (!j?.external?.google) { setErr(t('Masuk dengan Google belum diaktifkan di toko ini.')); return }
    } catch { /* jika pengecekan gagal, tetap coba */ }
    rememberChoice(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setErr(t('Masuk dengan Google belum diaktifkan di toko ini.'))
  }

  return (
    <section className="authwrap">
      <div className="authlogo"><Logo url={brand.logo} size={58} /></div>
      <h1 className="authtitle"><span className="g">{brand.name}</span> — {t('Masuk atau Daftar')}</h1>
      <p className="authsub">{brand.tagline}</p>

      <div className="authcard">
        {sent ? (
          <div>
            <h2>{t('Cek email Anda')}</h2>
            <p className="ok">{t('Pendaftaran berhasil. Kami mengirim tautan verifikasi ke')} {sent}. {t('Buka email Anda, klik tautannya, lalu masuk.')}</p>
            <Link className="btn" to="/masuk">{t('Ke halaman masuk')}</Link>
          </div>
        ) : (
          <>
            <div className="authtabs" role="tablist">
              <Link role="tab" aria-selected={!reg} className={!reg ? 'on' : ''} to="/masuk">{t('Masuk')}</Link>
              <Link role="tab" aria-selected={reg} className={reg ? 'on' : ''} to="/daftar">{t('Daftar')}</Link>
            </div>
            <form onSubmit={go}>
              {reg && <Field icon="user" label={t('Nama')}><input required minLength={2} maxLength={80} autoComplete="name" placeholder={t('Nama lengkap')} value={f.name} onChange={set('name')} /></Field>}
              {reg && <Field icon="phone" label={t('Nomor WhatsApp (opsional)')}><input inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" value={f.phone} onChange={set('phone')} /></Field>}
              <Field icon="mail" label={t('Email')}><input type="email" required autoComplete="email" placeholder="email@gmail.com" value={f.email} onChange={set('email')} /></Field>
              <Field icon="lock" label={t('Kata sandi')} aside={!reg && <button type="button" className="linkbtn forgot" onClick={forgot}>{t('Lupa kata sandi?')}</button>}>
                <input type={show ? 'text' : 'password'} required minLength={reg ? 8 : 1} autoComplete={reg ? 'new-password' : 'current-password'} placeholder={reg ? t('Minimal 8 karakter') : '••••••••'} value={f.pw} onChange={set('pw')} />
                <button type="button" className="fldeye" aria-label={show ? t('Sembunyikan kata sandi') : t('Tampilkan kata sandi')} onClick={() => setShow(!show)}><Icon n="eye" size={17} /></button>
              </Field>
              {!reg && <label className="chk remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />{t('Ingat saya')}</label>}
              {err && <p className="err" role="alert">{err}</p>}
              {info && <p className="ok">{info}</p>}
              <button className="btn lg wide" disabled={busy}>{busy ? t('Memproses...') : reg ? t('Daftar Sekarang') : t('Masuk')} <Icon n="arrow" size={16} /></button>
            </form>
            <div className="divider"><span>{t('Atau lanjutkan dengan')}</span></div>
            <button type="button" className="btn ghost wide gbtn" onClick={google}><GoogleG /> Google</button>
            <p className="authfoot"><Icon n="spark" size={14} /> {t('Nikmati akses ke produk digital pilihan')}</p>
          </>
        )}
      </div>
    </section>
  )
}

// "Ingat saya" dimatikan: sesi hanya berlaku sampai browser ditutup (lihat resetEphemeralSession di lib.ts).
function rememberChoice(remember: boolean) {
  try {
    if (remember) localStorage.removeItem('ws_ephemeral')
    else { localStorage.setItem('ws_ephemeral', '1'); sessionStorage.setItem('ws_alive', '1') }
  } catch { /* penyimpanan tidak tersedia */ }
}

export const Register = () => <AuthPage mode="register" />
export const Login = () => <AuthPage mode="login" />

interface MyOrder { order_number: string; created_at: string; grand_total: number; loyalty_discount: number; order_status: string; payment_status: string; fulfillment_status: string; public_note: string | null; items: { name: string; qty: number }[] }
interface Tier { months: number; percent: number }

export function Account() {
  const session = useSession()
  const t = useT()
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
  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <Navigate to="/masuk" replace />
  async function changePw(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? t('Gagal') + ': ' + error.message : t('Kata sandi diperbarui.')); if (!error) setPw('')
  }
  const name = String(session.user.user_metadata?.full_name ?? '')
  return (
    <>
      <section className="box"><h1>{t('Akun saya')}</h1><p>{name && <b>{name} · </b>}{session.user.email}</p></section>
      <section className="box">
        <h2>{t('Diskon pelanggan setia')}</h2>
        <p>{t('Belanja setiap bulan dan diskon naik. Pesanan yang selesai pada bulan-bulan berturut-turut dihitung sampai bulan lalu.')}</p>
        {loy && <p className="ok">Rangkaian Anda: {loy.streak} bulan. Diskon saat ini: {loy.percent}%.</p>}
        {tiers.length > 0 && <ul>{tiers.map((t) => <li key={t.months}>{t.months} bulan berturut-turut: diskon {t.percent}%</li>)}</ul>}
      </section>
      <section className="box">
        <h2>{t('Pesanan saya')}</h2>
        {orders === null && <p className="muted">{t('Memuat...')}</p>}
        {orders?.length === 0 && <p className="muted">{t('Belum ada pesanan.')} <Link to="/produk">{t('Lihat produk')}</Link></p>}
        {orders?.map((o) => (
          <div className="line" key={o.order_number}>
            <div><b>{o.order_number}</b><div className="muted">{new Date(o.created_at).toLocaleString('id-ID')} · {o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}</div>
              <div>{t(STATUS[o.order_status])} · {t(STATUS[o.payment_status])} · {t(STATUS[o.fulfillment_status])}</div>{o.public_note && <div className="muted">Catatan admin: {o.public_note}</div>}</div>
            <div><b>{rupiah(o.grand_total)}</b>{o.loyalty_discount > 0 && <div className="muted">hemat loyalitas {rupiah(o.loyalty_discount)}</div>}</div>
          </div>
        ))}
      </section>
      <form className="box" onSubmit={changePw}>
        <h2>{t('Ubah kata sandi')}</h2>
        <label>{t('Kata sandi baru (min. 8 karakter)')}<input type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {msg && <p role="status">{msg}</p>}
        <button className="btn">{t('Simpan')}</button>
      </form>
    </>
  )
}
