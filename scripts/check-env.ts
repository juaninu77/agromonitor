/**
 * Script para verificar la configuración de variables de entorno
 * Ejecutar: pnpm env:check
 */

import { getCurrentEnvironment, getEnvironmentConfig } from '../config/environments';

const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
];

const optionalEnvVars = [
  'DIRECT_URL',
  'DEBUG_MODE',
  'WEATHER_API_KEY',
  'MARKET_API_KEY',
];

function checkEnvironment(): void {
  const env = getCurrentEnvironment();
  const config = getEnvironmentConfig();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   AgroMonitor - Verificación de ENV    ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log(`📍 Ambiente actual: ${config.displayName} (${env})`);
  console.log(`🔧 Modo debug: ${config.debug ? 'Activado' : 'Desactivado'}`);
  console.log(`🚀 Es producción: ${config.isProduction ? 'Sí' : 'No'}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Variables Requeridas:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let hasErrors = false;

  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    const display = value 
      ? (varName.includes('SECRET') || varName.includes('PASSWORD') 
          ? '****' + value.slice(-4) 
          : value.slice(0, 50) + (value.length > 50 ? '...' : ''))
      : 'NO CONFIGURADA';

    console.log(`${status} ${varName}`);
    console.log(`   └─ ${display}\n`);

    if (!value) {
      hasErrors = true;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Variables Opcionales:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const varName of optionalEnvVars) {
    const value = process.env[varName];
    const status = value ? '✅' : '⚪';
    const display = value 
      ? (varName.includes('KEY') 
          ? '****' + value.slice(-4) 
          : value)
      : 'No configurada (opcional)';

    console.log(`${status} ${varName}`);
    console.log(`   └─ ${display}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (hasErrors) {
    console.log('❌ Hay variables requeridas sin configurar.');
    console.log(`   Crea el archivo .env.${env} basándote en config/env.example.txt\n`);
    process.exit(1);
  } else {
    console.log('✅ Todas las variables requeridas están configuradas.\n');
  }
}

checkEnvironment();

