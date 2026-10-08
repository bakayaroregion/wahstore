import { useSyncExternalStore } from 'react'

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
