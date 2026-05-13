export const MENU_KEYS = [
  'home',
  'datos',
  'jornada',
  'personal',
  'equipos',
  'actividades',
  'calidad',
  'evidencias',
  'tabulacion',
  'informeExportar',
  'bitacora',
  'settings',
  'users',
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

export const MENU_LABELS: Record<MenuKey, string> = {
  home: 'Inicio',
  datos: 'Datos generales',
  jornada: 'Jornada y condiciones',
  personal: 'Personal en obra',
  equipos: 'Equipos y materiales',
  actividades: 'Actividades desarrolladas',
  calidad: 'Calidad e incidentes',
  evidencias: 'Evidencias y cierre',
  tabulacion: 'Formato de tabulación',
  informeExportar: 'Exportar',
  bitacora: 'Bitácora Digital',
  settings: 'Configuración',
  users: 'Usuarios',
};

export const ROLES = [
  'SUPER_ADMIN',
  'INSPECTOR_TECNICO',
  'INSPECTOR_SSTMA',
  'RESIDENTE_TECNICO',
  'COSTOS',
  'DIRECTOR',
] as const;

export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  SUPER_ADMIN: 'Super administrador',
  INSPECTOR_TECNICO: 'Inspector técnico',
  INSPECTOR_SSTMA: 'Inspector SSTMA',
  RESIDENTE_TECNICO: 'Residente técnico',
  COSTOS: 'Costos',
  DIRECTOR: 'Director',
};
