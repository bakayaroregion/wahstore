// POST /functions/v1/check-order  { order_number, token }
// Jawaban gagal selalu sama (404) supaya tidak membocorkan apakah nomor pesanan ada.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("STORE_BASE_URL") ?? "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const Body = z.object({ order_number: z.string().trim().min(6).max(40), token: z.string().trim().min(20).max(80) });

async function hashToken(t: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode((Deno.env.get("ORDER_TOKEN_PEPPER") ?? "") + t));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), l = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  l.push(now); hits.set(ip, l); return l.length > 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  if (limited(req.headers.get("x-forwarded-for") ?? "unknown")) return json({ error: "Terlalu banyak percobaan." }, 429);
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: "Pesanan tidak ditemukan." }, 404);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await db.rpc("check_order", { p_number: p.data.order_number, p_token_hash: await hashToken(p.data.token) });
  return data ? json(data) : json({ error: "Pesanan tidak ditemukan." }, 404);
});
