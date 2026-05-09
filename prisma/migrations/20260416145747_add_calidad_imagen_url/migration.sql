-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "consecutivo" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "evidenciasOnedriveShareUrl" TEXT,
    "evidenciasGoogleDriveFolderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrenteObraCatalog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrenteObraCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JornadaCatalog" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JornadaCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformeDiario" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "jornadaCatalogoId" TEXT,
    "condiciones" TEXT,
    "actividades" TEXT,
    "incidentes" TEXT,
    "evidenciasUrl" TEXT,
    "registroFotografico" BOOLEAN DEFAULT false,
    "observacionesGenerales" TEXT,
    "observaciones" TEXT,
    "informeCerrado" BOOLEAN NOT NULL DEFAULT false,
    "cerradoEn" TIMESTAMP(3),
    "informeConsecutivo" INTEGER,
    "informeNo" TEXT,
    "centroTrabajoConsecutivo" INTEGER,
    "centroTrabajo" TEXT,
    "frenteObra" TEXT,
    "frenteObraCatalogoId" TEXT,
    "contratista" TEXT,
    "contratistaCatalogoId" TEXT,
    "encargadoReporte" TEXT,
    "encargadoReporteCatalogoId" TEXT,
    "cargo" TEXT,
    "cargoCatalogoId" TEXT,
    "horaEntrada" TEXT,
    "horaSalida" TEXT,
    "huboSuspension" BOOLEAN DEFAULT false,
    "motivoSuspension" TEXT,
    "horaSuspension" TEXT,
    "horaReinicio" TEXT,
    "tipoClima" TEXT,
    "horasClima" DOUBLE PRECISION,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InformeDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformeSuspension" (
    "id" TEXT NOT NULL,
    "informeDiarioId" TEXT NOT NULL,
    "motivoSuspension" TEXT NOT NULL,
    "horaSuspension" TEXT NOT NULL,
    "horaReinicio" TEXT NOT NULL,
    "tipoClima" TEXT,
    "horasClima" DOUBLE PRECISION,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InformeSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmaInforme" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "codigo" TEXT NOT NULL DEFAULT '',
    "observacion" TEXT NOT NULL DEFAULT '',
    "firmadoEn" TIMESTAMP(3),
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmaInforme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalObra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "subcontratista" TEXT,
    "horaEntrada" TEXT,
    "horaSalida" TEXT,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipoObra" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "placaRef" TEXT,
    "propiedad" TEXT,
    "estado" TEXT,
    "horasTrabajadas" DOUBLE PRECISION,
    "horaIngreso" TEXT,
    "horaSalida" TEXT,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIngreso" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "tipoMaterial" TEXT NOT NULL,
    "noRemision" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialIngreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialEntrega" (
    "id" TEXT NOT NULL,
    "tipoMaterial" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION,
    "contratista" TEXT NOT NULL,
    "firmaRecibido" BOOLEAN NOT NULL DEFAULT false,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActividadObra" (
    "id" TEXT NOT NULL,
    "pk" TEXT NOT NULL,
    "abscisado" TEXT NOT NULL,
    "itemContractual" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "observacion" BOOLEAN NOT NULL DEFAULT false,
    "imagenUrl" TEXT,
    "largo" DOUBLE PRECISION,
    "ancho" DOUBLE PRECISION,
    "altura" DOUBLE PRECISION,
    "cantidadTotal" DOUBLE PRECISION,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActividadObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnsayoObra" (
    "id" TEXT NOT NULL,
    "materialActividad" TEXT NOT NULL,
    "tipoEnsayo" TEXT NOT NULL,
    "idMuestra" TEXT NOT NULL,
    "laboratorio" TEXT NOT NULL,
    "localizacion" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "observacion" TEXT,
    "imagenUrl" TEXT,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnsayoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanoRedesObra" (
    "id" TEXT NOT NULL,
    "horaReporte" TEXT,
    "direccion" TEXT NOT NULL,
    "tipoDano" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "noReporte" TEXT NOT NULL,
    "observacion" TEXT,
    "imagenUrl" TEXT,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DanoRedesObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoConformidadObra" (
    "id" TEXT NOT NULL,
    "noConformidad" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "imagenUrl" TEXT,
    "informeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoConformidadObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratistaCatalog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratistaCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncargadoReporteCatalog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncargadoReporteCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoCatalog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "consecutivo" INTEGER,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleMenuPermission" (
    "role" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,

    CONSTRAINT "RoleMenuPermission_pkey" PRIMARY KEY ("role","menuKey")
);

-- CreateTable
CREATE TABLE "RoleFirmaPermission" (
    "role" TEXT NOT NULL,
    "permKey" TEXT NOT NULL,

    CONSTRAINT "RoleFirmaPermission_pkey" PRIMARY KEY ("role","permKey")
);

-- CreateTable
CREATE TABLE "RoleLabel" (
    "role" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "RoleLabel_pkey" PRIMARY KEY ("role")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identification_key" ON "User"("identification");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "FrenteObraCatalog_projectId_isActive_orden_idx" ON "FrenteObraCatalog"("projectId", "isActive", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "FrenteObraCatalog_projectId_nombre_key" ON "FrenteObraCatalog"("projectId", "nombre");

-- CreateIndex
CREATE INDEX "JornadaCatalog_isActive_orden_idx" ON "JornadaCatalog"("isActive", "orden");

-- CreateIndex
CREATE INDEX "InformeDiario_projectId_date_jornadaCatalogoId_idx" ON "InformeDiario"("projectId", "date", "jornadaCatalogoId");

-- CreateIndex
CREATE UNIQUE INDEX "InformeDiario_projectId_date_jornadaCatalogoId_key" ON "InformeDiario"("projectId", "date", "jornadaCatalogoId");

-- CreateIndex
CREATE INDEX "InformeSuspension_informeDiarioId_orden_idx" ON "InformeSuspension"("informeDiarioId", "orden");

-- CreateIndex
CREATE INDEX "FirmaInforme_informeId_idx" ON "FirmaInforme"("informeId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmaInforme_informeId_slot_key" ON "FirmaInforme"("informeId", "slot");

-- CreateIndex
CREATE INDEX "ContratistaCatalog_projectId_isActive_nombre_idx" ON "ContratistaCatalog"("projectId", "isActive", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ContratistaCatalog_projectId_cedula_key" ON "ContratistaCatalog"("projectId", "cedula");

-- CreateIndex
CREATE INDEX "EncargadoReporteCatalog_projectId_isActive_nombre_idx" ON "EncargadoReporteCatalog"("projectId", "isActive", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "EncargadoReporteCatalog_projectId_cedula_key" ON "EncargadoReporteCatalog"("projectId", "cedula");

-- CreateIndex
CREATE INDEX "CargoCatalog_projectId_consecutivo_idx" ON "CargoCatalog"("projectId", "consecutivo");

-- CreateIndex
CREATE INDEX "CargoCatalog_projectId_isActive_nombre_idx" ON "CargoCatalog"("projectId", "isActive", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CargoCatalog_projectId_nombre_key" ON "CargoCatalog"("projectId", "nombre");

-- AddForeignKey
ALTER TABLE "FrenteObraCatalog" ADD CONSTRAINT "FrenteObraCatalog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeDiario" ADD CONSTRAINT "InformeDiario_jornadaCatalogoId_fkey" FOREIGN KEY ("jornadaCatalogoId") REFERENCES "JornadaCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeDiario" ADD CONSTRAINT "InformeDiario_frenteObraCatalogoId_fkey" FOREIGN KEY ("frenteObraCatalogoId") REFERENCES "FrenteObraCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeDiario" ADD CONSTRAINT "InformeDiario_contratistaCatalogoId_fkey" FOREIGN KEY ("contratistaCatalogoId") REFERENCES "ContratistaCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeDiario" ADD CONSTRAINT "InformeDiario_encargadoReporteCatalogoId_fkey" FOREIGN KEY ("encargadoReporteCatalogoId") REFERENCES "EncargadoReporteCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeDiario" ADD CONSTRAINT "InformeDiario_cargoCatalogoId_fkey" FOREIGN KEY ("cargoCatalogoId") REFERENCES "CargoCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeDiario" ADD CONSTRAINT "InformeDiario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeDiario" ADD CONSTRAINT "InformeDiario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeSuspension" ADD CONSTRAINT "InformeSuspension_informeDiarioId_fkey" FOREIGN KEY ("informeDiarioId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmaInforme" ADD CONSTRAINT "FirmaInforme_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalObra" ADD CONSTRAINT "PersonalObra_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipoObra" ADD CONSTRAINT "EquipoObra_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIngreso" ADD CONSTRAINT "MaterialIngreso_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialEntrega" ADD CONSTRAINT "MaterialEntrega_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActividadObra" ADD CONSTRAINT "ActividadObra_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnsayoObra" ADD CONSTRAINT "EnsayoObra_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanoRedesObra" ADD CONSTRAINT "DanoRedesObra_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoConformidadObra" ADD CONSTRAINT "NoConformidadObra_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratistaCatalog" ADD CONSTRAINT "ContratistaCatalog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncargadoReporteCatalog" ADD CONSTRAINT "EncargadoReporteCatalog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoCatalog" ADD CONSTRAINT "CargoCatalog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
