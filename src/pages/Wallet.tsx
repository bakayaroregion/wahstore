import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { rupiah, useSession } from '../lib'
import { useT } from '../i18n'
import { Icon, PageBar } from '../ui'

interface Method { id: string; kind: 'QRIS' | 'BANK'; label: string; account_number: string | null; account_name: string | null; qr_image_url: string | null }
interface Tx { id: number; kind: string; amount: number; balance_after: number; note: string | null; created_at: string }
interface Dep { id: string; amount: number; method_label: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; note: string | null; created_at: string }
const PRESETS = [10000, 25000, 50000, 100000, 250000]
const KIND: Record<string, string> = { DEPOSIT: 'Isi saldo', PURCHASE: 'Pembelian', REFUND: 'Refund', ADJUST: 'Penyesuaian admin' }
const DSTAT: Record<string, string> = { PENDING: 'Menunggu verifikasi', APPROVED: 'Disetujui', REJECTED: 'Ditolak' }
const ERRS: Record<string, string> = {
  AMOUNT_INVALID: 'Nominal harus antara Rp 10.000 dan Rp 10.000.000.', TOO_MANY_PENDING: 'Masih ada 5 pengajuan yang menunggu. Tunggu admin memprosesnya dulu.',
  METHOD_INVALID: 'Metode pembayaran tidak tersedia.',
}

export function Wallet() {
  const t = useT()
  const session = useSession()
  const [bal, setBal] = useState<number | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [deps, setDeps] = useState<Dep[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'QRIS' | 'BANK'>('BANK')
  const [sel, setSel] = useState('')
  const [wa, setWa] = useState('')
  const [sent, setSent] = useState<{ code: string; url: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [copyKey, setCopyKey] = useState('')

  const load = useCallback(() => {
    supabase.rpc('my_wallet').then(({ data }) => setBal(Number(data ?? 0)))
    supabase.from('wallet_transactions').select('id,kind,amount,balance_after,note,created_at').order('id', { ascending: false }).limit(30).then(({ data }) => setTxs((data ?? []) as Tx[]))
    supabase.from('wallet_deposits').select('id,amount,method_label,status,note,created_at').order('created_at', { ascending: false }).limit(10).then(({ data }) => setDeps((data ?? []) as Dep[]))
  }, [])
  useEffect(() => {
    if (!session) return
    load()
    supabase.from('payment_methods').select('id,kind,label,account_number,account_name,qr_image_url').eq('is_active', true).order('sort_order').then(({ data }) => {
      const m = (data ?? []) as Method[]; setMethods(m)
      const first = m.find((x) => x.kind === 'BANK') ?? m[0]
      if (first) { setKind(first.kind); setSel(first.id) }
    })
  }, [session, load])
  useEffect(() => {
    supabase.from('store_settings').select('key,value').eq('key', 'whatsapp_number').then(({ data }) => {
      const n = String(data?.[0]?.value ?? '').replace(/\D/g, ''); if (/^\d{8,15}$/.test(n)) setWa(n)
    })
  }, [])

  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <Navigate to="/masuk" replace />

  const amt = Math.floor(Number(amount.replace(/\D/g, '')) || 0)
  const list = methods.filter((m) => m.kind === kind)
  const cur = list.find((m) => m.id === sel) ?? list[0]
  const hasQ = methods.some((m) => m.kind === 'QRIS'), hasB = methods.some((m) => m.kind === 'BANK')
  const switchKind = (k: 'QRIS' | 'BANK') => { setKind(k); const first = methods.find((m) => m.kind === k); if (first) setSel(first.id) }
  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v); setCopyKey(k); setTimeout(() => setCopyKey(''), 1500) }
  const waLink = (code: string, amount: number, method: string) => {
    if (!wa) return null
    const msg = `Halo Admin, saya sudah isi saldo.\n\nKode: ${code}\nEmail akun: ${session!.user.email}\nNominal: ${rupiah(amount)}\nMetode: ${method}\n\nBukti transfer saya lampirkan di chat ini. Mohon tambahkan ke saldo saya. Terima kasih.`
    return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setOk(''); setSent(null)
    if (amt < 10000 || amt > 10000000) { setErr(t(ERRS.AMOUNT_INVALID)); return }
    if (!cur) { setErr(t('Pilih metode pembayaran terlebih dahulu.')); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('request_deposit', { p_amount: amt, p_method: cur.id })
    setBusy(false)
    if (error || !data) { const k = Object.keys(ERRS).find((x) => error?.message.includes(x)); setErr(k ? t(ERRS[k]) : t('Pengajuan gagal. Coba lagi.')); return }
    const code = 'TOP-' + String(data).slice(0, 8).toUpperCase()
    setSent({ code, url: waLink(code, amt, `${cur.kind} - ${cur.label}`) })
    setAmount(''); load()
  }

  return (
    <section className="refpage">
      <PageBar icon="wallet" title={t('Saldo')} />
      <h1 className="h2c">{t('Saldo Saya')}</h1>
      <div className="box walletcard">
        <span className="muted">{t('Saldo tersedia')}</span>
        <b className="walletbal g">{bal === null ? '...' : rupiah(bal)}</b>
        <span className="muted">{t('Gunakan saldo untuk bayar pesanan langsung lunas di checkout.')}</span>
      </div>

      <form className="box" onSubmit={submit}>
        <h3 className="cotitle"><Icon n="wallet" size={20} /> {t('Isi Saldo')}</h3>
        <label>{t('Nominal')}
          <input inputMode="numeric" placeholder="Rp 50.000" value={amt ? rupiah(amt) : ''} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="paytabs">{PRESETS.map((n) => <button type="button" key={n} className={'paytab' + (amt === n ? ' on' : '')} onClick={() => setAmount(String(n))}>{rupiah(n)}</button>)}</div>
        <p className="muted">{t('Minimal Rp 10.000, maksimal Rp 10.000.000.')}</p>

        {methods.length === 0 ? <p className="muted">{t('Metode pembayaran belum diatur oleh admin. Hubungi admin lewat WhatsApp.')}</p> : (
          <>
            <div className="paykinds" role="tablist">
              {hasQ && <button type="button" role="tab" aria-selected={kind === 'QRIS'} className={'paykind' + (kind === 'QRIS' ? ' on' : '')} onClick={() => switchKind('QRIS')}>QRIS</button>}
              {hasB && <button type="button" role="tab" aria-selected={kind === 'BANK'} className={'paykind' + (kind === 'BANK' ? ' on' : '')} onClick={() => switchKind('BANK')}>{t('Transfer Rekening')}</button>}
            </div>
            {list.length > 1 && <div className="paytabs">{list.map((m) => <button type="button" key={m.id} className={'paytab' + (cur?.id === m.id ? ' on' : '')} onClick={() => setSel(m.id)}>{m.label}</button>)}</div>}
            {cur && (
              <div className="payinfo">
                {cur.kind === 'QRIS' ? (
                  cur.qr_image_url ? <img className="qrimg" src={cur.qr_image_url} alt="QRIS" /> : <p className="err">{t('Gambar QRIS belum diunggah admin.')}</p>
                ) : (
                  <>
                    <div className="payrow"><span className="muted">{t('Bank')}</span><b>{cur.label}</b></div>
                    <div className="payrow"><span className="muted">{t('Nomor Rekening')}</span><b className="mono">{cur.account_number}</b><button type="button" className="btn ghost sm" onClick={() => copy('acc', cur.account_number ?? '')}>{copyKey === 'acc' ? t('Tersalin') : t('Salin')}</button></div>
                    <div className="payrow"><span className="muted">{t('Atas Nama')}</span><b>{cur.account_name}</b></div>
                  </>
                )}
                {amt > 0 && <div className="payrow"><span className="muted">{t('Jumlah Pembayaran')}</span><b className="g">{rupiah(amt)}</b><button type="button" className="btn ghost sm" onClick={() => copy('amt', String(amt))}>{copyKey === 'amt' ? t('Tersalin') : t('Salin')}</button></div>}
              </div>
            )}
            <p className="muted">{t('Setelah membayar, tekan tombol di bawah lalu kirim foto bukti transfer ke WhatsApp admin. Saldo ditambahkan admin setelah pembayaran dicek.')}</p>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        {sent && (
          <div className="paywarn okbox" role="status">
            <p className="ok">{t('Pengajuan dibuat. Kode Anda:')} <b className="mono">{sent.code}</b></p>
            {sent.url
              ? <a className="btn wide" href={sent.url} target="_blank" rel="noopener noreferrer"><Icon n="chat" size={16} /> {t('Kirim Bukti ke WhatsApp')}</a>
              : <p className="err">{t('Nomor WhatsApp admin belum diatur. Hubungi admin dan sebutkan kode di atas.')}</p>}
          </div>
        )}
        <button className="btn lg wide" disabled={busy || methods.length === 0}>{busy ? t('Mengirim...') : t('Saya Sudah Bayar, Lanjut ke WhatsApp')}</button>
      </form>

      {deps.length > 0 && (
        <div className="box">
          <h3>{t('Pengajuan Isi Saldo')}</h3>
          {deps.map((d) => (
            <div className="line" key={d.id}>
              <span>{rupiah(d.amount)} <span className="muted">• {d.method_label}</span><div className="muted">TOP-{d.id.slice(0, 8).toUpperCase()} • {new Date(d.created_at).toLocaleString('id-ID')}{d.note ? ` • ${d.note}` : ''}</div>{d.status === 'PENDING' && waLink('TOP-' + d.id.slice(0, 8).toUpperCase(), d.amount, d.method_label) && <a className="linkbtn" href={waLink('TOP-' + d.id.slice(0, 8).toUpperCase(), d.amount, d.method_label)!} target="_blank" rel="noopener noreferrer">{t('Kirim bukti ke WhatsApp')}</a>}</span>
              <span className={'wstat ' + d.status.toLowerCase()}>{t(DSTAT[d.status])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="box">
        <h3>{t('Riwayat Saldo')}</h3>
        {txs.length === 0 ? <p className="muted">{t('Belum ada transaksi saldo.')} <Link to="/produk">{t('Lihat produk')}</Link></p> : txs.map((x) => (
          <div className="line" key={x.id}>
            <span>{t(KIND[x.kind] ?? x.kind)}<div className="muted">{new Date(x.created_at).toLocaleString('id-ID')}{x.note ? ` • ${x.note}` : ''}</div></span>
            <span className={x.amount > 0 ? 'ok' : 'err'}>{x.amount > 0 ? '+' : '-'} {rupiah(Math.abs(x.amount))}<div className="muted">{t('Saldo')} {rupiah(x.balance_after)}</div></span>
          </div>
        ))}
      </div>
    </section>
  )
}
