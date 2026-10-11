// Indicadores reproductivos (spec 03 §3.5), por torada/encarnerada (cada una es una campaña),
// calculados en una sola consulta SQL:
// - hembras entoradas: las cargadas en la torada o, si no, las servidas en ella;
// - % preñez (último tacto de cada servida dentro de los 300 días), % parición, % destete y,
//   en ovinos, % señalada; todos sobre las entoradas;
// - pérdidas tacto→parto y parto→destete, % de mellizos, cabeza/cuerpo/cola de parición
//   (21 días cada tramo desde inicio de torada + gestación) y kg destetados por hembra entorada;
// - del campo: intervalo entre partos (últimos 3 años).

import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { ReproduccionError } from "./service"
import { DIAS_GESTACION, tipoGrupoDeEspecie } from "./validation"

interface FilaTorada {
  id: string; nombre: string; tipo: string; tipo_grupo: string; fecha_inicio: Date; fecha_fin: Date | null; cantidad_hembras: number | null
  lote: string; especie: string
  servidas: number; tactadas: number; prenadas: number; paridas: number; abortos: number; nacidos_vivos: number; nacidos_muertos: number
  partos: number; mellizos: number; cabeza: number; cuerpo: number; cola: number; destetados: number; kg_destetados: number | null
  senalados: number; muertos_presenalada: number
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null)

export async function indicadoresReproductivos(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const hoy = hoyArgentina()
  const hace3 = `${Number(hoy.slice(0, 4)) - 3}${hoy.slice(4)}`
  const [filas, intervalo] = await Promise.all([
    prisma.$queryRaw<FilaTorada[]>`
      WITH tor AS (
        SELECT t.id, t.nombre, t.tipo, t.tipo_grupo, t.fecha_inicio, t.fecha_fin, t.cantidad_hembras, l.nombre AS lote, e.nombre AS especie,
          (CASE WHEN e.nombre IN ('ovino', 'caprino') THEN 150 WHEN e.nombre = 'equino' THEN 340 WHEN e.nombre = 'porcino' THEN 114 ELSE 283 END) AS gest
        FROM toradas t JOIN lotes l ON l.id = t.lote_id JOIN especies e ON e.id = l.especie_id
        WHERE l.establecimiento_id = ${establecimientoId}::uuid
      ),
      serv AS (
        SELECT s.torada_id, s.hembra_id, MIN(s.fecha) AS primer, MAX(s.fecha) AS ultimo
        FROM evt_servicio s WHERE s.anulado_at IS NULL AND s.torada_id IN (SELECT id FROM tor) GROUP BY 1, 2
      ),
      tac AS (
        SELECT DISTINCT ON (sv.torada_id, sv.hembra_id) sv.torada_id, sv.hembra_id, x.resultado
        FROM serv sv JOIN evt_tacto x ON x.hembra_id = sv.hembra_id AND x.anulado_at IS NULL AND x.fecha >= sv.primer AND x.fecha <= sv.primer + 300
        ORDER BY sv.torada_id, sv.hembra_id, x.fecha DESC, x.created_at DESC
      ),
      par AS (
        SELECT sv.torada_id, p.id, p.madre_id, p.fecha, p.resultado, p.parto_id, p.nacido_animal_id, (p.fecha - (tor.fecha_inicio + tor.gest)) AS dias_parición
        FROM serv sv JOIN tor ON tor.id = sv.torada_id
        JOIN evt_paricion p ON p.madre_id = sv.hembra_id AND p.anulado_at IS NULL
          AND p.fecha >= sv.primer + (tor.gest - 45) AND p.fecha <= sv.ultimo + (tor.gest + 30)
      ),
      primer_parto AS (
        SELECT DISTINCT ON (torada_id, madre_id) torada_id, madre_id, dias_parición FROM par WHERE resultado <> 'aborto' ORDER BY torada_id, madre_id, fecha
      ),
      dest AS (
        SELECT par.torada_id, d.peso_kg FROM par JOIN evt_destete d ON d.animal_id = par.nacido_animal_id AND d.anulado_at IS NULL
      )
      SELECT tor.id, tor.nombre, tor.tipo, tor.tipo_grupo, tor.fecha_inicio, tor.fecha_fin, tor.cantidad_hembras, tor.lote, tor.especie,
        (SELECT COUNT(*) FROM serv WHERE serv.torada_id = tor.id)::int AS servidas,
        (SELECT COUNT(*) FROM tac WHERE tac.torada_id = tor.id)::int AS tactadas,
        (SELECT COUNT(*) FROM tac WHERE tac.torada_id = tor.id AND tac.resultado = 'preñada')::int AS prenadas,
        (SELECT COUNT(DISTINCT madre_id) FROM par WHERE par.torada_id = tor.id AND par.resultado <> 'aborto')::int AS paridas,
        (SELECT COUNT(*) FROM par WHERE par.torada_id = tor.id AND par.resultado = 'aborto')::int AS abortos,
        (SELECT COUNT(*) FROM par WHERE par.torada_id = tor.id AND par.resultado = 'vivo')::int AS nacidos_vivos,
        (SELECT COUNT(*) FROM par WHERE par.torada_id = tor.id AND par.resultado = 'muerto')::int AS nacidos_muertos,
        (SELECT COUNT(DISTINCT COALESCE(parto_id, id)) FROM par WHERE par.torada_id = tor.id AND par.resultado <> 'aborto')::int AS partos,
        (SELECT COUNT(*) FROM (SELECT parto_id FROM par WHERE par.torada_id = tor.id AND parto_id IS NOT NULL AND resultado <> 'aborto' GROUP BY parto_id HAVING COUNT(*) > 1) m)::int AS mellizos,
        (SELECT COUNT(*) FROM primer_parto pp WHERE pp.torada_id = tor.id AND pp.dias_parición <= 21)::int AS cabeza,
        (SELECT COUNT(*) FROM primer_parto pp WHERE pp.torada_id = tor.id AND pp.dias_parición BETWEEN 22 AND 42)::int AS cuerpo,
        (SELECT COUNT(*) FROM primer_parto pp WHERE pp.torada_id = tor.id AND pp.dias_parición > 42)::int AS cola,
        (SELECT COUNT(*) FROM dest WHERE dest.torada_id = tor.id)::int AS destetados,
        (SELECT SUM(peso_kg) FROM dest WHERE dest.torada_id = tor.id)::float AS kg_destetados,
        (SELECT COALESCE(SUM(corderos_senalados), 0) FROM evt_senalada s WHERE s.torada_id = tor.id AND s.anulado_at IS NULL)::int AS senalados,
        (SELECT COALESCE(SUM(corderos_muertos), 0) FROM evt_senalada s WHERE s.torada_id = tor.id AND s.anulado_at IS NULL)::int AS muertos_presenalada
      FROM tor
      ORDER BY tor.fecha_inicio DESC
      LIMIT 30`,
    prisma.$queryRaw<{ promedio: number | null; casos: number }[]>`
      SELECT AVG(d)::float AS promedio, COUNT(d)::int AS casos FROM (
        SELECT p.fecha - LAG(p.fecha) OVER (PARTITION BY p.madre_id ORDER BY p.fecha) AS d
        FROM (
          SELECT DISTINCT p.madre_id, p.fecha FROM evt_paricion p JOIN animales a ON a.id = p.madre_id
          WHERE a.establecimiento_id = ${establecimientoId}::uuid AND p.anulado_at IS NULL AND p.resultado <> 'aborto' AND p.fecha >= ${hace3}::date
        ) p
      ) x WHERE d IS NOT NULL AND d > 100`,
  ])

  const toradas = filas.map((f) => {
    const entoradas = f.cantidad_hembras ?? f.servidas
    const ovino = tipoGrupoDeEspecie(f.especie) === "encarnerada"
    const conParto = f.cabeza + f.cuerpo + f.cola
    return {
      id: f.id, nombre: f.nombre, tipo: f.tipo, tipoGrupo: f.tipo_grupo, lote: f.lote, especie: f.especie,
      fechaInicio: f.fecha_inicio.toISOString().slice(0, 10), fechaFin: f.fecha_fin ? f.fecha_fin.toISOString().slice(0, 10) : null,
      gestacionDias: DIAS_GESTACION[f.especie.toLowerCase()] ?? DIAS_GESTACION.bovino,
      entoradas, servidas: f.servidas, tactadas: f.tactadas, prenadas: f.prenadas, paridas: f.paridas, abortos: f.abortos,
      nacidosVivos: f.nacidos_vivos, nacidosMuertos: f.nacidos_muertos, destetados: f.destetados, senalados: f.senalados,
      porcentaje: {
        prenez: f.tactadas ? pct(f.prenadas, entoradas) : null,
        paricion: f.partos || f.abortos ? pct(f.paridas, entoradas) : null,
        destete: f.destetados ? pct(f.destetados, entoradas) : null,
        senalada: ovino && f.senalados ? pct(f.senalados, entoradas) : null,
        mellizos: f.partos ? pct(f.mellizos, f.partos) : null,
      },
      // Las pérdidas recién tienen sentido cuando hay partos (y destetes) cargados
      perdidas: {
        tactoParto: f.prenadas && (f.partos || f.abortos) ? pct(Math.max(0, f.prenadas - f.paridas), f.prenadas) : null,
        partoDestete: f.nacidos_vivos && f.destetados ? pct(Math.max(0, f.nacidos_vivos - f.destetados), f.nacidos_vivos) : null,
        preSenalada: ovino && f.senalados ? f.muertos_presenalada : null,
      },
      distribucion: conParto ? { cabeza: pct(f.cabeza, conParto), cuerpo: pct(f.cuerpo, conParto), cola: pct(f.cola, conParto), partos: conParto } : null,
      kgDestetadosPorHembra: f.kg_destetados && entoradas ? Math.round((f.kg_destetados / entoradas) * 10) / 10 : null,
    }
  })
  return {
    toradas,
    intervaloEntrePartos: intervalo[0]?.casos ? { dias: Math.round(intervalo[0].promedio ?? 0), casos: intervalo[0].casos } : null,
  }
}
