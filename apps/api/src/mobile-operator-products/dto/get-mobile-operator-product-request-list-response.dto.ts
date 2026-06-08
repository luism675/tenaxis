import { EstadoSolicitudProductos } from '../../generated/client/client';

export interface MobileOperatorProductRequestProductDto {
  id: string;
  nombre: string;
  categoria: string | null;
  unidadMedida: string | null;
}

export interface MobileOperatorProductRequestItemDto {
  id: string;
  productoId: string;
  cantidad: string;
  unidadMedida: string | null;
  estado: EstadoSolicitudProductos;
  createdAt: Date;
  producto: MobileOperatorProductRequestProductDto;
}

export type MobileOperatorProductRequestListResponseDto =
  MobileOperatorProductRequestItemDto[];
