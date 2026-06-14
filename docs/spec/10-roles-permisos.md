# 10 — Roles y permisos

Roles definidos hoy en el sistema (`Usuario.rol` y `Membresia.rol`): `admin`, `encargado`, `vet`, `operario`. Se propone agregar `contador` (lectura comercial, sin operación de campo) en Fase 3.

## 10.1 Principios

1. El rol **efectivo** es el de `Membresia.rol` para la organización activa. El rol en `Usuario.rol` es un default histórico.
2. Un usuario puede ser parte de **múltiples organizaciones** con roles distintos.
3. Las acciones de campo críticas (DT-e, Bajas, Cierre de stock) requieren rol `admin` o `encargado`.
4. **Operario nunca puede borrar**. Solo cargar y editar lo propio.
5. **Veterinario nunca aprueba ventas**, pero sí aprueba protocolos sanitarios y certificados.
6. Toda acción sensible queda en `AuditLog`.

## 10.2 Matriz de permisos por módulo

Leyenda: `R` = leer, `C` = crear, `U` = editar, `D` = borrar, `X` = aprobar/cerrar/firmar.

### 1. Establecimientos y configuración

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Ver establecimientos | R | R | R | R | R |
| Crear/editar establecimiento | C/U | — | — | — | — |
| Configurar zona aftosa, PROLANA, etc. | C/U | — | — | — | — |
| Configurar marca/señal | C/U | U | — | — | — |
| Gestionar usuarios y roles | C/U/D | — | — | — | — |

### 2. Animales

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Ver animales | R | R | R | R | R |
| Alta de animal | C | C | — | C | — |
| Editar animal | U | U | U (datos sanitarios) | U (limitado) | — |
| Eliminar (soft delete) | D | D | — | — | — |
| Asignar caravana | C/U | C/U | — | C | — |

### 3. Eventos de campo (`EvtPesada`, `EvtMovimiento`, `EvtSanidad`, etc.)

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Registrar evento de pesada | C | C | — | C | — |
| Registrar evento de movimiento (interno) | C | C | — | C | — |
| Registrar evento sanitario | C | C | C | C (siguiendo protocolo) | — |
| Editar evento propio (mismo día) | U | U | U | U | — |
| Editar evento ajeno o antiguo | U | — | U (sanitario) | — | — |
| Anular evento | D | D | — | — | — |

### 4. Reproducción

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Crear torada/encarnerada | C | C | — | — | — |
| Registrar servicio | C | C | C | C | — |
| Registrar tacto | C | C | C | — | — |
| Registrar parición | C | C | C | C | — |
| Registrar señalada | C | C | — | C | — |
| Registrar destete | C | C | — | C | — |

### 5. Sanidad — protocolos y calendarios

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Ver protocolos | R | R | R | R | — |
| Crear protocolo | C | — | C | — | — |
| Editar protocolo | U | — | U | — | — |
| Aprobar protocolo (uso productivo) | X | — | X | — | — |
| Activar calendario por establecimiento | C/U | C/U | — | — | — |
| Registrar aplicación sanitaria | C | C | C | C (siguiendo orden) | — |

### 6. DT-e y trazabilidad

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Ver DT-e | R | R | R | R | R |
| Crear borrador DT-e | C | C | — | — | — |
| Emitir DT-e (cambia a estado emitido) | X | X | — | — | — |
| Marcar arribo | U | U | — | U | — |
| Anular DT-e | D | — | — | — | — |

### 7. Producción de lana

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Crear esquila | C | C | — | — | — |
| Cargar lote/fardos | C/U | C/U | — | C | — |
| Cargar análisis | C | C | — | — | — |
| Crear embarque | C | C | — | — | — |
| Crear liquidación de lana | C | C | — | — | R |
| Marcar cobrado | X | X | — | — | X |

### 8. Forraje y carga animal

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Configurar sectores y forrajes | C/U | C/U | — | — | — |
| Cargar aforos | C | C | — | C | — |
| Crear reservas | C | C | — | — | — |
| Registrar consumo de reservas | C | C | — | C | — |

### 9. Stock y cierre

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Ver stock | R | R | R | R | R |
| Cierre mensual (borrador) | C | C | — | — | — |
| Aprobar cierre | X | — | — | — | — |
| Reabrir cierre | X | — | — | — | — |

### 10. Comercial y facturación

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Ver liquidaciones | R | R | — | — | R |
| Crear liquidación de hacienda | C | C | — | — | C |
| Crear comprobante | C | C | — | — | C |
| Emitir comprobante (ARCA) | X | — | — | — | X |
| Registrar cobro | C | — | — | — | C |
| Ver cuenta corriente | R | R | — | — | R |
| Exportar contable | R | — | — | — | R |

### 11. Personal rural

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Alta de trabajador | C | C | — | — | C |
| Editar trabajador | U | U | — | — | U |
| Cargar jornales | C | C | — | C (propio) | C |
| Generar liquidación de sueldo | C | — | — | — | C |
| Marcar como pagado | X | — | — | — | X |

### 12. Reportes y dashboard

| Acción | admin | encargado | vet | operario | contador |
|---|---|---|---|---|---|
| Dashboard general | R | R | R | R (limitado) | R |
| KPIs reproductivos | R | R | R | — | — |
| KPIs sanitarios | R | R | R | — | — |
| Reportes comerciales | R | R | — | — | R |
| Auditoría (`AuditLog`) | R | — | — | — | — |

## 10.3 Reglas finas

1. **Operario solo ve eventos cargados por él mismo o por su sector asignado** (campo `sectorAsignadoId` futuro). Esto evita que en un campo grande un operario vea todo.
2. **Vet ve toda la sanidad de la org** pero no edita aspectos comerciales ni de personal.
3. **Contador no ve eventos de campo** (`EvtSanidad`, `EvtPesada`, etc.) salvo en agregados.
4. **El admin puede impersonar (en modo solo lectura) a otros roles** para depurar problemas — opcional, requiere auditoría especial.

## 10.4 Implementación técnica

- Usar guards en cada API route que validen `session.user.rol` contra una matriz declarativa.
- Estructura sugerida: archivo `lib/auth/permissions.ts` con función `can(rol, action, resource)`.
- En el frontend: ocultar/deshabilitar acciones según rol con un hook `usePermission(action)`.
- Reglas de scope: toda query lleva `where: { organizacionId: session.organizacionActiva }`.

## 10.5 Aprobaciones multi-paso (opcional Fase 3)

Para acciones críticas, sistema de doble aprobación:
- Encargado crea borrador de DT-e.
- Admin lo emite.
- Permite delegar carga pero centralizar firma.

Modelado con campo `aprobadoPorId` y `aprobadoEn` en las entidades sujetas.

## Pendientes con cliente

- Confirmar si hay distinción entre dueño y encargado en cada campo.
- ¿Hay veterinario propio o contratado por visita?
- ¿Tienen contador externo que va a usar el sistema?
- ¿Quieren que el sistema bloquee acciones a operarios o solo registre quién hizo qué?
