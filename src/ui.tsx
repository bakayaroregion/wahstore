import { useMemo, useState, type CSSProperties } from 'react'

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
  { slug: 'netflix', bg: '#E50914', dark: false, x: 3, y: 10, s: 42, d: 8, dx: 8, dy: -14 },
  { slug: 'telegram', bg: '#26A5E4', dark: false, x: 5, y: 30, s: 40, d: 9, dx: -6, dy: 12 },
  { slug: 'youtube', bg: '#FF0000', dark: false, x: 11, y: 46, s: 38, d: 10, dx: 10, dy: -10 },
  { slug: 'facebook', bg: '#0866FF', dark: false, x: 3, y: 60, s: 42, d: 7, dx: -8, dy: -12 },
  { slug: 'tiktok', bg: '#161616', dark: false, x: 12, y: 74, s: 38, d: 11, dx: 8, dy: 12 },
  { slug: 'whatsapp', bg: '#25D366', dark: false, x: 4, y: 88, s: 40, d: 9, dx: 10, dy: -10 },
  { slug: 'instagram', bg: 'linear-gradient(45deg,#f09433,#dc2743 55%,#bc1888)', dark: false, x: 92, y: 8, s: 42, d: 8, dx: -8, dy: 14 },
  { slug: 'x', bg: '#161616', dark: false, x: 84, y: 20, s: 36, d: 10, dx: 8, dy: -12 },
  { slug: 'discord', bg: '#5865F2', dark: false, x: 94, y: 32, s: 40, d: 9, dx: -10, dy: 10 },
  { slug: 'twitch', bg: '#9146FF', dark: false, x: 86, y: 46, s: 38, d: 11, dx: 6, dy: -14 },
  { slug: 'snapchat', bg: '#FFFC00', dark: true, x: 93, y: 60, s: 40, d: 8, dx: -8, dy: -10 },
  { slug: 'pinterest', bg: '#E60023', dark: false, x: 85, y: 74, s: 38, d: 10, dx: 10, dy: 12 },
  { slug: 'reddit', bg: '#FF4500', dark: false, x: 94, y: 86, s: 40, d: 9, dx: -6, dy: -12 },
  { slug: 'spotify', bg: '#1DB954', dark: false, x: 82, y: 92, s: 40, d: 11, dx: 8, dy: 10 },
  { slug: 'canva', bg: '#00A7B5', dark: false, x: 14, y: 90, s: 36, d: 10, dx: -8, dy: -10 },
]

function BrandTile({ b, i }: { b: Brand; i: number }) {
  const [bad, setBad] = useState(false)
  const st = { left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s, background: b.bg, animationDuration: `${b.d}s`, animationDelay: `-${i * 1.3}s`, '--dx': `${b.dx}px`, '--dy': `${b.dy}px` } as CSSProperties
  return (
    <span className="tile" style={st}>
      {bad ? <b>{b.slug[0].toUpperCase()}</b> : <img src={`/brands/${b.slug}.svg`} alt="" width={Math.round(b.s * 0.52)} height={Math.round(b.s * 0.52)} className={b.dark ? '' : 'inv'} onError={() => setBad(true)} />}
    </span>
  )
}

// [x%, y%, durasi detik, offset detik]. Bintang jatuh terus berulang tanpa henti.
const METEORS = [[95, 2, 6, 0], [70, -5, 7, 2], [45, 8, 8, 5], [100, 25, 5, 1], [82, 12, 9, 7], [60, 30, 6, 3], [30, -8, 7, 4], [110, 40, 8, 6], [15, 15, 9, 8]]

// Latar angkasa dekoratif: bintang diam, bintang jatuh, dan ubin ikon aplikasi yang melayang.
export function Space() {
  const stars = useMemo(() => {
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 100, z: r() * 2 + 1, o: r() * 0.6 + 0.2 }))
  }, [])
  return (
    <div className="space" aria-hidden="true">
      {stars.map((t, k) => <i className="star" key={k} style={{ left: `${t.x}%`, top: `${t.y}%`, width: t.z, height: t.z, opacity: t.o }} />)}
      {METEORS.map((m, k) => <i className="shoot" key={k} style={{ left: `${m[0]}%`, top: `${m[1]}%`, '--t': `${m[2]}s`, animationDelay: `-${m[3]}s` } as CSSProperties} />)}
      <svg className="const" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="2,16 6,22 12,19 15,27" /><polyline points="84,66 90,72 97,69" /><polyline points="20,86 26,81 32,85" /><polyline points="60,4 66,9 72,6" /></svg>
      {BRANDS.map((b, k) => <BrandTile b={b} i={k} key={b.slug} />)}
    </div>
  )
}
