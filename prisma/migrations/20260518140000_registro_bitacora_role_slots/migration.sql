-- Permisos por rol para secciones del registro de bitácora
CREATE TABLE "RoleRegistroBitacoraPermission" (
    "role" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,

    CONSTRAINT "RoleRegistroBitacoraPermission_pkey" PRIMARY KEY ("role","slotKey")
);

-- Roles de bitácora
INSERT INTO "RoleLabel" ("role", "label") VALUES
  ('CONTRATISTA', 'Contratista'),
  ('INTERVENTOR', 'Interventor'),
  ('IDU', 'IDU')
ON CONFLICT ("role") DO UPDATE SET "label" = EXCLUDED."label";

-- Por defecto: cada rol solo su sección; super admin las tres
INSERT INTO "RoleRegistroBitacoraPermission" ("role", "slotKey") VALUES
  ('SUPER_ADMIN', 'contratista'),
  ('SUPER_ADMIN', 'interventor'),
  ('SUPER_ADMIN', 'idu'),
  ('CONTRATISTA', 'contratista'),
  ('INTERVENTOR', 'interventor'),
  ('IDU', 'idu')
ON CONFLICT DO NOTHING;
