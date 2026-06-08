export class MobileOperatorReferralItemDto {
  id!: string;
  nombre!: string | null;
  apellido!: string | null;
  telefono!: string | null;
  createdAt!: Date;
}

export type MobileOperatorReferralListResponseDto =
  MobileOperatorReferralItemDto[];
