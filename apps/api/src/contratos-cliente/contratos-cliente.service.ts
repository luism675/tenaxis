import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContratoCliente,
  EstadoContratoCliente,
  TipoFacturacion,
} from '../generated/client/client';
import { CreateContratoClienteDto } from './dto/create-contrato-cliente.dto';
import { UpdateContratoClienteDto } from './dto/update-contrato-cliente.dto';

@Injectable()
export class ContratosClienteService {
  constructor(private readonly prisma: PrismaService) {}

  private assertContractBillingType(tipoFacturacion: TipoFacturacion) {
    if (tipoFacturacion === TipoFacturacion.UNICO) {
      throw new BadRequestException(
        'Un contrato comercial no puede usar tipo de facturación UNICO',
      );
    }
  }

  private validateDates(fechaInicio: string, fechaFin?: string) {
    const inicio = new Date(fechaInicio);
    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException('fechaInicio inválida');
    }

    if (!fechaFin) {
      return { inicio, fin: null as Date | null };
    }

    const fin = new Date(fechaFin);
    if (Number.isNaN(fin.getTime())) {
      throw new BadRequestException('fechaFin inválida');
    }

    if (fin < inicio) {
      throw new BadRequestException(
        'fechaFin no puede ser anterior a fechaInicio',
      );
    }

    return { inicio, fin };
  }

  private async assertClienteEmpresa(
    tenantId: string,
    clienteId: string,
    empresaId: string,
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        id: clienteId,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        empresaId: true,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const empresa = await this.prisma.empresa.findFirst({
      where: {
        id: empresaId,
        tenantId,
      },
      select: { id: true },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    if (cliente.empresaId && cliente.empresaId !== empresaId) {
      throw new BadRequestException(
        'El cliente no pertenece a la empresa indicada',
      );
    }

    return cliente;
  }

  async listByCliente(
    tenantId: string,
    clienteId: string,
  ): Promise<ContratoCliente[]> {
    return this.prisma.contratoCliente.findMany({
      where: {
        tenantId,
        clienteId,
      },
      orderBy: [{ fechaInicio: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getActiveByCliente(
    tenantId: string,
    clienteId: string,
    empresaId?: string,
  ): Promise<ContratoCliente | null> {
    return this.prisma.contratoCliente.findFirst({
      where: {
        tenantId,
        clienteId,
        ...(empresaId ? { empresaId } : {}),
        estado: EstadoContratoCliente.ACTIVO,
      },
      orderBy: { fechaInicio: 'desc' },
    });
  }

  async create(
    tenantId: string,
    clienteId: string,
    dto: CreateContratoClienteDto,
  ): Promise<ContratoCliente> {
    this.assertContractBillingType(dto.tipoFacturacion);
    await this.assertClienteEmpresa(tenantId, clienteId, dto.empresaId);

    const { inicio, fin } = this.validateDates(dto.fechaInicio, dto.fechaFin);

    if (
      (dto.estado ?? EstadoContratoCliente.ACTIVO) ===
      EstadoContratoCliente.ACTIVO
    ) {
      const existingActive = await this.getActiveByCliente(
        tenantId,
        clienteId,
        dto.empresaId,
      );

      if (existingActive) {
        throw new BadRequestException(
          'Ya existe un contrato activo para este cliente en la empresa seleccionada',
        );
      }
    }

    return this.prisma.contratoCliente.create({
      data: {
        tenantId,
        clienteId,
        empresaId: dto.empresaId,
        estado: dto.estado ?? EstadoContratoCliente.ACTIVO,
        fechaInicio: inicio,
        fechaFin: fin,
        serviciosComprometidos: dto.serviciosComprometidos,
        frecuenciaServicio: dto.frecuenciaServicio,
        tipoFacturacion: dto.tipoFacturacion,
        observaciones: dto.observaciones,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateContratoClienteDto,
  ): Promise<ContratoCliente> {
    if (!id || id === 'undefined') {
      throw new BadRequestException('ID de contrato inválido');
    }

    const existing = await this.prisma.contratoCliente.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Contrato no encontrado');
    }

    const nextEmpresaId = dto.empresaId ?? existing.empresaId;
    await this.assertClienteEmpresa(
      tenantId,
      existing.clienteId,
      nextEmpresaId,
    );

    const nextTipoFacturacion = dto.tipoFacturacion ?? existing.tipoFacturacion;
    this.assertContractBillingType(nextTipoFacturacion);

    const nextEstado = dto.estado ?? existing.estado;
    const nextFechaInicio =
      dto.fechaInicio ?? existing.fechaInicio.toISOString();
    const nextFechaFin =
      dto.fechaFin === undefined
        ? existing.fechaFin?.toISOString()
        : dto.fechaFin;
    const nextServiciosComprometidos =
      dto.serviciosComprometidos === undefined
        ? existing.serviciosComprometidos
        : dto.serviciosComprometidos;
    const nextFrecuenciaServicio =
      dto.frecuenciaServicio === undefined
        ? existing.frecuenciaServicio
        : dto.frecuenciaServicio;
    const nextObservaciones =
      dto.observaciones === undefined
        ? existing.observaciones
        : dto.observaciones;
    const { inicio, fin } = this.validateDates(nextFechaInicio, nextFechaFin);

    if (nextEstado === EstadoContratoCliente.ACTIVO) {
      const existingActive = await this.prisma.contratoCliente.findFirst({
        where: {
          tenantId,
          clienteId: existing.clienteId,
          empresaId: nextEmpresaId,
          estado: EstadoContratoCliente.ACTIVO,
          id: { not: id },
        },
      });

      if (existingActive) {
        throw new BadRequestException(
          'Ya existe otro contrato activo para este cliente en la empresa seleccionada',
        );
      }
    }

    return this.prisma.contratoCliente.update({
      where: { id },
      data: {
        empresaId: nextEmpresaId,
        estado: nextEstado,
        fechaInicio: inicio,
        fechaFin: fin,
        serviciosComprometidos: nextServiciosComprometidos,
        frecuenciaServicio: nextFrecuenciaServicio,
        tipoFacturacion: nextTipoFacturacion,
        observaciones: nextObservaciones,
      },
    });
  }
}
