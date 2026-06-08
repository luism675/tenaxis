import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterPushTokenParams {
  tenantId: string;
  membershipId: string;
  pushToken: string;
}

export interface SendServiceAssignedNotificationParams {
  tenantId: string;
  membershipId: string;
  serviceId: string;
}

export interface SendPaymentReminderNotificationParams {
  tenantId: string;
  membershipId: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: Record<string, string>;
}

interface ExpoPushResponseDataItem {
  id?: string;
  status?: 'ok' | 'error';
  message?: string;
  details?: unknown;
}

interface ExpoPushResponseBody {
  data?: ExpoPushResponseDataItem[];
  errors?: unknown[];
}

function isExpoPushResponseBody(value: unknown): value is ExpoPushResponseBody {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';
  private readonly expoPushTimeoutMs = 4_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async registerPushToken({
    tenantId,
    membershipId,
    pushToken,
  }: RegisterPushTokenParams): Promise<void> {
    const sanitizedPushToken = pushToken.trim();

    const result = await this.prisma.tenantMembership.updateMany({
      where: {
        id: membershipId,
        tenantId,
      },
      data: {
        pushToken: sanitizedPushToken,
      },
    });

    if (!result.count) {
      this.logger.warn(
        `No se pudo registrar pushToken porque la membresía ${membershipId} no existe en tenant ${tenantId}`,
      );
      throw new NotFoundException(
        'No encontramos la membresía autenticada para registrar el push token',
      );
    }

    this.logger.log(
      `Push token registrado para membership ${membershipId} en tenant ${tenantId}`,
    );
  }

  async sendServiceAssignedNotification({
    tenantId,
    membershipId,
    serviceId,
  }: SendServiceAssignedNotificationParams): Promise<boolean> {
    return this.sendNotificationToMembership(
      {
        tenantId,
        membershipId,
      },
      {
        title: 'Nuevo servicio asignado',
        body: 'Tenés un nuevo servicio programado. Revisalo en la app.',
        data: {
          type: 'service_assigned',
          serviceId,
        },
      },
    );
  }

  async sendPaymentReminderNotification({
    tenantId,
    membershipId,
  }: SendPaymentReminderNotificationParams): Promise<boolean> {
    return this.sendNotificationToMembership(
      {
        tenantId,
        membershipId,
      },
      {
        title: 'Recordatorio de cartera',
        body: 'Tenés dinero pendiente por reportar o entregar.',
        data: {
          type: 'payment_reminder',
        },
      },
    );
  }

  private async sendNotificationToMembership(
    target: {
      tenantId: string;
      membershipId: string;
    },
    template: Omit<ExpoPushMessage, 'to' | 'sound'>,
  ): Promise<boolean> {
    try {
      const membership = await this.prisma.tenantMembership.findFirst({
        where: {
          id: target.membershipId,
          tenantId: target.tenantId,
        },
        select: {
          pushToken: true,
        },
      });

      const pushToken = membership?.pushToken?.trim();
      if (!pushToken) {
        this.logger.warn(
          `Se omitió push notification ${template.data.type} porque membership ${target.membershipId} no tiene pushToken`,
        );
        return false;
      }

      return this.sendExpoNotification({
        to: pushToken,
        sound: 'default',
        ...template,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No pudimos procesar la push notification ${template.data.type} para membership ${target.membershipId}: ${message}`,
      );
      return false;
    }
  }

  private async sendExpoNotification(
    message: ExpoPushMessage,
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const expoAccessToken = this.configService
      .get<string>('EXPO_ACCESS_TOKEN')
      ?.trim();

    if (expoAccessToken) {
      headers.Authorization = `Bearer ${expoAccessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.expoPushTimeoutMs,
    );

    try {
      const response = await fetch(this.expoPushUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify([message]),
        signal: controller.signal,
      });
      const responseText = await response.text();
      const parsedBody = this.parseExpoResponseBody(responseText);

      if (!response.ok) {
        this.logger.error(
          `Expo respondió ${response.status} para push ${message.data.type}. Body: ${this.stringifyForLogs(parsedBody)}`,
        );
        return false;
      }

      const expoBody = isExpoPushResponseBody(parsedBody) ? parsedBody : null;
      const hasTicketErrors =
        expoBody?.data?.some((ticket) => ticket.status === 'error') ?? false;
      const hasTopLevelErrors = (expoBody?.errors?.length ?? 0) > 0;

      if (hasTicketErrors || hasTopLevelErrors) {
        this.logger.warn(
          `Expo devolvió errores para push ${message.data.type}. Body: ${this.stringifyForLogs(parsedBody)}`,
        );
        return false;
      }

      this.logger.log(
        `Push ${message.data.type} enviada a Expo. Tickets: ${this.stringifyForLogs(expoBody?.data ?? [])}`,
      );
      return true;
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : String(error);
      const timedOut = error instanceof Error && error.name === 'AbortError';
      this.logger.error(
        timedOut
          ? `Tiempo agotado enviando push ${message.data.type} a Expo`
          : `Error enviando push ${message.data.type} a Expo: ${messageText}`,
      );
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseExpoResponseBody(
    value: string,
  ): ExpoPushResponseBody | Record<string, unknown> | string | null {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as
        | ExpoPushResponseBody
        | Record<string, unknown>;
    } catch {
      return value;
    }
  }

  private stringifyForLogs(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
