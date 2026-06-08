import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class RegisterMobileOperatorServiceArrivalDto {
  @IsString()
  @IsNotEmpty()
  fotoLlegadaPath: string;

  @IsNumber()
  @IsOptional()
  latitud?: number;

  @IsNumber()
  @IsOptional()
  longitud?: number;

  @IsString()
  @IsOptional()
  linkMaps?: string;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;
}
