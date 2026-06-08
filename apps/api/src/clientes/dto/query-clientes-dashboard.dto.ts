import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryClientesDashboardDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'PERSONA', 'EMPRESA'])
  tipoCliente?: 'all' | 'PERSONA' | 'EMPRESA';

  @IsOptional()
  @IsIn([
    'all',
    'riesgoFuga',
    'upsellPotencial',
    'dormidos',
    'operacionEstable',
  ])
  segment?:
    | 'all'
    | 'riesgoFuga'
    | 'upsellPotencial'
    | 'dormidos'
    | 'operacionEstable';

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  empresas?: string;

  @IsOptional()
  @IsString()
  dept?: string;

  @IsOptional()
  @IsString()
  muni?: string;

  @IsOptional()
  @IsString()
  barrio?: string;

  @IsOptional()
  @IsString()
  class?: string;

  @IsOptional()
  @IsString()
  seg?: string;

  @IsOptional()
  @IsString()
  risk?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  sinVisita?: string;

  @IsOptional()
  @IsString()
  pendingPayments?: string;

  @IsOptional()
  @IsString()
  sinServicios?: string;
}
