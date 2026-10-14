// Lector XML mínimo para KML (sin dependencias ni DOM: funciona igual en el navegador y en
// los tests). Arma un árbol de elementos con su nombre local (sin prefijo de espacio de
// nombres: kml:, gx:), atributos y texto. Rechaza DOCTYPE/ENTITY (evita expansión de
// entidades) y XML mal cerrado.

export interface NodoXml {
  nombre: string
  atributos: Record<string, string>
  hijos: NodoXml[]
  texto: string
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    }
    return ENTIDADES[e] ?? m
  })
}

const local = (nombre: string) => nombre.slice(nombre.indexOf(":") + 1)

export class XmlInvalido extends Error {}

/** Parsea el documento y devuelve el elemento raíz. */
export function parsearXml(texto: string): NodoXml {
  if (/<!DOCTYPE|<!ENTITY/i.test(texto)) throw new XmlInvalido("KML inválido")
  const raiz: NodoXml = { nombre: "#documento", atributos: {}, hijos: [], texto: "" }
  const pila: NodoXml[] = [raiz]
  const actual = () => pila[pila.length - 1]
  let i = 0
  while (i < texto.length) {
    const lt = texto.indexOf("<", i)
    if (lt < 0) { actual().texto += decodificar(texto.slice(i)); break }
    if (lt > i) actual().texto += decodificar(texto.slice(i, lt))
    if (texto.startsWith("<!--", lt)) {
      const fin = texto.indexOf("-->", lt + 4); if (fin < 0) throw new XmlInvalido("KML inválido")
      i = fin + 3; continue
    }
    if (texto.startsWith("<![CDATA[", lt)) {
      const fin = texto.indexOf("]]>", lt + 9); if (fin < 0) throw new XmlInvalido("KML inválido")
      actual().texto += texto.slice(lt + 9, fin); i = fin + 3; continue
    }
    if (texto.startsWith("<?", lt)) {
      const fin = texto.indexOf("?>", lt + 2); if (fin < 0) throw new XmlInvalido("KML inválido")
      i = fin + 2; continue
    }
    const gt = texto.indexOf(">", lt + 1)
    if (gt < 0) throw new XmlInvalido("KML inválido")
    const contenido = texto.slice(lt + 1, gt)
    i = gt + 1
    if (contenido.startsWith("/")) {
      const nombre = local(contenido.slice(1).trim())
      const cerrado = pila.pop()
      if (!cerrado || cerrado === raiz || cerrado.nombre !== nombre) throw new XmlInvalido("KML inválido (etiquetas mal cerradas)")
      continue
    }
    const autocierre = contenido.endsWith("/")
    const cuerpo = autocierre ? contenido.slice(0, -1) : contenido
    const m = /^([^\s/>]+)/.exec(cuerpo)
    if (!m) throw new XmlInvalido("KML inválido")
    const atributos: Record<string, string> = {}
    for (const a of cuerpo.slice(m[1].length).matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      atributos[local(a[1])] = decodificar(a[3] ?? a[4] ?? "")
    }
    const nodo: NodoXml = { nombre: local(m[1]), atributos, hijos: [], texto: "" }
    actual().hijos.push(nodo)
    if (!autocierre) pila.push(nodo)
  }
  if (pila.length !== 1) throw new XmlInvalido("KML inválido (etiquetas sin cerrar)")
  const elemento = raiz.hijos[0]
  if (!elemento) throw new XmlInvalido("KML inválido")
  return elemento
}

/** Primer hijo directo con ese nombre. */
export const hijo = (n: NodoXml | undefined, nombre: string) => n?.hijos.find((h) => h.nombre === nombre)

/** Todos los descendientes con ese nombre (en orden de documento). */
export function descendientes(n: NodoXml, nombre: string): NodoXml[] {
  const out: NodoXml[] = []
  const visitar = (x: NodoXml) => { for (const h of x.hijos) { if (h.nombre === nombre) out.push(h); visitar(h) } }
  visitar(n)
  return out
}

/** Texto de un nodo y sus descendientes. */
export function textoDe(n: NodoXml | undefined): string {
  if (!n) return ""
  return n.texto + n.hijos.map(textoDe).join("")
}
