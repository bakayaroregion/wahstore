import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const rupiah = (n: number) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export interface Product {
  id: string; name: string; slug: string; sku: string; short_description: string | null; description?: string | null
  price: number; compare_at_price: number | null; labels: string[]; category_id: string | null
  categories?: { name: string } | null; logo_url?: string | null
}
export interface CartItem { product_id: string; name: string; price: number; qty: number }

export const STATUS: Record<string, string> = {
  PENDING: 'Menunggu konfirmasi', CONFIRMED: 'Dikonfirmasi', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan',
  UNPAID: 'Belum dibayar', AWAITING_VERIFICATION: 'Menunggu verifikasi', PAID: 'Lunas', FAILED: 'Gagal', REFUNDED: 'Dikembalikan',
  NOT_STARTED: 'Belum diproses', PROCESSING: 'Sedang diproses', DELIVERED: 'Sudah dikirim',
}

function read<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) || '') as T } catch { return d } }
export function write(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* penyimpanan tidak tersedia */ } }
export { read }

// Keranjang hanya kenyamanan. Harga dan total final selalu dihitung ulang server.
let cart: CartItem[] = read<CartItem[]>('ws_cart', [])
const subs = new Set<() => void>()
function set(c: CartItem[]) { cart = c; write('ws_cart', c); subs.forEach((f) => f()) }
export const cartApi = {
  add(p: Product) {
    const ex = cart.find((i) => i.product_id === p.id)
    set(ex ? cart.map((i) => i === ex ? { ...i, qty: Math.min(i.qty + 1, 100) } : i) : [...cart, { product_id: p.id, name: p.name, price: p.price, qty: 1 }])
  },
  setQty(id: string, qty: number) { set(cart.map((i) => i.product_id === id ? { ...i, qty: Math.max(1, Math.min(qty, 100)) } : i)) },
  remove(id: string) { set(cart.filter((i) => i.product_id !== id)) },
  clear() { set([]) },
}
export const useCart = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => cart)

// undefined = sedang memuat, null = belum masuk
export function useSession() {
  const [s, setS] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setS(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, x) => setS(x))
    return () => data.subscription.unsubscribe()
  }, [])
  return s
}

export interface Brand { name: string; tagline: string; logo: string; favicon: string }
function applyFavicon(url: string) {
  if (!url) return
  for (const rel of ['icon', 'apple-touch-icon']) {
    let l = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l) }
    l.href = url
  }
}
let brandCache: Brand | null = null
export function useBrand() {
  const [b, setB] = useState<Brand>(brandCache ?? { name: 'WAHYU STORE', tagline: 'Toko Produk Digital', logo: '', favicon: '' })
  useEffect(() => {
    supabase.from('store_settings').select('key,value').in('key', ['brand_name', 'brand_tagline', 'brand_logo_url', 'brand_favicon_url']).then(({ data }) => {
      const m: Record<string, string> = {}
      ;(data ?? []).forEach((r) => { m[r.key] = String(r.value ?? '') })
      const nb = { name: m.brand_name || 'WAHYU STORE', tagline: m.brand_tagline || 'Toko Produk Digital', logo: m.brand_logo_url || '', favicon: m.brand_favicon_url || '' }
      applyFavicon(nb.favicon)
      brandCache = nb; setB(nb)
    })
  }, [])
  return b
}

// Jika pelanggan masuk tanpa "Ingat saya", keluarkan sesi saat browser dibuka kembali.
export function resetEphemeralSession() {
  try {
    if (localStorage.getItem('ws_ephemeral') === '1' && !sessionStorage.getItem('ws_alive')) {
      localStorage.removeItem('ws_ephemeral')
      supabase.auth.signOut()
    }
  } catch { /* penyimpanan tidak tersedia */ }
}

// Favorit disimpan di perangkat pelanggan saja.
let favs: string[] = read<string[]>('ws_favs', [])
const favSubs = new Set<() => void>()
export const favApi = {
  toggle(id: string) {
    favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id].slice(-200)
    write('ws_favs', favs); favSubs.forEach((f) => f())
  },
}
export const useFavs = () => useSyncExternalStore((cb) => { favSubs.add(cb); return () => { favSubs.delete(cb) } }, () => favs)
