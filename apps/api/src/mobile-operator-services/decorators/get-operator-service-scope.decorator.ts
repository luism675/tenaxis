import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OperatorServiceScope } from '../types/operator-service-scope.type';

interface RequestWithOperatorServiceScope {
  operatorServiceScope: OperatorServiceScope;
}

export const GetOperatorServiceScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OperatorServiceScope => {
    const request = ctx
      .switchToHttp()
      .getRequest<RequestWithOperatorServiceScope>();

    return request.operatorServiceScope;
  },
);
