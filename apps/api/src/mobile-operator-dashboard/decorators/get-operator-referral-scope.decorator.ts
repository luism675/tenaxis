import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OperatorReferralScope } from '../types/operator-referral-scope.type';

interface RequestWithOperatorReferralScope {
  operatorReferralScope: OperatorReferralScope;
}

export const GetOperatorReferralScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OperatorReferralScope => {
    const request = ctx
      .switchToHttp()
      .getRequest<RequestWithOperatorReferralScope>();

    return request.operatorReferralScope;
  },
);
