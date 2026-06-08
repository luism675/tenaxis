import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsUUID,
  IsArray,
  IsBoolean,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NivelInfestacion,
  TipoVisita,
  TipoFacturacion,
  EstadoPagoOrden,
  UrgenciaOrden,
  EstadoOrden,
} from '../../generated/client/client';

export class CreateOrdenServicioDto {
  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

  @IsUUID()
  @IsNotEmpty()
  empresaId: string;

  @IsUUID()
  @IsOptional()
  direccionId?: string;

  @IsUUID()
  @IsOptional()
  tecnicoId?: string;

  @IsBoolean()
  @IsOptional()
  sinTecnico?: boolean;

  @IsString()
  @IsOptional()
  direccionTexto?: string;

  @IsString()
  @IsOptional()
  servicioEspecifico?: string; // Mantener como opcional por retrocompatibilidad

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviciosSeleccionados?: string[];

  @IsUUID()
  @IsOptional()
  servicioId?: string;

  @IsString()
  @IsOptional()
  observacion?: string;

  @IsString()
  @IsOptional()
  diagnosticoTecnico?: string;

  @IsString()
  @IsOptional()
  intervencionRealizada?: string;

  @IsString()
  @IsOptional()
  hallazgosEstructurales?: string;

  @IsString()
  @IsOptional()
  recomendacionesObligatorias?: string;

  @IsBoolean()
  @IsOptional()
  huboSellamiento?: boolean;

  @IsBoolean()
  @IsOptional()
  huboRecomendacionEstructural?: boolean;

  @IsEnum(NivelInfestacion)
  @IsOptional()
  nivelInfestacion?: NivelInfestacion;

  @IsEnum(UrgenciaOrden)
  @IsOptional()
  urgencia?: UrgenciaOrden;

  @IsEnum(TipoVisita)
  @IsOptional()
  tipoVisita?: TipoVisita;

  @IsNumber()
  @IsOptional()
  frecuenciaSugerida?: number;

  @IsEnum(TipoFacturacion)
  @IsOptional()
  tipoFacturacion?: TipoFacturacion;

  @IsNumber()
  @IsOptional()
  valorCotizado?: number;

  @IsNumber()
  @IsOptional()
  valorRepuestos?: number;

  @IsUUID()
  @IsOptional()
  metodoPagoId?: string;

  @IsString()
  @IsOptional()
  entidadFinancieraNombre?: string;

  @IsUUID()
  @IsOptional()
  creadoPorId?: string;

  @IsUUID()
  @IsOptional()
  liquidadoPorId?: string;

  @IsEnum(EstadoOrden)
  @IsOptional()
  estadoServicio?: EstadoOrden;

  @IsEnum(EstadoPagoOrden)
  @IsOptional()
  estadoPago?: EstadoPagoOrden;

  @IsDateString()
  @IsOptional()
  fechaVisita?: string;

  @IsDateString()
  @IsOptional()
  horaInicio?: string;

  @IsDateString()
  @IsOptional()
  horaInicioReal?: string;

  @IsDateString()
  @IsOptional()
  horaFinReal?: string;

  @IsNumber()
  @IsOptional()
  duracionMinutos?: number; // Not directly in schema but can be used to calculate horaFin

  @IsString()
  @IsOptional()
  facturaPath?: string;

  @IsString()
  @IsOptional()
  facturaElectronica?: string;

  @IsString()
  @IsOptional()
  comprobantePago?: string;

  @IsString()
  @IsOptional()
  evidenciaPath?: string;

  @IsNumber()
  @IsOptional()
  valorPagado?: number;

  @IsString()
  @IsOptional()
  observacionFinal?: string;

  @IsString()
  @IsOptional()
  referenciaPago?: string;

  @IsDateString()
  @IsOptional()
  fechaPago?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferenciaRealDto)
  @IsOptional()
  transferencias?: TransferenciaRealDto[];

  @IsBoolean()
  @IsOptional()
  confirmarMovimientoFinanciero?: boolean;

  @IsOptional()
  desglosePago?: any[]; // Validaremos la estructura en el servicio para mayor flexibilidad con JSON
}

export class TransferenciaRealDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsString()
  @IsNotEmpty()
  comprobantePath: string;

  @IsString()
  @IsNotEmpty()
  referenciaPago: string;

  @IsDateString()
  @IsNotEmpty()
  fechaPago: string;

  @IsString()
  @IsOptional()
  banco?: string;

  @IsString()
  @IsOptional()
  observacion?: string;
}
