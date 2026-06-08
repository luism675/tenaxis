import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSolicitudDto {
  @IsUUID()
  @IsNotEmpty()
  productoId: string;

  @IsString()
  @IsNotEmpty()
  cantidad: string;

  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @IsUUID()
  @IsOptional()
  membershipId?: string; // If an admin creates it for someone else
}
