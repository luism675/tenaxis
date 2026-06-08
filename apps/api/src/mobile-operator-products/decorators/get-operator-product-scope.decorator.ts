import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OperatorProductScope } from '../types/operator-product-scope.type';

interface RequestWithOperatorProductScope {
  operatorProductScope: OperatorProductScope;
}

export const GetOperatorProductScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OperatorProductScope => {
    const request = ctx
      .switchToHttp()
      .getRequest<RequestWithOperatorProductScope>();

    return request.operatorProductScope;
  },
);
