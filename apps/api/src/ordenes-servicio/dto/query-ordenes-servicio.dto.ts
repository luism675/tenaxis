import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  EstadoOrden,
  EstadoPagoOrden,
  MetodoPagoBase,
  UrgenciaOrden,
  TipoVisita,
} from '../../generated/client/client';
import {
  addBogotaDaysUtc,
  endOfBogotaDayUtc,
  endOfBogotaWeekUtc,
  startOfBogotaDayUtc,
  startOfBogotaWeekUtc,
  toBogotaDayBoundsUtc,
} from '../../common/utils/timezone.util';

export enum ServiciosPreset {
  HOY = 'HOY',
  MANANA = 'MANANA',
  SEMANA = 'SEMANA',
  SEGUIMIENTOS = 'SEGUIMIENTOS',
  ACCIONES_PENDIENTES = 'ACCIONES_PENDIENTES',
  SEGUIMIENTOS_CON_LLAMADAS = 'SEGUIMIENTOS_CON_LLAMADAS',
  SEGUIMIENTOS_SIN_LLAMADAS = 'SEGUIMIENTOS_SIN_LLAMADAS',
  VENCIDOS = 'VENCIDOS',
  SIN_TECNICO = 'SIN_TECNICO',
  PENDIENTES_LIQUIDAR = 'PENDIENTES_LIQUIDAR',
  RECHAZADOS = 'RECHAZADOS',
}

export enum DateSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryOrdenesServicioDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EstadoOrden)
  estado?: EstadoOrden;

  @IsOptional()
  @IsUUID()
  tecnicoId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  sinTecnico?: boolean;

  @IsOptional()
  @IsEnum(UrgenciaOrden)
  urgencia?: UrgenciaOrden;

  @IsOptional()
  @IsUUID()
  creadorId?: string;

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsString()
  departamento?: string;

  @IsOptional()
  @IsUUID()
  metodoPagoId?: string;

  @IsOptional()
  @IsEnum(MetodoPagoBase)
  metodoPagoBase?: MetodoPagoBase;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
        .map((item) => item.trim());
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  @IsArray()
  @IsEnum(MetodoPagoBase, { each: true })
  metodosPagoBase?: MetodoPagoBase[];

  @IsOptional()
  @IsEnum(EstadoPagoOrden)
  estadoPago?: EstadoPagoOrden;

  @IsOptional()
  @IsEnum(TipoVisita)
  tipoVisita?: TipoVisita;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsEnum(ServiciosPreset)
  preset?: ServiciosPreset;

  @IsOptional()
  @IsEnum(DateSortOrder)
  dateSortOrder?: DateSortOrder;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  refresh?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeFollowUps?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeKpis?: boolean;
}

export const normalizeSearchToken = (value?: string) =>
  value?.trim().toUpperCase() || undefined;

export const toLocalDayRange = (date: Date) => {
  return {
    start: startOfBogotaDayUtc(date),
    end: endOfBogotaDayUtc(date),
  };
};

export const applyPresetRange = (preset?: ServiciosPreset) => {
  if (!preset) return undefined;

  const now = new Date();

  if (preset === ServiciosPreset.HOY) {
    return toLocalDayRange(now);
  }

  if (preset === ServiciosPreset.MANANA) {
    const tomorrow = addBogotaDaysUtc(now, 1);
    return toLocalDayRange(tomorrow);
  }

  if (preset === ServiciosPreset.SEMANA) {
    const start = startOfBogotaWeekUtc(now);
    const end = endOfBogotaWeekUtc(now);
    return { start, end };
  }

  if (preset === ServiciosPreset.VENCIDOS) {
    const yesterday = addBogotaDaysUtc(now, -1);
    const yesterdayEnd = endOfBogotaDayUtc(yesterday);
    return { end: yesterdayEnd };
  }

  return undefined;
};

export const toDayBoundsFromIso = (iso?: string) => {
  if (!iso) return undefined;
  return toBogotaDayBoundsUtc(iso);
};
