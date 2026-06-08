import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CuentaCobroQueryDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}

export class CreateCuentaCobroTurnoDto {
  @IsUUID()
  empresaId: string;

  @IsISO8601({ strict: true })
  fecha: string;

  @Matches(TIME_HH_MM)
  horaEntrada: string;

  @Matches(TIME_HH_MM)
  horaSalida: string;

  @IsInt()
  @Min(0)
  descansoMinutos: number;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsString()
  fotoLlegada?: string;

  @IsOptional()
  @IsString()
  fotoSalida?: string;
}

export class UpdateCuentaCobroTurnoDto extends CreateCuentaCobroTurnoDto {}

export class CreateCuentaCobroUploadUrlDto {
  @IsUUID()
  empresaId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsIn(['llegada', 'salida'])
  tipo: 'llegada' | 'salida';
}
