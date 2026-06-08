import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class GenerateMonitoringPayrollDto {
  @IsUUID()
  empresaId: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @IsOptional()
  membershipIds?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeAllEligible?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
