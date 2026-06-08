import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EstadoContratoCliente,
  TipoFacturacion,
} from '../../generated/client/client';

export class CreateContratoClienteDto {
  @IsUUID()
  empresaId: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  serviciosComprometidos?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  frecuenciaServicio?: number;

  @IsEnum(TipoFacturacion)
  tipoFacturacion: TipoFacturacion;

  @IsEnum(EstadoContratoCliente)
  @IsOptional()
  estado?: EstadoContratoCliente;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
