import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class CreateServicioDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  empresaId: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereSeguimiento?: boolean;

  @IsInt()
  @Min(8)
  @Max(15)
  @IsOptional()
  primerSeguimientoDias?: number;

  @IsBoolean()
  @IsOptional()
  requiereSeguimientoTresMeses?: boolean;
}

export class UpdateServicioDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereSeguimiento?: boolean;

  @IsInt()
  @Min(8)
  @Max(15)
  @IsOptional()
  primerSeguimientoDias?: number;

  @IsBoolean()
  @IsOptional()
  requiereSeguimientoTresMeses?: boolean;
}
