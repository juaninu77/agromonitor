# Instalar Neon MCP Server para Claude Code

## ¿Qué es el Neon MCP Server?

Es un servidor que permite a Claude Code conectarse directamente a Neon Database y ejecutar operaciones como:
- Crear branches
- Listar databases
- Ejecutar queries
- Gestionar schemas

## Instalación

### Paso 1: Instalar el paquete

```bash
npm install -g @neondatabase/mcp-server
```

### Paso 2: Obtener tu API Key de Neon

1. Ve a [Neon Console](https://console.neon.tech)
2. Haz clic en tu avatar (arriba a la derecha)
3. Selecciona **"API keys"**
4. Haz clic en **"Generate new API key"**
5. Copia la API key (solo se muestra una vez)

### Paso 3: Configurar Claude Desktop

Edita el archivo de configuración de Claude Desktop:

**Windows:**
```
C:\Users\TU_USUARIO\AppData\Roaming\Claude\claude_desktop_config.json
```

**Mac/Linux:**
```
~/.config/claude/claude_desktop_config.json
```

Agrega esta configuración:

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": [
        "-y",
        "@neondatabase/mcp-server"
      ],
      "env": {
        "NEON_API_KEY": "tu-api-key-aqui"
      }
    }
  }
}
```

### Paso 4: Reiniciar Claude Code

1. Cierra completamente Claude Code
2. Vuelve a abrirlo
3. El MCP server de Neon estará disponible

### Paso 5: Verificar en Claude Code

Una vez instalado, yo podré:
- Ver tus proyectos de Neon
- Crear branches de desarrollo
- Gestionar databases
- Ejecutar queries directamente

## Troubleshooting

### Error: "command not found: npx"
Instala Node.js desde https://nodejs.org

### Error: "Invalid API key"
Verifica que copiaste correctamente la API key de Neon Console

### MCP no aparece después de reiniciar
Verifica que el archivo JSON esté bien formado (sin comas extras, comillas correctas)
