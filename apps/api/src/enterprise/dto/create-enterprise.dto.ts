import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEnterpriseDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  tenantId?: string;
}
