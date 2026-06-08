import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Role } from '../../generated/client/client';

export enum TeamScope {
  OPERATIVO = 'operativo',
  TODOS = 'todos',
}

export class TeamPerformanceQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsUUID()
  municipioId?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').filter(Boolean)
        : undefined,
  )
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @IsOptional()
  @IsEnum(TeamScope)
  scope?: TeamScope;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  activo?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
