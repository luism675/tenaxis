import type { PortalCliente, PortalServicio, PortalServicioSeleccionado } from "./types";

export const portalDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Bogota",
});

export const portalDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export function formatPortalDate(value?: string | null, withTime = false) {
  if (!value) return "Por definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Por definir";
  return (withTime ? portalDateTimeFormatter : portalDateFormatter).format(date);
}

export function getClienteName(cliente: PortalCliente) {
  if (cliente.tipoCliente === "EMPRESA") {
    return cliente.razonSocial || "Cliente empresa";
  }

  const fullName = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ").trim();
  return fullName || cliente.razonSocial || "Cliente";
}

export function getClienteDocument(cliente: PortalCliente) {
  if (cliente.nit) return `NIT ${cliente.nit}`;
  if (cliente.numeroDocumento) {
    return [cliente.tipoDocumento, cliente.numeroDocumento].filter(Boolean).join(" ");
  }
  return "Documento no registrado";
}

export function getClienteEnterprise(cliente: PortalCliente) {
  if (!cliente.empresa) return null;
  if (typeof cliente.empresa === "string") return cliente.empresa;
  return cliente.empresa.nombre || cliente.empresa.razonSocial || null;
}

export function getServiceTitle(servicio?: PortalServicio | null) {
  if (!servicio) return "Sin visita registrada";
  const serviceName =
    typeof servicio.servicio === "string" ? servicio.servicio : servicio.servicio?.nombre;
  return serviceName || servicio.tipoServicio || "Atención programada";
}

export function getServiceDate(servicio?: PortalServicio | null) {
  return formatPortalDate(
    servicio?.fechaProgramada ||
      servicio?.fechaVisita ||
      servicio?.fechaServicio ||
      servicio?.fechaInicio ||
      servicio?.fechaFin,
    true,
  );
}

export function getServiceCode(servicio?: PortalServicio | null) {
  if (!servicio) return "Sin referencia";
  return (
    servicio.codigo ||
    (servicio.numeroOrden ? `Orden ${servicio.numeroOrden}` : null) ||
    (servicio.consecutivo ? `Orden ${servicio.consecutivo}` : null) ||
    "Atención"
  );
}

export function getServiceLocation(servicio?: PortalServicio | null) {
  if (!servicio) return "Ubicación por confirmar";
  const direccion =
    typeof servicio.direccion === "string"
      ? servicio.direccion
      : servicio.direccion?.texto;
  const barrio =
    typeof servicio.direccion === "object" && servicio.direccion
      ? servicio.direccion.barrio
      : servicio.barrio;
  const municipio =
    typeof servicio.direccion === "object" && servicio.direccion
      ? servicio.direccion.municipio
      : servicio.municipio;
  return [servicio.sede, direccion, barrio, municipio]
    .filter(Boolean)
    .join(" · ") || "Ubicación por confirmar";
}

export function getServiceAssignee(servicio?: PortalServicio | null) {
  if (!servicio) return "Equipo por confirmar";
  if (servicio.tecnico) return servicio.tecnico;
  const operatorName = [servicio.operador?.nombre, servicio.operador?.apellido]
    .filter(Boolean)
    .join(" ")
    .trim();
  return operatorName || "Equipo por confirmar";
}

export function getServiceSummary(servicio?: PortalServicio | null) {
  return servicio?.resumen || servicio?.observaciones || servicio?.observacion || "Sin observaciones visibles.";
}

function getSelectedServiceName(item: PortalServicioSeleccionado) {
  if (typeof item === "string") return item;
  return item.nombre || item.servicio || item.tipo || null;
}

export function getSelectedServices(servicio?: PortalServicio | null) {
  const selected = servicio?.serviciosSeleccionados;
  if (!selected) return [];

  if (Array.isArray(selected)) {
    return selected.map(getSelectedServiceName).filter((item): item is string => Boolean(item));
  }

  const values = Object.values(selected)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object") {
        return getSelectedServiceName(value as PortalServicioSeleccionado);
      }
      return null;
    });

  return values.filter((item): item is string => Boolean(item));
}

export function normalizeStatus(value?: string | null) {
  if (!value) return "Por confirmar";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w|\s\w/g, (letter) => letter.toUpperCase());
}
