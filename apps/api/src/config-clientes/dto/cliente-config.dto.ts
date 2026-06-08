import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpsertClienteConfigDto {
  @IsUUID()
  clienteId: string;

  @IsUUID()
  empresaId: string;

  @IsOptional()
  @IsUUID()
  direccionId?: string;

  @IsOptional()
  @IsString()
  protocoloServicio?: string;

  @IsOptional()
  @IsString()
  observacionesFijas?: string;

  @IsOptional()
  @IsBoolean()
  requiereFirmaDigital?: boolean;

  @IsOptional()
  @IsBoolean()
  requiereFotosEvidencia?: boolean;

  @IsOptional()
  @IsInt()
  duracionEstimada?: number;

  @IsOptional()
  @IsInt()
  frecuenciaSugerida?: number;

  @IsOptional()
  elementosPredefinidos?: any;
}
