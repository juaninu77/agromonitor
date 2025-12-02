/**
 * Configuración Central de AgroMonitor
 * 
 * Exporta todas las configuraciones y utilidades de ambiente
 */

export * from './environments';
export * from './database';

// Re-exportar tipos principales
export type { Environment, EnvironmentConfig } from './environments';

