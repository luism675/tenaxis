import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  pushToken!: string;
}
