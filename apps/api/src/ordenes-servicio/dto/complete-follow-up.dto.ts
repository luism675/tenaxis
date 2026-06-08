import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CompleteFollowUpDto {
  @IsDateString()
  contactedAt: string;

  @IsString()
  @IsNotEmpty()
  channel: string;

  @IsString()
  @IsNotEmpty()
  outcome: string;

  @IsString()
  @IsIn(['ACEPTADO', 'RECHAZADO'])
  resolution: 'ACEPTADO' | 'RECHAZADO';

  @IsString()
  @IsNotEmpty()
  notes: string;

  @IsDateString()
  @IsOptional()
  nextActionAt?: string;
}
