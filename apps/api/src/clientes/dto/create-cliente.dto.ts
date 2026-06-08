import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NivelRiesgo,
  SegmentoCliente,
  TipoCliente,
} from '../../generated/client/enums';

class DireccionDto {
  @IsString()
  @IsOptional()
  nombreSede?: string;

  @IsString()
  @IsNotEmpty()
  direccion: string;

  @IsString()
  @IsOptional()
  piso?: string;

  @IsString()
  @IsOptional()
  bloque?: string;

  @IsString()
  @IsOptional()
  unidad?: string;

  @IsString()
  @IsOptional()
  barrio?: string;

  @IsString()
  @IsOptional()
  municipio?: string;

  @IsUUID()
  @IsOptional()
  municipioId?: string;

  @IsString()
  @IsOptional()
  tipoUbicacion?: string;

  @IsString()
  @IsOptional()
  clasificacionPunto?: string;

  @IsString()
  @IsOptional()
  horarioInicio?: string;

  @IsString()
  @IsOptional()
  horarioFin?: string;

  @IsString()
  @IsOptional()
  restricciones?: string;

  @IsOptional()
  latitud?: number | string;

  @IsOptional()
  longitud?: number | string;

  @IsOptional()
  precisionGPS?: number | string;

  @IsBoolean()
  @IsOptional()
  validadoPorSistema?: boolean;

  @IsString()
  @IsOptional()
  linkMaps?: string;

  @IsString()
  @IsOptional()
  nombreContacto?: string;

  @IsString()
  @IsOptional()
  telefonoContacto?: string;

  @IsString()
  @IsOptional()
  cargoContacto?: string;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;

  @IsBoolean()
  @IsOptional()
  bloqueada?: boolean;

  @IsString()
  @IsOptional()
  motivoBloqueo?: string;
}

class VehiculoDto {
  @IsString()
  @IsNotEmpty()
  placa: string;

  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  modelo?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  tipo?: string;
}

export class CreateClienteDto {
  @IsEnum(TipoCliente)
  tipoCliente: TipoCliente;

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  apellido?: string;

  @IsString()
  @IsOptional()
  razonSocial?: string;

  @IsString()
  @IsOptional()
  nit?: string;

  @IsString()
  @IsOptional()
  tipoDocumento?: string;

  @IsString()
  @IsOptional()
  numeroDocumento?: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsString()
  @IsOptional()
  telefono2?: string;

  @IsEmail()
  @IsOptional()
  correo?: string;

  // Inteligencia Comercial
  @IsString()
  @IsOptional()
  origenCliente?: string;

  @IsUUID()
  @IsOptional()
  tipoInteresId?: string;

  @IsString()
  @IsOptional()
  actividadEconomica?: string;

  @IsOptional()
  metrajeTotal?: number | string;

  @IsEnum(SegmentoCliente)
  @IsOptional()
  segmento?: SegmentoCliente;

  @IsString()
  @IsOptional()
  subsegmento?: string;

  @IsEnum(NivelRiesgo)
  @IsOptional()
  nivelRiesgo?: NivelRiesgo;

  @IsBoolean()
  @IsOptional()
  aceptaMarketing?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DireccionDto)
  direcciones?: DireccionDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VehiculoDto)
  vehiculos?: VehiculoDto[];
}
