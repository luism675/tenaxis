import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinTenantDto {
  @ApiProperty({ description: 'Slug del tenant al que se desea unir' })
  @IsString()
  @IsNotEmpty()
  slug: string;
}
