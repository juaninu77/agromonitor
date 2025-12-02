/**
 * Configuración de Base de Datos por Ambiente
 * 
 * Este archivo maneja las conexiones a diferentes bases de datos
 * según el ambiente (desarrollo, test, producción).
 * 
 * En Neon, recomendamos usar "branches" para cada ambiente:
 * - main: Producción
 * - develop: Desarrollo
 * - test: Pruebas automatizadas
 */

import { getCurrentEnvironment, type Environment } from './environments';

interface DatabaseConfig {
  name: string;
  branch: string;
  poolerEnabled: boolean;
  description: string;
}

/**
 * Configuración de branches de Neon para cada ambiente
 */
const databaseBranches: Record<Environment, DatabaseConfig> = {
  development: {
    name: 'agromonitor_dev',
    branch: 'develop',
    poolerEnabled: true,
    description: 'Base de datos de desarrollo - datos de prueba',
  },
  test: {
    name: 'agromonitor_test',
    branch: 'test',
    poolerEnabled: false,
    description: 'Base de datos de testing - se reinicia en cada test suite',
  },
  production: {
    name: 'agromonitor',
    branch: 'main',
    poolerEnabled: true,
    description: 'Base de datos de producción - datos reales',
  },
};

/**
 * Obtiene la configuración de base de datos para el ambiente actual
 */
export function getDatabaseConfig(): DatabaseConfig {
  return databaseBranches[getCurrentEnvironment()];
}

/**
 * Valida que la DATABASE_URL esté configurada
 */
export function validateDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    const env = getCurrentEnvironment();
    throw new Error(
      `DATABASE_URL no está configurada para el ambiente "${env}".\n` +
      `Por favor, configura la variable de entorno o crea el archivo .env.${env}`
    );
  }
}

/**
 * Obtiene la URL de la base de datos con validación
 */
export function getDatabaseUrl(): string {
  validateDatabaseUrl();
  return process.env.DATABASE_URL!;
}

/**
 * Verifica si la base de datos actual es de producción
 */
export function isProductionDatabase(): boolean {
  const config = getDatabaseConfig();
  return config.branch === 'main';
}

/**
 * Genera un warning si se está ejecutando una operación peligrosa en producción
 */
export function warnIfProduction(operation: string): void {
  if (isProductionDatabase()) {
    console.warn(
      `\n⚠️  ADVERTENCIA: Estás ejecutando "${operation}" en la base de datos de PRODUCCIÓN.\n` +
      `Branch: ${getDatabaseConfig().branch}\n`
    );
  }
}

export { databaseBranches };

