import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useSession } from '../lib'
import { Icon } from '../ui'
import { useT } from '../i18n'
import { Gate, ProductCard, useProducts } from './Store'

interface Result { mode: 'ai' | 'basic'; summary: string; picks: { id: string; reason: string }[] }
const EXAMPLES = ['Saya butuh aplikasi untuk desain konten jualan dan edit video pendek.', 'Saya ingin nonton film bersama keluarga selama satu bulan.', 'Saya butuh alat AI untuk membantu tugas dan menulis setiap hari.']

export function Recommend() {
  const session = useSession()
  const t = useT()
  const { list, stock } = useProducts(session)
  const [need, setNeed] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<Result | null>(null)

  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <section className="sec"><Gate /></section>

  async function go() {
    setBusy(true); setErr(''); setRes(null)
    const b = parseInt(budget.replace(/\D/g, ''), 10)
    const { data, error } = await supabase.functions.invoke('ai-recommend', { body: { need: need.trim(), ...(b >= 1000 ? { budget: b } : {}) } })
    setBusy(false)
    if (error || !data || data.error) { setErr(data?.error ?? t('Rekomendasi gagal. Coba lagi sebentar.')); return }
    setRes(data as Result)
  }

  const picked = (res?.picks ?? []).map((k) => ({ k, p: (list ?? []).find((x) => x.id === k.id) })).filter((x) => x.p)
  return (
    <section className="ai">
      <span className="badge"><Icon n="bot" size={14} /> {t('Rekomendasi pribadi')}</span>
      <h1 className="cattitle">{t('Paket premium mana yang paling cocok?')}</h1>
      <p className="muted">{t('Ceritakan aktivitas, aplikasi yang dicari, dan durasi penggunaan. AI akan membandingkan paket yang sedang tersedia.')}</p>
      <div className="aiform">
        <label htmlFor="ai-need"><b>{t('Kebutuhan Anda')}</b></label>
        <textarea id="ai-need" rows={4} maxLength={1000} value={need} onChange={(e) => setNeed(e.target.value)} placeholder={t('Contoh: Saya membuat konten TikTok setiap hari dan butuh aplikasi edit video tanpa watermark selama satu bulan.')} />
        <div className="aihint"><span>{t('Semakin spesifik, hasil semakin sesuai.')}</span><span>{need.length}/1000</span></div>
        <label htmlFor="ai-budget"><b>{t('Anggaran maksimal (opsional)')}</b></label>
        <div className="aibudget"><span className="fldic"><Icon n="wallet" size={16} /></span><input id="ai-budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder={t('Contoh: 50000')} /></div>
        <div className="aiex">{EXAMPLES.map((x) => <button type="button" className="chip" key={x} onClick={() => setNeed(t(x))}>{t(x)}</button>)}</div>
        <button className="btn lg" disabled={busy || need.trim().length < 10} onClick={go}><Icon n="spark" size={16} /> {busy ? t('Sedang mencari yang paling cocok...') : t('Dapatkan rekomendasi')}</button>
        <p className="muted aisafe">{t('Teks kebutuhanmu dikirim ke layanan AI hanya untuk memilih produk. Jangan menulis data pribadi atau kata sandi.')}</p>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
      {res && (
        <div className="aires" aria-live="polite">
          <h2>{t('Rekomendasi untukmu')}</h2>
          {res.summary && <p>{res.summary}</p>}
          <p className="muted aisafe">{res.mode === 'ai' ? t('Dipilih AI dari produk yang tersedia.') : t('Pencocokan kata kunci (AI belum diaktifkan toko).')}</p>
          {picked.length === 0 && <p className="muted">{t('Belum ada produk yang cocok. Coba ceritakan dengan kata lain.')}</p>}
          <div className="pgrid">
            {picked.map(({ k, p }) => (
              <div className="aipick" key={k.id}>
                <ProductCard p={p!} inStock={stock[k.id]} />
                {k.reason && <p className="aireason"><Icon n="spark" size={13} /> {k.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      <p><Link to="/produk">{t('Lihat produk')}</Link></p>
    </section>
  )
}
