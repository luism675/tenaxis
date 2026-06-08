const AUDIT_FIELD_LABELS: Record<string, string> = {
  clienteId: "Cliente",
  servicioId: "Servicio",
  creadoPorId: "Creado por",
  tecnicoId: "Técnico",
  liquidadoPorId: "Liquidado por",
  deletedById: "Eliminado por",
  membershipId: "Usuario",
  createdByMembershipId: "Creado por",
  adminId: "Administrador",
  direccionId: "Dirección",
  metodoPagoId: "Método de pago",
  entidadFinancieraId: "Entidad financiera",
  desglosePago: "Desglose de pago",
  comprobantePago: "Comprobante de pago",
  referenciaPago: "Referencia de pago",
  fechaPago: "Fecha de pago",
  estadoPago: "Estado de pago",
  numeroOrden: "Número de orden",
  observacion: "Observación",
  observacionFinal: "Observación final",
  valorCotizado: "Valor cotizado",
  valorPagado: "Valor pagado",
  valorRepuestos: "Valor repuestos",
  valorRepuestosTecnico: "Valor repuestos técnico",
  evidenciaPath: "Evidencia",
  facturaPath: "Factura",
  linkMaps: "Link Maps",
};

function capitalizeLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatAuditFieldLabel(key: string) {
  const normalizedKey = key.trim();

  if (!normalizedKey) {
    return "Campo";
  }

  if (AUDIT_FIELD_LABELS[normalizedKey]) {
    return AUDIT_FIELD_LABELS[normalizedKey];
  }

  return capitalizeLabel(
    normalizedKey
      .replace(/Id$/, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .trim(),
  );
}

function formatPrimitiveAuditValue(
  value: string | number | boolean | bigint,
): string {
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? new Intl.NumberFormat("es-CO").format(value)
      : String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return formatPrimitiveAuditValue(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const formattedItem = formatAuditValue(item)
          .trim()
          .replace(/\n+/g, " • ");

        if (!formattedItem) {
          return "";
        }

        return value.length > 1 ? `${index + 1}. ${formattedItem}` : formattedItem;
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, currentValue]) => {
        const formattedValue = formatAuditValue(currentValue)
          .trim()
          .replace(/\n+/g, " • ");

        if (!formattedValue) {
          return "";
        }

        return `${formatAuditFieldLabel(key)}: ${formattedValue}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(value);
}
