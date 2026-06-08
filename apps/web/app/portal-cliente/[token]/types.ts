export type PortalCliente = {
  id?: string;
  nombre?: string | null;
  apellido?: string | null;
  razonSocial?: string | null;
  tipoCliente?: "PERSONA" | "EMPRESA" | string | null;
  telefono?: string | null;
  telefono2?: string | null;
  correo?: string | null;
  numeroDocumento?: string | null;
  tipoDocumento?: string | null;
  nit?: string | null;
  empresa?: string | {
    nombre?: string | null;
    razonSocial?: string | null;
  } | null;
};

export type PortalDireccion = {
  texto?: string | null;
  barrio?: string | null;
  municipio?: string | null;
  departamento?: string | null;
};

export type PortalServicioSeleccionado =
  | string
  | {
      nombre?: string | null;
      servicio?: string | null;
      tipo?: string | null;
    };

export type PortalServicio = {
  id?: string;
  codigo?: string | null;
  consecutivo?: string | number | null;
  numeroOrden?: string | number | null;
  estado?: string | null;
  tipoServicio?: string | null;
  servicio?: string | {
    nombre?: string | null;
  } | null;
  serviciosSeleccionados?: PortalServicioSeleccionado[] | Record<string, unknown> | null;
  fechaProgramada?: string | null;
  fechaVisita?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fechaServicio?: string | null;
  direccion?: string | PortalDireccion | null;
  sede?: string | null;
  barrio?: string | null;
  municipio?: string | null;
  tecnico?: string | null;
  operador?: {
    nombre?: string | null;
    apellido?: string | null;
  } | null;
  resumen?: string | null;
  observacion?: string | null;
  observaciones?: string | null;
  recomendaciones?: string | null;
};

export type PortalPublicResponse = {
  cliente: PortalCliente;
  proximoServicio?: PortalServicio | null;
  ultimoServicio?: PortalServicio | null;
  historial: PortalServicio[];
  generadoAt?: string | null;
};
