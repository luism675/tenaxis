import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { FinanzasController } from '../src/contabilidad/contabilidad.controller';
import { ContabilidadService } from '../src/contabilidad/contabilidad.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../src/auth/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

describe('FinanzasController /finanzas/registrar-consignacion (integration)', () => {
  let app: INestApplication<App>;

  const registrarConsignacion = jest.fn();

  beforeEach(async () => {
    registrarConsignacion.mockReset().mockResolvedValue({ id: 'cons-1' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FinanzasController],
      providers: [
        {
          provide: ContabilidadService,
          useValue: {
            registrarConsignacion,
            getRecaudoTecnicos: jest.fn(),
            getAccountingBalance: jest.fn(),
            getEgresos: jest.fn(),
            getNominas: jest.fn(),
            getAnticipos: jest.fn(),
            generatePayrollFromMonitoring: jest.fn(),
            createEgreso: jest.fn(),
            createAnticipo: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<RequestWithUser>();
          req.user = {
            tenantId: 'tenant-1',
            membershipId: 'membership-1',
            role: 'ADMIN',
            email: 'admin@tenaxis.test',
            sub: 'user-1',
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('acepta payload JSON con ordenIds array real y comprobantePath', async () => {
    const payload = {
      tecnicoId: '11111111-1111-4111-8111-111111111111',
      empresaId: '22222222-2222-4222-8222-222222222222',
      valorConsignado: 60000,
      referenciaBanco: 'REF-JSON-001',
      comprobantePath: 'consignaciones/soporte-json.jpg',
      confirmarEfectivoFisico: true,
      ordenIds: [
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
      ],
      fechaConsignacion: '2026-03-26',
      observacion: 'Cierre mixto con payload JSON',
    };

    await request(app.getHttpServer())
      .post('/finanzas/registrar-consignacion')
      .send(payload)
      .expect(201)
      .expect({ id: 'cons-1' });

    expect(registrarConsignacion).toHaveBeenCalledWith(
      'tenant-1',
      'membership-1',
      expect.objectContaining({
        tecnicoId: payload.tecnicoId,
        empresaId: payload.empresaId,
        valorConsignado: payload.valorConsignado,
        referenciaBanco: payload.referenciaBanco,
        comprobantePath: payload.comprobantePath,
        confirmarEfectivoFisico: payload.confirmarEfectivoFisico,
        ordenIds: payload.ordenIds,
        fechaConsignacion: payload.fechaConsignacion,
        observacion: payload.observacion,
      }),
    );
  });

  it('rechaza con 400 si falta comprobantePath', async () => {
    const payload = {
      tecnicoId: '11111111-1111-4111-8111-111111111111',
      empresaId: '22222222-2222-4222-8222-222222222222',
      valorConsignado: 60000,
      referenciaBanco: 'REF-JSON-001',
      confirmarEfectivoFisico: true,
      ordenIds: ['33333333-3333-4333-8333-333333333333'],
      fechaConsignacion: '2026-03-26',
    };

    const response = await request(app.getHttpServer())
      .post('/finanzas/registrar-consignacion')
      .send(payload)
      .expect(400);

    const responseBody = response.body as { message: string | string[] };
    expect(responseBody.message).toContain('comprobantePath must be a string');
    expect(registrarConsignacion).not.toHaveBeenCalled();
  });

  it('acepta un mixto completamente resuelto y devuelve el cierre final de la orden', async () => {
    registrarConsignacion.mockResolvedValueOnce({
      id: 'cons-mixto-1',
      ordenesActualizadas: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          estadoPago: 'CONCILIADO',
          estadoServicio: 'LIQUIDADO',
        },
      ],
    });

    const payload = {
      tecnicoId: '11111111-1111-4111-8111-111111111111',
      empresaId: '22222222-2222-4222-8222-222222222222',
      valorConsignado: 60000,
      referenciaBanco: 'REF-MIXTO-OK',
      comprobantePath: 'consignaciones/mixto-resuelto.jpg',
      confirmarEfectivoFisico: true,
      ordenIds: ['33333333-3333-4333-8333-333333333333'],
      fechaConsignacion: '2026-03-26',
      observacion: 'Cierre final de mixto con transferencia ya validada',
    };

    await request(app.getHttpServer())
      .post('/finanzas/registrar-consignacion')
      .send(payload)
      .expect(201)
      .expect({
        id: 'cons-mixto-1',
        ordenesActualizadas: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            estadoPago: 'CONCILIADO',
            estadoServicio: 'LIQUIDADO',
          },
        ],
      });

    expect(registrarConsignacion).toHaveBeenCalledWith(
      'tenant-1',
      'membership-1',
      expect.objectContaining({
        tecnicoId: payload.tecnicoId,
        empresaId: payload.empresaId,
        valorConsignado: payload.valorConsignado,
        referenciaBanco: payload.referenciaBanco,
        comprobantePath: payload.comprobantePath,
        confirmarEfectivoFisico: payload.confirmarEfectivoFisico,
        ordenIds: payload.ordenIds,
        fechaConsignacion: payload.fechaConsignacion,
        observacion: payload.observacion,
      }),
    );
  });
});
