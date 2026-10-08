import { Link, Route, Routes } from 'react-router-dom'
import { useCart } from './lib'
import { configured } from './supabase'
import { Space } from './ui'
import Store, { ProductPage } from './pages/Store'
import { Cart, Check } from './pages/Cart'
import Admin from './pages/Admin'

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient></defs>
      <rect width="34" height="34" rx="10" fill="url(#lg)" />
      <path d="M8 11l3.5 12L17 14l5.5 9L26 11" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Shell() {
  const n = useCart().reduce((a, i) => a + i.qty, 0)
  return (
    <>
      <Space />
      <header className="top"><div className="wrap bar">
        <Link to="/" className="brand"><Logo /><span>WAHYU STORE<small>Toko Produk Digital</small></span></Link>
        <nav><Link to="/cek">Cek pesanan</Link><Link to="/keranjang" className="btn sm">Keranjang ({n})</Link></nav>
      </div></header>
      {!configured && <div className="warn">Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.</div>}
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Store />} />
          <Route path="/produk/:slug" element={<ProductPage />} />
          <Route path="/keranjang" element={<Cart />} />
          <Route path="/cek" element={<Check />} />
          <Route path="*" element={<p>Halaman tidak ditemukan. <Link to="/">Kembali ke beranda</Link></p>} />
        </Routes>
      </main>
      <footer><div className="wrap fcol">
        <div>© 2026 WAHYU STORE. Pesanan diproses melalui WhatsApp.</div>
        <div className="muted">Merek dan logo milik pemiliknya masing-masing. WAHYU STORE tidak berafiliasi dengan merek yang ditampilkan.</div>
        <div className="flinks"><Link to="/">Beranda</Link><Link to="/cek">Cek Pesanan</Link><Link to="/keranjang">Keranjang</Link></div>
      </div></footer>
    </>
  )
}
export default function App() {
  return <Routes><Route path="/admin/*" element={<Admin />} /><Route path="*" element={<Shell />} /></Routes>
}
