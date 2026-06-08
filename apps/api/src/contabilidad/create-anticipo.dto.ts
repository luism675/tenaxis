import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAnticipoDto {
  @IsOptional()
  @IsString()
  membershipId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  razon?: string;

  @IsString()
  empresaId: string;

  @IsOptional()
  @IsDateString()
  fechaAnticipo?: string;
}
