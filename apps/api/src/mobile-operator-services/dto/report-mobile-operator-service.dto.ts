import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum MobileOperatorServiceReportType {
  CLIENTE_AUSENTE = 'CLIENTE_AUSENTE',
  ACCESO_CERRADO = 'ACCESO_CERRADO',
  DIRECCION_INCORRECTA = 'DIRECCION_INCORRECTA',
  INCONVENIENTE_OPERATIVO = 'INCONVENIENTE_OPERATIVO',
  CLIENTE_RECHAZA_SERVICIO = 'CLIENTE_RECHAZA_SERVICIO',
  ZONA_INSEGURA = 'ZONA_INSEGURA',
  SERVICIO_DUPLICADO = 'SERVICIO_DUPLICADO',
  OTRO = 'OTRO',
}

export enum MobileOperatorServiceReportTargetStatus {
  REPROGRAMADO = 'REPROGRAMADO',
  CANCELADO = 'CANCELADO',
}

export class ReportMobileOperatorServiceDto {
  @IsEnum(MobileOperatorServiceReportType)
  tipo: MobileOperatorServiceReportType;

  @IsEnum(MobileOperatorServiceReportTargetStatus)
  @IsOptional()
  estadoDestino?: MobileOperatorServiceReportTargetStatus;

  @IsString()
  @IsOptional()
  motivo?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidenciaPaths?: string[];

  @IsNumber()
  @IsOptional()
  latitud?: number;

  @IsNumber()
  @IsOptional()
  longitud?: number;

  @IsString()
  @IsOptional()
  linkMaps?: string;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;
}
