import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { cartApi, favApi, Product, rupiah, useFavs, useSession } from '../lib'
import { Icon, catIcon } from '../ui'
import { useT } from '../i18n'

const SEL = 'id,name,slug,sku,short_description,description,price,compare_at_price,labels,category_id,logo_url,categories(name)'
interface Review { id: string; avatar_url: string | null; name: string; product_label: string | null; rating: number; body: string }
interface Stats { orders_completed: number; customers: number; repeat_pct: number | null; rating_avg: number | null; rating_count: number }
interface Cat { id: string; name: string; image_url: string | null }
const DEFAULT_HL = ['Harga tampil jelas sebelum pesanan dibuat', 'Setiap pesanan punya nomor dan kode akses untuk cek status', 'Konfirmasi dan pembayaran langsung lewat WhatsApp', 'Pembayaran diverifikasi admin sebelum pesanan diproses', 'Riwayat status pesanan tercatat']

function Thumb({ p, big, sm }: { p: Product; big?: boolean; sm?: boolean }) {
  const [bad, setBad] = useState(false)
  if (p.logo_url && !bad) return <div className={'ph logo' + (big ? ' big' : '') + (sm ? ' sm' : '')}><img src={p.logo_url} alt={p.name} loading="lazy" onError={() => setBad(true)} /></div>
  return <div className={'ph' + (big ? ' big' : '') + (sm ? ' sm' : '')} aria-hidden="true">{p.name[0]}</div>
}
function Price({ p }: { p: Product }) {
  return <div className="price">{rupiah(p.price)}{p.compare_at_price && p.compare_at_price > p.price && <s>{rupiah(p.compare_at_price)}</s>}</div>
}
function Gate() {
  const t = useT()
  return (
    <div className="callout">
      <span><Icon n="shield" size={18} /> {t('Daftar untuk melihat semua produk & harga')}</span>
      <Link className="btn" to="/daftar">{t('Daftar Gratis')} <Icon n="arrow" size={16} /></Link>
      <span className="muted">{t('Sudah punya akun?')} <Link to="/masuk">{t('Masuk')}</Link></span>
    </div>
  )
}

export default function Store() {
  const session = useSession()
  const t = useT()
  const [cats, setCats] = useState<Cat[]>([])
  const [wa, setWa] = useState('')
  const [hours, setHours] = useState('Setiap hari, 24 jam')
  const [highlights, setHighlights] = useState<string[]>(DEFAULT_HL)
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const rail = useRef<HTMLDivElement>(null)
  const [manual, setManual] = useState<{ c: string; r: string; p: string }>({ c: '', r: '', p: '' })

  useEffect(() => {
    supabase.from('categories').select('id,name,image_url').order('sort_order').then(({ data }) => setCats((data ?? []) as Cat[]))
    supabase.from('store_settings').select('key,value').in('key', ['whatsapp_number', 'operating_hours', 'highlights', 'stat_customers', 'stat_rating', 'stat_repeat']).then(({ data }) => {
      ;(data ?? []).forEach((r) => {
        if (r.key === 'whatsapp_number') { const n = String(r.value ?? '').replace(/\D/g, ''); if (/^\d{8,15}$/.test(n)) setWa(n) }
        if (r.key === 'operating_hours' && r.value) setHours(String(r.value))
        if (r.key === 'stat_customers') setManual((m) => ({ ...m, c: String(r.value ?? '').trim() }))
        if (r.key === 'stat_rating') setManual((m) => ({ ...m, r: String(r.value ?? '').trim() }))
        if (r.key === 'stat_repeat') setManual((m) => ({ ...m, p: String(r.value ?? '').trim() }))
        if (r.key === 'highlights' && Array.isArray(r.value) && r.value.length) setHighlights((r.value as unknown[]).map(String))
      })
    })
    supabase.from('testimonials').select('id,name,product_label,rating,body,avatar_url').eq('is_published', true).order('sort_order').then(({ data }) => setReviews((data ?? []) as Review[]))
    supabase.rpc('public_stats').then(({ data }) => { if (data) setStats(data as Stats) })
  }, [])

  const nav = useNavigate()
  const start = session
    ? <Link className="btn lg" to="/produk">{t('Lihat Produk')} <Icon n="arrow" size={16} /></Link>
    : <Link className="btn lg" to="/daftar">{t('Daftar Sekarang')} <Icon n="arrow" size={16} /></Link>

  return (
    <>
      <section className="hero">
        <span className="badge"><Icon n="spark" size={14} /> {t('Diskon untuk pelanggan setia tiap bulan')}</span>
        <h1>{t('Belanja')} <span className="g">{t('Produk Digital')}</span><br />{t('Jadi Lebih Mudah')}</h1>
        <p>{t('Daftar dengan email, pilih produk, lalu lanjutkan ke WhatsApp untuk pembayaran. Belanja rutin tiap bulan, diskonnya naik.')}</p>
        <div className="row c">
          {start}
          {wa && <a className="btn ghost lg" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">{t('Hubungi Admin')}</a>}
        </div>
      </section>

      <section className="feat">
        {[['shield', 'Pesanan Tercatat', 'Setiap pesanan punya nomor unik dan bisa dicek statusnya kapan saja.'],
          ['zap', 'Konfirmasi via WhatsApp', 'Setelah pesan, lanjut ke WhatsApp untuk petunjuk pembayaran.'],
          ['star', 'Diskon Pelanggan Setia', 'Belanja tiap bulan dan dapatkan diskon yang makin besar.']].map(([i, ti, d]) => (
          <div className="fcard" key={ti}><span className="ic"><Icon n={i as 'shield'} size={22} /></span><h3>{t(ti)}</h3><p>{t(d)}</p></div>
        ))}
      </section>

      <section className="sec">
        <h2 className="h2c">{t('Kategori')} <span className="g">{t('Tersedia')}</span></h2>
        <p className="sub">{t('Pilih kategori produk sesuai kebutuhanmu')}</p>
        <div className="cats">
          {cats.map((c) => (
            <button className="cat" key={c.id} onClick={() => nav(session ? `/produk?cat=${c.id}` : '/daftar')}>
              {c.image_url ? <img src={c.image_url} alt="" loading="lazy" /> : <span className="ic sm"><Icon n={catIcon(c.name)} /></span>}
              <b>{c.name}</b>
            </button>
          ))}
        </div>
        {session === null && <Gate />}
      </section>

      <section className="sec">
        <h2 className="h2c">{t('Kenapa')} <span className="g">{t('Belanja Di Sini')}</span>?</h2>
        <div className="checks">{highlights.map((c) => <div className="chk2" key={c}><span className="ic xs"><Icon n="check" size={14} /></span>{t(c)}</div>)}</div>
      </section>

      {(reviews.length > 0 || (stats && stats.customers > 0) || manual.c || manual.r || manual.p) && (
        <section className="sec">
          {reviews.length > 0 && <>
            <div className="c"><span className="badge live"><Icon n="chat" size={14} /> {t('Testimoni Pelanggan')}</span></div>
            <h2 className="h2c">{t('Apa Kata')} <span className="g">{t('Mereka?')}</span></h2>
            <p className="sub">{t('Ulasan dari pelanggan kami')}</p>
          </>}
          {reviews.length > 0 && (
            <>
              <div className="row c">
                <button className="btn ghost sm" aria-label={t('Sebelumnya')} onClick={() => rail.current?.scrollBy({ left: -340, behavior: 'smooth' })}>‹</button>
                <span className="muted">{t('Geser untuk melihat lebih banyak')}</span>
                <button className="btn ghost sm" aria-label={t('Berikutnya')} onClick={() => rail.current?.scrollBy({ left: 340, behavior: 'smooth' })}>›</button>
              </div>
              <div className="rail" ref={rail} tabIndex={0} aria-label="Daftar testimoni">
                {reviews.map((r) => (
                  <figure className="rev" key={r.id}>
                    <div className="who">
                      {r.avatar_url ? <img className="av" src={r.avatar_url} alt="" loading="lazy" /> : <span className="av">{r.name.slice(0, 2).toUpperCase()}</span>}
                      <div><b>{r.name}</b><div className="muted">{r.product_label}</div></div>
                      <span className="stars" role="img" aria-label={`${r.rating} dari 5 bintang`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <blockquote>{r.body}</blockquote>
                  </figure>
                ))}
              </div>
            </>
          )}
          <div className="stats3">
            {manual.c ? <div><b className="g n">{manual.c}</b><span>{t('Pelanggan Puas')}</span></div>
              : stats && stats.customers > 0 && <div><b className="g n">{stats.customers}</b><span>{t('Pelanggan Bertransaksi')}</span></div>}
            {manual.r ? <div><b className="g n">{manual.r}</b><span>{t('Rating Rata-rata')}</span></div>
              : stats && stats.rating_count > 0 && stats.rating_avg != null && <div><b className="g n">{stats.rating_avg}</b><span>{t('Rating Rata-rata')} ({stats.rating_count} {t('ulasan')})</span></div>}
            {manual.p ? <div><b className="g n">{manual.p}</b><span>{t('Repeat Order')}</span></div>
              : stats && stats.customers >= 10 && stats.repeat_pct != null && <div><b className="g n">{stats.repeat_pct}%</b><span>{t('Repeat Order')}</span></div>}
          </div>
        </section>
      )}

      <section className="cta">
        <h2>{t('Siap Memesan?')}</h2><p>{t('Daftar, pilih produk, dan selesaikan lewat WhatsApp.')}</p>
        {session ? <Link className="btn lg cta-btn" to="/produk">{t('Mulai Sekarang')} <Icon n="arrow" size={16} /></Link> : <Link className="btn lg cta-btn" to="/daftar">{t('Daftar Gratis')} <Icon n="arrow" size={16} /></Link>}
      </section>

      <section className="about">
        <h2>{t('Tentang')} <span className="g">{t('Toko Kami')}</span></h2>
        <p>{t('Setiap pesanan memiliki nomor dan kode akses untuk dicek kapan saja, dan pembayaran baru dianggap lunas setelah admin memverifikasinya.')}</p>
        <p><b>{t('Jam operasional:')}</b> {hours}</p>
        <div className="row c">{session ? <><Link className="btn ghost sm" to="/cek">{t('Cek Pesanan')}</Link><Link className="btn ghost sm" to="/akun">{t('Akun Saya')}</Link></> : <Link className="btn ghost sm" to="/masuk">{t('Masuk')}</Link>}</div>
      </section>
    </>
  )
}

export function ProductPage() {
  const { slug } = useParams()
  const session = useSession()
  const t = useT()
  const [p, setP] = useState<Product | null | undefined>(undefined)
  useEffect(() => {
    if (!session) return
    supabase.from('products').select(SEL).eq('slug', slug ?? '').maybeSingle().then(({ data }) => setP(data as unknown as Product | null))
  }, [slug, session])
  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <section className="box"><h1>{t('Masuk dulu')}</h1><p>{t('Produk dan harga hanya terlihat setelah Anda masuk.')}</p><div className="row"><Link className="btn" to="/masuk">{t('Masuk')}</Link><Link className="btn ghost" to="/daftar">{t('Daftar')}</Link></div></section>
  if (p === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!p) return <p>{t('Produk tidak ditemukan atau tidak tersedia.')} <Link to="/produk">{t('Lihat semua produk')}</Link></p>
  return (
    <section className="detail">
      <Thumb p={p} big />
      <div>
        <div className="muted">{p.categories?.name}</div>
        <h1>{p.name}</h1>
        <Price p={p} />
        <p>{p.short_description}</p>
        <div className="prose">{p.description}</div>
        <button className="btn" onClick={() => cartApi.add(p)}>{t('Tambah ke keranjang')}</button>
        <p className="muted">{t('Ketersediaan dan harga final dikonfirmasi saat pesanan dibuat.')}</p>
      </div>
    </section>
  )
}

function ProductCard({ p }: { p: Product }) {
  const t = useT()
  const favs = useFavs()
  const fav = favs.includes(p.id)
  const [copied, setCopied] = useState(false)
  async function share() {
    const url = `${window.location.origin}/produk/${p.slug}`
    try {
      if (navigator.share) await navigator.share({ title: p.name, url })
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    } catch { /* dibatalkan */ }
  }
  return (
    <article className="pcard">
      <div className="phead">
        <Thumb p={p} sm />
        <div className="pname"><h3 title={p.name}><Link to={`/produk/${p.slug}`}>{p.name}</Link></h3><div className="muted">{p.categories?.name}</div></div>
        <div className="pact">
          <button className="miniic" aria-label={t('Bagikan')} title={copied ? t('Tautan tersalin') : t('Bagikan')} onClick={share}><Icon n={copied ? 'check' : 'share'} size={15} /></button>
          <button className={'miniic' + (fav ? ' on' : '')} aria-pressed={fav} aria-label={fav ? t('Hapus dari favorit') : t('Tambah ke favorit')} title={fav ? t('Hapus dari favorit') : t('Tambah ke favorit')} onClick={() => favApi.toggle(p.id)}><Icon n="heart" size={15} /></button>
        </div>
      </div>
      {p.short_description && <p className="pdesc">{p.short_description}</p>}
      <div className="tags">{p.labels?.map((l) => <span className="tag" key={l}>{l}</span>)}</div>
      <div className="pfoot">
        <div className="price"><span className="g">{rupiah(p.price)}</span>{p.compare_at_price && p.compare_at_price > p.price && <s>{rupiah(p.compare_at_price)}</s>}</div>
        <button className="btn sm" onClick={() => cartApi.add(p)}><Icon n="cart" size={14} /> {t('Beli')}</button>
      </div>
    </article>
  )
}

function useProducts(session: unknown) {
  const t = useT()
  const [list, setList] = useState<Product[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!session) { setList(null); return }
    supabase.from('products').select(SEL).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErr(t('Produk gagal dimuat. Muat ulang halaman.')); else setList(data as unknown as Product[])
    })
  }, [session])
  return { list, err }
}

export function Catalog() {
  const session = useSession()
  const t = useT()
  const [params, setParams] = useSearchParams()
  const [cats, setCats] = useState<Cat[]>([])
  const [q, setQ] = useState('')
  const { list, err } = useProducts(session)
  const cat = params.get('cat') ?? ''
  useEffect(() => { supabase.from('categories').select('id,name,image_url').order('sort_order').then(({ data }) => setCats((data ?? []) as Cat[])) }, [])
  const shown = useMemo(() => (list ?? []).filter((p) => {
    if (cat === 'sale' ? !(p.compare_at_price && p.compare_at_price > p.price) : (cat && p.category_id !== cat)) return false
    return p.name.toLowerCase().includes(q.toLowerCase())
  }), [list, cat, q])
  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <section className="sec"><Gate /></section>
  return (
    <section className="catalog">
      <h1 className="cattitle">{t('Katalog Produk')}</h1>
      <div className="searchbox"><span className="fldic"><Icon n="search" size={17} /></span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Cari produk')} aria-label={t('Cari produk')} /></div>
      <div className="chips scrollchips">
        <button className="chip" aria-pressed={!cat} onClick={() => setParams({})}>{t('Semua')}</button>
        <button className="chip" aria-pressed={cat === 'sale'} onClick={() => setParams({ cat: 'sale' })}><Icon n="percent" size={14} /> {t('Diskon')}</button>
        {cats.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setParams({ cat: c.id })}><Icon n={catIcon(c.name)} size={14} /> {c.name}</button>)}
      </div>
      {err && <p className="err">{err}</p>}
      {!list && !err && <p className="muted">{t('Memuat produk...')}</p>}
      {list && shown.length === 0 && <p className="muted">{t('Belum ada produk yang cocok. Coba kata kunci atau kategori lain.')}</p>}
      <div className="pgrid">{shown.map((p) => <ProductCard p={p} key={p.id} />)}</div>
    </section>
  )
}

export function Favorites() {
  const session = useSession()
  const t = useT()
  const favs = useFavs()
  const { list, err } = useProducts(session)
  if (session === undefined) return <p className="muted">{t('Memuat...')}</p>
  if (!session) return <section className="sec"><Gate /></section>
  const shown = (list ?? []).filter((p) => favs.includes(p.id))
  return (
    <section className="catalog">
      <h1 className="cattitle">{t('Favorit Saya')}</h1>
      {err && <p className="err">{err}</p>}
      {!list && !err && <p className="muted">{t('Memuat produk...')}</p>}
      {list && shown.length === 0 && <p className="muted">{t('Belum ada favorit. Tekan ikon hati pada produk untuk menyimpannya.')} <Link to="/produk">{t('Lihat produk')}</Link></p>}
      <div className="pgrid">{shown.map((p) => <ProductCard p={p} key={p.id} />)}</div>
    </section>
  )
}
