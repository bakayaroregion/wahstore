import { useMemo } from 'react'

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

const TILES: { x: number; y: number; c: string; i: IconName; d: number }[] = [
  { x: 4, y: 12, c: '#be123c', i: 'play', d: 7 }, { x: 14, y: 6, c: '#15803d', i: 'music', d: 9 },
  { x: 3, y: 42, c: '#0f766e', i: 'cloud', d: 8 }, { x: 10, y: 60, c: '#a16207', i: 'video', d: 10 },
  { x: 5, y: 82, c: '#be185d', i: 'music', d: 7 }, { x: 15, y: 90, c: '#0e7490', i: 'chat', d: 11 },
  { x: 90, y: 10, c: '#475569', i: 'key', d: 9 }, { x: 80, y: 5, c: '#6d28d9', i: 'chat', d: 8 },
  { x: 94, y: 36, c: '#1e3a8a', i: 'play', d: 10 }, { x: 85, y: 52, c: '#6d28d9', i: 'bot', d: 7 },
  { x: 93, y: 70, c: '#0e7490', i: 'cloud', d: 9 }, { x: 82, y: 86, c: '#9a3412', i: 'book', d: 11 },
  { x: 24, y: 24, c: '#1d4ed8', i: 'edit', d: 12 }, { x: 72, y: 92, c: '#166534', i: 'star', d: 8 },
]

// Latar angkasa dekoratif: bintang, bintang jatuh, dan ubin ikon generik (bukan logo merek).
export function Space() {
  const stars = useMemo(() => {
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 100, z: r() * 2 + 1, o: r() * 0.6 + 0.2 }))
  }, [])
  return (
    <div className="space" aria-hidden="true">
      {stars.map((t, k) => <i className="star" key={k} style={{ left: `${t.x}%`, top: `${t.y}%`, width: t.z, height: t.z, opacity: t.o }} />)}
      {[{ x: 70, y: 8, t: 0 }, { x: 40, y: 30, t: 5 }, { x: 88, y: 55, t: 9 }].map((s, k) => <i className="shoot" key={k} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.t}s` }} />)}
      {TILES.map((t, k) => <span className="tile" key={k} style={{ left: `${t.x}%`, top: `${t.y}%`, background: t.c, animationDuration: `${t.d}s`, animationDelay: `-${k}s` }}><Icon n={t.i} size={18} /></span>)}
    </div>
  )
}
