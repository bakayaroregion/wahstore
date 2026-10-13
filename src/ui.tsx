import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { setLang, setTheme, useLang, useT, useTheme, type Lang } from './i18n'

const ICONS = {
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  zap: <polygon points="13 2 4 14 11 14 10 22 20 9 13 9" />,
  star: <polygon points="12 3 14.8 9 21 9.8 16.5 14 17.7 20.5 12 17.3 6.3 20.5 7.5 14 3 9.8 9.2 9" />,
  tv: <><rect x="3" y="7" width="18" height="13" rx="2" /><polyline points="8 3 12 7 16 3" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  book: <path d="M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z" />,
  cloud: <path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 7z" />,
  bot: <><rect x="4" y="8" width="16" height="11" rx="3" /><circle cx="9" cy="13.5" r="1" /><circle cx="15" cy="13.5" r="1" /><path d="M12 8V4" /></>,
  check: <polyline points="5 12 10 17 19 7" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <polygon points="7 4 20 12 7 20" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
  video: <><rect x="3" y="6" width="12" height="12" rx="2" /><polygon points="15 10 21 7 21 17 15 14" /></>,
  pkg: <path d="M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></>,
  heart: <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" />,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8S9 8 8 6a2.2 2.2 0 0 1 4-1c.6.8 0 3 0 3zM12 8s3 0 4-2a2.2 2.2 0 0 0-4-1c-.6.8 0 3 0 3z" /></>,
  wallet: <><path d="M4 7a2 2 0 0 1 2-2h11v3" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 13.5h2" /></>,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  logout: <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>,
  percent: <><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="17" r="2.2" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  refresh: <path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
}
export type IconName = keyof typeof ICONS

export function Icon({ n, size = 20 }: { n: IconName; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>
}

export function catIcon(name: string): IconName {
  const s = name.toLowerCase()
  if (/stream|video|film|tv/.test(s)) return 'tv'
  if (/musik|music|audio/.test(s)) return 'music'
  if (/edit|desain|design/.test(s)) return 'edit'
  if (/belajar|kursus|edu/.test(s)) return 'book'
  if (/cloud|storage/.test(s)) return 'cloud'
  if (/\bai\b|bot/.test(s)) return 'bot'
  if (/voucher|game/.test(s)) return 'star'
  if (/lisensi|license|akun/.test(s)) return 'key'
  return 'pkg'
}

interface Brand { slug: string; bg: string; dark: boolean; x: number; y: number; s: number; d: number; dx: number; dy: number }
// Ikon dari Simple Icons (lisensi CC0) di /public/brands. Tambah atau hapus baris untuk mengatur ikon yang melayang.
// Nama dan logo adalah merek dagang pemiliknya masing-masing.
const BRANDS: Brand[] = [
  { slug: 'netflix', bg: '#E50914', dark: false, x: 4, y: 14, s: 36, d: 8, dx: 4, dy: -6 },
  { slug: 'spotify', bg: '#1DB954', dark: false, x: 14, y: 9, s: 34, d: 9, dx: -6, dy: 8 },
  { slug: 'youtube', bg: '#FF0000', dark: false, x: 27, y: 18, s: 32, d: 10, dx: 8, dy: -10 },
  { slug: 'canva', bg: '#00A7B5', dark: false, x: 42, y: 11, s: 34, d: 11, dx: -4, dy: 12 },
  { slug: 'discord', bg: '#5865F2', dark: false, x: 57, y: 18, s: 32, d: 8, dx: 6, dy: -6 },
  { slug: 'twitch', bg: '#9146FF', dark: false, x: 68, y: 12, s: 36, d: 9, dx: -8, dy: 8 },
  { slug: 'tiktok', bg: '#161616', dark: false, x: 80, y: 16, s: 32, d: 10, dx: 4, dy: -10 },
  { slug: 'x', bg: '#161616', dark: false, x: 90, y: 9, s: 34, d: 11, dx: -6, dy: 12 },
  { slug: 'threads', bg: '#161616', dark: false, x: 96, y: 20, s: 30, d: 8, dx: 8, dy: -6 },
  { slug: 'github', bg: '#24292F', dark: false, x: 3, y: 44, s: 34, d: 9, dx: -4, dy: 8 },
  { slug: 'steam', bg: '#1B2838', dark: false, x: 12, y: 36, s: 32, d: 10, dx: 6, dy: -10 },
  { slug: 'zoom', bg: '#0B5CFF', dark: false, x: 24, y: 46, s: 36, d: 11, dx: -8, dy: 12 },
  { slug: 'wattpad', bg: '#FF500A', dark: false, x: 18, y: 25, s: 32, d: 8, dx: 4, dy: -6 },
  { slug: 'amazon', bg: '#232F3E', dark: false, x: 93, y: 64, s: 34, d: 9, dx: -6, dy: 8 },
  { slug: 'vimeo', bg: '#1AB7EA', dark: false, x: 8, y: 62, s: 32, d: 10, dx: 8, dy: -10 },
  { slug: 'linkedin', bg: '#0A66C2', dark: false, x: 86, y: 58, s: 34, d: 11, dx: -4, dy: 12 },
  { slug: 'googledrive', bg: '#1FA463', dark: false, x: 78, y: 47, s: 32, d: 8, dx: 6, dy: -6 },
  { slug: 'notion', bg: '#2B2B2B', dark: false, x: 89, y: 42, s: 36, d: 9, dx: -8, dy: 8 },
  { slug: 'applemusic', bg: '#FA243C', dark: false, x: 96, y: 51, s: 30, d: 10, dx: 4, dy: -10 },
  { slug: 'facebook', bg: '#0866FF', dark: false, x: 6, y: 86, s: 36, d: 11, dx: -6, dy: 12 },
  { slug: 'telegram', bg: '#26A5E4', dark: false, x: 17, y: 91, s: 34, d: 8, dx: 8, dy: -6 },
  { slug: 'whatsapp', bg: '#25D366', dark: false, x: 29, y: 84, s: 32, d: 9, dx: -4, dy: 8 },
  { slug: 'pinterest', bg: '#E60023', dark: false, x: 41, y: 92, s: 34, d: 10, dx: 6, dy: -10 },
  { slug: 'snapchat', bg: '#FFFC00', dark: true, x: 53, y: 85, s: 36, d: 11, dx: -8, dy: 12 },
  { slug: 'reddit', bg: '#FF4500', dark: false, x: 64, y: 91, s: 32, d: 8, dx: 4, dy: -6 },
  { slug: 'instagram', bg: 'linear-gradient(45deg,#f09433,#dc2743 55%,#bc1888)', dark: false, x: 76, y: 85, s: 34, d: 9, dx: -6, dy: 8 },
]

function BrandTile({ b, i }: { b: Brand; i: number }) {
  const [bad, setBad] = useState(false)
  const st = { left: `${b.x}%`, top: `${b.y}%`, '--s': b.s, background: b.bg, animationDuration: `${b.d}s`, animationDelay: `-${i * 1.3}s`, '--dx': `${b.dx}px`, '--dy': `${b.dy}px` } as CSSProperties
  return (
    <span className="tile" style={st}>
      {bad ? <b>{b.slug[0].toUpperCase()}</b> : <img src={`/brands/${b.slug}.svg`} alt="" className={b.dark ? '' : 'inv'} onError={() => setBad(true)} />}
    </span>
  )
}

// [x%, y%, durasi detik, offset detik]. Bintang jatuh terus berulang tanpa henti.
const METEORS = [[95, 2, 6, 0, 150], [70, -5, 7, 2, 210], [45, 8, 8, 5, 120], [100, 25, 5, 1, 180], [82, 12, 9, 7, 140], [60, 30, 6, 3, 240], [30, -8, 7, 4, 130], [110, 40, 8, 6, 200], [15, 15, 9, 8, 110],
  [88, -2, 5.5, 2.5, 170], [52, -6, 6.5, 6.5, 230], [105, 8, 7.5, 3.5, 100], [75, 20, 8.5, 9, 190], [38, 2, 9.5, 1.5, 150], [92, 34, 6, 5.5, 125], [22, -4, 7, 7.5, 175]]

// Ranting pohon sakura dan burung untuk tema siang bergaya Jepang.
const PETALS = Array.from({ length: 12 }, (_, k) => ({ x: (k * 4.7 + (k % 3) * 2.1) % 100, d: 11 + (k * 7) % 9, w: (k * 3.3) % 14, s: 8 + (k * 5) % 8 }))
const BIRDS = [[14, 26, 0, 11], [22, 70, 9, 15], [9, 40, 5, 19], [18, 58, 14, 13], [12, 33, 2, 17]]

// Latar angkasa dekoratif: bintang diam, bintang jatuh, dan ubin ikon aplikasi yang melayang.
// Rasi bintang: titik [x%, y%]. Garis dan titiknya berkedip pelan.
const CONSTS = [
  [[78, 16], [82, 8], [86, 4], [90, 10]],
  [[93, 22], [95, 32], [90, 40], [86, 47]],
  [[30, 93], [36, 87], [42, 91], [46, 85], [52, 93]],
  [[4, 30], [9, 24], [14, 28], [12, 36]],
  [[56, 72], [60, 78], [66, 74], [70, 80]],
  [[18, 60], [22, 66], [28, 63]],
]

export function Space() {
  const stars = useMemo(() => {
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 150 }, () => ({ x: r() * 100, y: r() * 100, z: r() * 2 + 1, o: r() * 0.6 + 0.25, tw: 2 + r() * 4, dl: r() * 6 }))
  }, [])
  const orbs = useMemo(() => {
    let s = 31; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 16 }, () => ({ x: r() * 100, y: r() * 100, z: 14 + r() * 20, tw: 5 + r() * 6, dl: r() * 8 }))
  }, [])
  return (
    <div className="space" aria-hidden="true">
      {orbs.map((o, k) => <i className="orb" key={k} style={{ left: `${o.x}%`, top: `${o.y}%`, width: o.z, height: o.z, animationDuration: `${o.tw}s`, animationDelay: `-${o.dl}s` }} />)}
      {stars.map((t, k) => <i className="star" key={k} style={{ left: `${t.x}%`, top: `${t.y}%`, width: t.z, height: t.z, opacity: t.o, animationDuration: `${t.tw}s`, animationDelay: `-${t.dl}s` }} />)}
      {METEORS.map((m, k) => <i className="shoot" key={k} style={{ left: `${m[0]}%`, top: `${m[1]}%`, '--t': `${m[2]}s`, '--l': `${m[4]}px`, animationDelay: `-${m[3]}s` } as CSSProperties} />)}
      <svg className="const" viewBox="0 0 100 100" preserveAspectRatio="none">{CONSTS.map((c, k) => <polyline key={k} points={c.map((p) => p.join(',')).join(' ')} style={{ animationDelay: `-${k * 1.7}s` }} />)}</svg>
      {CONSTS.flat().map((p, k) => <i className="node" key={k} style={{ left: `${p[0]}%`, top: `${p[1]}%`, animationDelay: `-${(k % 6) * 0.9}s` }} />)}
      <div className="sun" />
      {[[8, 10, 260, 90], [40, 24, 320, 120], [66, 6, 240, 100], [18, 52, 300, 140]].map((c, k) => <i className="cloud" key={k} style={{ left: `${c[0]}%`, top: `${c[1]}%`, width: c[2], height: c[2] / 4, animationDuration: `${c[3]}s`, animationDelay: `-${k * 23}s` }} />)}
      <svg className="fuji" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice">
        <path className="far" d="M0 300V230l140-30 120 25 150-50 130 40 120-35 160 45 140-30 240 20v85z" />
        <path className="mtn" d="M300 300L520 120l40-45c20-26 40-26 60 0l40 45 230 180z" />
        <path className="cap" d="M520 120l40-45c20-26 40-26 60 0l40 45-30-8-25 14-25-16-25 16-25-14z" />
        <path className="near" d="M0 300v-55c120-30 240-20 380 5s260 10 420-15 280-20 400 5v60z" />
      </svg>
      {PETALS.map((p, k) => <i className="petal" key={k} style={{ left: `${p.x}%`, width: p.s, height: p.s * 0.8, animationDuration: `${p.d}s`, animationDelay: `-${p.w}s` }} />)}
      {BIRDS.map((b, k) => (
        <svg className="bird" key={k} viewBox="0 0 40 20" style={{ top: `${b[1]}%`, animationDuration: `${b[3]}s`, animationDelay: `-${b[2]}s` }}>
          <path d="M2 14Q10 2 20 12Q30 2 38 14" />
        </svg>
      ))}
      {BRANDS.map((b, k) => <BrandTile b={b} i={k} key={b.slug} />)}
    </div>
  )
}

// Pemilih bahasa: tombol kecil "ID" yang membuka daftar Indonesia, English, Khmer.
const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'id', flag: 'ID', label: 'Indonesia' },
  { code: 'en', flag: 'GB', label: 'English' },
  { code: 'km', flag: 'KH', label: 'ខ្មែរ' },
]
export function LangMenu() {
  const lang = useLang()
  const t = useT()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="lang" ref={box}>
      <button className="linkbtn langbtn" aria-haspopup="listbox" aria-expanded={open} aria-label={t('Bahasa')} onClick={() => setOpen(!open)}>{lang.toUpperCase()}</button>
      {open && (
        <ul className="langlist" role="listbox">
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={lang === l.code}>
              <button className={lang === l.code ? 'on' : ''} onClick={() => { setLang(l.code); setOpen(false) }}><small>{l.flag}</small> {l.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Tombol siang/malam: bulan saat gelap, matahari saat terang.
export function ThemeToggle() {
  const theme = useTheme()
  const t = useT()
  const light = theme === 'light'
  return (
    <button className="themebtn" aria-label={light ? t('Mode gelap') : t('Mode terang')} title={light ? t('Mode gelap') : t('Mode terang')} onClick={() => setTheme(light ? 'dark' : 'light')}>
      <Icon n={light ? 'sun' : 'moon'} size={18} />
    </button>
  )
}

export function Logo({ url, size = 34 }: { url: string; size?: number }) {
  if (url) return <img src={url} alt="" width={size} height={size} style={{ borderRadius: size / 3.4, objectFit: 'cover' }} />
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient></defs>
      <rect width="34" height="34" rx="10" fill="url(#lg)" />
      <path d="M8 11l3.5 12L17 14l5.5 9L26 11" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


// Bilah judul halaman: panah kembali, ikon berlatar gradasi, dan nama halaman.
export function PageBar({ icon, title, back = '/produk' }: { icon: IconName; title: string; back?: string }) {
  return (
    <div className="pagebar">
      <Link to={back} className="pbback" aria-label="Kembali"><Icon n="back" size={18} /></Link>
      <span className="pbic"><Icon n={icon} size={20} /></span>
      <b>{title}</b>
    </div>
  )
}
