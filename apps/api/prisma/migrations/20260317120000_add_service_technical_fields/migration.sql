ALTER TABLE "public"."ordenes_servicio"
ADD COLUMN "diagnosticoTecnico" TEXT,
ADD COLUMN "intervencionRealizada" TEXT,
ADD COLUMN "hallazgosEstructurales" TEXT,
ADD COLUMN "recomendacionesObligatorias" TEXT,
ADD COLUMN "huboSellamiento" BOOLEAN,
ADD COLUMN "huboRecomendacionEstructural" BOOLEAN,
ADD COLUMN "horaInicioReal" TIMESTAMP(3),
ADD COLUMN "horaFinReal" TIMESTAMP(3);
