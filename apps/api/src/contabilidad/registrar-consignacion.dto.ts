import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class RegistrarConsignacionDto {
  @IsUUID()
  tecnicoId: string;

  @IsUUID()
  empresaId: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Number(value);
  })
  @IsNumber()
  valorConsignado?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Number(value);
  })
  @IsNumber()
  @Min(0)
  valorEntregado?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Number(value);
  })
  @IsNumber()
  @Min(0)
  valorAdelanto?: number;

  @IsString()
  referenciaBanco: string;

  @IsString()
  comprobantePath: string;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  confirmarEfectivoFisico: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ordenIds: string[];

  @IsDateString()
  fechaConsignacion: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
