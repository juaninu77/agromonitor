#!/bin/bash
# Script de backup para base de datos Neon PostgreSQL
# Uso: ./scripts/backup-db.sh

set -e  # Detener si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Crear directorio de backups si no existe
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# Obtener fecha y hora
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

# Verificar que DATABASE_URL esté configurada
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL no está configurada${NC}"
    echo "Por favor, configura DATABASE_URL en tu archivo .env"
    exit 1
fi

echo -e "${YELLOW}🔄 Creando backup de la base de datos...${NC}"

# Crear backup usando pg_dump
if command -v pg_dump &> /dev/null; then
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        # Obtener tamaño del archivo
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "${GREEN}✅ Backup creado exitosamente${NC}"
        echo -e "   Archivo: $BACKUP_FILE"
        echo -e "   Tamaño: $SIZE"
        
        # Mantener solo los últimos 7 backups
        echo -e "${YELLOW}🧹 Limpiando backups antiguos (manteniendo últimos 7)...${NC}"
        ls -t "$BACKUP_DIR"/backup_*.sql 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
        
        echo -e "${GREEN}✅ Backup completado${NC}"
    else
        echo -e "${RED}❌ Error al crear el backup${NC}"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
else
    echo -e "${RED}❌ Error: pg_dump no está instalado${NC}"
    echo "Instala PostgreSQL client tools para usar este script"
    echo "O usa el dashboard de Neon para crear backups manualmente"
    exit 1
fi

