import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MetodoPagoBase,
  NivelInfestacion,
} from '../../generated/client/client';

export class MobileOperatorServicePaymentBreakdownItemDto {
  @IsEnum(MetodoPagoBase)
  metodo: MetodoPagoBase;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsString()
  @IsOptional()
  banco?: string;

  @IsString()
  @IsOptional()
  referencia?: string;

  @IsString()
  @IsOptional()
  observacion?: string;
}

export class MobileOperatorServiceTransferDto {
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

export enum MobileOperatorServiceInvoiceType {
  PHYSICAL = 'physical',
  ELECTRONIC = 'electronic',
}

export class FinishMobileOperatorServiceDto {
  @IsString()
  @IsNotEmpty()
  fotoSalidaPath: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceEvidencePaths?: string[];

  @IsUUID()
  @IsOptional()
  metodoPagoId?: string;

  @IsString()
  @IsOptional()
  facturaPath?: string;

  @IsString()
  @IsOptional()
  facturaElectronica?: string;

  @IsEnum(MobileOperatorServiceInvoiceType)
  @IsOptional()
  invoiceType?: MobileOperatorServiceInvoiceType;

  @IsString()
  @IsOptional()
  comprobantePago?: string;

  @IsString()
  @IsOptional()
  referenciaPago?: string;

  @IsDateString()
  @IsOptional()
  fechaPago?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  montoPagado?: number;

  @IsBoolean()
  @IsOptional()
  facturaSolicitada?: boolean;

  @IsString()
  @IsOptional()
  observacionFinal?: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileOperatorServicePaymentBreakdownItemDto)
  @IsOptional()
  desglosePago?: MobileOperatorServicePaymentBreakdownItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileOperatorServiceTransferDto)
  @IsOptional()
  transferencias?: MobileOperatorServiceTransferDto[];

  @IsNumber()
  @IsOptional()
  latitud?: number;

  @IsNumber()
  @IsOptional()
  longitud?: number;

  @IsString()
  @IsOptional()
  linkMaps?: string;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;
}
