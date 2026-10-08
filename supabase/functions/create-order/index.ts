// POST /functions/v1/create-order
// Harga, stok, dan kupon dihitung ulang di database (create_order). Total dari browser tidak dipercaya.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("STORE_BASE_URL") ?? "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional(),
  coupon: z.string().trim().max(40).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(), variant_id: z.string().uuid().nullish(), quantity: z.number().int().min(1).max(100),
  })).min(1).max(20),
});

function normPhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d;
  return /^\d{9,15}$/.test(d) ? d : null;
}
const b64url = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hashToken(t: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode((Deno.env.get("ORDER_TOKEN_PEPPER") ?? "") + t));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Pembatas sederhana per instance. Untuk produksi, pindahkan ke tabel/Redis agar berlaku lintas instance.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), l = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  l.push(now); hits.set(ip, l); return l.length > 5;
}

const ERR: Record<string, string> = {
  PRODUCT_UNAVAILABLE: "Produk tidak tersedia.", VARIANT_UNAVAILABLE: "Varian tidak tersedia.", OUT_OF_STOCK: "Stok tidak mencukupi.",
  COUPON_INVALID: "Kupon tidak valid.", COUPON_EXHAUSTED: "Kuota kupon habis.", COUPON_MIN_PURCHASE: "Belum memenuhi minimum belanja kupon.",
  INVALID_QUANTITY: "Jumlah tidak valid.", INVALID_ITEMS: "Keranjang tidak valid.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  if (limited(req.headers.get("x-forwarded-for") ?? "unknown")) return json({ error: "Terlalu banyak percobaan. Coba lagi sebentar." }, 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Data tidak valid.", fields: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data, phone = normPhone(b.phone);
  if (!phone) return json({ error: "Nomor WhatsApp tidak valid." }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const { data, error } = await db.rpc("create_order", {
    p_name: b.name, p_phone: phone, p_email: b.email ?? "", p_note: b.note ?? "", p_coupon: b.coupon ?? "",
    p_items: b.items, p_token_hash: await hashToken(token),
  });
  if (error) {
    const code = Object.keys(ERR).find((k) => error.message.includes(k));
    return json({ error: code ? ERR[code] : "Pesanan gagal dibuat." }, code ? 400 : 500);
  }
  const o = data[0];

  const { data: rows } = await db.from("store_settings").select("key,value").in("key", ["whatsapp_number", "wa_checkout_template"]);
  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
  const { data: items } = await db.from("order_items").select("name_snapshot,variant_snapshot,quantity").eq("order_id", o.order_id);
  const summary = (items ?? []).map((i) => `${i.name_snapshot}${i.variant_snapshot ? ` (${i.variant_snapshot})` : ""} x${i.quantity}`).join(", ");
  const rupiah = "Rp " + Number(o.grand_total).toLocaleString("id-ID");
  const tpl: string = s.wa_checkout_template ??
    "Halo Admin, saya ingin melakukan pemesanan.\n\nNomor Pesanan: {ORDER_NUMBER}\nNama: {CUSTOMER_NAME}\nProduk: {PRODUCT_SUMMARY}\nTotal: {FORMATTED_TOTAL}\nCatatan: {CUSTOMER_NOTE}\n\nMohon petunjuk pembayaran dan konfirmasi pesanan. Terima kasih.";
  const msg = tpl.replaceAll("{ORDER_NUMBER}", o.order_number).replaceAll("{CUSTOMER_NAME}", b.name)
    .replaceAll("{PRODUCT_SUMMARY}", summary).replaceAll("{FORMATTED_TOTAL}", rupiah).replaceAll("{CUSTOMER_NOTE}", b.note || "-");
  const num = String(s.whatsapp_number ?? "").replace(/\D/g, "");
  const wa_url = /^\d{8,15}$/.test(num) ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : null;

  // Token hanya dikembalikan sekali ini; simpan di sisi pembeli untuk halaman Cek Pesanan.
  return json({ order_number: o.order_number, access_token: token, subtotal: o.subtotal, discount_total: o.discount_total,
    grand_total: o.grand_total, status: "PENDING", payment_status: "UNPAID", wa_url,
    warning: wa_url ? null : "Nomor WhatsApp toko belum diatur di admin." }, 201);
});
