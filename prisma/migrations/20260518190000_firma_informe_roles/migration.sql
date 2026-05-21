-- Roles alineados con las firmas del informe diario (Evidencias y cierre)
INSERT INTO "RoleLabel" ("role", "label") VALUES
  ('RESPONSABLE_DILIGENCIAMIENTO', 'Responsable de diligenciamiento'),
  ('RESIDENTE_OBRA', 'Residente de obra'),
  ('AUXILIAR_INGENIERIA', 'Auxiliar de ingeniería'),
  ('DIRECTOR_OBRA', 'Director de obra')
ON CONFLICT ("role") DO UPDATE SET "label" = EXCLUDED."label";

-- Acceso al flujo del informe diario (sin configuración ni usuarios)
INSERT INTO "RoleMenuPermission" ("role", "menuKey")
SELECT r.role, m.menu_key
FROM (
  VALUES
    ('RESPONSABLE_DILIGENCIAMIENTO'),
    ('RESIDENTE_OBRA'),
    ('AUXILIAR_INGENIERIA'),
    ('DIRECTOR_OBRA')
) AS r(role)
CROSS JOIN (
  VALUES
    ('home'),
    ('datos'),
    ('jornada'),
    ('personal'),
    ('equipos'),
    ('actividades'),
    ('calidad'),
    ('evidencias'),
    ('tabulacion'),
    ('informeExportar')
) AS m(menu_key)
ON CONFLICT DO NOTHING;

-- Código en barra + firma en su casilla correspondiente
INSERT INTO "RoleFirmaPermission" ("role", "permKey") VALUES
  ('RESPONSABLE_DILIGENCIAMIENTO', 'token'),
  ('RESPONSABLE_DILIGENCIAMIENTO', 'responsableDiligenciamiento'),
  ('RESIDENTE_OBRA', 'token'),
  ('RESIDENTE_OBRA', 'residenteObra'),
  ('AUXILIAR_INGENIERIA', 'token'),
  ('AUXILIAR_INGENIERIA', 'auxiliarIngenieria'),
  ('DIRECTOR_OBRA', 'token'),
  ('DIRECTOR_OBRA', 'vistoBuenoDirectorObra')
ON CONFLICT DO NOTHING;
