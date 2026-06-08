export interface MobileOperatorProductProviderDto {
  id: string;
  nombre: string;
}

export interface MobileOperatorProductItemDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  unidadMedida: string | null;
  precio: string | null;
  moneda: string | null;
  stockActual: number | null;
  stockMinimo: number | null;
  activo: boolean;
  proveedor: MobileOperatorProductProviderDto | null;
}

export type MobileOperatorProductListResponseDto =
  MobileOperatorProductItemDto[];
