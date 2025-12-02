/**
 * Script para configurar las variables de entorno iniciales
 * Ejecutar: pnpm env:setup
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const projectRoot = path.join(__dirname, '..');

const envTemplate = `# ========================================
# AgroMonitor - Ambiente: {{ENV_NAME}}
# ========================================
# Generado automáticamente por setup-env.ts

NODE_ENV={{NODE_ENV}}

# Base de datos Neon (Branch: {{BRANCH}})
DATABASE_URL="{{DATABASE_URL}}"
DIRECT_URL="{{DIRECT_URL}}"

# Autenticación
NEXTAUTH_SECRET="{{NEXTAUTH_SECRET}}"
NEXTAUTH_URL="{{NEXTAUTH_URL}}"

# Configuración
DEBUG_MODE={{DEBUG_MODE}}
`;

const environmentConfigs = {
  development: {
    ENV_NAME: 'Desarrollo',
    NODE_ENV: 'development',
    BRANCH: 'develop',
    NEXTAUTH_URL: 'http://localhost:3000',
    DEBUG_MODE: 'true',
  },
  test: {
    ENV_NAME: 'Pruebas',
    NODE_ENV: 'test',
    BRANCH: 'test',
    NEXTAUTH_URL: 'http://localhost:3000',
    DEBUG_MODE: 'true',
  },
  production: {
    ENV_NAME: 'Producción',
    NODE_ENV: 'production',
    BRANCH: 'main',
    NEXTAUTH_URL: 'https://tu-dominio.com',
    DEBUG_MODE: 'false',
  },
};

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   AgroMonitor - Setup de Ambientes     ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log('Este script te ayudará a crear los archivos de entorno.\n');
  console.log('Necesitarás tener configuradas las bases de datos en Neon:');
  console.log('  - Branch "develop" para desarrollo');
  console.log('  - Branch "test" para pruebas');
  console.log('  - Branch "main" para producción\n');

  console.log('📝 Instrucciones para crear branches en Neon:');
  console.log('  1. Ve a console.neon.tech');
  console.log('  2. Selecciona tu proyecto');
  console.log('  3. En el menú lateral, ve a "Branches"');
  console.log('  4. Crea los branches: develop, test (main ya existe)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    for (const [env, config] of Object.entries(environmentConfigs)) {
      const envFile = path.join(projectRoot, `.env.${env}`);
      
      if (fs.existsSync(envFile)) {
        const overwrite = await question(`\n⚠️  El archivo .env.${env} ya existe. ¿Sobrescribir? (s/N): `);
        if (overwrite.toLowerCase() !== 's') {
          console.log(`   Saltando .env.${env}`);
          continue;
        }
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 Configurando ambiente: ${config.ENV_NAME}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      const databaseUrl = await question(`DATABASE_URL (branch ${config.BRANCH}): `);
      const directUrl = await question(`DIRECT_URL (sin pooler, presiona Enter para usar la misma): `) || databaseUrl;
      
      let nextAuthSecret = await question(`NEXTAUTH_SECRET (Enter para generar automáticamente): `);
      if (!nextAuthSecret) {
        nextAuthSecret = generateSecret();
        console.log(`   Generado: ${nextAuthSecret.slice(0, 8)}...`);
      }

      let nextAuthUrl = await question(`NEXTAUTH_URL (Enter para usar ${config.NEXTAUTH_URL}): `);
      if (!nextAuthUrl) {
        nextAuthUrl = config.NEXTAUTH_URL;
      }

      let content = envTemplate;
      content = content.replace('{{ENV_NAME}}', config.ENV_NAME);
      content = content.replace('{{NODE_ENV}}', config.NODE_ENV);
      content = content.replace('{{BRANCH}}', config.BRANCH);
      content = content.replace('{{DATABASE_URL}}', databaseUrl);
      content = content.replace('{{DIRECT_URL}}', directUrl);
      content = content.replace('{{NEXTAUTH_SECRET}}', nextAuthSecret);
      content = content.replace('{{NEXTAUTH_URL}}', nextAuthUrl);
      content = content.replace('{{DEBUG_MODE}}', config.DEBUG_MODE);

      fs.writeFileSync(envFile, content);
      console.log(`\n✅ Archivo .env.${env} creado exitosamente.`);
    }

    // Crear .env principal que apunta a development por defecto
    const mainEnvFile = path.join(projectRoot, '.env');
    if (!fs.existsSync(mainEnvFile)) {
      const devEnvFile = path.join(projectRoot, '.env.development');
      if (fs.existsSync(devEnvFile)) {
        fs.copyFileSync(devEnvFile, mainEnvFile);
        console.log('\n✅ Archivo .env principal creado (copia de .env.development)');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Setup completado!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 Próximos pasos:');
    console.log('  1. Verifica la configuración: pnpm env:check');
    console.log('  2. Genera el cliente Prisma: pnpm db:generate');
    console.log('  3. Sincroniza la BD: pnpm db:push:dev');
    console.log('  4. Inicia el servidor: pnpm dev\n');

  } finally {
    rl.close();
  }
}

main().catch(console.error);

