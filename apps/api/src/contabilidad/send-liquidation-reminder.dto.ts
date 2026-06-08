import { IsOptional, IsUUID } from 'class-validator';

export class SendLiquidationReminderDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}
