// Gasto real del asistente según cada proveedor (solo lectura):
// - Anthropic: Usage & Cost Admin API (`/v1/organizations/cost_report`). Necesita una clave de
//   administrador (ANTHROPIC_ADMIN_KEY, `sk-ant-admin…`): la clave del asistente no sirve. El
//   informe es de toda la organización; ANTHROPIC_WORKSPACE_ID lo limita a un espacio de trabajo.
// - Meta: `pricing_analytics` de la cuenta de WhatsApp Business (WHATSAPP_WABA_ID), con el
//   mismo token del asistente (permiso whatsapp_business_management).
// Cada proveedor se consulta como mucho una vez cada 10 minutos por período (caché en memoria).

import { whatsappConfig } from "./config"

export type EstadoCosto = "ok" | "sin_configurar" | "error"

export interface CostosAnthropic {
  estado: EstadoCosto
  mensaje?: string
  totalUsd: number
  porModelo: { modelo: string; usd: number }[]
  porTipo: { tipo: string; usd: number }[]
  porDia: { dia: string; usd: number }[]
}

export interface CostosMeta {
  estado: EstadoCosto
  mensaje?: string
  moneda: string
  total: number
  mensajes: number
  mensajesGratis: number
  porCategoria: { categoria: string; mensajes: number; costo: number }[]
}

const CACHE_MS = 10 * 60_000
const cache = new Map<string, { hasta: number; valor: unknown }>()

async function conCache<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const c = cache.get(clave)
  if (c && c.hasta > Date.now()) return c.valor as T
  const valor = await fn()
  // Los errores no se guardan: el próximo intento vuelve a consultar
  if ((valor as { estado?: string }).estado !== "error") cache.set(clave, { hasta: Date.now() + CACHE_MS, valor })
  return valor
}

const error = (e: unknown) => (e instanceof Error ? e.message : "No se pudo consultar")

// ---------------------------------------------------------------- Anthropic

interface CostoResultado { amount: string; model: string | null; token_type: string | null; cost_type: string | null; workspace_id: string | null }
interface CostoPagina { data: { starting_at: string; results: CostoResultado[] }[]; has_more: boolean; next_page: string | null }

const TIPO_TOKEN: Record<string, string> = {
  uncached_input_tokens: "Entrada",
  output_tokens: "Salida",
  cache_read_input_tokens: "Lectura de caché",
  "cache_creation.ephemeral_5m_input_tokens": "Escritura de caché",
  "cache_creation.ephemeral_1h_input_tokens": "Escritura de caché",
}

/** `desde` y `hasta` son días (YYYY-MM-DD); los buckets de Anthropic son días UTC. */
export function costosAnthropic(desde: string, hasta: string, f: typeof fetch = fetch): Promise<CostosAnthropic> {
  const vacio = { totalUsd: 0, porModelo: [], porTipo: [], porDia: [] }
  const clave = process.env.ANTHROPIC_ADMIN_KEY
  if (!clave) return Promise.resolve({ estado: "sin_configurar", ...vacio })
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID || null
  return conCache(`anthropic:${desde}:${hasta}:${workspace}`, async () => {
    try {
      const fin = new Date(new Date(`${hasta}T00:00:00Z`).getTime() + 86_400_000).toISOString()
      const resultados: (CostoResultado & { dia: string })[] = []
      let pagina: string | null = null
      // 31 días por página; 90 días = 3 páginas (tope 5 por las dudas)
      for (let i = 0; i < 5; i++) {
        const q = new URLSearchParams({ starting_at: `${desde}T00:00:00Z`, ending_at: fin, bucket_width: "1d", limit: "31" })
        q.append("group_by[]", "description")
        if (workspace) q.append("group_by[]", "workspace_id")
        if (pagina) q.set("page", pagina)
        const res = await f(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, {
          headers: { "x-api-key": clave, "anthropic-version": "2023-06-01", "User-Agent": "AgroMonitor/1.0" },
          signal: AbortSignal.timeout(15_000),
        })
        const json = (await res.json().catch(() => ({}))) as Partial<CostoPagina> & { error?: { message?: string } }
        if (!res.ok) throw new Error(json.error?.message ?? `Anthropic respondió ${res.status}`)
        for (const b of json.data ?? []) for (const r of b.results) resultados.push({ ...r, dia: b.starting_at.slice(0, 10) })
        if (!json.has_more || !json.next_page) break
        pagina = json.next_page
      }
      const propios = workspace ? resultados.filter((r) => r.workspace_id === workspace) : resultados
      const sumar = (clave: (r: CostoResultado & { dia: string }) => string) => {
        const m = new Map<string, number>()
        // amount viene en centavos de USD, como texto decimal
        for (const r of propios) m.set(clave(r), (m.get(clave(r)) ?? 0) + Number(r.amount) / 100)
        return [...m.entries()].map(([k, usd]) => ({ k, usd })).sort((a, b) => b.usd - a.usd)
      }
      return {
        estado: "ok" as const,
        totalUsd: propios.reduce((s, r) => s + Number(r.amount) / 100, 0),
        porModelo: sumar((r) => r.model ?? (r.cost_type === "web_search" ? "Búsqueda web" : "Otros")).map(({ k, usd }) => ({ modelo: k, usd })),
        porTipo: sumar((r) => (r.token_type ? TIPO_TOKEN[r.token_type] ?? r.token_type : "Otros")).map(({ k, usd }) => ({ tipo: k, usd })),
        porDia: sumar((r) => r.dia).map(({ k, usd }) => ({ dia: k, usd })).sort((a, b) => a.dia.localeCompare(b.dia)),
      }
    } catch (e) {
      return { estado: "error" as const, mensaje: error(e), ...vacio }
    }
  })
}

// ---------------------------------------------------------------- Meta

interface PuntoPrecio { start?: number; volume?: number; cost?: number; pricing_type?: string; pricing_category?: string }

const CATEGORIA: Record<string, string> = {
  SERVICE: "Servicio (respuestas)",
  UTILITY: "Utilidad (avisos)",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticación",
  AUTHENTICATION_INTERNATIONAL: "Autenticación internacional",
  REFERRAL_CONVERSION: "Desde anuncios",
}

export function costosMeta(desde: string, hasta: string, f: typeof fetch = fetch): Promise<CostosMeta> {
  const vacio = { moneda: "USD", total: 0, mensajes: 0, mensajesGratis: 0, porCategoria: [] }
  const c = whatsappConfig()
  const waba = process.env.WHATSAPP_WABA_ID
  if (!waba || !c.token) return Promise.resolve({ estado: "sin_configurar", ...vacio })
  return conCache(`meta:${desde}:${hasta}`, async () => {
    try {
      const inicio = Math.floor(new Date(`${desde}T03:00:00Z`).getTime() / 1000) // 00:00 de Argentina
      const fin = Math.floor(new Date(`${hasta}T03:00:00Z`).getTime() / 1000) + 86_400
      const campo = `pricing_analytics.start(${inicio}).end(${fin}).granularity(DAILY).dimensions(["PRICING_CATEGORY","PRICING_TYPE"])`
      const q = new URLSearchParams({ fields: `currency,${campo}` })
      const res = await f(`https://graph.facebook.com/${c.graphVersion}/${waba}?${q}`, {
        headers: { Authorization: `Bearer ${c.token}` },
        signal: AbortSignal.timeout(15_000),
      })
      const json = (await res.json().catch(() => ({}))) as {
        currency?: string
        pricing_analytics?: { data?: { data_points?: PuntoPrecio[] }[] }
        error?: { message?: string }
      }
      if (!res.ok) throw new Error(json.error?.message ?? `Meta respondió ${res.status}`)
      const puntos = (json.pricing_analytics?.data ?? []).flatMap((d) => d.data_points ?? [])
      const cat = new Map<string, { mensajes: number; costo: number }>()
      let total = 0, mensajes = 0, gratis = 0
      for (const p of puntos) {
        const vol = Number(p.volume ?? 0), costo = Number(p.cost ?? 0)
        total += costo
        mensajes += vol
        if (p.pricing_type?.startsWith("FREE")) gratis += vol
        const k = CATEGORIA[p.pricing_category ?? ""] ?? p.pricing_category ?? "Otros"
        const a = cat.get(k) ?? { mensajes: 0, costo: 0 }
        cat.set(k, { mensajes: a.mensajes + vol, costo: a.costo + costo })
      }
      return {
        estado: "ok" as const,
        moneda: json.currency ?? "USD",
        total,
        mensajes,
        mensajesGratis: gratis,
        porCategoria: [...cat.entries()].map(([categoria, v]) => ({ categoria, ...v })).sort((a, b) => b.mensajes - a.mensajes),
      }
    } catch (e) {
      return { estado: "error" as const, mensaje: error(e), ...vacio }
    }
  })
}

/** Solo para tests */
export const limpiarCacheCostos = () => cache.clear()
