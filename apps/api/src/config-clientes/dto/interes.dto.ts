import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTipoInteresDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  frecuenciaSugerida?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  riesgoSugerido?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}

export class UpdateTipoInteresDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  frecuenciaSugerida?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  riesgoSugerido?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
