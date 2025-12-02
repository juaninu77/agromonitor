/**
 * Configuración de Ambientes para AgroMonitor
 * 
 * Este archivo define las configuraciones específicas para cada ambiente:
 * - development: Desarrollo local
 * - test: Pruebas automatizadas y CI/CD
 * - production: Producción
 */

export type Environment = 'development' | 'test' | 'production';

interface EnvironmentConfig {
  name: Environment;
  displayName: string;
  isProduction: boolean;
  debug: boolean;
  api: {
    timeout: number;
    retries: number;
  };
  database: {
    poolMin: number;
    poolMax: number;
    logQueries: boolean;
  };
  features: {
    enableMocks: boolean;
    enableDevTools: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
  };
}

const environments: Record<Environment, EnvironmentConfig> = {
  development: {
    name: 'development',
    displayName: 'Desarrollo',
    isProduction: false,
    debug: true,
    api: {
      timeout: 30000, // 30 segundos
      retries: 1,
    },
    database: {
      poolMin: 1,
      poolMax: 5,
      logQueries: true,
    },
    features: {
      enableMocks: true,
      enableDevTools: true,
      enableAnalytics: false,
      enableErrorReporting: false,
    },
  },

  test: {
    name: 'test',
    displayName: 'Pruebas',
    isProduction: false,
    debug: true,
    api: {
      timeout: 10000, // 10 segundos
      retries: 0,
    },
    database: {
      poolMin: 1,
      poolMax: 3,
      logQueries: false,
    },
    features: {
      enableMocks: true,
      enableDevTools: false,
      enableAnalytics: false,
      enableErrorReporting: false,
    },
  },

  production: {
    name: 'production',
    displayName: 'Producción',
    isProduction: true,
    debug: false,
    api: {
      timeout: 15000, // 15 segundos
      retries: 3,
    },
    database: {
      poolMin: 2,
      poolMax: 10,
      logQueries: false,
    },
    features: {
      enableMocks: false,
      enableDevTools: false,
      enableAnalytics: true,
      enableErrorReporting: true,
    },
  },
};

/**
 * Obtiene el ambiente actual basado en NODE_ENV
 */
export function getCurrentEnvironment(): Environment {
  const env = process.env.NODE_ENV as Environment;
  if (env && environments[env]) {
    return env;
  }
  return 'development';
}

/**
 * Obtiene la configuración del ambiente actual
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return environments[getCurrentEnvironment()];
}

/**
 * Verifica si estamos en un ambiente específico
 */
export function isEnvironment(env: Environment): boolean {
  return getCurrentEnvironment() === env;
}

/**
 * Verifica si estamos en producción
 */
export function isProduction(): boolean {
  return getEnvironmentConfig().isProduction;
}

/**
 * Verifica si estamos en desarrollo
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Verifica si estamos en modo test
 */
export function isTest(): boolean {
  return getCurrentEnvironment() === 'test';
}

export { environments };
export type { EnvironmentConfig };

