import { IsNotEmpty, IsString } from 'class-validator';

export class RemoveOrdenServicioDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
