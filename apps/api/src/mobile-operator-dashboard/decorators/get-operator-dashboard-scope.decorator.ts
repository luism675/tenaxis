import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OperatorDashboardScope } from '../types/operator-dashboard-scope.type';

interface RequestWithOperatorDashboardScope {
  operatorDashboardScope: OperatorDashboardScope;
}

export const GetOperatorDashboardScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OperatorDashboardScope => {
    const request = ctx
      .switchToHttp()
      .getRequest<RequestWithOperatorDashboardScope>();

    return request.operatorDashboardScope;
  },
);
