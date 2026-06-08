import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateFollowUpOverrideDto {
  @IsUUID()
  @IsNotEmpty()
  membershipId: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
