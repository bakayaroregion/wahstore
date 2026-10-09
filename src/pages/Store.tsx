import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { cartApi, Product, rupiah, useSession } from '../lib'
import { Icon, catIcon } from '../ui'

const SEL = 'id,name,slug,sku,short_description,description,price,compare_at_price,labels,category_id,logo_url,categories(name)'
interface Review { id: string; avatar_url: string | null; name: string; product_label: string | null; rating: number; body: string }
interface Stats { orders_completed: number; customers: number; repeat_pct: number | null; rating_avg: number | null; rating_count: number }
interface Cat { id: string; name: string; image_url: string | null }
const DEFAULT_HL = ['Harga tampil jelas sebelum pesanan dibuat', 'Setiap pesanan punya nomor dan kode akses untuk cek status', 'Konfirmasi dan pembayaran langsung lewat WhatsApp', 'Pembayaran diverifikasi admin sebelum pesanan diproses', 'Riwayat status pesanan tercatat']

function Thumb({ p, big }: { p: Product; big?: boolean }) {
  const [bad, setBad] = useState(false)
  if (p.logo_url && !bad) return <div className={'ph logo' + (big ? ' big' : '')}><img src={p.logo_url} alt={p.name} loading="lazy" onError={() => setBad(true)} /></div>
  return <div className={'ph' + (big ? ' big' : '')} aria-hidden="true">{p.name[0]}</div>
}
function Price({ p }: { p: Product }) {
  return <div className="price">{rupiah(p.price)}{p.compare_at_price && p.compare_at_price > p.price && <s>{rupiah(p.compare_at_price)}</s>}</div>
}
function Gate() {
  return (
    <div className="callout">
      <span><Icon n="shield" size={18} /> Daftar untuk melihat semua produk &amp; harga</span>
      <Link className="btn" to="/daftar">Daftar Gratis <Icon n="arrow" size={16} /></Link>
      <span className="muted">Sudah punya akun? <Link to="/masuk">Masuk</Link></span>
    </div>
  )
}

export default function Store() {
  const session = useSession()
  const [cats, setCats] = useState<Cat[]>([])
  const [wa, setWa] = useState('')
  const [hours, setHours] = useState('Setiap hari, 24 jam')
  const [highlights, setHighlights] = useState<string[]>(DEFAULT_HL)
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const rail = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('categories').select('id,name,image_url').order('sort_order').then(({ data }) => setCats((data ?? []) as Cat[]))
    supabase.from('store_settings').select('key,value').in('key', ['whatsapp_number', 'operating_hours', 'highlights']).then(({ data }) => {
      ;(data ?? []).forEach((r) => {
        if (r.key === 'whatsapp_number') { const n = String(r.value ?? '').replace(/\D/g, ''); if (/^\d{8,15}$/.test(n)) setWa(n) }
        if (r.key === 'operating_hours' && r.value) setHours(String(r.value))
        if (r.key === 'highlights' && Array.isArray(r.value) && r.value.length) setHighlights((r.value as unknown[]).map(String))
      })
    })
    supabase.from('testimonials').select('id,name,product_label,rating,body,avatar_url').eq('is_published', true).order('sort_order').then(({ data }) => setReviews((data ?? []) as Review[]))
    supabase.rpc('public_stats').then(({ data }) => { if (data) setStats(data as Stats) })
  }, [])

  const nav = useNavigate()
  const start = session
    ? <Link className="btn lg" to="/produk">Lihat Produk <Icon n="arrow" size={16} /></Link>
    : <Link className="btn lg" to="/daftar">Daftar Sekarang <Icon n="arrow" size={16} /></Link>

  return (
    <>
      <section className="hero">
        <span className="badge"><Icon n="spark" size={14} /> Diskon untuk pelanggan setia tiap bulan</span>
        <h1>Belanja <span className="g">Produk Digital</span><br />Jadi Lebih Mudah</h1>
        <p>Daftar dengan email, pilih produk, lalu lanjutkan ke WhatsApp untuk pembayaran. Belanja rutin tiap bulan, diskonnya naik.</p>
        <div className="row c">
          {start}
          {wa && <a className="btn ghost lg" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Hubungi Admin</a>}
        </div>
      </section>

      <section className="feat">
        {[['shield', 'Pesanan Tercatat', 'Setiap pesanan punya nomor unik dan bisa dicek statusnya kapan saja.'],
          ['zap', 'Konfirmasi via WhatsApp', 'Setelah pesan, lanjut ke WhatsApp untuk petunjuk pembayaran.'],
          ['star', 'Diskon Pelanggan Setia', 'Belanja tiap bulan dan dapatkan diskon yang makin besar.']].map(([i, t, d]) => (
          <div className="fcard" key={t}><span className="ic"><Icon n={i as 'shield'} size={22} /></span><h3>{t}</h3><p>{d}</p></div>
        ))}
      </section>

      <section className="sec">
        <h2 className="h2c">Kategori <span className="g">Tersedia</span></h2>
        <p className="sub">Pilih kategori produk sesuai kebutuhanmu</p>
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
        <h2 className="h2c">Kenapa <span className="g">Belanja Di Sini</span>?</h2>
        <div className="checks">{highlights.map((c) => <div className="chk2" key={c}><span className="ic xs"><Icon n="check" size={14} /></span>{c}</div>)}</div>
      </section>

      {(reviews.length > 0 || (stats && stats.customers > 0)) && (
        <section className="sec">
          {reviews.length > 0 && <>
            <div className="c"><span className="badge"><Icon n="chat" size={14} /> Testimoni Pelanggan</span></div>
            <h2 className="h2c">Apa Kata <span className="g">Mereka?</span></h2>
            <p className="sub">Ulasan dari pelanggan kami</p>
          </>}
          {reviews.length > 0 && (
            <>
              <div className="row c">
                <button className="btn ghost sm" aria-label="Sebelumnya" onClick={() => rail.current?.scrollBy({ left: -340, behavior: 'smooth' })}>‹</button>
                <span className="muted">Geser untuk melihat lebih banyak</span>
                <button className="btn ghost sm" aria-label="Berikutnya" onClick={() => rail.current?.scrollBy({ left: 340, behavior: 'smooth' })}>›</button>
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
            {stats && stats.customers > 0 && <div><b className="g n">{stats.customers}</b><span>Pelanggan Bertransaksi</span></div>}
            {stats && stats.rating_count > 0 && stats.rating_avg != null && <div><b className="g n">{stats.rating_avg}</b><span>Rating Rata-rata ({stats.rating_count} ulasan)</span></div>}
            {stats && stats.customers >= 10 && stats.repeat_pct != null && <div><b className="g n">{stats.repeat_pct}%</b><span>Repeat Order</span></div>}
          </div>
        </section>
      )}

      <section className="cta">
        <h2>Siap Memesan?</h2><p>Daftar, pilih produk, dan selesaikan lewat WhatsApp.</p>
        {session ? <Link className="btn lg cta-btn" to="/produk">Mulai Sekarang <Icon n="arrow" size={16} /></Link> : <Link className="btn lg cta-btn" to="/daftar">Daftar Gratis <Icon n="arrow" size={16} /></Link>}
      </section>

      <section className="about">
        <h2>Tentang <span className="g">Toko Kami</span></h2>
        <p>Setiap pesanan memiliki nomor dan kode akses untuk dicek kapan saja, dan pembayaran baru dianggap lunas setelah admin memverifikasinya.</p>
        <p><b>Jam operasional:</b> {hours}</p>
        <div className="row c"><Link className="btn ghost sm" to="/cek">Cek Pesanan</Link>{session ? <Link className="btn ghost sm" to="/akun">Akun Saya</Link> : <Link className="btn ghost sm" to="/masuk">Masuk</Link>}</div>
      </section>
    </>
  )
}

export function ProductPage() {
  const { slug } = useParams()
  const session = useSession()
  const [p, setP] = useState<Product | null | undefined>(undefined)
  useEffect(() => {
    if (!session) return
    supabase.from('products').select(SEL).eq('slug', slug ?? '').maybeSingle().then(({ data }) => setP(data as unknown as Product | null))
  }, [slug, session])
  if (session === undefined) return <p className="muted">Memuat...</p>
  if (!session) return <section className="box"><h1>Masuk dulu</h1><p>Produk dan harga hanya terlihat setelah Anda masuk.</p><div className="row"><Link className="btn" to="/masuk">Masuk</Link><Link className="btn ghost" to="/daftar">Daftar</Link></div></section>
  if (p === undefined) return <p className="muted">Memuat...</p>
  if (!p) return <p>Produk tidak ditemukan atau tidak tersedia. <Link to="/produk">Lihat semua produk</Link></p>
  return (
    <section className="detail">
      <Thumb p={p} big />
      <div>
        <div className="muted">{p.categories?.name}</div>
        <h1>{p.name}</h1>
        <Price p={p} />
        <p>{p.short_description}</p>
        <div className="prose">{p.description}</div>
        <button className="btn" onClick={() => cartApi.add(p)}>Tambah ke keranjang</button>
        <p className="muted">Ketersediaan dan harga final dikonfirmasi saat pesanan dibuat.</p>
      </div>
    </section>
  )
}

export function Catalog() {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [list, setList] = useState<Product[] | null>(null)
  const [cats, setCats] = useState<Cat[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const cat = params.get('cat') ?? ''
  useEffect(() => { supabase.from('categories').select('id,name,image_url').order('sort_order').then(({ data }) => setCats((data ?? []) as Cat[])) }, [])
  useEffect(() => {
    if (!session) { setList(null); return }
    supabase.from('products').select(SEL).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErr('Produk gagal dimuat. Muat ulang halaman.'); else setList(data as unknown as Product[])
    })
  }, [session])
  const shown = useMemo(() => (list ?? []).filter((p) => (!cat || p.category_id === cat) && p.name.toLowerCase().includes(q.toLowerCase())), [list, cat, q])
  if (session === undefined) return <p className="muted">Memuat...</p>
  if (!session) return <section className="sec"><Gate /></section>
  return (
    <section className="sec">
      <h1 className="h2c">Semua <span className="g">Produk</span></h1>
      <div className="tools">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk" aria-label="Cari produk" />
        <div className="chips">
          <button className="chip" aria-pressed={!cat} onClick={() => setParams({})}>Semua</button>
          {cats.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setParams({ cat: c.id })}>{c.name}</button>)}
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {!list && !err && <p className="muted">Memuat produk...</p>}
      {list && shown.length === 0 && <p className="muted">Belum ada produk yang cocok. Coba kata kunci atau kategori lain.</p>}
      <div className="grid">
        {shown.map((p) => (
          <article className="card" key={p.id}>
            <Thumb p={p} />
            <div className="tags">{p.labels?.map((l) => <span className="tag" key={l}>{l}</span>)}</div>
            <h3><Link to={`/produk/${p.slug}`}>{p.name}</Link></h3>
            <div className="muted">{p.categories?.name}</div>
            <Price p={p} />
            <div className="row"><Link className="btn ghost sm" to={`/produk/${p.slug}`}>Detail</Link><button className="btn sm" onClick={() => cartApi.add(p)}>Beli</button></div>
          </article>
        ))}
      </div>
    </section>
  )
}
