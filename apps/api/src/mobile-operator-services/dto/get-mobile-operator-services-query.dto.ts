import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum MobileOperatorServiceTab {
  TODAY = 'today',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
}

export class GetMobileOperatorServicesQueryDto {
  @IsEnum(MobileOperatorServiceTab)
  @IsOptional()
  tab?: MobileOperatorServiceTab = MobileOperatorServiceTab.TODAY;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}
