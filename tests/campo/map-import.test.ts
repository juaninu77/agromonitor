import { describe, expect, it } from "vitest"
import { parsearXml, descendientes, textoDe } from "@/lib/mapa/xml"
import { inferirTipo, nombresLibres, parseMapImport, tipoCompatible, tipoDesdeTexto } from "@/lib/mapa/import"

const cuadrado = (x: number, y: number, d = 0.01) => `${x},${y},0 ${x + d},${y},0 ${x + d},${y + d},0 ${x},${y + d},0 ${x},${y},0`
const kml = (cuerpo: string) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document><name>Campo</name>${cuerpo}</Document></kml>`
const poligono = (nombre: string, coords: string, extra = "") =>
  `<Placemark><name>${nombre}</name>${extra}<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`
const punto = (nombre: string, x: number, y: number) => `<Placemark><name>${nombre}</name><Point><coordinates>${x},${y},0</coordinates></Point></Placemark>`
const linea = (nombre: string, coords: string) => `<Placemark><name>${nombre}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`

describe("lector XML del KML", () => {
  it("lee prefijos, entidades, CDATA, comentarios y etiquetas que se cierran solas", () => {
    const raiz = parsearXml(`<?xml version="1.0"?><!-- hola --><kml:kml><kml:Placemark id='p1'><name>Potrero &amp; aguada &#241;</name><description><![CDATA[<b>Pasto</b> bueno]]></description><gx:Track/></kml:Placemark></kml:kml>`)
    expect(raiz.nombre).toBe("kml")
    const p = descendientes(raiz, "Placemark")[0]
    expect(p.atributos.id).toBe("p1")
    expect(textoDe(p.hijos.find((h) => h.nombre === "name"))).toBe("Potrero & aguada ñ")
    expect(textoDe(p.hijos.find((h) => h.nombre === "description"))).toBe("<b>Pasto</b> bueno")
    expect(p.hijos.some((h) => h.nombre === "Track")).toBe(true)
  })
  it("rechaza DOCTYPE/ENTITY y etiquetas mal cerradas", () => {
    expect(() => parsearXml('<!DOCTYPE x [<!ENTITY a "b">]><kml/>')).toThrow()
    expect(() => parsearXml("<kml><Placemark></kml>")).toThrow()
    expect(() => parsearXml("<kml><Placemark>")).toThrow()
    expect(() => parsearXml("texto sin etiquetas")).toThrow()
  })
})

describe("tipo de cada lugar importado", () => {
  it("usa la palabra que aparece primero en el nombre", () => {
    expect(tipoDesdeTexto("Potrero del Molino")).toBe("potrero")
    expect(tipoDesdeTexto("Aguada potrero 3")).toBe("aguada")
    expect(tipoDesdeTexto("Galpón de máquinas")).toBe("galpon")
    expect(tipoDesdeTexto("Límite del campo")).toBe("limite")
    expect(tipoDesdeTexto("Lote 4 - Soja")).toBe("potrero")
    expect(tipoDesdeTexto("Cuadro norte")).toBe("potrero")
    expect(tipoDesdeTexto("Sin pistas")).toBeNull()
  })
  it("respeta la forma: un punto no es un potrero ni una línea un área", () => {
    expect(tipoCompatible("potrero", "Point")).toBe(false)
    expect(tipoCompatible("aguada", "Point")).toBe(true)
    expect(tipoCompatible("alambrado", "LineString")).toBe(true)
    expect(tipoCompatible("corral", "LineString")).toBe(false)
    expect(tipoCompatible("tranquera", "Polygon")).toBe(false)
  })
  it("prioriza el dato del archivo, después el nombre, la carpeta y por último la forma", () => {
    expect(inferirTipo({ nombre: "X", tipo: "Corral" }, "Polygon")).toEqual({ tipo: "corral", detectado: true })
    expect(inferirTipo({ nombre: "X", tipo: "Galpón / depósito" }, "Polygon")).toEqual({ tipo: "galpon", detectado: true })
    expect(inferirTipo({ nombre: "N1", carpeta: "Aguadas" }, "Point")).toEqual({ tipo: "aguada", detectado: true })
    expect(inferirTipo({ nombre: "Tranquera vieja" }, "Polygon")).toEqual({ tipo: "potrero", detectado: false })
    expect(inferirTipo({ nombre: "Traza" }, "LineString")).toEqual({ tipo: "alambrado", detectado: false })
    expect(inferirTipo({ nombre: "Marca" }, "Point")).toEqual({ tipo: "otro", detectado: false })
  })
})

describe("importar un KML de Google Earth", () => {
  it("genera los lugares con su tipo, carpeta y descripción", () => {
    const r = parseMapImport(kml(`
      <Folder><name>Potreros</name>${poligono("P1", cuadrado(-69, -45))}${poligono("Potrero del molino", cuadrado(-68.9, -45))}</Folder>
      <Folder><name>Aguadas</name>${punto("Norte", -69.005, -44.995)}</Folder>
      ${linea("Camino interno", "-69,-45 -68.9,-45")}
      ${linea("Traza", "-69,-45.01 -68.9,-45.01")}
      ${poligono("Galpón", cuadrado(-69.002, -45.002, 0.0005), "<description><![CDATA[<p>Chapa<br>techo nuevo</p>]]></description>")}
      ${poligono("Encierre", cuadrado(-68.95, -45.02, 0.001), '<ExtendedData><Data name="tipo"><value>corral</value></Data></ExtendedData>')}
    `), "campo.kml")
    const por = Object.fromEntries(r.lugares.map((l) => [l.nombre, l]))
    expect(r.lugares).toHaveLength(7)
    expect(por.P1).toMatchObject({ tipo: "potrero", carpeta: "Potreros", tipoDetectado: true })
    expect(por["Potrero del molino"].tipo).toBe("potrero")
    expect(por.Norte).toMatchObject({ tipo: "aguada", carpeta: "Aguadas" })
    expect(por["Camino interno"].tipo).toBe("camino")
    expect(por.Traza).toMatchObject({ tipo: "alambrado", tipoDetectado: false })
    expect(por["Galpón"]).toMatchObject({ tipo: "galpon", descripcion: "Chapa\ntecho nuevo" })
    expect(por.Encierre.tipo).toBe("corral")
    expect(r.omitidos).toEqual([])
  })

  it("repara contornos sin cerrar y vértices repetidos seguidos", () => {
    const abierto = "-69,-45 -69,-45 -68.99,-45 -68.99,-44.99 -69,-44.99"
    const r = parseMapImport(kml(poligono("Abierto", abierto)), "c.kml")
    const anillo = r.lugares[0].geometry.type === "Polygon" ? r.lugares[0].geometry.coordinates[0] : []
    expect(anillo).toHaveLength(5)
    expect(anillo[0]).toEqual(anillo[4])
  })

  it("simplifica los trazos de más de 500 vértices y avisa", () => {
    const n = 1200
    const circulo = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 2 * Math.PI
      return `${-69 + 0.02 * Math.cos(a)},${-45 + 0.02 * Math.sin(a)}`
    }).join(" ")
    const r = parseMapImport(kml(poligono("Redondo", circulo)), "c.kml")
    const anillo = r.lugares[0].geometry.type === "Polygon" ? r.lugares[0].geometry.coordinates[0] : []
    expect(anillo.length).toBeLessThanOrEqual(501)
    expect(anillo.length).toBeGreaterThan(20)
    expect(r.avisos.some((a) => /Redondo.*simplificó de 1200/.test(a))).toBe(true)
  })

  it("omite con el motivo una figura que no se puede reparar e importa las demás", () => {
    const moño = "-69,-45 -68.99,-44.99 -68.99,-45 -69,-44.99 -69,-45"
    const r = parseMapImport(kml(poligono("Cruzado", moño) + poligono("Bueno", cuadrado(-68.9, -45))), "c.kml")
    expect(r.lugares.map((l) => l.nombre)).toEqual(["Bueno"])
    expect(r.omitidos).toEqual([{ nombre: "Cruzado", motivo: expect.stringMatching(/cruzarse/) }])
    // Si ninguna sirve, el archivo se rechaza con el motivo
    expect(() => parseMapImport(kml(poligono("Cruzado", moño)), "c.kml")).toThrow(/Cruzado/)
  })

  it("separa MultiGeometry, ignora huecos y recorridos GPS avisando", () => {
    const multi = `<Placemark><name>Lote</name><MultiGeometry>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${cuadrado(-69, -45)}</coordinates></LinearRing></outerBoundaryIs>
        <innerBoundaryIs><LinearRing><coordinates>${cuadrado(-68.996, -44.996, 0.002)}</coordinates></LinearRing></innerBoundaryIs></Polygon>
      <Point><coordinates>-68.95,-45</coordinates></Point></MultiGeometry></Placemark>
      <Placemark><name>Recorrida</name><gx:Track><when>2026-01-01</when></gx:Track></Placemark>`
    const r = parseMapImport(kml(multi), "c.kml")
    expect(r.lugares.map((l) => [l.nombre, l.tipo])).toEqual([["Lote (1)", "potrero"], ["Lote (2)", "otro"]])
    expect(r.avisos.join(" ")).toMatch(/1 hueco/)
    expect(r.avisos.join(" ")).toMatch(/Recorrida.*recorrido GPS/)
  })

  it("toma como límite del campo el polígono sin tipo que encierra a los demás", () => {
    const r = parseMapImport(kml(
      poligono("Estancia La Esperanza", cuadrado(-69.1, -45.1, 0.3)) + poligono("P1", cuadrado(-69, -45)) + poligono("P2", cuadrado(-68.95, -45)),
    ), "c.kml")
    expect(r.lugares.find((l) => l.nombre === "Estancia La Esperanza")?.tipo).toBe("limite")
    expect(r.avisos.join(" ")).toMatch(/encierra a los demás/)
    // Si el más grande ya tiene un tipo reconocido, no se toca
    const r2 = parseMapImport(kml(
      poligono("Potrero grande", cuadrado(-69.1, -45.1, 0.3)) + poligono("P1", cuadrado(-69, -45)) + poligono("P2", cuadrado(-68.95, -45)),
    ), "c.kml")
    expect(r2.lugares.every((l) => l.tipo === "potrero")).toBe(true)
  })

  it("en GeoJSON usa las propiedades tipo, descripción y carpeta", () => {
    const r = parseMapImport(JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", properties: { nombre: "Bebedero", tipo: "aguada", descripcion: "Australiano 20.000 l" }, geometry: { type: "Point", coordinates: [-69, -45] } },
    ] }), "c.geojson")
    expect(r.lugares[0]).toMatchObject({ nombre: "Bebedero", tipo: "aguada", descripcion: "Australiano 20.000 l", tipoDetectado: true })
  })
})

describe("nombres repetidos", () => {
  it("numera los que ya existen en el campo o se repiten en el archivo", () => {
    expect(nombresLibres(["Potrero 1", "Aguada", "aguada", "Nuevo"], ["potrero 1", "Potrero 1 (2)"])).toEqual(["Potrero 1 (3)", "Aguada", "aguada (2)", "Nuevo"])
  })
})
