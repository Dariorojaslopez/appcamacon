ALTER TABLE "InformeSuspension" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "InformeSuspension" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "InformeSuspension" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "InformeSuspension" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "InformeSuspension" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "EquipoObra" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "EquipoObra" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "EquipoObra" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "EquipoObra" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "EquipoObra" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "MaterialIngreso" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "MaterialIngreso" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "MaterialIngreso" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "MaterialIngreso" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "MaterialIngreso" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "MaterialEntrega" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "MaterialEntrega" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "MaterialEntrega" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "MaterialEntrega" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "MaterialEntrega" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "ActividadObra" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "ActividadObra" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "ActividadObra" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "ActividadObra" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "ActividadObra" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "EnsayoObra" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "EnsayoObra" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "EnsayoObra" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "EnsayoObra" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "EnsayoObra" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "DanoRedesObra" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "DanoRedesObra" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "DanoRedesObra" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "DanoRedesObra" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "DanoRedesObra" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "NoConformidadObra" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "NoConformidadObra" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "NoConformidadObra" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "NoConformidadObra" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "NoConformidadObra" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);

ALTER TABLE "ItemCatalog" ADD COLUMN "imagenLatitud" DOUBLE PRECISION;
ALTER TABLE "ItemCatalog" ADD COLUMN "imagenLongitud" DOUBLE PRECISION;
ALTER TABLE "ItemCatalog" ADD COLUMN "imagenPrecision" DOUBLE PRECISION;
ALTER TABLE "ItemCatalog" ADD COLUMN "imagenGeoEstado" TEXT;
ALTER TABLE "ItemCatalog" ADD COLUMN "imagenTomadaEn" TIMESTAMP(3);
