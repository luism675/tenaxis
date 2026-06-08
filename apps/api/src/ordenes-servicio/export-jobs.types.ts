import { ExportOrdenesServicioDto } from './dto/export-ordenes-servicio.dto';

export interface OrdenesExportJobData {
  requestedBy: {
    userId: string;
    membershipId?: string;
    tenantId: string;
    email: string;
  };
  filters: ExportOrdenesServicioDto;
}

export interface OrdenesExportJobResult {
  filePath: string;
  fileName: string;
  totalRows: number;
  completedAt: string;
}
