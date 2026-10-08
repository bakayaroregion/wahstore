import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { cartApi, Product, rupiah } from '../lib'
import { Icon, catIcon } from '../ui'

const SEL = 'id,name,slug,sku,short_description,description,price,compare_at_price,labels,category_id,logo_url,categories(name)'

interface Review { id: string; name: string; product_label: string | null; rating: number; body: string }
interface Stats { orders_completed: number; rating_avg: number | null; rating_count: number }
const DEFAULT_HL = ['Harga tampil jelas sebelum pesanan dibuat', 'Setiap pesanan punya nomor dan kode akses untuk cek status', 'Konfirmasi dan pembayaran langsung lewat WhatsApp', 'Pembayaran diverifikasi admin sebelum pesanan diproses', 'Riwayat status pesanan tercatat']

function Thumb({ p, big }: { p: Product; big?: boolean }) {
  const [bad, setBad] = useState(false)
  if (p.logo_url && !bad) return <div className={'ph logo' + (big ? ' big' : '')}><img src={p.logo_url} alt={p.name} loading="lazy" onError={() => setBad(true)} /></div>
  return <div className={'ph' + (big ? ' big' : '')} aria-hidden="true">{p.name[0]}</div>
}

function Price({ p }: { p: Product }) {
  return <div className="price">{rupiah(p.price)}{p.compare_at_price && p.compare_at_price > p.price && <s>{rupiah(p.compare_at_price)}</s>}</div>
}

export default function Store() {
  const [list, setList] = useState<Product[] | null>(null)
  const [cats, setCats] = useState<{ id: string; name: string }[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [err, setErr] = useState('')
  const [wa, setWa] = useState('')
  const [hours, setHours] = useState('Setiap hari, 24 jam')
  const [highlights, setHighlights] = useState<string[]>(DEFAULT_HL)
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const rail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    supabase.from('products').select(SEL).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErr('Produk gagal dimuat. Muat ulang halaman.'); else setList(data as unknown as Product[])
    })
    supabase.from('categories').select('id,name').order('sort_order').then(({ data }) => setCats(data ?? []))
    supabase.from('store_settings').select('key,value').in('key', ['whatsapp_number', 'operating_hours', 'highlights']).then(({ data }) => {
      ;(data ?? []).forEach((r) => {
        if (r.key === 'whatsapp_number') { const n = String(r.value ?? '').replace(/\D/g, ''); if (/^\d{8,15}$/.test(n)) setWa(n) }
        if (r.key === 'operating_hours' && r.value) setHours(String(r.value))
        if (r.key === 'highlights' && Array.isArray(r.value) && r.value.length) setHighlights((r.value as unknown[]).map(String))
      })
    })
    supabase.from('testimonials').select('id,name,product_label,rating,body').eq('is_published', true).order('sort_order').then(({ data }) => setReviews((data ?? []) as Review[]))
    supabase.rpc('public_stats').then(({ data }) => { if (data) setStats(data as Stats) })
  }, [])
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    ;(list ?? []).forEach((p) => { if (p.category_id) m[p.category_id] = (m[p.category_id] ?? 0) + 1 })
    return m
  }, [list])
  const go = () => document.getElementById('produk')?.scrollIntoView({ behavior: 'smooth' })
  const pick = (id: string) => { setCat(id); go() }
  const shown = (list ?? []).filter((p) => (!cat || p.category_id === cat) && p.name.toLowerCase().includes(q.toLowerCase()))
  const checks = highlights
  return (
    <>
      <section className="hero">
        <span className="badge"><Icon n="spark" size={14} /> Toko produk digital</span>
        <h1>Belanja <span className="g">Produk Digital</span><br />Jadi Lebih Mudah</h1>
        <p>Pilih produk, buat pesanan, lalu lanjutkan ke WhatsApp untuk pembayaran dan konfirmasi dengan admin.</p>
        <div className="row c">
          <button className="btn lg" onClick={go}>Lihat Produk <Icon n="arrow" size={16} /></button>
          {wa && <a className="btn ghost lg" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Hubungi Admin</a>}
        </div>
      </section>

      <section className="feat">
        {[['shield', 'Pesanan Tercatat', 'Setiap pesanan punya nomor unik dan bisa dicek statusnya kapan saja.'],
          ['zap', 'Konfirmasi via WhatsApp', 'Setelah pesan, lanjut ke WhatsApp untuk petunjuk pembayaran.'],
          ['star', 'Harga Transparan', 'Total dihitung server dan terlihat sebelum Anda membayar.']].map(([i, t, d]) => (
          <div className="fcard" key={t}><span className="ic"><Icon n={i as 'shield'} size={22} /></span><h3>{t}</h3><p>{d}</p></div>
        ))}
      </section>

      <section className="sec">
        <h2 className="h2c">Kategori <span className="g">Tersedia</span></h2>
        <p className="sub">Pilih kategori produk sesuai kebutuhanmu</p>
        <div className="cats">
          {cats.map((c) => (
            <button className="cat" key={c.id} onClick={() => pick(c.id)}>
              <span className="ic sm"><Icon n={catIcon(c.name)} /></span><b>{c.name}</b><span className="muted">{counts[c.id] ?? 0} produk</span>
            </button>
          ))}
        </div>
        <div className="callout"><Icon n="shield" size={18} /> Semua produk dan harga ada di bawah <button className="btn" onClick={go}>Lihat Produk <Icon n="arrow" size={16} /></button></div>
      </section>

      <section className="sec" id="produk">
        <h2 className="h2c">Semua <span className="g">Produk</span></h2>
        <div className="tools">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk" aria-label="Cari produk" />
          <div className="chips">
            <button className="chip" aria-pressed={!cat} onClick={() => setCat('')}>Semua</button>
            {cats.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>)}
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

      <section className="sec">
        <h2 className="h2c">Kenapa <span className="g">WAHYU STORE</span>?</h2>
        <div className="checks">{checks.map((c) => <div className="chk2" key={c}><span className="ic xs"><Icon n="check" size={14} /></span>{c}</div>)}</div>
      </section>

      {(reviews.length > 0 || (stats && stats.orders_completed > 0)) && (
        <section className="sec">
          <div className="c"><span className="badge"><Icon n="chat" size={14} /> Testimoni Pelanggan</span></div>
          <h2 className="h2c">Apa Kata <span className="g">Mereka?</span></h2>
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
                      <span className="av">{r.name.slice(0, 2).toUpperCase()}</span>
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
            {stats && stats.orders_completed > 0 && <div><b className="g n">{stats.orders_completed}</b><span>Pesanan selesai</span></div>}
            {stats && stats.rating_count > 0 && stats.rating_avg != null && <div><b className="g n">{stats.rating_avg}</b><span>Rating rata-rata ({stats.rating_count} ulasan)</span></div>}
          </div>
        </section>
      )}

      <section className="cta">
        <h2>Siap Memesan?</h2><p>Pilih produk, buat pesanan, dan selesaikan lewat WhatsApp.</p>
        <button className="btn lg" onClick={go}>Mulai Sekarang <Icon n="arrow" size={16} /></button>
      </section>

      <section className="about">
        <h2>Tentang <span className="g">WAHYU STORE</span></h2>
        <p><b>WAHYU STORE</b> adalah toko produk digital. Setiap pesanan memiliki nomor dan kode akses untuk dicek kapan saja, dan pembayaran baru dianggap lunas setelah admin memverifikasinya.</p>
        <p><b>Jam operasional:</b> {hours}</p>
        <div className="row c"><Link className="btn ghost sm" to="/cek">Cek Pesanan</Link><Link className="btn ghost sm" to="/keranjang">Keranjang</Link></div>
      </section>
    </>
  )
}

export function ProductPage() {
  const { slug } = useParams()
  const [p, setP] = useState<Product | null | undefined>(undefined)
  useEffect(() => { supabase.from('products').select(SEL).eq('slug', slug ?? '').maybeSingle().then(({ data }) => setP(data as unknown as Product | null)) }, [slug])
  if (p === undefined) return <p className="muted">Memuat...</p>
  if (!p) return <p>Produk tidak ditemukan atau tidak tersedia. <Link to="/">Lihat semua produk</Link></p>
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
