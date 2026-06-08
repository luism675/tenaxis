import { IsOptional, IsString } from 'class-validator';

export class QueryClientesDashboardKpisDto {
  @IsOptional()
  @IsString()
  refresh?: string;
}
