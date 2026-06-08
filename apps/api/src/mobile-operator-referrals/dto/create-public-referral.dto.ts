import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePublicReferralDto {
  @IsString()
  @IsNotEmpty({ message: 'El código es requerido' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  apellido: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  telefono: string;
}
