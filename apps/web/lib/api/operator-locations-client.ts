import { apiFetch } from "@/lib/api/base-client";

export type OperatorLastLocationDto = {
  operatorId: string;
  operatorName: string;
  operatorRole?: string | null;
  empresaId: string;
  lastLocation: {
    latitud: number;
    longitud: number;
    llegada: string;
    salida: string | null;
    ordenId: string;
    numeroOrden: string | null;
    clienteNombre: string | null;
    direccionTexto: string | null;
    linkMaps: string | null;
  } | null;
};

type OperatorLocationsParams = {
  empresaId?: string;
};

const buildOperatorLocationsQuery = (params: OperatorLocationsParams = {}) => {
  const query = new URLSearchParams();

  if (params.empresaId) {
    query.set("empresaId", params.empresaId);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const operatorLocationsClient = {
  async getLastLocations(
    params: OperatorLocationsParams = {},
  ): Promise<OperatorLastLocationDto[]> {
    return apiFetch<OperatorLastLocationDto[]>(
      `/ordenes-servicio/operator-locations${buildOperatorLocationsQuery(params)}`,
    );
  },
};
