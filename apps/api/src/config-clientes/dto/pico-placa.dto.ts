import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DiaSemana } from '../../generated/client/client';

export class PicoPlacaDiaDto {
  @IsEnum(DiaSemana)
  dia: DiaSemana;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9)
  numeroUno: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9)
  numeroDos: number;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}

export class UpsertPicoPlacaDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => PicoPlacaDiaDto)
  reglas: PicoPlacaDiaDto[];
}

export class QueryPicoPlacaRestriccionesDto {
  @IsString()
  empresaId: string;

  @IsISO8601()
  @IsOptional()
  fecha?: string;
}
