import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class QueryClientesRankingKpisDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsBooleanString()
  refresh?: string;
}
