import { Prisma } from '../../generated/client/client';
import { MobileOperatorServiceNavigationDto } from './get-mobile-operator-service-list-response.dto';

export interface MobileOperatorServiceDetailClientDto {
  nombre: string | null;
}

export interface MobileOperatorServiceDetailServiceDto {
  id: string;
  nombre: string;
}

export interface MobileOperatorServiceDetailAddressDto {
  direccionTexto: string;
  piso: string | null;
  bloque: string | null;
  unidad: string | null;
  barrio: string | null;
  municipio: string | null;
  departamento: string | null;
  linkMaps: string | null;
  latitud: number | null;
  longitud: number | null;
  precisionGPS: string | null;
}

export interface MobileOperatorServiceDetailPaymentMethodDto {
  id: string;
  nombre: string;
}

export interface MobileOperatorServiceDetailPaymentDto {
  metodoPago: MobileOperatorServiceDetailPaymentMethodDto | null;
  valorCotizado: number | null;
  valorPagado: number | null;
  estadoPago: string;
  metodosPagoBase: string[];
  desglosePago: Prisma.JsonValue | null;
  comprobantePago: Prisma.JsonValue | null;
  facturaPath: string | null;
  facturaElectronica: string | null;
  referenciaPago: string | null;
  fechaPago: string | null;
}

export interface MobileOperatorServiceGeolocationDto {
  id: string;
  llegada: string;
  salida: string | null;
  latitud: number | null;
  longitud: number | null;
  fotoLlegada: string | null;
  fotoSalida: string | null;
  linkMaps: string | null;
}

export interface MobileOperatorServiceActionsDto {
  canOpenNavigation: boolean;
  canMarkArrival: boolean;
  canFinish: boolean;
  canReport: boolean;
  canUploadEvidence: boolean;
}

export interface MobileOperatorServiceDetailResponseDto {
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
  cliente: MobileOperatorServiceDetailClientDto;
  servicio: MobileOperatorServiceDetailServiceDto | null;
  serviciosSeleccionados: Prisma.JsonValue | null;
  direccion: MobileOperatorServiceDetailAddressDto;
  observacion: string | null;
  observacionFinal: string | null;
  diagnosticoTecnico: string | null;
  intervencionRealizada: string | null;
  hallazgosEstructurales: string | null;
  recomendacionesObligatorias: string | null;
  huboSellamiento: boolean;
  huboRecomendacionEstructural: boolean;
  nivelInfestacion: string | null;
  payment: MobileOperatorServiceDetailPaymentDto;
  latestGeolocation: MobileOperatorServiceGeolocationDto | null;
  evidenciasCount: number;
  navigation: MobileOperatorServiceNavigationDto;
  actions: MobileOperatorServiceActionsDto;
}
