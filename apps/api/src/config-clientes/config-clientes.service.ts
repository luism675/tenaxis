import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTipoInteresDto, UpdateTipoInteresDto } from './dto/interes.dto';
import { CreateServicioDto, UpdateServicioDto } from './dto/servicio.dto';
import { UpsertClienteConfigDto } from './dto/cliente-config.dto';
import { CreateSegmentoDto, UpdateSegmentoDto } from './dto/segmento.dto';
import { CreateRiesgoDto, UpdateRiesgoDto } from './dto/riesgo.dto';
import {
  DiaSemana,
  NivelRiesgo,
  Role,
  SegmentoCliente,
} from '../generated/client/client';
import {
  QueryPicoPlacaRestriccionesDto,
  UpsertPicoPlacaDto,
} from './dto/pico-placa.dto';

const SEGMENTOS_CATALOG = [
  {
    id: SegmentoCliente.HOGAR,
    nombre: 'HOGAR',
    descripcion: 'Residencial y propiedad horizontal',
    frecuenciaSugerida: 90,
    riesgoSugerido: NivelRiesgo.BAJO,
    activo: true,
  },
  {
    id: SegmentoCliente.COMERCIO,
    nombre: 'COMERCIO',
    descripcion: 'Retail, tiendas y restaurantes',
    frecuenciaSugerida: 30,
    riesgoSugerido: NivelRiesgo.MEDIO,
    activo: true,
  },
  {
    id: SegmentoCliente.INDUSTRIA,
    nombre: 'INDUSTRIA',
    descripcion: 'Plantas, bodegas y procesos productivos',
    frecuenciaSugerida: 15,
    riesgoSugerido: NivelRiesgo.ALTO,
    activo: true,
  },
  {
    id: SegmentoCliente.SALUD,
    nombre: 'SALUD',
    descripcion: 'Clínicas, hospitales y consultorios',
    frecuenciaSugerida: 15,
    riesgoSugerido: NivelRiesgo.ALTO,
    activo: true,
  },
  {
    id: SegmentoCliente.EDUCACION,
    nombre: 'EDUCACION',
    descripcion: 'Colegios, universidades e instituciones educativas',
    frecuenciaSugerida: 30,
    riesgoSugerido: NivelRiesgo.MEDIO,
    activo: true,
  },
  {
    id: SegmentoCliente.HORECA,
    nombre: 'HORECA',
    descripcion: 'Hoteles, restaurantes y catering',
    frecuenciaSugerida: 15,
    riesgoSugerido: NivelRiesgo.ALTO,
    activo: true,
  },
  {
    id: SegmentoCliente.OFICINA,
    nombre: 'OFICINA',
    descripcion: 'Oficinas administrativas y corporativas',
    frecuenciaSugerida: 30,
    riesgoSugerido: NivelRiesgo.BAJO,
    activo: true,
  },
  {
    id: SegmentoCliente.OTRO,
    nombre: 'OTRO',
    descripcion: 'Casos no clasificados en el catálogo estándar',
    frecuenciaSugerida: 30,
    riesgoSugerido: NivelRiesgo.MEDIO,
    activo: true,
  },
] as const;

const RIESGOS_CATALOG = [
  {
    id: NivelRiesgo.BAJO,
    nombre: 'BAJO',
    color: 'emerald',
    valor: 1,
    activo: true,
  },
  {
    id: NivelRiesgo.MEDIO,
    nombre: 'MEDIO',
    color: 'amber',
    valor: 2,
    activo: true,
  },
  {
    id: NivelRiesgo.ALTO,
    nombre: 'ALTO',
    color: 'orange',
    valor: 3,
    activo: true,
  },
  {
    id: NivelRiesgo.CRITICO,
    nombre: 'CRITICO',
    color: 'red',
    valor: 4,
    activo: true,
  },
] as const;

const DIAS_SEMANA_ORDENADOS: DiaSemana[] = [
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
  DiaSemana.DOMINGO,
];

@Injectable()
export class ConfigClientesService {
  constructor(private prisma: PrismaService) {}

  // --- Configuracion Operativa de Clientes ---
  async findClienteConfig(
    tenantId: string,
    clienteId: string,
    empresaId: string,
    direccionId?: string,
  ) {
    await this.assertEmpresaBelongsToTenant(tenantId, empresaId);

    return this.prisma.clienteConfiguracionOperativa.findFirst({
      where: {
        tenantId,
        clienteId,
        empresaId,
        direccionId: direccionId || null,
      },
    });
  }

  async findAllClienteConfigs(tenantId: string, clienteId: string) {
    return this.prisma.clienteConfiguracionOperativa.findMany({
      where: { tenantId, clienteId },
      include: {
        direccion: {
          select: { nombreSede: true, direccion: true },
        },
      },
    });
  }

  async upsertClienteConfig(tenantId: string, dto: UpsertClienteConfigDto) {
    const { clienteId, empresaId, direccionId, ...configData } = dto;

    // Buscamos si ya existe una configuración para este cliente/empresa/sede
    const existing = await this.prisma.clienteConfiguracionOperativa.findFirst({
      where: {
        tenantId,
        clienteId,
        empresaId,
        direccionId: direccionId || null,
      },
    });

    if (existing) {
      return this.prisma.clienteConfiguracionOperativa.update({
        where: { id: existing.id },
        data: configData,
      });
    }

    return this.prisma.clienteConfiguracionOperativa.create({
      data: {
        ...configData,
        clienteId,
        empresaId,
        tenantId,
        direccionId: direccionId || null,
      },
    });
  }

  // --- Segmentos ---
  findAllSegmentos(tenantId: string) {
    void tenantId;
    return SEGMENTOS_CATALOG;
  }

  createSegmento(tenantId: string, dto: CreateSegmentoDto) {
    void tenantId;
    return { id: 'dummy', ...dto };
  }

  updateSegmento(id: string, dto: UpdateSegmentoDto) {
    return { id, ...dto };
  }

  // --- Riesgos ---
  findAllRiesgos(tenantId: string) {
    void tenantId;
    return RIESGOS_CATALOG;
  }

  createRiesgo(tenantId: string, dto: CreateRiesgoDto) {
    void tenantId;
    return { id: 'dummy', ...dto };
  }

  updateRiesgo(id: string, dto: UpdateRiesgoDto) {
    return { id, ...dto };
  }

  // --- Tipos de Interés ---
  async findAllTiposInteres(tenantId: string) {
    return this.prisma.tipoInteres.findMany({
      where: { tenantId },
      orderBy: { nombre: 'asc' },
    });
  }

  async createTipoInteres(tenantId: string, dto: CreateTipoInteresDto) {
    return this.prisma.tipoInteres.create({
      data: { ...dto, tenantId },
    });
  }

  async updateTipoInteres(id: string, dto: UpdateTipoInteresDto) {
    return this.prisma.tipoInteres.update({
      where: { id },
      data: dto,
    });
  }

  // --- Servicios ---
  async findAllServicios(tenantId: string, empresaId?: string) {
    const scopedEmpresaId = empresaId || '';
    await this.assertEmpresaBelongsToTenant(tenantId, scopedEmpresaId);

    return this.prisma.servicio.findMany({
      where: {
        tenantId,
        empresaId: scopedEmpresaId,
        deleteAt: null,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async createServicio(tenantId: string, dto: CreateServicioDto) {
    this.validateServicioFollowUpConfig(dto);
    return this.prisma.servicio.create({
      data: { ...dto, tenantId } as CreateServicioDto & { tenantId: string },
    });
  }

  async updateServicio(id: string, dto: UpdateServicioDto) {
    this.validateServicioFollowUpConfig(dto);
    return this.prisma.servicio.update({
      where: { id },
      data: dto,
    });
  }

  async deleteServicio(id: string) {
    return this.prisma.servicio.update({
      where: { id },
      data: { deleteAt: new Date(), activo: false },
    });
  }

  // --- Tipos de Servicio ---
  async findAllTiposServicio(tenantId: string, empresaId: string) {
    await this.assertEmpresaBelongsToTenant(tenantId, empresaId);

    return this.prisma.tipoServicio.findMany({
      where: { tenantId, empresaId, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // --- Métodos de Pago ---
  async findAllMetodosPago(tenantId: string, empresaId: string) {
    await this.assertEmpresaBelongsToTenant(tenantId, empresaId);

    return this.prisma.metodoPago.findMany({
      where: { tenantId, empresaId, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // --- Estados de Servicio ---
  async findAllEstadosServicio(tenantId: string, empresaId: string) {
    await this.assertEmpresaBelongsToTenant(tenantId, empresaId);

    return this.prisma.estadoServicio.findMany({
      where: { tenantId, empresaId, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // --- Pico y Placa ---
  async findPicoPlaca(tenantId: string, empresaId: string) {
    await this.assertEmpresaBelongsToTenant(tenantId, empresaId);

    const reglas = await this.prisma.picoPlaca.findMany({
      where: {
        tenantId,
        empresaId,
      },
    });

    return this.sortPicoPlacaRules(reglas);
  }

  async upsertPicoPlaca(
    tenantId: string,
    empresaId: string,
    dto: UpsertPicoPlacaDto,
  ) {
    await this.assertEmpresaBelongsToTenant(tenantId, empresaId);
    this.validatePicoPlacaRules(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.picoPlaca.deleteMany({
        where: {
          tenantId,
          empresaId,
        },
      });

      if (dto.reglas.length === 0) {
        return;
      }

      await tx.picoPlaca.createMany({
        data: dto.reglas.map((regla) => ({
          tenantId,
          empresaId,
          dia: regla.dia,
          numeroUno: regla.numeroUno,
          numeroDos: regla.numeroDos,
          activo: regla.activo ?? true,
        })),
      });
    });

    return this.findPicoPlaca(tenantId, empresaId);
  }

  async findPicoPlacaRestrictions(
    tenantId: string,
    query: QueryPicoPlacaRestriccionesDto,
  ) {
    await this.assertEmpresaBelongsToTenant(tenantId, query.empresaId);

    const fecha = query.fecha ? new Date(query.fecha) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('fecha inválida');
    }

    const dia = this.getDiaSemanaFromDate(fecha);
    const regla = await this.prisma.picoPlaca.findFirst({
      where: {
        tenantId,
        empresaId: query.empresaId,
        dia,
        activo: true,
      },
    });

    if (!regla) {
      return {
        fecha: fecha.toISOString(),
        dia,
        regla: null,
        operadoresRestringidos: [],
      };
    }

    const operadores = await this.prisma.empresaMembership.findMany({
      where: {
        tenantId,
        empresaId: query.empresaId,
        activo: true,
        deletedAt: null,
        role: Role.OPERADOR,
        membership: {
          tenantId,
          activo: true,
          role: Role.OPERADOR,
          placa: { not: null },
        },
      },
      select: {
        membershipId: true,
        membership: {
          select: {
            placa: true,
            moto: true,
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
    });

    const operadoresRestringidos = operadores
      .map((operador) => {
        const digito = this.getPicoPlacaDigit(
          operador.membership.placa,
          operador.membership.moto,
        );
        const restringido =
          digito !== null &&
          (digito === regla.numeroUno || digito === regla.numeroDos);

        if (!restringido) {
          return null;
        }

        return {
          membershipId: operador.membershipId,
          nombre: [
            operador.membership.user?.nombre,
            operador.membership.user?.apellido,
          ]
            .filter(Boolean)
            .join(' '),
          placa: operador.membership.placa,
          vehiculo: operador.membership.moto ? 'MOTO' : 'CARRO',
          digito,
        };
      })
      .filter((operador): operador is NonNullable<typeof operador> =>
        Boolean(operador),
      );

    return {
      fecha: fecha.toISOString(),
      dia,
      regla,
      operadoresRestringidos,
    };
  }

  private validateServicioFollowUpConfig(
    dto: Partial<CreateServicioDto & UpdateServicioDto>,
  ) {
    if (dto.requiereSeguimiento && !dto.primerSeguimientoDias) {
      throw new BadRequestException(
        'primerSeguimientoDias es obligatorio cuando el servicio requiere seguimiento',
      );
    }
  }

  private async assertEmpresaBelongsToTenant(
    tenantId: string,
    empresaId?: string,
  ) {
    if (!empresaId) {
      throw new BadRequestException('Seleccioná una empresa para continuar');
    }

    const empresa = await this.prisma.empresa.findFirst({
      where: {
        id: empresaId,
        tenantId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!empresa) {
      throw new BadRequestException(
        'La empresa seleccionada no está disponible',
      );
    }
  }

  private validatePicoPlacaRules(dto: UpsertPicoPlacaDto) {
    const dias = new Set<DiaSemana>();

    for (const regla of dto.reglas) {
      if (dias.has(regla.dia)) {
        throw new BadRequestException(
          `El día ${regla.dia} está duplicado en la configuración`,
        );
      }

      if ((regla.activo ?? true) && regla.numeroUno === regla.numeroDos) {
        throw new BadRequestException(
          `El día ${regla.dia} debe tener dos dígitos diferentes`,
        );
      }

      dias.add(regla.dia);
    }
  }

  private sortPicoPlacaRules<T extends { dia: DiaSemana }>(rules: T[]): T[] {
    return [...rules].sort(
      (a, b) =>
        DIAS_SEMANA_ORDENADOS.indexOf(a.dia) -
        DIAS_SEMANA_ORDENADOS.indexOf(b.dia),
    );
  }

  private getDiaSemanaFromDate(date: Date): DiaSemana {
    const dias: DiaSemana[] = [
      DiaSemana.DOMINGO,
      DiaSemana.LUNES,
      DiaSemana.MARTES,
      DiaSemana.MIERCOLES,
      DiaSemana.JUEVES,
      DiaSemana.VIERNES,
      DiaSemana.SABADO,
    ];

    return dias[date.getDay()];
  }

  private getPicoPlacaDigit(
    placa?: string | null,
    esMoto?: boolean | null,
  ): number | null {
    const normalized = placa?.replace(/\s+/g, '').toUpperCase();
    if (!normalized) {
      return null;
    }

    const match = esMoto
      ? normalized.match(/\d/)
      : normalized.match(/\d(?=[^\d]*$)/);

    return match ? Number(match[0]) : null;
  }
}
