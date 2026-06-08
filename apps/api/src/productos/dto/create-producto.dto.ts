import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  precio?: number;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stockActual?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stockMinimo?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tiempoReposicion?: number;

  @IsUUID()
  @IsOptional()
  proveedorId?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
