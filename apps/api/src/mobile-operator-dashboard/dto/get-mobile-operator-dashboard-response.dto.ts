import { Prisma } from '../../generated/client/client';

export class OperatorDashboardSummaryDto {
  serviciosHoy!: number;
  programadosHoy!: number;
  finalizadosHoy!: number;
  pendientesLiquidarHoy!: number;
  canceladosHoy!: number;
}

export class OperatorDashboardQueueDto {
  pendientes!: number;
  vencidos!: number;
}

export class OperatorDashboardAlertsDto {
  urgentesPendientes!: number;
  criticasPendientes!: number;
  serviciosSinEvidencia!: number;
  evidenciasSubidasHoy!: number;
}

export class OperatorDashboardActivityDto {
  sesionActiva!: boolean;
  horaInicioJornada!: string | null;
  duracionMin!: number;
  tiempoInactivo!: number;
}

export class OperatorDashboardCashCollectionDto {
  saldoPendiente!: number;
  ordenesPendientesCount!: number;
  ultimaTransferencia!: string | null;
  diasSinTransferir!: number;
}

export class OperatorDashboardNextServiceServicioDto {
  id!: string;
  nombre!: string;
}

export class OperatorDashboardNextServiceDto {
  id!: string;
  fechaVisita!: string;
  horaInicio!: string | null;
  horaVisita!: string | null;
  estadoServicio!: string;
  tipoVisita!: string | null;
  urgencia!: string | null;
  clienteNombre!: string | null;
  direccion!: string | null;
  servicioId!: string;
  servicio!: OperatorDashboardNextServiceServicioDto | null;
  serviciosSeleccionados!: Prisma.JsonValue | null;
}

export class OperatorDashboardResponseDto {
  summary!: OperatorDashboardSummaryDto;
  queue!: OperatorDashboardQueueDto;
  alerts!: OperatorDashboardAlertsDto;
  activity!: OperatorDashboardActivityDto;
  cashCollection!: OperatorDashboardCashCollectionDto;
  nextService!: OperatorDashboardNextServiceDto | null;
}
