import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MobileOperatorReferralMeResponseDto } from './dto/get-mobile-operator-referral-me-response.dto';
import { OperatorReferralScope } from './types/operator-referral-scope.type';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_MAX_RETRIES = 20;

@Injectable()
export class MobileOperatorReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getMe(
    scope: OperatorReferralScope,
  ): Promise<MobileOperatorReferralMeResponseDto> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: scope.membershipId,
        tenantId: scope.tenantId,
        activo: true,
      },
      select: {
        codigoReferido: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('No se encontró la membresía del operador');
    }

    const code =
      membership.codigoReferido?.trim() ||
      (await this.assignReferralCode(scope));
    const shareUrl = this.buildShareUrl(code);

    return {
      code,
      shareUrl,
      qrValue: shareUrl,
    };
  }

  private async assignReferralCode(
    scope: OperatorReferralScope,
  ): Promise<string> {
    const code = await this.generateUniqueReferralCode();

    const result = await this.prisma.tenantMembership.updateMany({
      where: {
        id: scope.membershipId,
        tenantId: scope.tenantId,
      },
      data: {
        codigoReferido: code,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('No se encontró la membresía del operador');
    }

    return code;
  }

  private async generateUniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < REFERRAL_CODE_MAX_RETRIES; attempt += 1) {
      const candidate = this.buildReferralCodeCandidate();
      const existing = await this.prisma.tenantMembership.findFirst({
        where: {
          codigoReferido: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException(
      'No fue posible generar un código de referido único',
    );
  }

  private buildReferralCodeCandidate(): string {
    return Array.from({ length: REFERRAL_CODE_LENGTH }, () => {
      const index = randomInt(0, REFERRAL_CODE_ALPHABET.length);
      return REFERRAL_CODE_ALPHABET[index];
    }).join('');
  }

  private buildShareUrl(code: string): string {
    const baseUrl = this.resolveShareBaseUrl();
    return `${baseUrl}/registro-referidos?code=${encodeURIComponent(code)}`;
  }

  private resolveShareBaseUrl(): string {
    const candidates = [
      'PUBLIC_APP_URL',
      'APP_URL',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_WEB_URL',
      'WEB_URL',
      'CLIENT_URL',
    ];

    for (const key of candidates) {
      const value = this.configService.get<string>(key)?.trim();
      if (value) {
        return value.replace(/\/+$/, '');
      }
    }

    return 'http://localhost:3000';
  }
}
