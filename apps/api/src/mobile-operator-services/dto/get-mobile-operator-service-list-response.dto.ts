import { Prisma } from '../../generated/client/client';
import { MobileOperatorServiceTab } from './get-mobile-operator-services-query.dto';

export interface MobileOperatorServiceSummaryDto {
  today: number;
  completed: number;
  overdue: number;
}

export interface MobileOperatorServiceListServiceDto {
  id: string;
  nombre: string;
}

export interface MobileOperatorServiceNavigationDto {
  destinationSource: 'coordinates' | 'linkMaps' | 'address' | 'unknown';
  launchUrl: string | null;
  latitud: number | null;
  longitud: number | null;
  linkMaps: string | null;
}

export interface MobileOperatorServicePaginationDto {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface MobileOperatorServiceListItemDto {
  id: string;
  numeroOrden: string | null;
  fechaVisita: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  horaInicioReal: string | null;
  horaFinReal: string | null;
  estadoServicio: string;
  estadoPago: string;
  tipoVisita: string | null;
  urgencia: string | null;
  clienteNombre: string | null;
  direccion: string;
  servicioId: string;
  servicio: MobileOperatorServiceListServiceDto | null;
  serviciosSeleccionados: Prisma.JsonValue | null;
  llegadaRegistrada: boolean;
  salidaRegistrada: boolean;
  navigation: MobileOperatorServiceNavigationDto;
}

export interface MobileOperatorServiceListResponseDto {
  tab: MobileOperatorServiceTab;
  summary: MobileOperatorServiceSummaryDto;
  pagination: MobileOperatorServicePaginationDto;
  items: MobileOperatorServiceListItemDto[];
}
