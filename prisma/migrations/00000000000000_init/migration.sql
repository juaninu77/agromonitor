-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password_hash" TEXT,
    "telefono" TEXT,
    "avatar" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'operario',
    "es_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizaciones" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "es_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresias" (
    "id" UUID NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'operario',
    "es_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,

    CONSTRAINT "membresias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especies" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "organizacion_id" UUID,

    CONSTRAINT "especies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "razas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "especie_id" UUID NOT NULL,
    "organizacion_id" UUID,

    CONSTRAINT "razas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "edad_min_meses" INTEGER,
    "edad_max_meses" INTEGER,
    "sexo" TEXT,
    "descripcion" TEXT,
    "especie_id" UUID NOT NULL,
    "organizacion_id" UUID,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "establecimientos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT,
    "renspa" TEXT,
    "provincia" TEXT,
    "localidad" TEXT,
    "hectareas" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizacion_id" UUID NOT NULL,

    CONSTRAINT "establecimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectores" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "superficie_ha" DOUBLE PRECISION,
    "uso" TEXT,
    "capacidad" INTEGER,
    "tiene_agua" BOOLEAN NOT NULL DEFAULT false,
    "tiene_sombra" BOOLEAN NOT NULL DEFAULT false,
    "tiene_balanza" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "establecimiento_id" UUID NOT NULL,

    CONSTRAINT "sectores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forrajes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "clase" TEXT,
    "notas" TEXT,

    CONSTRAINT "forrajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector_forrajes" (
    "id" UUID NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "densidad_siembra_kg_ha" DOUBLE PRECISION,
    "notas" TEXT,
    "sector_id" UUID NOT NULL,
    "forraje_id" UUID NOT NULL,

    CONSTRAINT "sector_forrajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mediciones_potrero" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "altura_pasto_cm" DOUBLE PRECISION,
    "ms_kg_ha" DOUBLE PRECISION,
    "cobertura_pct" DOUBLE PRECISION,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sector_id" UUID NOT NULL,

    CONSTRAINT "mediciones_potrero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "objetivo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "especie_id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "principio_activo" TEXT,
    "laboratorio" TEXT,
    "retiro_dias" INTEGER NOT NULL DEFAULT 0,
    "dosis_referencia" TEXT,
    "notas" TEXT,
    "organizacion_id" UUID,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_producto" (
    "id" UUID NOT NULL,
    "nro_lote" TEXT NOT NULL,
    "vencimiento" DATE,
    "proveedor" TEXT,
    "cantidad" DOUBLE PRECISION,
    "unidad" TEXT,
    "costo" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "producto_id" UUID NOT NULL,
    "proveedor_id" UUID,

    CONSTRAINT "lotes_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "tipo" TEXT[],
    "contacto_nombre" TEXT,
    "contacto_tel" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizacion_id" UUID NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "tipo" TEXT[],
    "renspa" TEXT,
    "contacto_nombre" TEXT,
    "contacto_tel" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizacion_id" UUID NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animales" (
    "id" UUID NOT NULL,
    "cuig" TEXT,
    "caravana_visual" TEXT,
    "caravana_rfid" TEXT,
    "otro_id" TEXT,
    "sexo" TEXT NOT NULL,
    "fecha_nacimiento" DATE,
    "origen" TEXT,
    "estado_vital" TEXT NOT NULL DEFAULT 'activo',
    "color_manto" TEXT,
    "mocho" BOOLEAN,
    "marca_fuego" TEXT,
    "cornamenta" TEXT,
    "estado_castracion" TEXT,
    "denticion" TEXT,
    "es_cabana" BOOLEAN NOT NULL DEFAULT false,
    "registro_cabana" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "especie_id" UUID NOT NULL,
    "raza_id" UUID,
    "categoria_id" UUID,
    "proveedor_id" UUID,
    "establecimiento_id" UUID,

    CONSTRAINT "animales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genealogias" (
    "animal_id" UUID NOT NULL,
    "padre_id" UUID,
    "madre_id" UUID,
    "padre_externo" TEXT,
    "madre_externo" TEXT,
    "observ" TEXT,

    CONSTRAINT "genealogias_pkey" PRIMARY KEY ("animal_id")
);

-- CreateTable
CREATE TABLE "animal_attrs" (
    "id" UUID NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "desde" DATE,
    "hasta" DATE,
    "animal_id" UUID NOT NULL,

    CONSTRAINT "animal_attrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_lote_hist" (
    "id" UUID NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "motivo" TEXT,
    "animal_id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,

    CONSTRAINT "animal_lote_hist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicacion_hist" (
    "id" UUID NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "motivo" TEXT,
    "animal_id" UUID NOT NULL,
    "sector_id" UUID NOT NULL,

    CONSTRAINT "ubicacion_hist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_paricion" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "resultado" TEXT NOT NULL,
    "peso_nacer_kg" DOUBLE PRECISION,
    "tipo_parto" TEXT,
    "dificultad" INTEGER,
    "sexo_cria" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "madre_id" UUID NOT NULL,
    "padre_id" UUID,
    "padre_externo" TEXT,
    "nacido_animal_id" UUID,

    CONSTRAINT "evt_paricion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_destete" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "peso_kg" DOUBLE PRECISION,
    "edad_dias" INTEGER,
    "metodo" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animal_id" UUID NOT NULL,
    "lote_destete_id" UUID,

    CONSTRAINT "evt_destete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_pesada" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "peso_kg" DOUBLE PRECISION,
    "cc" DOUBLE PRECISION,
    "gdp_kg" DOUBLE PRECISION,
    "balanza" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animal_id" UUID,
    "lote_id" UUID,
    "cantidad_animales" INTEGER,

    CONSTRAINT "evt_pesada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_movimiento" (
    "id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animal_id" UUID,
    "lote_id" UUID,
    "cantidad_animales" INTEGER,
    "origen_sector_id" UUID,
    "destino_sector_id" UUID NOT NULL,

    CONSTRAINT "evt_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_sanidad" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "dosis" DOUBLE PRECISION,
    "unidad" TEXT,
    "via" TEXT,
    "motivo" TEXT,
    "carencia_dias" INTEGER,
    "aplicador" TEXT,
    "veterinario" TEXT,
    "costo" DECIMAL(12,2),
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animal_id" UUID,
    "lote_id" UUID,
    "cantidad_animales" INTEGER,
    "producto_id" UUID NOT NULL,
    "lote_producto_id" UUID,

    CONSTRAINT "evt_sanidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toradas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "tipo" TEXT NOT NULL,
    "cantidad_hembras" INTEGER,
    "cantidad_machos" INTEGER,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lote_id" UUID NOT NULL,

    CONSTRAINT "toradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_servicio" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "toro_nombre" TEXT,
    "lote_semen" TEXT,
    "inseminador" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hembra_id" UUID NOT NULL,
    "macho_id" UUID,
    "torada_id" UUID,

    CONSTRAINT "evt_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_tacto" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "resultado" TEXT NOT NULL,
    "meses_gest" DOUBLE PRECISION,
    "fecha_probable_parto" DATE,
    "metodo" TEXT NOT NULL DEFAULT 'palpacion',
    "veterinario" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hembra_id" UUID NOT NULL,
    "servicio_id" UUID,

    CONSTRAINT "evt_tacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_baja" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "peso_vivo_kg" DOUBLE PRECISION,
    "precio_kg" DECIMAL(12,2),
    "precio_total" DECIMAL(12,2),
    "dta_numero" TEXT,
    "factura_numero" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animal_id" UUID NOT NULL,
    "cliente_id" UUID,

    CONSTRAINT "evt_baja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dietas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "ms_objetivo_kg" DOUBLE PRECISION,
    "proteina_pct" DOUBLE PRECISION,
    "energia_mcal" DOUBLE PRECISION,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizacion_id" UUID,

    CONSTRAINT "dietas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dieta_componentes" (
    "id" UUID NOT NULL,
    "insumo" TEXT NOT NULL,
    "proporcion_pct" DOUBLE PRECISION NOT NULL,
    "kg_por_animal" DOUBLE PRECISION,
    "dieta_id" UUID NOT NULL,

    CONSTRAINT "dieta_componentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_alimentacion" (
    "id" UUID NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "ms_dia_plan_kg" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lote_id" UUID NOT NULL,
    "dieta_id" UUID NOT NULL,

    CONSTRAINT "planes_alimentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_alimentacion" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidad_animales" INTEGER,
    "ms_real_kg" DOUBLE PRECISION,
    "desvio_pct" DOUBLE PRECISION,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lote_id" UUID NOT NULL,
    "dieta_id" UUID,

    CONSTRAINT "evt_alimentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evt_pastoreo" (
    "id" UUID NOT NULL,
    "ingreso" TIMESTAMP(3) NOT NULL,
    "egreso" TIMESTAMP(3),
    "animales_promedio" INTEGER,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lote_id" UUID NOT NULL,
    "sector_id" UUID NOT NULL,

    CONSTRAINT "evt_pastoreo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tabla" TEXT NOT NULL,
    "row_pk" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "organizacion_id" UUID,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_transito" (
    "id" UUID NOT NULL,
    "numero_dta" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'DTe',
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "fecha_uso" DATE,
    "renspa_origen" TEXT NOT NULL,
    "nombre_origen" TEXT,
    "renspa_destino" TEXT NOT NULL,
    "nombre_destino" TEXT,
    "especie" TEXT NOT NULL,
    "cantidad_animales" INTEGER NOT NULL,
    "categorias" TEXT,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'vigente',
    "patente_camion" TEXT,
    "transportista" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "establecimiento_id" UUID,

    CONSTRAINT "documentos_transito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "fecha_limite" TIMESTAMP(3),
    "fecha_completada" TIMESTAMP(3),
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "asignado_a_id" UUID,
    "establecimiento_id" UUID NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "producto_id" UUID NOT NULL,
    "lote_producto_id" UUID,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_manga" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "tipo" TEXT NOT NULL,
    "acciones_habilitadas" TEXT[],
    "lote_origen_id" UUID,
    "producto_sanidad_id" UUID,
    "dosis_sanidad" DOUBLE PRECISION,
    "total_animales" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "iniciada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_at" TIMESTAMP(3),
    "establecimiento_id" UUID NOT NULL,
    "operador_id" UUID NOT NULL,

    CONSTRAINT "sesiones_manga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion_manga_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden" INTEGER NOT NULL,
    "eid_leido" TEXT NOT NULL,
    "timestamp_lectura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso_kg" DOUBLE PRECISION,
    "cc" DOUBLE PRECISION,
    "denticion" TEXT,
    "resultado_tacto" TEXT,
    "meses_gestacion" DOUBLE PRECISION,
    "accion_sanidad" BOOLEAN NOT NULL DEFAULT false,
    "apartado_a" TEXT,
    "observaciones" TEXT,
    "es_nuevo_registro" BOOLEAN NOT NULL DEFAULT false,
    "caravana_visual_reg" TEXT,
    "sexo_reg" TEXT,
    "categoria_reg" TEXT,
    "sesion_id" UUID NOT NULL,
    "animal_id" UUID,

    CONSTRAINT "sesion_manga_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizaciones_slug_key" ON "organizaciones"("slug");

-- CreateIndex
CREATE INDEX "membresias_usuario_id_idx" ON "membresias"("usuario_id");

-- CreateIndex
CREATE INDEX "membresias_organizacion_id_idx" ON "membresias"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "membresias_usuario_id_organizacion_id_key" ON "membresias"("usuario_id", "organizacion_id");

-- CreateIndex
CREATE INDEX "especies_organizacion_id_idx" ON "especies"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "especies_organizacion_id_nombre_key" ON "especies"("organizacion_id", "nombre");

-- CreateIndex
CREATE INDEX "razas_organizacion_id_idx" ON "razas"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "razas_especie_id_nombre_key" ON "razas"("especie_id", "nombre");

-- CreateIndex
CREATE INDEX "categorias_organizacion_id_idx" ON "categorias"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_especie_id_nombre_key" ON "categorias"("especie_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "establecimientos_organizacion_id_nombre_key" ON "establecimientos"("organizacion_id", "nombre");

-- CreateIndex
CREATE INDEX "sectores_tipo_idx" ON "sectores"("tipo");

-- CreateIndex
CREATE INDEX "sectores_activo_idx" ON "sectores"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "sectores_establecimiento_id_nombre_key" ON "sectores"("establecimiento_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "forrajes_nombre_key" ON "forrajes"("nombre");

-- CreateIndex
CREATE INDEX "sector_forrajes_sector_id_idx" ON "sector_forrajes"("sector_id");

-- CreateIndex
CREATE INDEX "sector_forrajes_forraje_id_idx" ON "sector_forrajes"("forraje_id");

-- CreateIndex
CREATE INDEX "mediciones_potrero_sector_id_idx" ON "mediciones_potrero"("sector_id");

-- CreateIndex
CREATE INDEX "mediciones_potrero_fecha_idx" ON "mediciones_potrero"("fecha");

-- CreateIndex
CREATE INDEX "lotes_tipo_idx" ON "lotes"("tipo");

-- CreateIndex
CREATE INDEX "lotes_activo_idx" ON "lotes"("activo");

-- CreateIndex
CREATE INDEX "lotes_establecimiento_id_idx" ON "lotes"("establecimiento_id");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_establecimiento_id_nombre_key" ON "lotes"("establecimiento_id", "nombre");

-- CreateIndex
CREATE INDEX "productos_tipo_idx" ON "productos"("tipo");

-- CreateIndex
CREATE INDEX "productos_organizacion_id_idx" ON "productos"("organizacion_id");

-- CreateIndex
CREATE INDEX "lotes_producto_producto_id_idx" ON "lotes_producto"("producto_id");

-- CreateIndex
CREATE INDEX "lotes_producto_proveedor_id_idx" ON "lotes_producto"("proveedor_id");

-- CreateIndex
CREATE INDEX "lotes_producto_vencimiento_idx" ON "lotes_producto"("vencimiento");

-- CreateIndex
CREATE INDEX "proveedores_organizacion_id_idx" ON "proveedores"("organizacion_id");

-- CreateIndex
CREATE INDEX "clientes_organizacion_id_idx" ON "clientes"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "animales_cuig_key" ON "animales"("cuig");

-- CreateIndex
CREATE UNIQUE INDEX "animales_caravana_visual_key" ON "animales"("caravana_visual");

-- CreateIndex
CREATE UNIQUE INDEX "animales_caravana_rfid_key" ON "animales"("caravana_rfid");

-- CreateIndex
CREATE INDEX "animales_especie_id_idx" ON "animales"("especie_id");

-- CreateIndex
CREATE INDEX "animales_estado_vital_idx" ON "animales"("estado_vital");

-- CreateIndex
CREATE INDEX "animales_cuig_idx" ON "animales"("cuig");

-- CreateIndex
CREATE INDEX "animales_caravana_rfid_idx" ON "animales"("caravana_rfid");

-- CreateIndex
CREATE INDEX "animales_establecimiento_id_idx" ON "animales"("establecimiento_id");

-- CreateIndex
CREATE INDEX "animales_raza_id_idx" ON "animales"("raza_id");

-- CreateIndex
CREATE INDEX "animales_categoria_id_idx" ON "animales"("categoria_id");

-- CreateIndex
CREATE INDEX "animales_proveedor_id_idx" ON "animales"("proveedor_id");

-- CreateIndex
CREATE INDEX "genealogias_padre_id_idx" ON "genealogias"("padre_id");

-- CreateIndex
CREATE INDEX "genealogias_madre_id_idx" ON "genealogias"("madre_id");

-- CreateIndex
CREATE INDEX "animal_attrs_animal_id_idx" ON "animal_attrs"("animal_id");

-- CreateIndex
CREATE INDEX "animal_attrs_clave_idx" ON "animal_attrs"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "animal_attrs_animal_id_clave_desde_key" ON "animal_attrs"("animal_id", "clave", "desde");

-- CreateIndex
CREATE INDEX "animal_lote_hist_animal_id_idx" ON "animal_lote_hist"("animal_id");

-- CreateIndex
CREATE INDEX "animal_lote_hist_lote_id_idx" ON "animal_lote_hist"("lote_id");

-- CreateIndex
CREATE INDEX "animal_lote_hist_animal_id_hasta_idx" ON "animal_lote_hist"("animal_id", "hasta");

-- CreateIndex
CREATE INDEX "ubicacion_hist_animal_id_idx" ON "ubicacion_hist"("animal_id");

-- CreateIndex
CREATE INDEX "ubicacion_hist_sector_id_idx" ON "ubicacion_hist"("sector_id");

-- CreateIndex
CREATE INDEX "ubicacion_hist_animal_id_hasta_idx" ON "ubicacion_hist"("animal_id", "hasta");

-- CreateIndex
CREATE UNIQUE INDEX "evt_paricion_nacido_animal_id_key" ON "evt_paricion"("nacido_animal_id");

-- CreateIndex
CREATE INDEX "evt_paricion_madre_id_idx" ON "evt_paricion"("madre_id");

-- CreateIndex
CREATE INDEX "evt_paricion_fecha_idx" ON "evt_paricion"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "evt_destete_animal_id_key" ON "evt_destete"("animal_id");

-- CreateIndex
CREATE INDEX "evt_destete_fecha_idx" ON "evt_destete"("fecha");

-- CreateIndex
CREATE INDEX "evt_destete_lote_destete_id_idx" ON "evt_destete"("lote_destete_id");

-- CreateIndex
CREATE INDEX "evt_pesada_animal_id_idx" ON "evt_pesada"("animal_id");

-- CreateIndex
CREATE INDEX "evt_pesada_lote_id_idx" ON "evt_pesada"("lote_id");

-- CreateIndex
CREATE INDEX "evt_pesada_fecha_idx" ON "evt_pesada"("fecha");

-- CreateIndex
CREATE INDEX "evt_movimiento_animal_id_idx" ON "evt_movimiento"("animal_id");

-- CreateIndex
CREATE INDEX "evt_movimiento_lote_id_idx" ON "evt_movimiento"("lote_id");

-- CreateIndex
CREATE INDEX "evt_movimiento_fecha_idx" ON "evt_movimiento"("fecha");

-- CreateIndex
CREATE INDEX "evt_sanidad_animal_id_idx" ON "evt_sanidad"("animal_id");

-- CreateIndex
CREATE INDEX "evt_sanidad_lote_id_idx" ON "evt_sanidad"("lote_id");

-- CreateIndex
CREATE INDEX "evt_sanidad_fecha_idx" ON "evt_sanidad"("fecha");

-- CreateIndex
CREATE INDEX "evt_sanidad_producto_id_idx" ON "evt_sanidad"("producto_id");

-- CreateIndex
CREATE INDEX "evt_sanidad_lote_producto_id_idx" ON "evt_sanidad"("lote_producto_id");

-- CreateIndex
CREATE INDEX "toradas_lote_id_idx" ON "toradas"("lote_id");

-- CreateIndex
CREATE INDEX "evt_servicio_hembra_id_idx" ON "evt_servicio"("hembra_id");

-- CreateIndex
CREATE INDEX "evt_servicio_macho_id_idx" ON "evt_servicio"("macho_id");

-- CreateIndex
CREATE INDEX "evt_servicio_torada_id_idx" ON "evt_servicio"("torada_id");

-- CreateIndex
CREATE INDEX "evt_servicio_fecha_idx" ON "evt_servicio"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "evt_tacto_servicio_id_key" ON "evt_tacto"("servicio_id");

-- CreateIndex
CREATE INDEX "evt_tacto_hembra_id_idx" ON "evt_tacto"("hembra_id");

-- CreateIndex
CREATE INDEX "evt_tacto_fecha_idx" ON "evt_tacto"("fecha");

-- CreateIndex
CREATE INDEX "evt_tacto_resultado_idx" ON "evt_tacto"("resultado");

-- CreateIndex
CREATE UNIQUE INDEX "evt_baja_animal_id_key" ON "evt_baja"("animal_id");

-- CreateIndex
CREATE INDEX "evt_baja_fecha_idx" ON "evt_baja"("fecha");

-- CreateIndex
CREATE INDEX "evt_baja_motivo_idx" ON "evt_baja"("motivo");

-- CreateIndex
CREATE INDEX "evt_baja_cliente_id_idx" ON "evt_baja"("cliente_id");

-- CreateIndex
CREATE INDEX "dietas_organizacion_id_idx" ON "dietas"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "dieta_componentes_dieta_id_insumo_key" ON "dieta_componentes"("dieta_id", "insumo");

-- CreateIndex
CREATE INDEX "planes_alimentacion_lote_id_idx" ON "planes_alimentacion"("lote_id");

-- CreateIndex
CREATE INDEX "planes_alimentacion_dieta_id_idx" ON "planes_alimentacion"("dieta_id");

-- CreateIndex
CREATE INDEX "planes_alimentacion_activo_idx" ON "planes_alimentacion"("activo");

-- CreateIndex
CREATE INDEX "evt_alimentacion_lote_id_idx" ON "evt_alimentacion"("lote_id");

-- CreateIndex
CREATE INDEX "evt_alimentacion_dieta_id_idx" ON "evt_alimentacion"("dieta_id");

-- CreateIndex
CREATE INDEX "evt_alimentacion_fecha_idx" ON "evt_alimentacion"("fecha");

-- CreateIndex
CREATE INDEX "evt_pastoreo_lote_id_idx" ON "evt_pastoreo"("lote_id");

-- CreateIndex
CREATE INDEX "evt_pastoreo_sector_id_idx" ON "evt_pastoreo"("sector_id");

-- CreateIndex
CREATE INDEX "evt_pastoreo_ingreso_idx" ON "evt_pastoreo"("ingreso");

-- CreateIndex
CREATE INDEX "audit_log_tabla_idx" ON "audit_log"("tabla");

-- CreateIndex
CREATE INDEX "audit_log_fecha_idx" ON "audit_log"("fecha");

-- CreateIndex
CREATE INDEX "audit_log_organizacion_id_idx" ON "audit_log"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_transito_numero_dta_key" ON "documentos_transito"("numero_dta");

-- CreateIndex
CREATE INDEX "documentos_transito_numero_dta_idx" ON "documentos_transito"("numero_dta");

-- CreateIndex
CREATE INDEX "documentos_transito_estado_idx" ON "documentos_transito"("estado");

-- CreateIndex
CREATE INDEX "documentos_transito_fecha_emision_idx" ON "documentos_transito"("fecha_emision");

-- CreateIndex
CREATE INDEX "documentos_transito_establecimiento_id_idx" ON "documentos_transito"("establecimiento_id");

-- CreateIndex
CREATE INDEX "tareas_estado_idx" ON "tareas"("estado");

-- CreateIndex
CREATE INDEX "tareas_prioridad_idx" ON "tareas"("prioridad");

-- CreateIndex
CREATE INDEX "tareas_asignado_a_id_idx" ON "tareas"("asignado_a_id");

-- CreateIndex
CREATE INDEX "tareas_establecimiento_id_idx" ON "tareas"("establecimiento_id");

-- CreateIndex
CREATE INDEX "tareas_fecha_limite_idx" ON "tareas"("fecha_limite");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_idx" ON "notificaciones"("usuario_id");

-- CreateIndex
CREATE INDEX "notificaciones_leida_idx" ON "notificaciones"("leida");

-- CreateIndex
CREATE INDEX "notificaciones_created_at_idx" ON "notificaciones"("created_at");

-- CreateIndex
CREATE INDEX "movimientos_stock_producto_id_idx" ON "movimientos_stock"("producto_id");

-- CreateIndex
CREATE INDEX "movimientos_stock_lote_producto_id_idx" ON "movimientos_stock"("lote_producto_id");

-- CreateIndex
CREATE INDEX "movimientos_stock_fecha_idx" ON "movimientos_stock"("fecha");

-- CreateIndex
CREATE INDEX "movimientos_stock_tipo_idx" ON "movimientos_stock"("tipo");

-- CreateIndex
CREATE INDEX "sesiones_manga_establecimiento_id_idx" ON "sesiones_manga"("establecimiento_id");

-- CreateIndex
CREATE INDEX "sesiones_manga_estado_idx" ON "sesiones_manga"("estado");

-- CreateIndex
CREATE INDEX "sesiones_manga_fecha_idx" ON "sesiones_manga"("fecha");

-- CreateIndex
CREATE INDEX "sesion_manga_items_sesion_id_idx" ON "sesion_manga_items"("sesion_id");

-- CreateIndex
CREATE INDEX "sesion_manga_items_eid_leido_idx" ON "sesion_manga_items"("eid_leido");

-- CreateIndex
CREATE INDEX "sesion_manga_items_animal_id_idx" ON "sesion_manga_items"("animal_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies" ADD CONSTRAINT "especies_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razas" ADD CONSTRAINT "razas_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razas" ADD CONSTRAINT "razas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establecimientos" ADD CONSTRAINT "establecimientos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector_forrajes" ADD CONSTRAINT "sector_forrajes_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector_forrajes" ADD CONSTRAINT "sector_forrajes_forraje_id_fkey" FOREIGN KEY ("forraje_id") REFERENCES "forrajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mediciones_potrero" ADD CONSTRAINT "mediciones_potrero_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_producto" ADD CONSTRAINT "lotes_producto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_producto" ADD CONSTRAINT "lotes_producto_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_raza_id_fkey" FOREIGN KEY ("raza_id") REFERENCES "razas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genealogias" ADD CONSTRAINT "genealogias_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genealogias" ADD CONSTRAINT "genealogias_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genealogias" ADD CONSTRAINT "genealogias_madre_id_fkey" FOREIGN KEY ("madre_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_attrs" ADD CONSTRAINT "animal_attrs_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_lote_hist" ADD CONSTRAINT "animal_lote_hist_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_lote_hist" ADD CONSTRAINT "animal_lote_hist_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicacion_hist" ADD CONSTRAINT "ubicacion_hist_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicacion_hist" ADD CONSTRAINT "ubicacion_hist_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_paricion" ADD CONSTRAINT "evt_paricion_madre_id_fkey" FOREIGN KEY ("madre_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_paricion" ADD CONSTRAINT "evt_paricion_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_paricion" ADD CONSTRAINT "evt_paricion_nacido_animal_id_fkey" FOREIGN KEY ("nacido_animal_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_destete" ADD CONSTRAINT "evt_destete_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_destete" ADD CONSTRAINT "evt_destete_lote_destete_id_fkey" FOREIGN KEY ("lote_destete_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_pesada" ADD CONSTRAINT "evt_pesada_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_pesada" ADD CONSTRAINT "evt_pesada_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_movimiento" ADD CONSTRAINT "evt_movimiento_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_movimiento" ADD CONSTRAINT "evt_movimiento_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_movimiento" ADD CONSTRAINT "evt_movimiento_origen_sector_id_fkey" FOREIGN KEY ("origen_sector_id") REFERENCES "sectores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_movimiento" ADD CONSTRAINT "evt_movimiento_destino_sector_id_fkey" FOREIGN KEY ("destino_sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_sanidad" ADD CONSTRAINT "evt_sanidad_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_sanidad" ADD CONSTRAINT "evt_sanidad_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_sanidad" ADD CONSTRAINT "evt_sanidad_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_sanidad" ADD CONSTRAINT "evt_sanidad_lote_producto_id_fkey" FOREIGN KEY ("lote_producto_id") REFERENCES "lotes_producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toradas" ADD CONSTRAINT "toradas_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_servicio" ADD CONSTRAINT "evt_servicio_hembra_id_fkey" FOREIGN KEY ("hembra_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_servicio" ADD CONSTRAINT "evt_servicio_macho_id_fkey" FOREIGN KEY ("macho_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_servicio" ADD CONSTRAINT "evt_servicio_torada_id_fkey" FOREIGN KEY ("torada_id") REFERENCES "toradas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_tacto" ADD CONSTRAINT "evt_tacto_hembra_id_fkey" FOREIGN KEY ("hembra_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_tacto" ADD CONSTRAINT "evt_tacto_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "evt_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_baja" ADD CONSTRAINT "evt_baja_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_baja" ADD CONSTRAINT "evt_baja_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietas" ADD CONSTRAINT "dietas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dieta_componentes" ADD CONSTRAINT "dieta_componentes_dieta_id_fkey" FOREIGN KEY ("dieta_id") REFERENCES "dietas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_alimentacion" ADD CONSTRAINT "planes_alimentacion_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_alimentacion" ADD CONSTRAINT "planes_alimentacion_dieta_id_fkey" FOREIGN KEY ("dieta_id") REFERENCES "dietas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_alimentacion" ADD CONSTRAINT "evt_alimentacion_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_alimentacion" ADD CONSTRAINT "evt_alimentacion_dieta_id_fkey" FOREIGN KEY ("dieta_id") REFERENCES "dietas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_pastoreo" ADD CONSTRAINT "evt_pastoreo_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_pastoreo" ADD CONSTRAINT "evt_pastoreo_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_transito" ADD CONSTRAINT "documentos_transito_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asignado_a_id_fkey" FOREIGN KEY ("asignado_a_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_lote_producto_id_fkey" FOREIGN KEY ("lote_producto_id") REFERENCES "lotes_producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_manga" ADD CONSTRAINT "sesiones_manga_lote_origen_id_fkey" FOREIGN KEY ("lote_origen_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_manga" ADD CONSTRAINT "sesiones_manga_producto_sanidad_id_fkey" FOREIGN KEY ("producto_sanidad_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_manga" ADD CONSTRAINT "sesiones_manga_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_manga" ADD CONSTRAINT "sesiones_manga_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_manga_items" ADD CONSTRAINT "sesion_manga_items_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "sesiones_manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_manga_items" ADD CONSTRAINT "sesion_manga_items_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

