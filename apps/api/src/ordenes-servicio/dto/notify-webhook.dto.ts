import { IsNotEmpty, IsString } from 'class-validator';

export class NotifyLiquidationDto {
  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsString()
  @IsNotEmpty()
  cliente: string;

  @IsString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  servicio: string;

  @IsString()
  @IsNotEmpty()
  idServicio: string;
}

export class NotifyOperatorDto {
  @IsString()
  @IsNotEmpty()
  telefonoOperador: string;

  @IsString()
  @IsNotEmpty()
  numeroOrden: string;

  @IsString()
  @IsNotEmpty()
  cliente: string;

  @IsString()
  @IsNotEmpty()
  servicio: string;

  @IsString()
  @IsNotEmpty()
  programacion: string;

  @IsString()
  @IsNotEmpty()
  tecnico: string;

  @IsString()
  @IsNotEmpty()
  estado: string;

  @IsString()
  @IsNotEmpty()
  urgencia: string;

  @IsString()
  @IsNotEmpty()
  direccion: string;

  @IsString()
  @IsNotEmpty()
  linkMaps: string;

  @IsString()
  @IsNotEmpty()
  municipio: string;

  @IsString()
  @IsNotEmpty()
  barrio: string;

  @IsString()
  @IsNotEmpty()
  detalles: string;

  @IsString()
  @IsNotEmpty()
  valorCotizado: string;

  @IsString()
  @IsNotEmpty()
  metodosPago: string;

  @IsString()
  @IsNotEmpty()
  observaciones: string;

  @IsString()
  @IsNotEmpty()
  idServicio: string;
}
