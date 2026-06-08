import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMobileOperatorProductRequestDto } from './dto/create-mobile-operator-product-request.dto';
import { GetOperatorProductScope } from './decorators/get-operator-product-scope.decorator';
import { OperatorProductScopeGuard } from './guards/operator-product-scope.guard';
import { MobileOperatorProductsService } from './mobile-operator-products.service';
import { OperatorProductScope } from './types/operator-product-scope.type';

@Controller('mobile/operator')
@UseGuards(JwtAuthGuard, OperatorProductScopeGuard)
export class MobileOperatorProductsController {
  constructor(
    private readonly mobileOperatorProductsService: MobileOperatorProductsService,
  ) {}

  @Get('products')
  listProducts(@GetOperatorProductScope() scope: OperatorProductScope) {
    return this.mobileOperatorProductsService.listProducts(scope);
  }

  @Get('product-requests')
  listProductRequests(@GetOperatorProductScope() scope: OperatorProductScope) {
    return this.mobileOperatorProductsService.listProductRequests(scope);
  }

  @Get('product-requests/stats')
  getProductRequestStats(
    @GetOperatorProductScope() scope: OperatorProductScope,
  ) {
    return this.mobileOperatorProductsService.getProductRequestStats(scope);
  }

  @Post('product-requests')
  createProductRequest(
    @GetOperatorProductScope() scope: OperatorProductScope,
    @Body() dto: CreateMobileOperatorProductRequestDto,
  ) {
    return this.mobileOperatorProductsService.createProductRequest(scope, dto);
  }
}
