import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GeoService } from './geo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('departments')
  async getDepartments() {
    return this.geoService.getDepartments();
  }

  @Get('municipalities')
  async getMunicipalities(@Query('departmentId') departmentId?: string) {
    return this.geoService.getMunicipalities(departmentId);
  }
}
