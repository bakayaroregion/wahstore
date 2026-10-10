import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { supabase, configured } from './supabase'
import { rupiah, useBrand, useCart, useFavs, useSession } from './lib'
import { Space, LangMenu, ThemeToggle, Logo, Icon } from './ui'
import { useT } from './i18n'
import Store, { Catalog, Favorites, ProductPage } from './pages/Store'
import { Cart, Check } from './pages/Cart'
import { Account, Login, Register } from './pages/Auth'
import Admin from './pages/Admin'

function Shell() {
  const cart = useCart()
  const total = cart.reduce((a, i) => a + i.price * i.qty, 0)
  const count = cart.reduce((a, i) => a + i.qty, 0)
  const favCount = useFavs().length
  const wide = useLocation().pathname === '/produk' || useLocation().pathname === '/favorit'
  const session = useSession()
  const brand = useBrand()
  const t = useT()
  useEffect(() => { document.title = `${brand.name} - ${brand.tagline}` }, [brand])
  return (
    <>
      <Space />
      <header className="top"><div className={'wrap bar' + (wide ? ' wide' : '')}>
        <Link to="/" className="brand"><Logo url={brand.logo} /><span>{brand.name}<small>{brand.tagline}</small></span></Link>
        <nav>
          {!session && <><LangMenu /><ThemeToggle /></>}
          {session ? (
            <>
              <Link to="/keranjang" className="cartpill" aria-label={t('Keranjang')} title={t('Keranjang')}><Icon n="cart" size={16} /> {rupiah(total)}{count > 0 && <b className="cnt">{count}</b>}</Link>
              <LangMenu />
              <ThemeToggle />
              <Link to="/akun" className="iconbtn" aria-label={t('Diskon pelanggan setia')} title={t('Diskon pelanggan setia')}><Icon n="gift" size={17} /></Link>
              <Link to="/favorit" className="iconbtn" aria-label={t('Favorit')} title={t('Favorit')}><Icon n="heart" size={17} />{favCount > 0 && <b className="cnt">{favCount}</b>}</Link>
              <Link to="/cek" className="iconbtn" aria-label={t('Cek pesanan')} title={t('Cek pesanan')}><Icon n="receipt" size={17} /></Link>
              <Link to="/akun" className="iconbtn" aria-label={t('Akun')} title={t('Akun')}><Icon n="user" size={17} /></Link>
              <button className="iconbtn" aria-label={t('Keluar')} title={t('Keluar')} onClick={() => supabase.auth.signOut()}><Icon n="logout" size={17} /></button>
            </>
          ) : session === null ? (
            <><Link to="/masuk">{t('Masuk')}</Link><Link to="/daftar" className="btn sm">{t('Daftar')}</Link></>
          ) : null}
        </nav>
      </div></header>
      {!configured && <div className="warn">Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.</div>}
      <main className={'wrap' + (wide ? ' wide' : '')}>
        <Routes>
          <Route path="/" element={<Store />} />
          <Route path="/produk" element={<Catalog />} />
          <Route path="/produk/:slug" element={<ProductPage />} />
          <Route path="/favorit" element={<Favorites />} />
          <Route path="/keranjang" element={<Cart />} />
          <Route path="/cek" element={<Check />} />
          <Route path="/masuk" element={<Login />} />
          <Route path="/daftar" element={<Register />} />
          <Route path="/akun" element={<Account />} />
          <Route path="*" element={<p>{t('Halaman tidak ditemukan.')} <Link to="/">{t('Kembali ke beranda')}</Link></p>} />
        </Routes>
      </main>
      <footer><div className="wrap fcol">
        <div>© 2026 {brand.name}. {t('Pesanan diproses melalui WhatsApp.')}</div>
        <div className="muted">{t('Merek dan logo milik pemiliknya masing-masing.')} {brand.name} {t('tidak berafiliasi dengan merek yang ditampilkan.')}</div>
        <div className="flinks"><Link to="/">{t('Beranda')}</Link>{session && <Link to="/cek">{t('Cek Pesanan')}</Link>}<Link to="/akun">{t('Akun')}</Link></div>
      </div></footer>
    </>
  )
}
export default function App() {
  return <Routes><Route path="/admin/*" element={<Admin />} /><Route path="*" element={<Shell />} /></Routes>
}
