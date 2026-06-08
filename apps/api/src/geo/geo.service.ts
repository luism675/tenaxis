import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private prisma: PrismaService) {}

  async getDepartments() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getMunicipalities(departmentId?: string) {
    return this.prisma.municipality.findMany({
      where: departmentId ? { departmentId } : {},
      orderBy: { name: 'asc' },
    });
  }
}
