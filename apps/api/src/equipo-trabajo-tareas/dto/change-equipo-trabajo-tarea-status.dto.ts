import { IsEnum } from 'class-validator';
import { EquipoTrabajoTareaEstado } from '../../generated/client/client';

export class ChangeEquipoTrabajoTareaStatusDto {
  @IsEnum(EquipoTrabajoTareaEstado)
  estado!: EquipoTrabajoTareaEstado;
}
