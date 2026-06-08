import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMobileOperatorProductRequestDto {
  @IsUUID()
  productoId!: string;

  @IsString()
  @IsNotEmpty()
  cantidad!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unidadMedida?: string;
}
