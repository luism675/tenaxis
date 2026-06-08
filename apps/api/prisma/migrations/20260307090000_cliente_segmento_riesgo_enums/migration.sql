-- Create enum for standardized customer segment catalog.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SegmentoCliente') THEN
    CREATE TYPE "SegmentoCliente" AS ENUM (
      'HOGAR',
      'COMERCIO',
      'INDUSTRIA',
      'SALUD',
      'EDUCACION',
      'HORECA',
      'OFICINA',
      'OTRO'
    );
  END IF;
END
$$;

-- Ensure NivelRiesgo enum exists (it may not if it was previously unused at DB level).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NivelRiesgo') THEN
    CREATE TYPE "NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');
  END IF;
END
$$;

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "segmento" "SegmentoCliente" NOT NULL DEFAULT 'OTRO',
  ADD COLUMN IF NOT EXISTS "nivelRiesgo" "NivelRiesgo" NOT NULL DEFAULT 'MEDIO';

-- Backfill segmento from legacy dynamic table values.
UPDATE "clientes" c
SET "segmento" = CASE
  WHEN normalized_name IN ('HOGAR', 'RESIDENCIAL', 'PH / RESIDENCIAL', 'PH RESIDENCIAL') THEN 'HOGAR'::"SegmentoCliente"
  WHEN normalized_name IN ('COMERCIO', 'TIENDA', 'RETAIL', 'PANADERIA', 'RESTAURANTE') THEN 'COMERCIO'::"SegmentoCliente"
  WHEN normalized_name IN ('INDUSTRIA', 'INDUSTRIAL', 'BODEGA', 'INDUSTRIA ALIMENTOS') THEN 'INDUSTRIA'::"SegmentoCliente"
  WHEN normalized_name IN ('SALUD', 'IPS / SALUD', 'IPS SALUD', 'CLINICA', 'HOSPITAL') THEN 'SALUD'::"SegmentoCliente"
  WHEN normalized_name IN ('EDUCACION', 'COLEGIO', 'UNIVERSIDAD') THEN 'EDUCACION'::"SegmentoCliente"
  WHEN normalized_name IN ('HORECA', 'HOTEL', 'HOTELERIA') THEN 'HORECA'::"SegmentoCliente"
  WHEN normalized_name IN ('OFICINA', 'OFICINA ADMINISTRATIVA') THEN 'OFICINA'::"SegmentoCliente"
  ELSE 'OTRO'::"SegmentoCliente"
END
FROM (
  SELECT
    c2.id,
    UPPER(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(s.nombre, ''), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'))) AS normalized_name
  FROM "clientes" c2
  LEFT JOIN "segmentos_negocio" s ON s.id = c2."segmentoId"
) mapped
WHERE mapped.id = c.id;

-- Backfill nivelRiesgo from legacy dynamic table values.
UPDATE "clientes" c
SET "nivelRiesgo" = CASE
  WHEN normalized_risk IN ('CRITICO', 'CRÍTICO') THEN 'CRITICO'::"NivelRiesgo"
  WHEN normalized_risk = 'ALTO' THEN 'ALTO'::"NivelRiesgo"
  WHEN normalized_risk = 'BAJO' THEN 'BAJO'::"NivelRiesgo"
  ELSE 'MEDIO'::"NivelRiesgo"
END
FROM (
  SELECT
    c2.id,
    UPPER(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(r.nombre, ''), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'))) AS normalized_risk
  FROM "clientes" c2
  LEFT JOIN "niveles_riesgo_operativo" r ON r.id = c2."riesgoId"
) mapped
WHERE mapped.id = c.id;

-- Emit simple migration counts for audit visibility.
DO $$
DECLARE
  total_count bigint;
  otro_count bigint;
  medio_count bigint;
BEGIN
  SELECT COUNT(*) INTO total_count FROM "clientes";
  SELECT COUNT(*) INTO otro_count FROM "clientes" WHERE "segmento" = 'OTRO';
  SELECT COUNT(*) INTO medio_count FROM "clientes" WHERE "nivelRiesgo" = 'MEDIO';
  RAISE NOTICE 'clientes total: %, segmento OTRO: %, nivelRiesgo MEDIO: %', total_count, otro_count, medio_count;
END
$$;

ALTER TABLE "clientes"
  DROP COLUMN IF EXISTS "segmentoId",
  DROP COLUMN IF EXISTS "riesgoId";

DROP TABLE IF EXISTS "segmentos_negocio";
DROP TABLE IF EXISTS "niveles_riesgo_operativo";

CREATE INDEX IF NOT EXISTS "clientes_segmento_idx" ON "clientes"("segmento");
CREATE INDEX IF NOT EXISTS "clientes_nivelRiesgo_idx" ON "clientes"("nivelRiesgo");
