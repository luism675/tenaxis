export interface MonitoringPayrollPreviewItem {
  membershipId: string;
  empresaId: string;
  role: string;
  nombre: string;
  apellido: string;
  valorHora: number | null;
  sesionesCerradas: number;
  sesionesAbiertas: number;
  minutosBrutos: number;
  minutosInactivos: number;
  minutosPagables: number;
  horasPagables: number;
  pagoEstimado: number;
  estado: 'OK' | 'SIN_VALOR_HORA' | 'SIN_SESIONES_CERRADAS';
}

export interface MonitoringPayrollPreviewSummary {
  totalPersonas: number;
  elegibles: number;
  conIncidencias: number;
  horasPagables: number;
  totalEstimado: number;
}

export interface MonitoringPayrollPreviewResponse {
  date: string;
  items: MonitoringPayrollPreviewItem[];
  summary: MonitoringPayrollPreviewSummary;
}
