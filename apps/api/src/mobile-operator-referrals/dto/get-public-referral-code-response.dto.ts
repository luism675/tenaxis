export class PublicReferralReferrerDto {
  membershipId!: string;
  nombre!: string | null;
  apellido!: string | null;
}

export class PublicReferralCodeResponseDto {
  valid!: boolean;
  code!: string;
  empresaId!: string | null;
  referrer!: PublicReferralReferrerDto | null;
}
