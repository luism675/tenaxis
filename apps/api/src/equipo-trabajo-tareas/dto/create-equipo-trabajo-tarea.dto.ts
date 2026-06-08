import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEquipoTrabajoTareaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  titulo!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  descripcion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  observaciones?: string;

  @IsUUID()
  @IsOptional()
  responsableMembershipId?: string | null;

  @IsDateString()
  @IsOptional()
  fechaLimite?: string;

  @IsUUID()
  @IsOptional()
  empresaId?: string;
}
