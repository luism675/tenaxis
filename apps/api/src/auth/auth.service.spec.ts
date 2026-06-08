import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/client/client';
import { AuthService } from './auth.service';

type PasswordResetCreateArg = {
  data: {
    id: string;
    userId: string;
    tokenHash: string;
    tenantId?: string;
    empresaId?: string;
  };
};

type PasswordResetUpdateManyArg = {
  where: {
    userId: string;
    usedAt: null;
    expiresAt: { gt: Date };
  };
  data: { usedAt: Date };
};

type PasswordResetUpdateArg = {
  where: { id: string };
  data: { usedAt: Date };
};

type UserUpdateArg = {
  where: { id: string };
  data: { password: string };
};

const firstMockArg = <T>(mock: jest.Mock, callIndex = 0): T => {
  const calls = mock.mock.calls as unknown[][];
  return calls[callIndex]?.[0] as T;
};

describe('AuthService password reset', () => {
  let service: AuthService;
  let prisma: {
    $transaction: jest.Mock;
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    passwordResetToken: {
      updateMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    authSession: {
      updateMany: jest.Mock;
    };
  };
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FRONTEND_URL: 'https://app.tenaxis.test',
      NODE_ENV: 'test',
    };
    prisma = {
      $transaction: jest.fn(async (actions: Array<unknown>) =>
        Promise.all(actions),
      ),
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        updateMany: jest.fn(),
      },
    };
    service = new AuthService(
      prisma as never,
      { signAsync: jest.fn() } as never,
      {
        startSession: jest.fn(),
        recordEvent: jest.fn(),
        endSession: jest.fn(),
      } as never,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('returns a generic response and does not create tokens when the email is unknown', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({
      email: '  NOEXISTE@TENAXIS.TEST  ',
    });

    expect(result).toEqual({
      message:
        'Si el correo existe en Tenaxis, recibirás instrucciones para restablecer tu contraseña.',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'noexiste@tenaxis.test' },
      }),
    );
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a hashed reset token scoped to the active membership', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      memberships: [
        {
          id: 'membership-1',
          tenantId: 'tenant-1',
          role: Role.ADMIN,
          empresaMemberships: [{ empresaId: 'empresa-1' }],
        },
      ],
    });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'token-1' });

    const result = await service.forgotPassword({
      email: '  USER@TENAXIS.TEST  ',
    });

    expect(result.resetUrl).toMatch(
      /^https:\/\/app\.tenaxis\.test\/reiniciar-contraseña\?token=/,
    );

    const resetUrl = result.resetUrl;
    if (!resetUrl) {
      throw new Error('Expected resetUrl in non-production response');
    }
    const token = new URL(resetUrl).searchParams.get('token');
    if (!token) {
      throw new Error('Expected reset token in resetUrl');
    }

    const createArg = firstMockArg<PasswordResetCreateArg>(
      prisma.passwordResetToken.create,
    );
    expect(createArg.data).toMatchObject({
      id: token.split('.')[0],
      userId: 'user-1',
      tenantId: 'tenant-1',
      empresaId: 'empresa-1',
    });
    await expect(bcrypt.compare(token, createArg.data.tokenHash)).resolves.toBe(
      true,
    );
    const updateManyArg = firstMockArg<PasswordResetUpdateManyArg>(
      prisma.passwordResetToken.updateMany,
    );
    expect(updateManyArg.where.userId).toBe('user-1');
    expect(updateManyArg.where.usedAt).toBeNull();
    expect(updateManyArg.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(updateManyArg.data.usedAt).toBeInstanceOf(Date);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not expose the reset url in production responses', async () => {
    process.env.NODE_ENV = 'production';
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      memberships: [],
    });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'token-1' });

    const result = await service.forgotPassword({
      email: 'user@tenaxis.test',
    });

    expect(result).toEqual({
      message:
        'Si el correo existe en Tenaxis, recibirás instrucciones para restablecer tu contraseña.',
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed reset tokens before touching the database', async () => {
    await expect(
      service.resetPassword({ token: 'malformado', password: 'nueva-clave' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it('updates the password, consumes the reset token, and revokes active sessions', async () => {
    const token = 'token-id.secret';
    const tokenHash = await bcrypt.hash(token, 4);
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: 'user-1',
      tokenHash,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    prisma.passwordResetToken.update.mockResolvedValue({ id: 'token-id' });
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.resetPassword({
      token,
      password: 'nueva-clave',
    });

    expect(result).toEqual({ success: true });

    const userUpdateArg = firstMockArg<UserUpdateArg>(prisma.user.update);
    expect(userUpdateArg.where).toEqual({ id: 'user-1' });
    expect(userUpdateArg.data.password).not.toBe('nueva-clave');
    await expect(
      bcrypt.compare('nueva-clave', userUpdateArg.data.password),
    ).resolves.toBe(true);
    const resetUpdateArg = firstMockArg<PasswordResetUpdateArg>(
      prisma.passwordResetToken.update,
    );
    expect(resetUpdateArg.where).toEqual({ id: 'token-id' });
    expect(resetUpdateArg.data.usedAt).toBeInstanceOf(Date);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revoked: false },
      data: { revoked: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
