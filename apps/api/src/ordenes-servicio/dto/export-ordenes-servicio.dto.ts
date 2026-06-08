import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  EstadoOrden,
  EstadoPagoOrden,
  MetodoPagoBase,
  TipoVisita,
  UrgenciaOrden,
} from '../../generated/client/client';
import { ServiciosPreset } from './query-ordenes-servicio.dto';

export class ExportOrdenesServicioDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  empresaIds?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeAllEmpresas?: boolean;

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
}
