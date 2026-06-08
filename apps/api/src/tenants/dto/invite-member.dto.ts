import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsUUID,
} from 'class-validator';
import { Role } from '../../generated/client/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;

  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  apellido?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
  })
  password?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  empresaIds?: string[];
}
