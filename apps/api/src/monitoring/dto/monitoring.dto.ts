import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsEnum,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const normalizeQueryArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) =>
        typeof entry === 'string' ? entry.split(',') : String(entry),
      )
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return undefined;
};

export enum MonitoringAuditStatusFilter {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class RecordEventDto {
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  ruta?: string;
}

export class HeartbeatDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(60)
  @Type(() => Number)
  inactiveMinutes?: number;
}

export class MonitoringPaginationDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe estar en formato YYYY-MM-DD',
  })
  date?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate debe estar en formato YYYY-MM-DD',
  })
  startDate?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate debe estar en formato YYYY-MM-DD',
  })
  endDate?: string;
}

export class MonitoringAuditsQueryDto extends MonitoringPaginationDto {
  @Transform(normalizeQueryArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  actions?: string[];

  @Transform(normalizeQueryArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  users?: string[];

  @Transform(normalizeQueryArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  entities?: string[];

  @Transform(normalizeQueryArray)
  @IsArray()
  @IsEnum(MonitoringAuditStatusFilter, { each: true })
  @IsOptional()
  statuses?: MonitoringAuditStatusFilter[];

  @IsString()
  @IsOptional()
  entityId?: string;
}
