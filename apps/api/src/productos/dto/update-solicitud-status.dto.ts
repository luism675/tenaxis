import { IsEnum, IsNotEmpty } from 'class-validator';
import { EstadoSolicitudProductos } from '../../generated/client/client';

export class UpdateSolicitudStatusDto {
  @IsEnum(EstadoSolicitudProductos)
  @IsNotEmpty()
  estado: EstadoSolicitudProductos;
}
