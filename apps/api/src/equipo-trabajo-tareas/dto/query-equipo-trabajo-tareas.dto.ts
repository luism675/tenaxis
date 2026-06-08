import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { EquipoTrabajoTareaEstado } from '../../generated/client/client';

export type EquipoTrabajoTareaVencimiento = 'vencidas' | 'hoy' | 'semana';

export class QueryEquipoTrabajoTareasDto {
  @IsEnum(EquipoTrabajoTareaEstado)
  @IsOptional()
  estado?: EquipoTrabajoTareaEstado;

  @IsUUID()
  @IsOptional()
  responsableMembershipId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsIn(['vencidas', 'hoy', 'semana'])
  @IsOptional()
  vencimiento?: EquipoTrabajoTareaVencimiento;

  @IsUUID()
  @IsOptional()
  empresaId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
