import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MonitoringScope } from '../types';

interface RequestWithScope {
  monitoringScope: MonitoringScope;
}

export const GetScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): MonitoringScope => {
    const request = ctx.switchToHttp().getRequest<RequestWithScope>();
    return request.monitoringScope;
  },
);
