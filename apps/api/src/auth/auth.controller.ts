import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './jwt-payload.interface';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ip =
      req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(
      loginDto,
      Array.isArray(ip) ? ip[0] : ip,
      userAgent,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: RequestWithUser, @Body() logoutDto?: LogoutDto) {
    return this.authService.logout(
      req.user?.sesionId,
      req.user?.authSessionId,
      logoutDto?.refresh_token,
      req.user?.sub,
    );
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException();
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException();
    }
    const enterpriseIdHeader = req.headers['x-enterprise-id'];
    const enterpriseId = Array.isArray(enterpriseIdHeader)
      ? enterpriseIdHeader[0]
      : enterpriseIdHeader;
    const testRoleHeader = req.headers['x-test-role'];
    const testRole = Array.isArray(testRoleHeader)
      ? testRoleHeader[0]
      : testRoleHeader;
    return this.authService.getProfile(token, enterpriseId, testRole);
  }

  @Patch('test-role')
  async updateTestRole(@Body() body: { role: string }, @Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException();
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException();
    }
    const profile = await this.authService.getProfile(token);
    return this.authService.updateTestRole(profile.sub, body.role);
  }
}
