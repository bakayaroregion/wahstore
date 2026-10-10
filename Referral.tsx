import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useSession } from '../lib'
import { Icon } from '../ui'
import { useT } from '../i18n'

interface Info { code: string; pending: number; success: number; required: number; percent: number; coupons: { code: string; percent: number; used: boolean; expires_at: string | null }[] }

export function Referral() {
  const session = useSession()
  const t = useT()
  const [info, setInfo] = useState<Info | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!session) return
    supabase.rpc('my_referral').then(({ data, error }) => {
      if (error) setErr(t('Gagal memuat') + ': ' + error.message + ' (0011_referral.sql)')
      else setInfo(data as Info)
    })
  }, [session])
  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <Navigate to="/masuk" replace />

  const link = info ? `${window.location.origin}/daftar?ref=${info.code}` : ''
  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) } catch { /* diabaikan */ }
  }
  async function regen() {
    setBusy(true)
    const { data, error } = await supabase.rpc('regen_referral_code')
    setBusy(false)
    if (error) setErr(error.message); else if (info) setInfo({ ...info, code: String(data) })
  }
  const msg = info ? encodeURIComponent(`${t('Yuk daftar dan belanja di sini pakai kode referral saya')} ${info.code}: ${link}`) : ''
  const req = info?.required ?? 3
  const pct = info?.percent ?? 10

  return (
    <section className="refpage">
      <h1 className="h2c">{t('Program Referral')}</h1>
      <p className="sub">{t('Ajak teman daftar & belanja')} {req}x, {t('dapatkan kupon diskon')} {pct}%!</p>

      <div className="box">
        <h3>{t('Cara Kerja')}</h3>
        {[
          ['Bagikan Kode Referral', 'Salin kode referral Anda dan kirim ke teman'],
          ['Teman Daftar', 'Teman daftar menggunakan kode referral Anda'],
          ['Teman Belanja', `${t('Setelah teman menyelesaikan')} ${req}x ${t('pesanan yang berstatus selesai')}`],
          ['Dapatkan Kupon!', `${t('Anda otomatis mendapat kupon diskon')} ${pct}% ${t('untuk belanja')}`],
        ].map(([title, desc], i) => (
          <div className={'step' + (i === 3 ? ' win' : '')} key={title}>
            <span className="stepn">{i === 3 ? <Icon n="check" size={16} /> : i + 1}</span>
            <div><b>{t(title)}</b><div className="muted">{i === 2 || i === 3 ? desc : t(desc)}</div></div>
          </div>
        ))}
      </div>

      <div className="box">
        <h2 className="reftitle"><Icon n="user" size={20} /> {t('Kode Referral Anda')}</h2>
        <p className="muted">{t('Bagikan kode ini ke teman. Anda mendapat kupon diskon')} {pct}% {t('setiap teman yang sudah menyelesaikan')} {req}x {t('pesanan')}.</p>
        {err && <p className="err" role="alert">{err}</p>}
        {!info && !err && <p className="muted">{t('Memuat...')}</p>}
        {info && (
          <>
            <div className="refcode"><span>{info.code}</span><button className="miniic" aria-label={t('Salin')} onClick={() => copy(info.code, 'code')}><Icon n={copied === 'code' ? 'check' : 'copy'} size={17} /></button></div>
            <div className="muted lbl">{t('Link Referral (klik untuk salin)')}:</div>
            <button className="reflink" onClick={() => copy(link, 'link')}><Icon n="link" size={15} /> <span>{link}</span><Icon n={copied === 'link' ? 'check' : 'copy'} size={16} /></button>
            <div className="muted lbl">{t('Bagikan')}:</div>
            <div className="sharerow">
              <a className="sh wa" href={`https://wa.me/?text=${msg}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a className="sh x" href={`https://twitter.com/intent/tweet?text=${msg}`} target="_blank" rel="noopener noreferrer">X</a>
              <a className="sh fb" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
            </div>
            <button className="btn ghost wide" disabled={busy} onClick={regen}><Icon n="refresh" size={15} /> {t('Perbarui Kode dari Nama')}</button>
            <p className="muted">{t('Memperbarui kode membuat link lama tidak berlaku lagi.')}</p>
            <div className="refstats">
              <div><b>{info.pending}</b><span>{t('Pending')}</span></div>
              <div><b>{info.success}</b><span>{t('Berhasil')}</span></div>
              <div><b>{info.coupons.length}</b><span>{t('Kupon')}</span></div>
            </div>
          </>
        )}
      </div>

      {info && info.coupons.length > 0 && (
        <div className="box">
          <h3>{t('Kupon Anda')}</h3>
          <p className="muted">{t('Masukkan kode kupon ini di keranjang saat membuat pesanan. Sekali pakai.')}</p>
          {info.coupons.map((c) => (
            <div className="line" key={c.code}>
              <div><b className="mono">{c.code}</b><div className="muted">{t('Diskon')} {c.percent}%{c.expires_at ? ` · ${t('berlaku sampai')} ${new Date(c.expires_at).toLocaleDateString('id-ID')}` : ''}</div></div>
              {c.used ? <span className="muted">{t('Sudah dipakai')}</span> : <button className="btn ghost sm" onClick={() => copy(c.code, c.code)}>{copied === c.code ? t('Tersalin') : t('Salin')}</button>}
            </div>
          ))}
        </div>
      )}
      <div className="c"><Link className="btn ghost" to="/produk">{t('Kembali ke Katalog')}</Link></div>
    </section>
  )
}
