import { PartialType } from '@nestjs/mapped-types';
import { CreateEnterpriseDto } from './create-enterprise.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEnterpriseDto extends PartialType(CreateEnterpriseDto) {
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
