// Desempeño por toro (Fase E4): de cada toro o semen, hembras servidas, % preñez, partos,
// cabeza/cuerpo/cola, facilidad de parto y peso al destete de las crías. Una sola consulta SQL.
// A quién se atribuye cada servicio:
// - monta natural: el macho cargado en el servicio o, si la torada tiene un solo toro, ese toro;
//   si tiene varios y no se indicó, a la torada («Torada X · N toros»);
// - IA/IATF: la pajuela del inventario o, si no, el toro escrito en el servicio.
// Un tacto cuenta para su servicio (o, sin vincular, para el último servicio previo de la hembra) y
// un parto, para el último servicio de la madre entre gestación − 30 y + 30 días antes.

import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { ReproduccionError } from "./service"

interface FilaToro {
  clave: string; nombre: string | null; tipo: string; servicios: number; servidas: number
  tactadas: number; prenadas: number; partos: number; nacidos_vivos: number; abortos: number
  cabeza: number; cuerpo: number; cola: number; dificultad: number | null; destetados: number; peso_destete: number | null
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null)
const redondear = (n: number | null, dec = 1) => (n == null ? null : Math.round(n * 10 ** dec) / 10 ** dec)

export async function desempenoPorToro(ctx: AuthContext, establecimientoId: string, anio: number, toradaId?: string | null) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const desde = `${anio}-01-01`, hasta = `${anio}-12-31`
  const filas = await prisma.$queryRaw<FilaToro[]>`
    WITH serv AS (
      SELECT s.id, s.hembra_id, s.fecha, s.tipo, s.torada_id, s.producto_semen_id, s.toro_nombre,
        COALESCE(s.macho_id, CASE WHEN s.tipo = 'natural' AND (SELECT COUNT(*) FROM toradas_machos x WHERE x.torada_id = s.torada_id) = 1
          THEN (SELECT x.animal_id FROM toradas_machos x WHERE x.torada_id = s.torada_id LIMIT 1) END) AS macho,
        (CASE WHEN e.nombre IN ('ovino', 'caprino') THEN 150 WHEN e.nombre = 'equino' THEN 340 WHEN e.nombre = 'porcino' THEN 114 ELSE 283 END) AS gest,
        t.fecha_inicio AS inicio_torada
      FROM evt_servicio s
      JOIN animales a ON a.id = s.hembra_id JOIN especies e ON e.id = a.especie_id
      LEFT JOIN toradas t ON t.id = s.torada_id
      WHERE s.establecimiento_id = ${establecimientoId}::uuid AND s.anulado_at IS NULL
        AND s.fecha BETWEEN ${desde}::date AND ${hasta}::date
        AND (${toradaId ?? null}::uuid IS NULL OR s.torada_id = ${toradaId ?? null}::uuid)
    ),
    k AS (
      SELECT serv.*, CASE
        WHEN macho IS NOT NULL THEN 'm:' || macho
        WHEN producto_semen_id IS NOT NULL THEN 's:' || producto_semen_id
        WHEN NULLIF(TRIM(toro_nombre), '') IS NOT NULL THEN 'n:' || LOWER(TRIM(toro_nombre))
        WHEN torada_id IS NOT NULL THEN 't:' || torada_id
        ELSE 'x' END AS clave
      FROM serv
    ),
    tac AS (
      -- El tacto vinculado al servicio o, si se cargó sin vincular, el primero de la hembra dentro
      -- de los 300 días siguientes sin otro servicio en el medio
      SELECT DISTINCT ON (k.id) k.id AS servicio_id, x.resultado
      FROM k JOIN evt_tacto x ON x.hembra_id = k.hembra_id AND x.anulado_at IS NULL AND (
        x.servicio_id = k.id OR (x.servicio_id IS NULL AND x.fecha > k.fecha AND x.fecha <= k.fecha + 300
          AND NOT EXISTS (SELECT 1 FROM evt_servicio s2 WHERE s2.hembra_id = k.hembra_id AND s2.anulado_at IS NULL AND s2.fecha > k.fecha AND s2.fecha < x.fecha)))
      ORDER BY k.id, (x.servicio_id = k.id) DESC NULLS LAST, x.fecha ASC
    ),
    par AS (
      SELECT DISTINCT ON (p.id) p.id, COALESCE(p.parto_id, p.id) AS parto, p.fecha, p.resultado, p.dificultad, p.nacido_animal_id,
        k.clave, (p.fecha - (COALESCE(k.inicio_torada, k.fecha) + k.gest)) AS dias
      FROM evt_paricion p JOIN k ON k.hembra_id = p.madre_id
        AND p.fecha BETWEEN k.fecha + (k.gest - 30) AND k.fecha + (k.gest + 30)
      WHERE p.anulado_at IS NULL
      ORDER BY p.id, k.fecha DESC
    ),
    des AS (
      SELECT par.clave, d.peso_kg FROM par JOIN evt_destete d ON d.animal_id = par.nacido_animal_id AND d.anulado_at IS NULL
    )
    SELECT k.clave,
      CASE
        WHEN k.clave LIKE 'm:%' THEN (SELECT COALESCE(a.caravana_visual, a.cuig, 'Sin caravana') FROM animales a WHERE a.id = MIN(k.macho::text)::uuid)
        WHEN k.clave LIKE 's:%' THEN (SELECT pr.nombre FROM productos pr WHERE pr.id = MIN(k.producto_semen_id::text)::uuid)
        WHEN k.clave LIKE 'n:%' THEN MIN(k.toro_nombre)
        WHEN k.clave LIKE 't:%' THEN (SELECT t.nombre || (CASE (SELECT COUNT(*) FROM toradas_machos x WHERE x.torada_id = t.id) WHEN 0 THEN ' · sin toro indicado' ELSE ' · ' || (SELECT COUNT(*) FROM toradas_machos x WHERE x.torada_id = t.id) || ' toros' END) FROM toradas t WHERE t.id = MIN(k.torada_id::text)::uuid)
        ELSE NULL END AS nombre,
      CASE WHEN BOOL_AND(k.tipo = 'natural') THEN 'natural' WHEN BOOL_AND(k.tipo <> 'natural') THEN 'ia' ELSE 'mixto' END AS tipo,
      COUNT(*)::int AS servicios, COUNT(DISTINCT k.hembra_id)::int AS servidas,
      COUNT(tac.servicio_id) FILTER (WHERE tac.resultado <> 'dudosa')::int AS tactadas,
      COUNT(tac.servicio_id) FILTER (WHERE tac.resultado = 'preñada')::int AS prenadas,
      (SELECT COUNT(DISTINCT par.parto) FROM par WHERE par.clave = k.clave AND par.resultado <> 'aborto')::int AS partos,
      (SELECT COUNT(*) FROM par WHERE par.clave = k.clave AND par.resultado = 'vivo')::int AS nacidos_vivos,
      (SELECT COUNT(*) FROM par WHERE par.clave = k.clave AND par.resultado = 'aborto')::int AS abortos,
      (SELECT COUNT(DISTINCT par.parto) FROM par WHERE par.clave = k.clave AND par.resultado <> 'aborto' AND par.dias <= 21)::int AS cabeza,
      (SELECT COUNT(DISTINCT par.parto) FROM par WHERE par.clave = k.clave AND par.resultado <> 'aborto' AND par.dias BETWEEN 22 AND 42)::int AS cuerpo,
      (SELECT COUNT(DISTINCT par.parto) FROM par WHERE par.clave = k.clave AND par.resultado <> 'aborto' AND par.dias > 42)::int AS cola,
      (SELECT AVG(par.dificultad)::float FROM par WHERE par.clave = k.clave AND par.dificultad IS NOT NULL) AS dificultad,
      (SELECT COUNT(*) FROM des WHERE des.clave = k.clave AND des.peso_kg IS NOT NULL)::int AS destetados,
      (SELECT AVG(des.peso_kg)::float FROM des WHERE des.clave = k.clave) AS peso_destete
    FROM k LEFT JOIN tac ON tac.servicio_id = k.id
    WHERE k.clave <> 'x'
    GROUP BY k.clave`

  const toros = filas.map((f) => {
    const conParto = f.cabeza + f.cuerpo + f.cola
    return {
      clave: f.clave, nombre: f.nombre ?? "Sin identificar", origen: f.clave.startsWith("m:") ? "rodeo" : f.clave.startsWith("s:") ? "pajuela" : f.clave.startsWith("t:") ? "torada" : "texto",
      tipo: f.tipo, servicios: f.servicios, servidas: f.servidas, tactadas: f.tactadas, prenadas: f.prenadas,
      porcentajePrenez: pct(f.prenadas, f.tactadas),
      partos: f.partos, nacidosVivos: f.nacidos_vivos, abortos: f.abortos,
      distribucion: conParto ? { cabeza: pct(f.cabeza, conParto), cuerpo: pct(f.cuerpo, conParto), cola: pct(f.cola, conParto) } : null,
      dificultadParto: redondear(f.dificultad), destetados: f.destetados, pesoDestete: redondear(f.peso_destete, 0),
    }
  })
  // Ranking: mejor % preñez primero (los sin tacto al final), luego más hembras servidas
  toros.sort((a, b) => (b.porcentajePrenez ?? -1) - (a.porcentajePrenez ?? -1) || b.servidas - a.servidas)
  return { anio, toros }
}
