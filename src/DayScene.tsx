import { useMemo } from 'react'
import type { CSSProperties } from 'react'

// Pemandangan siang bergaya Jepang (senja): langit, matahari, awan berlapis, Fuji, pagoda, bukit, sakura.
// Semua gerak memakai transform/opacity (CSS keyframes). Tidak ada library dan tidak ada canvas.

const mk = (seed: number) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

// Garis punggung gunung halus dari titik-titik [x,y] (kurva kuadratik lewat titik tengah).
function ridge(pts: number[][], bottom = 900) {
  let d = `M ${pts[0][0]} ${bottom} L ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2
    d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`
  }
  const l = pts[pts.length - 1]
  return `${d} L ${l[0]} ${l[1]} L ${l[0]} ${bottom} Z`
}

const FAR = [[-800, 330], [-600, 290], [-420, 318], [-250, 262], [-80, 300], [90, 268], [260, 306], [420, 286], [600, 322], [760, 300], [1000, 318], [1180, 280], [1360, 312], [1520, 270], [1700, 308], [1880, 266], [2060, 304], [2250, 276], [2420, 320]]
const MID = [[-800, 410], [-620, 340], [-430, 372], [-250, 304], [-60, 356], [120, 318], [300, 352], [430, 396], [560, 340], [700, 380], [820, 408], [960, 392], [1100, 366], [1220, 396], [1340, 336], [1480, 376], [1650, 324], [1820, 370], [2000, 312], [2200, 372], [2420, 340]]
const HILL1 = (x: number) => 446 + 16 * Math.sin(x / 190) + 9 * Math.sin(x / 83 + 1)
const HILL2 = (x: number) => 478 + 12 * Math.sin(x / 150 + 2) + 6 * Math.sin(x / 61)

function hillPath(f: (x: number) => number) {
  let d = `M -800 560 L -800 ${f(-800).toFixed(1)}`
  for (let x = -760; x <= 2400; x += 40) d += ` L ${x} ${f(x).toFixed(1)}`
  return d + ' L 2400 560 Z'
}

function Pagoda({ x, y, s }: { x: number; y: number; s: number }) {
  const tiers = [0, 1, 2, 3, 4]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#4a4f8c">
      <rect x="-3" y="-128" width="6" height="22" />
      {tiers.map((k) => {
        const w = 30 - k * 4, y0 = -k * 20
        return (
          <g key={k}>
            <rect x={-w * 0.62} y={y0 - 14} width={w * 1.24} height="14" />
            <path d={`M ${-w - 6} ${y0 - 13} Q ${-w * 0.5} ${y0 - 14} 0 ${y0 - 27} Q ${w * 0.5} ${y0 - 14} ${w + 6} ${y0 - 13} Q ${w * 0.5} ${y0 - 9} 0 ${y0 - 10} Q ${-w * 0.5} ${y0 - 9} ${-w - 6} ${y0 - 13} Z`} />
          </g>
        )
      })}
    </g>
  )
}

function Tree({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
      <path d="M0 -44 L-9 -22 H-4 L-13 -2 H-5 L-16 18 H16 L5 -2 H13 L4 -22 H9 Z" />
      <rect x="-2" y="18" width="4" height="7" />
    </g>
  )
}

// Cabang sakura: batang melengkung + gerombol bunga dibuat acak (seed tetap supaya konsisten).
function Blossoms({ pts, seed, n }: { pts: number[][]; seed: number; n: number }) {
  const r = mk(seed)
  const cols = ['#ffd3e0', '#ffbcd2', '#ffe3ec', '#f9a8c4', '#ffc9da']
  const out: JSX.Element[] = []
  pts.forEach((p, i) => {
    for (let k = 0; k < n; k++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 34
      out.push(<circle key={`${i}-${k}`} cx={p[0] + Math.cos(a) * d} cy={p[1] + Math.sin(a) * d * 0.75} r={5 + r() * 9} fill={cols[Math.floor(r() * cols.length)]} opacity={0.72 + r() * 0.26} />)
    }
  })
  return <>{out}</>
}

// Awan: [posisi 0..1, y %, lebar (vw), varian, durasi naik-turun (s), jarak naik-turun (px), jeda (s)]
type Cl = [number, number, number, 'a' | 'b' | 'c', number, number, number]
const LAYERS: { cls: string; dur: number; rev: boolean; clouds: Cl[] }[] = [
  { cls: 'far', dur: 150, rev: false, clouds: [[0.04, 8, 20, 'b', 9, 8, 0], [0.38, 34, 26, 'a', 12, 10, 3], [0.7, 12, 22, 'c', 10, 8, 6]] },
  { cls: 'mid', dur: 78, rev: true, clouds: [[0.0, 44, 34, 'a', 8, 16, 1], [0.46, 8, 30, 'c', 7, 18, 4], [0.78, 52, 36, 'b', 9, 14, 2]] },
  { cls: 'high', dur: 46, rev: false, clouds: [[0.1, 10, 38, 'c', 6, 22, 0], [0.55, 40, 44, 'a', 7, 26, 3]] },
]

const PETALS = 22
const BIRDS = [[16, 11, 0], [24, 15, 9], [10, 19, 5]]

export function DayScene() {
  const petals = useMemo(() => {
    const r = mk(77)
    return Array.from({ length: PETALS }, (_, i) => ({
      x: 35 + r() * 75, sz: 8 + r() * 8, dur: 14 + r() * 14, dl: r() * 24, dx: 22 + r() * 40, sw: 2.6 + r() * 2.6, rot: 220 + r() * 360, hue: i % 3,
    }))
  }, [])

  return (
    <div className="day" aria-hidden="true">
      <div className="d-sky" />
      <div className="d-glow" />

      {/* awan paling jauh: kecil, lambat, di atas matahari */}
      <Clouds {...LAYERS[0]} />

      {/* matahari senja di atas garis gunung */}
      <div className="lbox sunbox">
        <div className="sun2"><i className="halo" /><i className="rays" /><i className="disc" /></div>
      </div>

      {/* awan tengah dan awan tinggi: melintas di depan matahari */}
      <Clouds {...LAYERS[1]} />
      <Clouds {...LAYERS[2]} />

      {/* pegunungan */}
      <div className="lbox land">
        <svg viewBox="0 0 1600 500" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="dFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a9a6dc" /><stop offset="1" stopColor="#f6cbbd" /></linearGradient>
            <linearGradient id="dFuji" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6670c4" /><stop offset=".6" stopColor="#8a82c2" /><stop offset="1" stopColor="#dfa3b4" /></linearGradient>
            <linearGradient id="dMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6872b4" /><stop offset="1" stopColor="#a995c3" /></linearGradient>
            <linearGradient id="dShade" gradientUnits="userSpaceOnUse" x1="640" y1="0" x2="1100" y2="0"><stop offset="0" stopColor="#3f3c8c" stopOpacity=".34" /><stop offset=".5" stopColor="#3f3c8c" stopOpacity="0" /><stop offset=".62" stopColor="#ffc88a" stopOpacity="0" /><stop offset="1" stopColor="#ffc88a" stopOpacity=".42" /></linearGradient>
            <clipPath id="dFujiClip"><path d="M 360 440 C 470 410 580 330 665 235 C 735 160 800 122 842 114 Q 880 104 918 114 C 960 122 1025 160 1095 235 C 1180 330 1290 410 1400 440 L 1400 500 L 360 500 Z" /></clipPath>
          </defs>
          <path d={ridge(FAR)} fill="url(#dFar)" opacity=".85" />
          <g>
            <path d="M 360 440 C 470 410 580 330 665 235 C 735 160 800 122 842 114 Q 880 104 918 114 C 960 122 1025 160 1095 235 C 1180 330 1290 410 1400 440 L 1400 500 L 360 500 Z" fill="url(#dFuji)" />
            <g clipPath="url(#dFujiClip)">
              <path d="M 620 262 Q 665 222 700 250 Q 735 205 775 238 Q 810 198 845 236 Q 880 200 920 240 Q 960 205 1000 242 Q 1040 214 1075 248 Q 1100 232 1140 266 L 1140 60 L 620 60 Z" fill="#fff6f4" />
              <rect x="560" y="90" width="660" height="420" fill="url(#dShade)" />
            </g>
          </g>
          <path d={ridge(MID)} fill="url(#dMid)" />
          <Pagoda x={300} y={354} s={0.62} />
        </svg>
        <i className="mist m1" />
        <i className="mist m2" />
      </div>

      <div className="lbox near">
        <svg viewBox="0 0 1600 500" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
          <path d={hillPath(HILL1)} fill="#78a877" />
          {[-300, -190, -90, 40, 130, 1480, 1580, 1690, 1800].map((x, k) => <Tree key={x} x={x} y={HILL1(x) + 8} s={0.7 + (k % 3) * 0.16} c="#4f8564" />)}
          <path d={hillPath(HILL2)} fill="#3f7556" />
          {[-420, -240, -30, 210, 330, 560, 760, 980, 1220, 1360, 1960].map((x, k) => <Tree key={x} x={x} y={HILL2(x) + 10} s={0.95 + (k % 4) * 0.2} c="#2f5d49" />)}
        </svg>
        <i className="mist m3" />
      </div>

      {/* sakura di tepi kanan dan cabang di sudut kiri atas */}
      <svg className="sakura" viewBox="0 0 420 640">
        <g className="sw">
          <path d="M 250 640 C 262 560 230 500 246 430 C 256 380 300 330 312 262 C 318 230 310 200 296 170 M 246 440 C 200 410 150 396 96 340 M 290 300 C 340 270 372 240 398 196 M 262 500 C 310 480 350 470 392 430" fill="none" stroke="#5a3b3a" strokeWidth="14" strokeLinecap="round" />
          <Blossoms pts={[[296, 150], [330, 210], [236, 214], [150, 330], [96, 330], [380, 190], [330, 300], [300, 110], [250, 270], [390, 420], [344, 456], [180, 392]]} seed={5} n={9} />
        </g>
      </svg>
      <svg className="branch" viewBox="0 0 380 240">
        <g className="sw2">
          <path d="M -10 20 C 80 40 150 60 230 110 C 280 140 320 150 360 190 M 120 52 C 150 90 150 120 170 160 M 200 92 C 230 70 270 60 330 70" fill="none" stroke="#5a3b3a" strokeWidth="9" strokeLinecap="round" />
          <Blossoms pts={[[60, 42], [130, 60], [220, 100], [300, 150], [350, 190], [172, 168], [286, 66], [334, 74]]} seed={9} n={7} />
        </g>
      </svg>

      {/* kelopak sakura tertiup angin */}
      {petals.map((p, k) => (
        <span className="petal" key={k} style={{ left: `${p.x}%`, '--dx': `-${p.dx}vw`, animationDuration: `${p.dur}s`, animationDelay: `-${p.dl}s` } as CSSProperties}>
          <i className={`pt h${p.hue}`} style={{ width: p.sz, height: p.sz * 0.8, animationDuration: `${p.sw}s`, '--rot': `${p.rot}deg` } as CSSProperties} />
        </span>
      ))}

      {BIRDS.map((b, k) => (
        <svg className="bird" key={k} viewBox="0 0 40 20" style={{ top: `${b[1]}%`, animationDuration: `${24 + k * 5}s`, animationDelay: `-${b[2]}s` }}>
          <path d="M2 14Q10 2 20 12Q30 2 38 14" />
        </svg>
      ))}
    </div>
  )
}

function Clouds({ cls, dur, rev, clouds }: { cls: string; dur: number; rev: boolean; clouds: Cl[] }) {
  const half = (key: string) => (
    <div className="chalf" key={key}>
      {clouds.map((c, k) => (
        <span className="cl" key={k} style={{ '--f': c[0], '--y': `${c[1]}%`, '--w': `${c[2]}vw`, '--amp': `${c[5]}px`, '--bob': `${c[4]}s`, '--dl': `-${c[6]}s` } as CSSProperties}>
          <i className={c[3]} />
        </span>
      ))}
    </div>
  )
  return (
    <div className={`clayer ${cls}`}>
      <div className={`ctrack${rev ? ' rv' : ''}`} style={{ animationDuration: `${dur}s` }}>{half('a')}{half('b')}</div>
    </div>
  )
}
