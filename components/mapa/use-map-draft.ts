"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { z } from "zod"
import type { MapDraft } from "@/lib/mapa/types"
const schema = z.object({ id: z.string().uuid().optional(), version: z.number().int().positive().optional(), nombre: z.string().max(120), tipo: z.string().max(40), descripcion: z.string().max(3000), kind: z.enum(["Point", "Polygon", "LineString"]), drawing: z.boolean(), vertices: z.array(z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-85).max(85)])).max(500) })
export function useMapDraft(fieldId: string) {
  const { data: session } = useSession()
  const key = session?.user?.id ? `agromonitor:map-draft:${session.user.id}:${fieldId}` : ""
  const [draft, setDraft] = useState<MapDraft | null>(null), [loaded, setLoaded] = useState("")
  const [recovered, setRecovered] = useState(false), [storageError, setStorageError] = useState(false), [online, setOnline] = useState(true)
  useEffect(() => {
    if (!key) return
    try { const raw = localStorage.getItem(key); const parsed = raw ? schema.safeParse(JSON.parse(raw)) : null; setDraft(parsed?.success ? parsed.data : null); setRecovered(!!parsed?.success) } catch { setStorageError(true) }
    setLoaded(key)
  }, [key])
  useEffect(() => {
    if (!key || loaded !== key) return
    try { if (draft) localStorage.setItem(key, JSON.stringify(draft)); else { localStorage.removeItem(key); setRecovered(false) }; setStorageError(false) } catch { setStorageError(true) }
  }, [draft, key, loaded])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine); update()
    window.addEventListener("online", update); window.addEventListener("offline", update)
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update) }
  }, [])
  useEffect(() => {
    if (!draft || !storageError) return
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent)
  }, [draft, storageError])
  return { draft, setDraft, recovered, storageError, online }
}
