CREATE TABLE "bitacora_eventos" (
  "id" TEXT NOT NULL,
  "tipo_evento" TEXT NOT NULL,
  "modulo_origen" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "usuario_id" TEXT,
  "usuario" TEXT,
  "rol_usuario" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL,
  "hora" TEXT NOT NULL,
  "timestamp_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "precision_gps" DOUBLE PRECISION,
  "direccion_aproximada" TEXT,
  "dispositivo" TEXT,
  "navegador" TEXT,
  "ip" TEXT,
  "proyecto_id" TEXT NOT NULL,
  "informe_id" TEXT,
  "frente_obra_id" TEXT,
  "contratista_id" TEXT,
  "evidencia_fotografica" TEXT,
  "firma_asociada" TEXT,
  "observaciones" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
  "hash_integridad" TEXT NOT NULL,
  "source_model" TEXT,
  "source_id" TEXT,
  "payload" JSONB,
  "inconsistencias" JSONB,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bitacora_eventos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitacora_evidencias" (
  "id" TEXT NOT NULL,
  "evento_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "preview_url" TEXT,
  "fase" TEXT,
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "precision_gps" DOUBLE PRECISION,
  "geo_estado" TEXT,
  "tomada_en" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bitacora_evidencias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitacora_firmas" (
  "id" TEXT NOT NULL,
  "evento_id" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "firmante" TEXT,
  "rol_firmante" TEXT,
  "firmado_en" TIMESTAMP(3),
  "hash_firma" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bitacora_firmas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitacora_auditoria" (
  "id" TEXT NOT NULL,
  "evento_id" TEXT,
  "accion" TEXT NOT NULL,
  "tabla" TEXT NOT NULL,
  "registro_id" TEXT,
  "valor_anterior" JSONB,
  "valor_nuevo" JSONB,
  "usuario_id" TEXT,
  "usuario" TEXT,
  "rol_usuario" TEXT,
  "ip" TEXT,
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "timestamp_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bitacora_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitacora_clima" (
  "id" TEXT NOT NULL,
  "proyecto_id" TEXT NOT NULL,
  "informe_id" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL,
  "tipo" TEXT NOT NULL,
  "temperatura" DOUBLE PRECISION,
  "humedad" DOUBLE PRECISION,
  "observaciones" TEXT,
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "precision_gps" DOUBLE PRECISION,
  "capturado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bitacora_clima_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bitacora_eventos_proyecto_id_fecha_timestamp_utc_idx" ON "bitacora_eventos"("proyecto_id", "fecha", "timestamp_utc");
CREATE INDEX "bitacora_eventos_informe_id_modulo_origen_idx" ON "bitacora_eventos"("informe_id", "modulo_origen");
CREATE INDEX "bitacora_eventos_source_model_source_id_idx" ON "bitacora_eventos"("source_model", "source_id");
CREATE INDEX "bitacora_evidencias_evento_id_idx" ON "bitacora_evidencias"("evento_id");
CREATE INDEX "bitacora_firmas_evento_id_idx" ON "bitacora_firmas"("evento_id");
CREATE INDEX "bitacora_auditoria_tabla_registro_id_idx" ON "bitacora_auditoria"("tabla", "registro_id");
CREATE INDEX "bitacora_auditoria_timestamp_utc_idx" ON "bitacora_auditoria"("timestamp_utc");
CREATE UNIQUE INDEX "bitacora_clima_informe_id_key" ON "bitacora_clima"("informe_id");
CREATE INDEX "bitacora_clima_proyecto_id_fecha_idx" ON "bitacora_clima"("proyecto_id", "fecha");

ALTER TABLE "bitacora_eventos" ADD CONSTRAINT "bitacora_eventos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitacora_eventos" ADD CONSTRAINT "bitacora_eventos_informe_id_fkey" FOREIGN KEY ("informe_id") REFERENCES "InformeDiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bitacora_evidencias" ADD CONSTRAINT "bitacora_evidencias_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "bitacora_eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitacora_firmas" ADD CONSTRAINT "bitacora_firmas_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "bitacora_eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "bitacora_eventos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bitacora_clima" ADD CONSTRAINT "bitacora_clima_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitacora_clima" ADD CONSTRAINT "bitacora_clima_informe_id_fkey" FOREIGN KEY ("informe_id") REFERENCES "InformeDiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
