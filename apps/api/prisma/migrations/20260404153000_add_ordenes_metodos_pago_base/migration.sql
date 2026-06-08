ALTER TABLE "ordenes_servicio"
ADD COLUMN "metodosPagoBase" "MetodoPagoBase"[] DEFAULT ARRAY[]::"MetodoPagoBase"[];

UPDATE "ordenes_servicio" AS os
SET "metodosPagoBase" = COALESCE(derived.metodos_pago_base, ARRAY[]::"MetodoPagoBase"[])
FROM LATERAL (
  SELECT ARRAY(
    SELECT DISTINCT metodo
    FROM (
      SELECT
        CASE
          WHEN normalized_name LIKE '%EFECT%' THEN 'EFECTIVO'::"MetodoPagoBase"
          WHEN normalized_name LIKE '%TRANSFER%' THEN 'TRANSFERENCIA'::"MetodoPagoBase"
          WHEN normalized_name LIKE '%TARJETA%' OR normalized_name LIKE '%CREDI%' THEN 'CREDITO'::"MetodoPagoBase"
          WHEN normalized_name LIKE '%BONO%' THEN 'BONO'::"MetodoPagoBase"
          WHEN normalized_name LIKE '%CORT%' THEN 'CORTESIA'::"MetodoPagoBase"
          WHEN normalized_name LIKE '%PEND%' THEN 'PENDIENTE'::"MetodoPagoBase"
          WHEN normalized_name LIKE '%QR%' THEN 'TRANSFERENCIA'::"MetodoPagoBase"
          ELSE NULL
        END AS metodo
      FROM (
        SELECT TRANSLATE(UPPER(COALESCE(item->>'metodo', '')), 'ÁÉÍÓÚ', 'AEIOU') AS normalized_name
        FROM jsonb_array_elements(COALESCE(os."desglosePago", '[]'::jsonb)) AS item

        UNION ALL

        SELECT TRANSLATE(UPPER(COALESCE(mp."nombre", '')), 'ÁÉÍÓÚ', 'AEIOU') AS normalized_name
        FROM "metodos_pago" AS mp
        WHERE mp."id" = os."metodoPagoId"
      ) AS normalized_sources
    ) AS resolved_methods
    WHERE metodo IS NOT NULL
  ) AS metodos_pago_base
) AS derived;
