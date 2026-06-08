export interface ApiResponse<T> {
  data: T;
  meta?: AuditMeta;
  message?: string;
}

export interface AuditFilterOption {
  value: string;
  label: string;
}

export interface AuditFilterOptions {
  actions: AuditFilterOption[];
  entities: AuditFilterOption[];
  statuses: AuditFilterOption[];
  users: AuditFilterOption[];
}

export interface AuditMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  filterOptions?: AuditFilterOptions;
  [key: string]: unknown;
}

export interface AuditFilters {
  entityId: string;
  actions: string[];
  users: string[];
  entities: string[];
  statuses: string[];
}

export interface User {
  nombre: string;
  apellido: string;
}

export interface Membership {
  id: string;
  username: string;
  role: string;
  user: User;
}

export interface Session {
  id: string;
  fechaInicio: string;
  fechaFin: string | null;
  tiempoInactivo: number;
  membershipId: string;
  membership: Membership;
  logs: Log[];
  updatedAt: string;
  ip: string;
  dispositivo: string;
}

export interface Log {
  id: string;
  tipo: string;
  descripcion: string;
  ruta?: string;
  createdAt: string;
  sesionId: string;
  sesion: {
    ip: string;
    dispositivo: string;
    membership: Membership;
  };
}

export interface Audit {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  membershipId: string;
  membership: Membership;
  detalles: {
    anterior?: unknown;
    nuevo?: unknown;
    resultado?: unknown;
  };
}

export interface MonitoringStats {
  totalEvents: number;
  activeSessions: number;
  totalInactivity: number;
}

export interface MonitoringAlert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  severity: 'alta' | 'media' | 'baja';
}

export interface MonitoringMetrics {
  avgActiveTimeMin: number;
  totalInactivityMin: number;
  topInactivity: { name: string; minutes: number }[];
  mttfeSec: number;
  userCount: number;
}

export interface ExecutiveAuditMetrics {
  today: { created: number; updated: number; deleted: number; total: number };
  week: { created: number; updated: number; deleted: number; total: number };
  topEntities: { name: string; count: number }[];
  topUsers: { name: string; count: number }[];
  successRate: number;
}

export type MonitoringPayrollStatus =
  | "OK"
  | "SIN_VALOR_HORA"
  | "SIN_SESIONES_CERRADAS";

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
  estado: MonitoringPayrollStatus;
}

export interface MonitoringPayrollPreviewSummary {
  totalPersonas: number;
  elegibles: number;
  conIncidencias: number;
  horasPagables: number;
  totalEstimado: number;
}

export interface MonitoringPayrollPreview {
  date: string;
  items: MonitoringPayrollPreviewItem[];
  summary: MonitoringPayrollPreviewSummary;
}

export interface GeneratedMonitoringPayroll {
  id: string;
  membershipId: string;
  totalPagar: number;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  membership?: Membership;
  colaborador?: string;
}

export interface GenerateMonitoringPayrollResponse {
  success?: boolean;
  generated?: GeneratedMonitoringPayroll[];
  nominas?: GeneratedMonitoringPayroll[];
  summary?: {
    total: number;
    totalPagar: number;
  };
  createdCount?: number;
  totalPagar?: number;
}
