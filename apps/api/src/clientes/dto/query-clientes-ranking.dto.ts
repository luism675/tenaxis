import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryClientesRankingDto {
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
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([
    'ranking',
    'cliente',
    'totalPagado',
    'ticketPromedio',
    'liquidados',
    'cancelacion',
    'noTomados',
  ])
  sort?:
    | 'ranking'
    | 'cliente'
    | 'totalPagado'
    | 'ticketPromedio'
    | 'liquidados'
    | 'cancelacion'
    | 'noTomados';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
