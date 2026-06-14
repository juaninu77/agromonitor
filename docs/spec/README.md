# Especificación funcional Agromonitor — Campo argentino

Especificación de producto y de datos para el ERP ganadero **Agromonitor**, orientada a productores del campo argentino. Foco inicial: dos campos en **Chubut** y **Río Negro** (Patagonia).

Esta carpeta documenta **qué** debe resolver el sistema (regulación SENASA, ARCA/AFIP, RENATRE, normativa provincial) y **cómo** se mapea al schema Prisma existente (`prisma/schema.prisma` v3) en Neon Postgres. No reemplaza la documentación técnica general en `docs/` — la complementa.

## Cómo leer esta spec

Cada documento responde una pregunta concreta. Si querés implementar un módulo, empezá por el doc correspondiente y bajá al [11-modelo-datos.md](./11-modelo-datos.md) para ver qué hay que tocar en el schema.

| # | Documento | Pregunta que responde |
|---|---|---|
| 00 | [Overview](./00-overview.md) | ¿Qué hace el ERP, para quién, con qué principios y glosario? |
| 01 | [Identificación y trazabilidad](./01-identificacion-trazabilidad.md) | CUIG, RENSPA, marca/señal, caravana RFID, DT-e, SIGSA |
| 02 | [Sanidad](./02-sanidad.md) | Plan sanitario bovino + ovino, diferencial Patagonia ZLSV |
| 03 | [Reproducción](./03-reproduccion.md) | Servicio, tacto, parición, destete, señalada — KPIs |
| 04 | [Producción de lana](./04-produccion-lana.md) | PROLANA, esquila, análisis, embarque, liquidación |
| 05 | [Stock y movimientos](./05-stock-movimientos.md) | Categorías, partes ingreso/egreso, cierre de stock, valuación |
| 06 | [Forraje y carga animal](./06-forraje-carga-animal.md) | Pasturas, aforos, EV/ha, reservas |
| 07 | [Comercial y administrativo](./07-comercial-administrativo.md) | Liquidaciones, AFIP/ARCA, IVA agropecuario, facturación |
| 08 | [Personal rural](./08-personal-rural.md) | RENATRE, libreta trabajador rural, jornales |
| 09 | [Integraciones](./09-integraciones.md) | SIGSA, SIGBIOTraza, ARCA, ROSGAN, PROLANA |
| 10 | [Roles y permisos](./10-roles-permisos.md) | Matriz módulo × rol |
| 11 | [Modelo de datos](./11-modelo-datos.md) | Entidades canónicas, gaps vs schema actual |
| 12 | [Roadmap](./12-roadmap.md) | Fases, MVP Chubut/RN, secuencia |

## Convenciones

- **Idioma**: español en código y UI (sigue el estándar del repo desde v2).
- **Naming**: PascalCase para modelos Prisma, camelCase para campos, snake_case en la columna física vía `@map`.
- **Configuración por establecimiento**: el sistema debe permitir que dos campos del mismo cliente operen con reglas distintas (zona aftosa, especie dominante, PROLANA opt-in, etc.).
- **Multi-tenant**: todo cuelga de `Organizacion`. Nunca cruzar datos entre orgs en queries.
- **Event sourcing**: los `Evt*` son inmutables. Cualquier corrección crea un nuevo evento de ajuste, no edita el original.

## Estado de la spec

Versión 0.1 — borrador inicial. Pendiente de revisar con los dos clientes (Chubut + Río Negro) antes de fijar el alcance del MVP. Ver pendientes al final de cada doc.
