import { IsEnum, IsString } from 'class-validator';

export enum MobileOperatorServiceUploadKind {
  ARRIVAL_PHOTO = 'arrivalPhoto',
  EXIT_PHOTO = 'exitPhoto',
  PAYMENT_RECEIPT = 'paymentReceipt',
  INVOICE_PHOTO = 'invoicePhoto',
  ELECTRONIC_INVOICE = 'electronicInvoice',
  REPORT_EVIDENCE = 'reportEvidence',
  SERVICE_EVIDENCE = 'serviceEvidence',
}

export class CreateMobileOperatorServiceSignedUploadUrlDto {
  @IsEnum(MobileOperatorServiceUploadKind)
  kind: MobileOperatorServiceUploadKind;

  @IsString()
  fileName: string;
}
