import { Role } from '../generated/client/client';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';

describe('ClientPortalController', () => {
  it('delegates protected link creation with the authenticated user', async () => {
    const createLink = jest.fn().mockResolvedValue({
      url: 'https://portal.test/portal-cliente/token',
      expiresAt: new Date('2026-06-18T12:00:00.000Z'),
    });
    const service = {
      createLink,
      getPublicDashboard: jest.fn(),
    } as unknown as jest.Mocked<ClientPortalService>;
    const controller = new ClientPortalController(service);
    const user = {
      sub: 'user-1',
      email: 'u@test.com',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
    };

    await controller.createLink({ user } as never, 'cliente-1', {
      baseUrl: 'https://portal.test',
    });

    expect(createLink).toHaveBeenCalledWith(user, 'cliente-1', {
      baseUrl: 'https://portal.test',
    });
  });

  it('delegates public token dashboard without auth context', async () => {
    const getPublicDashboard = jest
      .fn()
      .mockResolvedValue({ generadoAt: new Date() });
    const service = {
      createLink: jest.fn(),
      getPublicDashboard,
    } as unknown as jest.Mocked<ClientPortalService>;
    const controller = new ClientPortalController(service);

    await controller.getPublicDashboard('public-token');

    expect(getPublicDashboard).toHaveBeenCalledWith('public-token');
  });
});
