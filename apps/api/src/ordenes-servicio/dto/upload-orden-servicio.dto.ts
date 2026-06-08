import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export enum OrdenUploadKind {
  FACTURA_ELECTRONICA = 'facturaElectronica',
  COMPROBANTE_PAGO = 'comprobantePago',
  CONSIGNACION_TECNICO = 'consignacionTecnico',
  EVIDENCIAS = 'evidencias',
}

export class CreateSignedUploadUrlDto {
  @IsEnum(OrdenUploadKind)
  kind: OrdenUploadKind;

  @IsString()
  fileName: string;
}

export class CreateSignedDownloadUrlDto {
  @IsString()
  @IsNotEmpty()
  path: string;
}

export class ConfirmUploadedFilesDto {
  @IsEnum(OrdenUploadKind)
  kind: OrdenUploadKind;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  paths: string[];
}
