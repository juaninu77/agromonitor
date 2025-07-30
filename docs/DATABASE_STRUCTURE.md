# 🗄️ Estructura de Base de Datos - Plataforma de Agricultura Inteligente

## Visión General

La base de datos está diseñada siguiendo principios de normalización, escalabilidad y performance. Utiliza PostgreSQL con extensiones especializadas para datos geoespaciales y análisis temporal.

## 🏗️ Arquitectura de Esquemas

### 1. **core** - Esquema Principal
Gestión de usuarios, organizaciones y configuración del sistema.

### 2. **livestock** - Esquema Ganadero
Manejo integral de ganado, producción y reproducción.

### 3. **crops** - Esquema Agrícola
Gestión de cultivos, fenología y manejo agronómico.

### 4. **finance** - Esquema Financiero
Contabilidad, costos y análisis económico.

### 5. **iot** - Esquema IoT
Dispositivos, sensores y datos en tiempo real.

### 6. **audit** - Esquema de Auditoría
Trazabilidad y logs del sistema.

---

## 📋 Definición de Tablas

### ESQUEMA: core

\`\`\`sql
-- Organizaciones (granjas, cooperativas, empresas)
CREATE TABLE core.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'farm', 'cooperative', 'enterprise'
    tax_id VARCHAR(50) UNIQUE,
    address JSONB,
    contact_info JSONB,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usuarios del sistema
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'operator', 'viewer'
    permissions JSONB DEFAULT '[]',
    avatar_url TEXT,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ubicaciones y lotes
CREATE TABLE core.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'field', 'pasture', 'facility', 'storage'
    area_hectares DECIMAL(10,4),
    geometry GEOMETRY(POLYGON, 4326), -- PostGIS para coordenadas
    soil_type VARCHAR(100),
    elevation INTEGER,
    slope_percentage DECIMAL(5,2),
    drainage_class VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración del sistema
CREATE TABLE core.system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### ESQUEMA: livestock

\`\`\`sql
-- Animales individuales
CREATE TABLE livestock.animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    tag_number VARCHAR(50) NOT NULL,
    name VARCHAR(100),
    species VARCHAR(50) NOT NULL, -- 'cattle', 'sheep', 'goat', 'pig'
    breed VARCHAR(100),
    gender VARCHAR(10) NOT NULL, -- 'male', 'female'
    birth_date DATE,
    birth_weight DECIMAL(6,2),
    current_weight DECIMAL(6,2),
    body_condition_score DECIMAL(2,1),
    genetic_value INTEGER,
    sire_id UUID REFERENCES livestock.animals(id),
    dam_id UUID REFERENCES livestock.animals(id),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'sold', 'deceased', 'culled'
    location_id UUID REFERENCES core.locations(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, tag_number)
);

-- Registros de producción (leche, huevos, etc.)
CREATE TABLE livestock.production_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID REFERENCES livestock.animals(id),
    record_date DATE NOT NULL,
    production_type VARCHAR(50) NOT NULL, -- 'milk', 'eggs', 'wool'
    quantity DECIMAL(8,3) NOT NULL,
    quality_metrics JSONB, -- fat%, protein%, SCC, etc.
    milking_session INTEGER, -- 1=morning, 2=afternoon, 3=evening
    operator_id UUID REFERENCES core.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historial reproductivo
CREATE TABLE livestock.reproductive_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID REFERENCES livestock.animals(id),
    event_type VARCHAR(50) NOT NULL, -- 'heat', 'insemination', 'pregnancy_check', 'calving'
    event_date DATE NOT NULL,
    details JSONB,
    outcome VARCHAR(50), -- 'successful', 'failed', 'pending'
    veterinarian_id UUID REFERENCES core.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registros sanitarios
CREATE TABLE livestock.health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID REFERENCES livestock.animals(id),
    record_date DATE NOT NULL,
    record_type VARCHAR(50) NOT NULL, -- 'vaccination', 'treatment', 'checkup', 'diagnosis'
    treatment_name VARCHAR(255),
    dosage VARCHAR(100),
    withdrawal_period INTEGER, -- días
    veterinarian_id UUID REFERENCES core.users(id),
    cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grupos de animales
CREATE TABLE livestock.animal_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_type VARCHAR(50), -- 'lactating', 'dry', 'heifers', 'calves'
    location_id UUID REFERENCES core.locations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Relación animales-grupos
CREATE TABLE livestock.animal_group_memberships (
    animal_id UUID REFERENCES livestock.animals(id),
    group_id UUID REFERENCES livestock.animal_groups(id),
    joined_date DATE NOT NULL,
    left_date DATE,
    PRIMARY KEY (animal_id, group_id, joined_date)
);

-- Planes nutricionales
CREATE TABLE livestock.nutrition_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL,
    target_group VARCHAR(100), -- 'lactating_cows', 'dry_cows', etc.
    daily_dry_matter DECIMAL(6,2),
    crude_protein DECIMAL(5,2),
    metabolizable_energy DECIMAL(5,2),
    neutral_detergent_fiber DECIMAL(5,2),
    calcium DECIMAL(4,3),
    phosphorus DECIMAL(4,3),
    ration_components JSONB, -- ingredientes y proporciones
    cost_per_day DECIMAL(8,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### ESQUEMA: crops

\`\`\`sql
-- Cultivos/variedades
CREATE TABLE crops.crop_varieties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    species VARCHAR(100) NOT NULL, -- 'Zea mays', 'Glycine max'
    common_name VARCHAR(100), -- 'Maíz', 'Soja'
    variety_type VARCHAR(50), -- 'hybrid', 'open_pollinated', 'gmo'
    maturity_days INTEGER,
    thermal_units_required INTEGER,
    yield_potential DECIMAL(6,2),
    characteristics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plantaciones/siembras
CREATE TABLE crops.plantings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    location_id UUID REFERENCES core.locations(id),
    crop_variety_id UUID REFERENCES crops.crop_varieties(id),
    planting_date DATE NOT NULL,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    area_planted DECIMAL(8,4), -- hectáreas
    plant_population INTEGER, -- plantas por hectárea
    row_spacing DECIMAL(4,2), -- cm
    planting_depth DECIMAL(4,1), -- cm
    seed_rate DECIMAL(6,2), -- kg/ha
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'harvested', 'failed'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Etapas fenológicas
CREATE TABLE crops.phenological_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planting_id UUID REFERENCES crops.plantings(id),
    stage_code VARCHAR(10) NOT NULL, -- 'VE', 'V6', 'R1', etc.
    stage_name VARCHAR(100) NOT NULL,
    date_reached DATE,
    percentage_reached DECIMAL(5,2) DEFAULT 0,
    thermal_units_accumulated INTEGER,
    observations TEXT,
    recorded_by UUID REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aplicaciones (fertilizantes, pesticidas, etc.)
CREATE TABLE crops.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planting_id UUID REFERENCES crops.plantings(id),
    application_date DATE NOT NULL,
    application_type VARCHAR(50) NOT NULL, -- 'fertilizer', 'herbicide', 'insecticide', 'fungicide'
    product_name VARCHAR(255) NOT NULL,
    active_ingredient VARCHAR(255),
    rate_per_hectare DECIMAL(8,3),
    total_amount DECIMAL(10,3),
    unit VARCHAR(20), -- 'kg', 'L', 'g'
    method VARCHAR(50), -- 'spray', 'broadcast', 'injection'
    weather_conditions JSONB,
    operator_id UUID REFERENCES core.users(id),
    cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoreo de plagas y enfermedades
CREATE TABLE crops.pest_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planting_id UUID REFERENCES crops.plantings(id),
    monitoring_date DATE NOT NULL,
    pest_type VARCHAR(50) NOT NULL, -- 'insect', 'disease', 'weed'
    pest_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255),
    severity_level INTEGER CHECK (severity_level BETWEEN 1 AND 5),
    economic_threshold INTEGER,
    area_affected DECIMAL(8,4), -- hectáreas
    control_measures TEXT,
    scout_id UUID REFERENCES core.users(id),
    photos JSONB, -- URLs de fotos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Análisis de suelos
CREATE TABLE crops.soil_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES core.locations(id),
    sample_date DATE NOT NULL,
    depth_cm INTEGER DEFAULT 20,
    ph DECIMAL(3,1),
    organic_matter DECIMAL(4,2),
    nitrogen_ppm DECIMAL(6,1),
    phosphorus_ppm DECIMAL(6,1),
    potassium_ppm DECIMAL(6,1),
    calcium_ppm DECIMAL(8,1),
    magnesium_ppm DECIMAL(6,1),
    sulfur_ppm DECIMAL(6,1),
    cec DECIMAL(5,2), -- capacidad de intercambio catiónico
    texture VARCHAR(50),
    bulk_density DECIMAL(4,2),
    infiltration_rate DECIMAL(5,2),
    laboratory VARCHAR(255),
    recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Riego
CREATE TABLE crops.irrigation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planting_id UUID REFERENCES crops.plantings(id),
    irrigation_date DATE NOT NULL,
    water_amount_mm DECIMAL(6,2),
    duration_minutes INTEGER,
    method VARCHAR(50), -- 'sprinkler', 'drip', 'flood', 'pivot'
    soil_moisture_before DECIMAL(5,2),
    soil_moisture_after DECIMAL(5,2),
    operator_id UUID REFERENCES core.users(id),
    energy_cost DECIMAL(8,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cosecha
CREATE TABLE crops.harvest_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planting_id UUID REFERENCES crops.plantings(id),
    harvest_date DATE NOT NULL,
    area_harvested DECIMAL(8,4),
    total_yield DECIMAL(10,2), -- kg
    yield_per_hectare DECIMAL(8,2),
    moisture_percentage DECIMAL(5,2),
    quality_grade VARCHAR(50),
    storage_location VARCHAR(255),
    operator_id UUID REFERENCES core.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### ESQUEMA: finance

\`\`\`sql
-- Cuentas contables
CREATE TABLE finance.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    account_code VARCHAR(20) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
    parent_account_id UUID REFERENCES finance.accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transacciones financieras
CREATE TABLE finance.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    transaction_date DATE NOT NULL,
    reference_number VARCHAR(50),
    description TEXT NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    transaction_type VARCHAR(50), -- 'sale', 'purchase', 'payment', 'receipt'
    related_entity_type VARCHAR(50), -- 'animal', 'planting', 'equipment'
    related_entity_id UUID,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detalles de transacciones (partida doble)
CREATE TABLE finance.transaction_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES finance.transactions(id),
    account_id UUID REFERENCES finance.accounts(id),
    debit_amount DECIMAL(12,2) DEFAULT 0,
    credit_amount DECIMAL(12,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Presupuestos
CREATE TABLE finance.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL,
    budget_year INTEGER NOT NULL,
    budget_type VARCHAR(50), -- 'operational', 'capital', 'project'
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'approved', 'active', 'closed'
    total_budget DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Líneas de presupuesto
CREATE TABLE finance.budget_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES finance.budgets(id),
    account_id UUID REFERENCES finance.accounts(id),
    category VARCHAR(100),
    budgeted_amount DECIMAL(12,2) NOT NULL,
    actual_amount DECIMAL(12,2) DEFAULT 0,
    variance DECIMAL(12,2) GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Centros de costo
CREATE TABLE finance.cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES core.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### ESQUEMA: iot

\`\`\`sql
-- Dispositivos IoT
CREATE TABLE iot.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    device_id VARCHAR(100) UNIQUE NOT NULL, -- ID único del dispositivo
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'sensor', 'actuator', 'gateway'
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    location_id UUID REFERENCES core.locations(id),
    coordinates POINT, -- ubicación exacta del dispositivo
    installation_date DATE,
    last_maintenance DATE,
    battery_level INTEGER CHECK (battery_level BETWEEN 0 AND 100),
    signal_strength INTEGER,
    firmware_version VARCHAR(50),
    configuration JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'maintenance', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tipos de sensores y sus métricas
CREATE TABLE iot.sensor_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    unit_of_measurement VARCHAR(20),
    min_value DECIMAL(10,4),
    max_value DECIMAL(10,4),
    accuracy DECIMAL(6,4),
    calibration_interval_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Datos de sensores (particionada por fecha)
CREATE TABLE iot.sensor_data (
    id UUID DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES iot.devices(id),
    sensor_type_id UUID REFERENCES iot.sensor_types(id),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    value DECIMAL(12,4) NOT NULL,
    quality_flag INTEGER DEFAULT 1, -- 1=good, 2=questionable, 3=bad
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Particiones mensuales para sensor_data
CREATE TABLE iot.sensor_data_2024_01 PARTITION OF iot.sensor_data
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE iot.sensor_data_2024_02 PARTITION OF iot.sensor_data
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... más particiones según necesidad

-- Alertas de dispositivos
CREATE TABLE iot.device_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES iot.devices(id),
    alert_type VARCHAR(50) NOT NULL, -- 'threshold', 'offline', 'battery_low', 'malfunction'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,
    threshold_value DECIMAL(12,4),
    actual_value DECIMAL(12,4),
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES core.users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comandos enviados a dispositivos
CREATE TABLE iot.device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES iot.devices(id),
    command_type VARCHAR(50) NOT NULL, -- 'irrigation_start', 'irrigation_stop', 'calibrate'
    command_payload JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'acknowledged', 'executed', 'failed'
    sent_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    response JSONB,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### ESQUEMA: audit

\`\`\`sql
-- Log de auditoría
CREATE TABLE audit.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    user_id UUID REFERENCES core.users(id),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Particiones trimestrales para audit_log
CREATE TABLE audit.audit_log_2024_q1 PARTITION OF audit.audit_log
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE audit.audit_log_2024_q2 PARTITION OF audit.audit_log
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Sesiones de usuario
CREATE TABLE audit.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES core.users(id),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    logout_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Log de errores del sistema
CREATE TABLE audit.error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_level VARCHAR(20) NOT NULL, -- 'ERROR', 'WARNING', 'CRITICAL'
    error_message TEXT NOT NULL,
    error_code VARCHAR(50),
    stack_trace TEXT,
    user_id UUID REFERENCES core.users(id),
    request_url TEXT,
    request_method VARCHAR(10),
    request_payload JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 🔧 Índices y Optimizaciones

### Índices Principales

\`\`\`sql
-- Índices para performance
CREATE INDEX idx_animals_org_status ON livestock.animals(organization_id, status);
CREATE INDEX idx_animals_tag ON livestock.animals(tag_number);
CREATE INDEX idx_production_animal_date ON livestock.production_records(animal_id, record_date DESC);
CREATE INDEX idx_plantings_org_status ON crops.plantings(organization_id, status);
CREATE INDEX idx_plantings_location ON crops.plantings(location_id);
CREATE INDEX idx_sensor_data_device_time ON iot.sensor_data(device_id, timestamp DESC);
CREATE INDEX idx_transactions_org_date ON finance.transactions(organization_id, transaction_date DESC);

-- Índices geoespaciales
CREATE INDEX idx_locations_geometry ON core.locations USING GIST(geometry);
CREATE INDEX idx_devices_coordinates ON iot.devices USING GIST(coordinates);

-- Índices para búsqueda de texto
CREATE INDEX idx_animals_search ON livestock.animals USING GIN(to_tsvector('spanish', name || ' ' || tag_number));
CREATE INDEX idx_plantings_search ON crops.plantings USING GIN(to_tsvector('spanish', COALESCE(notes, '')));
\`\`\`

### Vistas Materializadas

\`\`\`sql
-- Vista de producción diaria por animal
CREATE MATERIALIZED VIEW livestock.daily_production_summary AS
SELECT 
    animal_id,
    record_date,
    SUM(quantity) as total_production,
    AVG((quality_metrics->>'fat_percentage')::decimal) as avg_fat,
    AVG((quality_metrics->>'protein_percentage')::decimal) as avg_protein,
    AVG((quality_metrics->>'somatic_cell_count')::integer) as avg_scc
FROM livestock.production_records
WHERE record_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY animal_id, record_date;

CREATE UNIQUE INDEX ON livestock.daily_production_summary(animal_id, record_date);

-- Vista de resumen de cultivos activos
CREATE MATERIALIZED VIEW crops.active_plantings_summary AS
SELECT 
    p.id,
    p.organization_id,
    p.location_id,
    cv.common_name as crop_name,
    p.planting_date,
    p.area_planted,
    CURRENT_DATE - p.planting_date as days_since_planting,
    ps.stage_name as current_stage,
    ps.percentage_reached as stage_progress
FROM crops.plantings p
JOIN crops.crop_varieties cv ON p.crop_variety_id = cv.id
LEFT JOIN LATERAL (
    SELECT stage_name, percentage_reached
    FROM crops.phenological_stages 
    WHERE planting_id = p.id 
    ORDER BY date_reached DESC NULLS LAST
    LIMIT 1
) ps ON true
WHERE p.status = 'active';

CREATE UNIQUE INDEX ON crops.active_plantings_summary(id);
\`\`\`

---

## 🔒 Seguridad y Permisos

### Row Level Security (RLS)

\`\`\`sql
-- Habilitar RLS en tablas principales
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestock.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops.plantings ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY org_isolation ON core.organizations
    FOR ALL TO authenticated
    USING (id IN (
        SELECT organization_id FROM core.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY animals_org_policy ON livestock.animals
    FOR ALL TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM core.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY plantings_org_policy ON crops.plantings
    FOR ALL TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM core.users 
        WHERE id = auth.uid()
    ));
\`\`\`

### Triggers de Auditoría

\`\`\`sql
-- Función genérica de auditoría
CREATE OR REPLACE FUNCTION audit.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log (
            table_name, record_id, operation, old_values, user_id, timestamp
        ) VALUES (
            TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), 
            COALESCE(current_setting('app.current_user_id', true)::uuid, NULL),
            NOW()
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log (
            table_name, record_id, operation, old_values, new_values, user_id, timestamp
        ) VALUES (
            TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW),
            COALESCE(current_setting('app.current_user_id', true)::uuid, NULL),
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log (
            table_name, record_id, operation, new_values, user_id, timestamp
        ) VALUES (
            TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW),
            COALESCE(current_setting('app.current_user_id', true)::uuid, NULL),
            NOW()
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a tablas principales
CREATE TRIGGER audit_animals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON livestock.animals
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_function();

CREATE TRIGGER audit_plantings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON crops.plantings
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_function();
\`\`\`

---

## 📊 Funciones y Procedimientos

### Funciones de Cálculo

\`\`\`sql
-- Calcular días en leche
CREATE OR REPLACE FUNCTION livestock.calculate_days_in_milk(animal_id UUID)
RETURNS INTEGER AS $$
DECLARE
    last_calving_date DATE;
BEGIN
    SELECT MAX(event_date) INTO last_calving_date
    FROM livestock.reproductive_events
    WHERE animal_id = $1 AND event_type = 'calving';
    
    IF last_calving_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN CURRENT_DATE - last_calving_date;
END;
$$ LANGUAGE plpgsql;

-- Calcular unidades térmicas acumuladas
CREATE OR REPLACE FUNCTION crops.calculate_thermal_units(
    planting_id UUID,
    base_temp DECIMAL DEFAULT 10.0
) RETURNS INTEGER AS $$
DECLARE
    planting_date DATE;
    thermal_units INTEGER := 0;
    daily_temp RECORD;
BEGIN
    SELECT p.planting_date INTO planting_date
    FROM crops.plantings p WHERE p.id = $1;
    
    -- Aquí se calcularían las unidades térmicas basadas en datos climáticos
    -- Por simplicidad, retornamos un cálculo estimado
    RETURN (CURRENT_DATE - planting_date) * 15; -- Estimación simple
END;
$$ LANGUAGE plpgsql;
\`\`\`

### Procedimientos de Mantenimiento

\`\`\`sql
-- Limpieza automática de datos antiguos
CREATE OR REPLACE PROCEDURE maintenance.cleanup_old_data()
LANGUAGE plpgsql AS $$
BEGIN
    -- Eliminar datos de sensores mayores a 2 años
    DELETE FROM iot.sensor_data 
    WHERE timestamp < CURRENT_DATE - INTERVAL '2 years';
    
    -- Eliminar logs de auditoría mayores a 5 años
    DELETE FROM audit.audit_log 
    WHERE timestamp < CURRENT_DATE - INTERVAL '5 years';
    
    -- Actualizar estadísticas de tablas
    ANALYZE;
    
    RAISE NOTICE 'Limpieza de datos completada';
END;
$$;

-- Actualizar vistas materializadas
CREATE OR REPLACE PROCEDURE maintenance.refresh_materialized_views()
LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY livestock.daily_production_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY crops.active_plantings_summary;
    
    RAISE NOTICE 'Vistas materializadas actualizadas';
END;
$$;
\`\`\`

---

## 🚀 Consideraciones de Performance

### Particionamiento
- **sensor_data**: Particionada por mes para optimizar consultas temporales
- **audit_log**: Particionada por trimestre para gestión eficiente de logs

### Estrategias de Indexación
- Índices compuestos para consultas frecuentes
- Índices parciales para datos activos
- Índices GIN para búsqueda de texto completo
- Índices GIST para datos geoespaciales

### Optimizaciones de Consultas
- Vistas materializadas para reportes complejos
- Funciones almacenadas para cálculos frecuentes
- Conexiones de solo lectura para reportes

---

## 📈 Escalabilidad

### Horizontal
- Réplicas de lectura para reportes
- Sharding por organización para grandes volúmenes
- CDN para archivos estáticos

### Vertical
- Configuración optimizada de PostgreSQL
- Monitoreo de performance con pg_stat_statements
- Ajuste automático de parámetros

---

*Esta estructura de base de datos está diseñada para soportar el crecimiento y evolución de la plataforma de agricultura inteligente, manteniendo performance, seguridad y escalabilidad.*
