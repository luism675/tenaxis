import { IsOptional, IsUUID } from 'class-validator';

export class QueryOperatorLocationsDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}

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
