-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ClasificacionCliente" AS ENUM ('ORO', 'PLATA', 'BRONCE', 'RIESGO');

-- CreateEnum
CREATE TYPE "public"."DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "public"."EstadoConsignacion" AS ENUM ('PENDIENTE', 'VALIDADA', 'OBSERVADA');

-- CreateEnum
CREATE TYPE "public"."EstadoCuentaCobro" AS ENUM ('PAGADA', 'PENDIENTE', 'RECHAZADA', 'GENERADA');

-- CreateEnum
CREATE TYPE "public"."EstadoNomina" AS ENUM ('BORRADOR', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "public"."EstadoOrden" AS ENUM ('NUEVO', 'PROCESO', 'CANCELADO', 'PROGRAMADO', 'LIQUIDADO', 'TECNICO_FINALIZO', 'REPROGRAMADO', 'SIN_CONCRETAR');

-- CreateEnum
CREATE TYPE "public"."EstadoPagoComision" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "public"."EstadoPagoOrden" AS ENUM ('PENDIENTE', 'EFECTIVO_DECLARADO', 'CONSIGNADO', 'CONCILIADO', 'ANTICIPO', 'PAGADO', 'CREDITO', 'PARCIAL', 'CORTESIA');

-- CreateEnum
CREATE TYPE "public"."EstadoPaquete" AS ENUM ('ACTIVO', 'FINALIZADO', 'CANCELADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "public"."EstadoPermiso" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "public"."EstadoSolicitudProductos" AS ENUM ('PENDIENTE', 'RECHAZADA', 'ACEPTADA');

-- CreateEnum
CREATE TYPE "public"."EstadoSugerencia" AS ENUM ('PENDIENTE', 'ACEPTADA', 'DESCARTADA', 'EJECUTADA');

-- CreateEnum
CREATE TYPE "public"."MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."MetodoPagoBase" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CREDITO', 'BONO', 'CORTESIA', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "public"."NivelInfestacion" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO', 'PREVENTIVO');

-- CreateEnum
CREATE TYPE "public"."NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "public"."PrioridadSugerencia" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SU_ADMIN', 'ADMIN', 'COORDINADOR', 'ASESOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."TipoCliente" AS ENUM ('PERSONA', 'EMPRESA');

-- CreateEnum
CREATE TYPE "public"."TipoFacturacion" AS ENUM ('UNICO', 'CONTRATO_MENSUAL', 'PLAN_TRIMESTRAL', 'PLAN_SEMESTRAL', 'PLAN_ANUAL');

-- CreateEnum
CREATE TYPE "public"."TipoPago" AS ENUM ('PORCENTAJE', 'SALARIO_FIJO');

-- CreateEnum
CREATE TYPE "public"."TipoPermiso" AS ENUM ('EDITAR_VALOR_COTIZADO', 'EDITAR_TIPO_SERVICIO', 'DESCARGAR_EXCEL');

-- CreateEnum
CREATE TYPE "public"."TipoVisita" AS ENUM ('DIAGNOSTICO', 'PREVENTIVO', 'CORRECTIVO', 'SEGUIMIENTO', 'REINCIDENCIA');

-- CreateEnum
CREATE TYPE "public"."UrgenciaOrden" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateTable
CREATE TABLE "public"."anticipos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "consignacionId" UUID,
    "monto" DECIMAL(12,2) NOT NULL,
    "razon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anticipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auditorias" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "detalles" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "empresaId" UUID,
    "tenantId" UUID,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."citas_psicologos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "servicioId" UUID,
    "creadoPorId" UUID,
    "psicologoId" UUID,
    "tipoServicio" UUID,
    "consultorioId" UUID,
    "paqueteId" UUID,
    "fechaCita" TIMESTAMP(3),
    "horaInicio" TIMESTAMP(3),
    "horaFin" TIMESTAMP(3),
    "valor" DECIMAL(12,2),
    "metodoPago" TEXT,
    "comprobantePath" TEXT,
    "observacion" TEXT,
    "realizada" BOOLEAN NOT NULL DEFAULT false,
    "estadoPago" "public"."EstadoPagoOrden" DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citas_psicologos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cliente_configuracion_operativa" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "direccionId" UUID,
    "protocoloServicio" TEXT,
    "observacionesFijas" TEXT,
    "requiereFirmaDigital" BOOLEAN NOT NULL DEFAULT true,
    "requiereFotosEvidencia" BOOLEAN NOT NULL DEFAULT true,
    "duracionEstimada" INTEGER DEFAULT 60,
    "frecuenciaSugerida" INTEGER DEFAULT 30,
    "elementosPredefinidos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_configuracion_operativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clientes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID,
    "nombre" TEXT,
    "apellido" TEXT,
    "telefono" TEXT NOT NULL,
    "telefono2" TEXT,
    "correo" TEXT,
    "numeroDocumento" TEXT,
    "tipoDocumento" TEXT,
    "registroDocumento" TEXT,
    "documentoPath" TEXT,
    "creadoPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "aceptaMarketing" BOOLEAN NOT NULL DEFAULT false,
    "cargoContacto" TEXT,
    "clasificacion" "public"."ClasificacionCliente" DEFAULT 'BRONCE',
    "fechaConsentimiento" TIMESTAMP(3),
    "frecuenciaServicio" INTEGER,
    "nit" TEXT,
    "planActual" TEXT,
    "proximaVisita" TIMESTAMP(3),
    "razonSocial" TEXT,
    "representanteLegal" TEXT,
    "score" INTEGER DEFAULT 0,
    "subsegmento" TEXT,
    "ticketPromedio" DECIMAL(12,2),
    "tipoCliente" "public"."TipoCliente" NOT NULL DEFAULT 'PERSONA',
    "ultimaVisita" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "riesgoId" UUID,
    "segmentoId" UUID,
    "actividadEconomica" TEXT,
    "metrajeTotal" DECIMAL(12,2),
    "origenCliente" TEXT,
    "tipoInteresId" UUID,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commission_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationNodeId" UUID NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "valorBase" DECIMAL(12,2) NOT NULL,
    "valorComision" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "citaPsicologoId" UUID,
    "concepto" TEXT,
    "empresaId" UUID NOT NULL,
    "estadoPago" "public"."EstadoPagoComision" NOT NULL DEFAULT 'PENDIENTE',
    "fechaPago" TIMESTAMP(3),
    "ordenServicioId" UUID,

    CONSTRAINT "commission_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."configuracion_pagos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "tipo" "public"."TipoPago",
    "valorParticipacion" DECIMAL(12,2),
    "salarioBase" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consignacion_ordenes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "consignacionId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,

    CONSTRAINT "consignacion_ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consignaciones_efectivo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "tecnicoId" UUID NOT NULL,
    "creadoPorId" UUID NOT NULL,
    "fechaConsignacion" TIMESTAMP(3) NOT NULL,
    "valorConsignado" DECIMAL(12,2) NOT NULL,
    "referenciaBanco" TEXT NOT NULL,
    "comprobantePath" TEXT NOT NULL,
    "estado" "public"."EstadoConsignacion" NOT NULL DEFAULT 'PENDIENTE',
    "diferencia" DECIMAL(12,2),
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consignaciones_efectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consultorios" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cuentas_cobro" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "estado" "public"."EstadoCuentaCobro" NOT NULL DEFAULT 'GENERADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cuentas_pago" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "banco" TEXT NOT NULL,
    "tipoCuenta" TEXT NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "valorHora" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."declaraciones_efectivo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "tecnicoId" UUID NOT NULL,
    "valorDeclarado" DECIMAL(12,2) NOT NULL,
    "evidenciaPath" TEXT NOT NULL,
    "observacion" TEXT,
    "consignado" BOOLEAN NOT NULL DEFAULT false,
    "fechaDeclaracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "declaraciones_efectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."direcciones" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID,
    "clienteId" UUID NOT NULL,
    "direccion" TEXT NOT NULL,
    "piso" TEXT,
    "bloque" TEXT,
    "unidad" TEXT,
    "barrio" TEXT,
    "municipio" TEXT,
    "linkMaps" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "nombreSede" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "cargoContacto" TEXT,
    "clasificacionPunto" TEXT,
    "horarioFin" TEXT,
    "horarioInicio" TEXT,
    "motivoBloqueo" TEXT,
    "municipioId" UUID,
    "nombreContacto" TEXT,
    "precisionGPS" DECIMAL(10,2),
    "restricciones" TEXT,
    "telefonoContacto" TEXT,
    "tipoUbicacion" TEXT,
    "validadoPorSistema" BOOLEAN NOT NULL DEFAULT false,
    "departmentId" UUID,
    "zonaId" UUID,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."egresos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID,
    "titulo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "razon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" TEXT DEFAULT 'GENERAL',

    CONSTRAINT "egresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."empresa_memberships" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "zonaId" UUID,
    "role" "public"."Role" DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "empresa_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."empresas" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."entidades_financieras" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidades_financieras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."estados_servicio" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID NOT NULL,

    CONSTRAINT "estados_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."evidencias_servicio" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenServicioId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."geolocalizaciones" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "llegada" TIMESTAMP(3) NOT NULL,
    "salida" TIMESTAMP(3),
    "fotoLlegada" TEXT,
    "fotoSalida" TEXT,
    "linkMaps" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geolocalizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."logs_evento" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "sesionId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "ruta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metodos_pago" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID NOT NULL,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."municipalities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" UUID NOT NULL,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."niveles_riesgo_operativo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "valor" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "niveles_riesgo_operativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."nomina_detalles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nominaId" UUID NOT NULL,
    "ordenId" UUID,
    "citaId" UUID,
    "valorServicio" DECIMAL(12,2) NOT NULL,
    "concepto" TEXT,

    CONSTRAINT "nomina_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."nominas" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalServicios" INTEGER NOT NULL,
    "totalValorPagado" DECIMAL(12,2) NOT NULL,
    "totalRepuestos" DECIMAL(12,2) NOT NULL,
    "totalIva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseComisionable" DECIMAL(12,2) NOT NULL,
    "porcentajeAplicado" DECIMAL(5,2),
    "salarioFijo" DECIMAL(12,2),
    "totalComisiones" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPagar" DECIMAL(12,2) NOT NULL,
    "estado" "public"."EstadoNomina" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,

    CONSTRAINT "nominas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ordenes_servicio" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "servicioId" UUID NOT NULL,
    "creadoPorId" UUID,
    "tecnicoId" UUID,
    "direccionId" UUID,
    "direccionTexto" TEXT NOT NULL,
    "piso" TEXT,
    "bloque" TEXT,
    "unidad" TEXT,
    "barrio" TEXT,
    "municipio" TEXT,
    "departamento" TEXT,
    "linkMaps" TEXT,
    "zonaId" UUID,
    "vehiculoId" UUID,
    "metodoPagoId" UUID,
    "numeroOrden" TEXT,
    "fechaVisita" TIMESTAMP(3),
    "horaInicio" TIMESTAMP(3),
    "horaFin" TIMESTAMP(3),
    "observacion" TEXT,
    "observacionFinal" TEXT,
    "condicionesHigiene" TEXT,
    "condicionesLocal" TEXT,
    "valorCotizado" DECIMAL(12,2),
    "valorPagado" DECIMAL(12,2),
    "valorRepuestos" DECIMAL(12,2) DEFAULT 0,
    "valorRepuestosTecnico" DECIMAL(12,2) DEFAULT 0,
    "facturaPath" TEXT,
    "facturaElectronica" TEXT,
    "comprobantePago" TEXT,
    "evidenciaPath" TEXT,
    "desglosePago" JSONB,
    "referenciaPago" TEXT,
    "fechaPago" TIMESTAMP(3),
    "entidadFinancieraId" UUID,
    "estadoPago" "public"."EstadoPagoOrden" NOT NULL DEFAULT 'PENDIENTE',
    "seguimientoRevisado" BOOLEAN DEFAULT false,
    "liquidadoPorId" UUID,
    "liquidadoAt" TIMESTAMP(3),
    "ordenPadreId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "frecuenciaSugerida" INTEGER,
    "tipoFacturacion" "public"."TipoFacturacion",
    "tipoVisita" "public"."TipoVisita",
    "nivelInfestacion" "public"."NivelInfestacion",
    "urgencia" "public"."UrgenciaOrden",
    "estadoServicio" "public"."EstadoOrden" NOT NULL DEFAULT 'NUEVO',

    CONSTRAINT "ordenes_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization_nodes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "parentId" UUID,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "puedeTenerSubordinados" BOOLEAN NOT NULL DEFAULT false,
    "porcentajeComision" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID NOT NULL,
    "empresaMembershipId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."paquetes_adquiridos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "catalogoId" UUID NOT NULL,
    "membershipId" UUID,
    "sesionesTotales" INTEGER NOT NULL,
    "sesionesConsumidas" INTEGER NOT NULL DEFAULT 0,
    "saldoRestante" INTEGER NOT NULL,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "precioPagado" DECIMAL(12,2) NOT NULL,
    "estado" "public"."EstadoPaquete" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "paquetes_adquiridos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID,
    "tenantId" UUID,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permisos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "adminId" UUID,
    "tipo" "public"."TipoPermiso" NOT NULL,
    "entidadId" TEXT,
    "motivo" TEXT,
    "estado" "public"."EstadoPermiso" NOT NULL DEFAULT 'PENDIENTE',
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAprobacion" TIMESTAMP(3),
    "fechaExpiracion" TIMESTAMP(3),

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pico_placa" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "numeroUno" INTEGER NOT NULL,
    "numeroDos" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID NOT NULL,
    "dia" "public"."DiaSemana" NOT NULL,

    CONSTRAINT "pico_placa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plans" (
    "id" UUID NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "maxOperators" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,
    "maxEmpresas" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."productos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedorId" UUID,
    "categoria" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedida" TEXT,
    "precio" DECIMAL(12,2),
    "moneda" TEXT,
    "stockActual" INTEGER,
    "stockMinimo" INTEGER,
    "tiempoReposicion" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."productos_solicitados" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "cantidad" TEXT NOT NULL,
    "unidadMedida" TEXT,
    "estado" "public"."EstadoSolicitudProductos" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_solicitados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proveedores" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "pais" TEXT,
    "departamento" TEXT,
    "ciudad" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresaId" UUID NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."referidos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "nombre" TEXT,
    "apellido" TEXT,
    "telefono" TEXT,
    "codigo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."segmentos_negocio" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "frecuenciaSugerida" INTEGER DEFAULT 30,
    "riesgoSugerido" TEXT DEFAULT 'BAJO',

    CONSTRAINT "segmentos_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."servicios" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sesiones_actividad" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "duracionMin" INTEGER,
    "tiempoInactivo" INTEGER NOT NULL DEFAULT 0,
    "dispositivo" TEXT,
    "ip" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "graceUntil" TIMESTAMP(3),
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "lastPaymentDate" TIMESTAMP(3),
    "nextReminderDate" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sugerencias_seguimiento" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID,
    "clienteId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "prioridad" "public"."PrioridadSugerencia" NOT NULL DEFAULT 'MEDIA',
    "estado" "public"."EstadoSugerencia" NOT NULL DEFAULT 'PENDIENTE',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "metadata" JSONB,
    "fechaSugerida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEjecutada" TIMESTAMP(3),
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sugerencias_seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_memberships" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "role" "public"."Role" NOT NULL,
    "status" "public"."MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "codigoReferido" TEXT,
    "moto" BOOLEAN,
    "numberId" TEXT,
    "placa" TEXT,
    "pushToken" TEXT,
    "username" TEXT,
    "whatsappGroupId" TEXT,
    "direccion" TEXT,
    "municipioId" UUID,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "correo" TEXT,
    "nit" TEXT,
    "nombre" TEXT NOT NULL,
    "numero" TEXT,
    "pagina" TEXT,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."terapias_psicologos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "cantidadSesiones" INTEGER NOT NULL DEFAULT 1,
    "precioBase" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terapias_psicologos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tipos_interes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "frecuenciaSugerida" INTEGER DEFAULT 30,
    "riesgoSugerido" TEXT DEFAULT 'BAJO',

    CONSTRAINT "tipos_interes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tipos_servicio" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID NOT NULL,

    CONSTRAINT "tipos_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."turnos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "cuentaCobroId" UUID,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaEntrada" TIMESTAMP(3) NOT NULL,
    "horaSalida" TIMESTAMP(3) NOT NULL,
    "tiempoDescanso" INTEGER NOT NULL,
    "valorTotal" DECIMAL(12,2),
    "observaciones" TEXT,
    "fotoEntrada" TEXT,
    "fotoSalida" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "telefono" TEXT,
    "tipoDocumento" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehiculos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID,
    "clienteId" UUID NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "color" TEXT,
    "tipo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zonas" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" UUID NOT NULL,

    CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anticipos_empresaId_idx" ON "public"."anticipos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "anticipos_membershipId_idx" ON "public"."anticipos"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "anticipos_tenantId_empresaId_idx" ON "public"."anticipos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "anticipos_tenantId_idx" ON "public"."anticipos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "auditorias_createdAt_idx" ON "public"."auditorias"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "auditorias_empresaId_idx" ON "public"."auditorias"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "auditorias_entidad_entidadId_idx" ON "public"."auditorias"("entidad" ASC, "entidadId" ASC);

-- CreateIndex
CREATE INDEX "auditorias_tenantId_idx" ON "public"."auditorias"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "auth_sessions_empresaId_idx" ON "public"."auth_sessions"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "public"."auth_sessions"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "auth_sessions_tenantId_idx" ON "public"."auth_sessions"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "public"."auth_sessions"("userId" ASC);

-- CreateIndex
CREATE INDEX "citas_psicologos_empresaId_idx" ON "public"."citas_psicologos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "citas_psicologos_pacienteId_idx" ON "public"."citas_psicologos"("pacienteId" ASC);

-- CreateIndex
CREATE INDEX "citas_psicologos_psicologoId_idx" ON "public"."citas_psicologos"("psicologoId" ASC);

-- CreateIndex
CREATE INDEX "citas_psicologos_tenantId_empresaId_idx" ON "public"."citas_psicologos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "citas_psicologos_tenantId_idx" ON "public"."citas_psicologos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "cliente_configuracion_operativa_clienteId_idx" ON "public"."cliente_configuracion_operativa"("clienteId" ASC);

-- CreateIndex
CREATE INDEX "cliente_configuracion_operativa_direccionId_idx" ON "public"."cliente_configuracion_operativa"("direccionId" ASC);

-- CreateIndex
CREATE INDEX "cliente_configuracion_operativa_empresaId_idx" ON "public"."cliente_configuracion_operativa"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "cliente_configuracion_operativa_tenantId_idx" ON "public"."cliente_configuracion_operativa"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "clientes_empresaId_idx" ON "public"."clientes"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "clientes_nombre_apellido_idx" ON "public"."clientes"("nombre" ASC, "apellido" ASC);

-- CreateIndex
CREATE INDEX "clientes_numeroDocumento_idx" ON "public"."clientes"("numeroDocumento" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefono_key" ON "public"."clientes"("telefono" ASC);

-- CreateIndex
CREATE INDEX "clientes_tenantId_empresaId_idx" ON "public"."clientes"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "clientes_tenantId_idx" ON "public"."clientes"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "commission_records_createdAt_idx" ON "public"."commission_records"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "commission_records_empresaId_idx" ON "public"."commission_records"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "commission_records_estadoPago_idx" ON "public"."commission_records"("estadoPago" ASC);

-- CreateIndex
CREATE INDEX "commission_records_organizationNodeId_idx" ON "public"."commission_records"("organizationNodeId" ASC);

-- CreateIndex
CREATE INDEX "commission_records_tenantId_empresaId_idx" ON "public"."commission_records"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "commission_records_tenantId_idx" ON "public"."commission_records"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "configuracion_pagos_empresaId_idx" ON "public"."configuracion_pagos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "configuracion_pagos_membershipId_idx" ON "public"."configuracion_pagos"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "configuracion_pagos_tenantId_empresaId_idx" ON "public"."configuracion_pagos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "configuracion_pagos_tenantId_idx" ON "public"."configuracion_pagos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "consignacion_ordenes_empresaId_idx" ON "public"."consignacion_ordenes"("empresaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "consignacion_ordenes_ordenId_key" ON "public"."consignacion_ordenes"("ordenId" ASC);

-- CreateIndex
CREATE INDEX "consignacion_ordenes_tenantId_empresaId_idx" ON "public"."consignacion_ordenes"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "consignacion_ordenes_tenantId_idx" ON "public"."consignacion_ordenes"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "consignaciones_efectivo_empresaId_idx" ON "public"."consignaciones_efectivo"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "consignaciones_efectivo_estado_idx" ON "public"."consignaciones_efectivo"("estado" ASC);

-- CreateIndex
CREATE INDEX "consignaciones_efectivo_tecnicoId_idx" ON "public"."consignaciones_efectivo"("tecnicoId" ASC);

-- CreateIndex
CREATE INDEX "consignaciones_efectivo_tenantId_empresaId_idx" ON "public"."consignaciones_efectivo"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "consignaciones_efectivo_tenantId_idx" ON "public"."consignaciones_efectivo"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "consultorios_empresaId_idx" ON "public"."consultorios"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "consultorios_tenantId_empresaId_idx" ON "public"."consultorios"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "consultorios_tenantId_idx" ON "public"."consultorios"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_cobro_empresaId_idx" ON "public"."cuentas_cobro"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_cobro_membershipId_idx" ON "public"."cuentas_cobro"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_cobro_tenantId_empresaId_idx" ON "public"."cuentas_cobro"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_cobro_tenantId_idx" ON "public"."cuentas_cobro"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_pago_empresaId_idx" ON "public"."cuentas_pago"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_pago_membershipId_idx" ON "public"."cuentas_pago"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_pago_tenantId_empresaId_idx" ON "public"."cuentas_pago"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "cuentas_pago_tenantId_idx" ON "public"."cuentas_pago"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "declaraciones_efectivo_consignado_idx" ON "public"."declaraciones_efectivo"("consignado" ASC);

-- CreateIndex
CREATE INDEX "declaraciones_efectivo_empresaId_idx" ON "public"."declaraciones_efectivo"("empresaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "declaraciones_efectivo_ordenId_key" ON "public"."declaraciones_efectivo"("ordenId" ASC);

-- CreateIndex
CREATE INDEX "declaraciones_efectivo_tecnicoId_idx" ON "public"."declaraciones_efectivo"("tecnicoId" ASC);

-- CreateIndex
CREATE INDEX "declaraciones_efectivo_tenantId_empresaId_idx" ON "public"."declaraciones_efectivo"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "declaraciones_efectivo_tenantId_idx" ON "public"."declaraciones_efectivo"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "public"."departments"("code" ASC);

-- CreateIndex
CREATE INDEX "direcciones_empresaId_idx" ON "public"."direcciones"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "direcciones_tenantId_empresaId_idx" ON "public"."direcciones"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "direcciones_tenantId_idx" ON "public"."direcciones"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "egresos_empresaId_idx" ON "public"."egresos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "egresos_membershipId_idx" ON "public"."egresos"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "egresos_tenantId_empresaId_idx" ON "public"."egresos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "egresos_tenantId_idx" ON "public"."egresos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "empresa_memberships_empresaId_idx" ON "public"."empresa_memberships"("empresaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_memberships_membershipId_empresaId_key" ON "public"."empresa_memberships"("membershipId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "empresa_memberships_tenantId_idx" ON "public"."empresa_memberships"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "empresas_tenantId_idx" ON "public"."empresas"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "entidades_financieras_empresaId_idx" ON "public"."entidades_financieras"("empresaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "entidades_financieras_empresaId_nombre_key" ON "public"."entidades_financieras"("empresaId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "entidades_financieras_tenantId_idx" ON "public"."entidades_financieras"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "estados_servicio_empresaId_idx" ON "public"."estados_servicio"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "estados_servicio_tenantId_idx" ON "public"."estados_servicio"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "evidencias_servicio_ordenServicioId_idx" ON "public"."evidencias_servicio"("ordenServicioId" ASC);

-- CreateIndex
CREATE INDEX "evidencias_servicio_tenantId_idx" ON "public"."evidencias_servicio"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "geolocalizaciones_empresaId_idx" ON "public"."geolocalizaciones"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "geolocalizaciones_membershipId_idx" ON "public"."geolocalizaciones"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "geolocalizaciones_ordenId_idx" ON "public"."geolocalizaciones"("ordenId" ASC);

-- CreateIndex
CREATE INDEX "geolocalizaciones_tenantId_empresaId_idx" ON "public"."geolocalizaciones"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "geolocalizaciones_tenantId_idx" ON "public"."geolocalizaciones"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "logs_evento_empresaId_idx" ON "public"."logs_evento"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "logs_evento_sesionId_idx" ON "public"."logs_evento"("sesionId" ASC);

-- CreateIndex
CREATE INDEX "logs_evento_tenantId_empresaId_idx" ON "public"."logs_evento"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "logs_evento_tenantId_idx" ON "public"."logs_evento"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "metodos_pago_empresaId_idx" ON "public"."metodos_pago"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "metodos_pago_tenantId_idx" ON "public"."metodos_pago"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "municipalities_code_key" ON "public"."municipalities"("code" ASC);

-- CreateIndex
CREATE INDEX "niveles_riesgo_operativo_tenantId_idx" ON "public"."niveles_riesgo_operativo"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "nomina_detalles_empresaId_idx" ON "public"."nomina_detalles"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "nomina_detalles_nominaId_idx" ON "public"."nomina_detalles"("nominaId" ASC);

-- CreateIndex
CREATE INDEX "nomina_detalles_tenantId_empresaId_idx" ON "public"."nomina_detalles"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "nomina_detalles_tenantId_idx" ON "public"."nomina_detalles"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "nominas_empresaId_idx" ON "public"."nominas"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "nominas_estado_idx" ON "public"."nominas"("estado" ASC);

-- CreateIndex
CREATE INDEX "nominas_membershipId_idx" ON "public"."nominas"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "nominas_tenantId_empresaId_idx" ON "public"."nominas"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "nominas_tenantId_idx" ON "public"."nominas"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_clienteId_idx" ON "public"."ordenes_servicio"("clienteId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_empresaId_idx" ON "public"."ordenes_servicio"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_entidadFinancieraId_idx" ON "public"."ordenes_servicio"("entidadFinancieraId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_estadoServicio_idx" ON "public"."ordenes_servicio"("estadoServicio" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_fechaVisita_idx" ON "public"."ordenes_servicio"("fechaVisita" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_numeroOrden_idx" ON "public"."ordenes_servicio"("numeroOrden" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_tecnicoId_idx" ON "public"."ordenes_servicio"("tecnicoId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_tenantId_empresaId_idx" ON "public"."ordenes_servicio"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_tenantId_idx" ON "public"."ordenes_servicio"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "organization_nodes_empresaId_idx" ON "public"."organization_nodes"("empresaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "organization_nodes_empresaMembershipId_key" ON "public"."organization_nodes"("empresaMembershipId" ASC);

-- CreateIndex
CREATE INDEX "organization_nodes_parentId_idx" ON "public"."organization_nodes"("parentId" ASC);

-- CreateIndex
CREATE INDEX "organization_nodes_tenantId_empresaId_idx" ON "public"."organization_nodes"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "organization_nodes_tenantId_idx" ON "public"."organization_nodes"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "paquetes_adquiridos_clienteId_idx" ON "public"."paquetes_adquiridos"("clienteId" ASC);

-- CreateIndex
CREATE INDEX "paquetes_adquiridos_empresaId_idx" ON "public"."paquetes_adquiridos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "paquetes_adquiridos_estado_idx" ON "public"."paquetes_adquiridos"("estado" ASC);

-- CreateIndex
CREATE INDEX "paquetes_adquiridos_tenantId_empresaId_idx" ON "public"."paquetes_adquiridos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "paquetes_adquiridos_tenantId_idx" ON "public"."paquetes_adquiridos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "password_reset_tokens_empresaId_idx" ON "public"."password_reset_tokens"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "public"."password_reset_tokens"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "password_reset_tokens_tenantId_idx" ON "public"."password_reset_tokens"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "permisos_empresaId_idx" ON "public"."permisos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "permisos_estado_idx" ON "public"."permisos"("estado" ASC);

-- CreateIndex
CREATE INDEX "permisos_membershipId_idx" ON "public"."permisos"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "permisos_tenantId_empresaId_idx" ON "public"."permisos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "permisos_tenantId_idx" ON "public"."permisos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "pico_placa_empresaId_idx" ON "public"."pico_placa"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "pico_placa_tenantId_idx" ON "public"."pico_placa"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "productos_empresaId_idx" ON "public"."productos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "productos_tenantId_idx" ON "public"."productos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "productos_solicitados_empresaId_idx" ON "public"."productos_solicitados"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "productos_solicitados_membershipId_idx" ON "public"."productos_solicitados"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "productos_solicitados_tenantId_empresaId_idx" ON "public"."productos_solicitados"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "productos_solicitados_tenantId_idx" ON "public"."productos_solicitados"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "proveedores_empresaId_idx" ON "public"."proveedores"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "proveedores_tenantId_idx" ON "public"."proveedores"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "referidos_empresaId_idx" ON "public"."referidos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "referidos_membershipId_idx" ON "public"."referidos"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "referidos_tenantId_empresaId_idx" ON "public"."referidos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "referidos_tenantId_idx" ON "public"."referidos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "segmentos_negocio_tenantId_idx" ON "public"."segmentos_negocio"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "servicios_empresaId_idx" ON "public"."servicios"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "servicios_tenantId_empresaId_idx" ON "public"."servicios"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "servicios_tenantId_idx" ON "public"."servicios"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "sesiones_actividad_empresaId_idx" ON "public"."sesiones_actividad"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "sesiones_actividad_fechaInicio_idx" ON "public"."sesiones_actividad"("fechaInicio" ASC);

-- CreateIndex
CREATE INDEX "sesiones_actividad_membershipId_idx" ON "public"."sesiones_actividad"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "sesiones_actividad_tenantId_empresaId_idx" ON "public"."sesiones_actividad"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "sesiones_actividad_tenantId_idx" ON "public"."sesiones_actividad"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "subscriptions_endDate_idx" ON "public"."subscriptions"("endDate" ASC);

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "public"."subscriptions"("status" ASC);

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_idx" ON "public"."subscriptions"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenantId_key" ON "public"."subscriptions"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "sugerencias_seguimiento_empresaId_idx" ON "public"."sugerencias_seguimiento"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "sugerencias_seguimiento_estado_idx" ON "public"."sugerencias_seguimiento"("estado" ASC);

-- CreateIndex
CREATE INDEX "sugerencias_seguimiento_fechaSugerida_idx" ON "public"."sugerencias_seguimiento"("fechaSugerida" ASC);

-- CreateIndex
CREATE INDEX "sugerencias_seguimiento_tenantId_idx" ON "public"."sugerencias_seguimiento"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "tenant_memberships_role_idx" ON "public"."tenant_memberships"("role" ASC);

-- CreateIndex
CREATE INDEX "tenant_memberships_tenantId_idx" ON "public"."tenant_memberships"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_userId_tenantId_key" ON "public"."tenant_memberships"("userId" ASC, "tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "public"."tenants"("slug" ASC);

-- CreateIndex
CREATE INDEX "terapias_psicologos_empresaId_idx" ON "public"."terapias_psicologos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "terapias_psicologos_tenantId_empresaId_idx" ON "public"."terapias_psicologos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "terapias_psicologos_tenantId_idx" ON "public"."terapias_psicologos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "tipos_interes_tenantId_idx" ON "public"."tipos_interes"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "tipos_servicio_empresaId_idx" ON "public"."tipos_servicio"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "tipos_servicio_tenantId_idx" ON "public"."tipos_servicio"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "turnos_empresaId_idx" ON "public"."turnos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "turnos_membershipId_idx" ON "public"."turnos"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "turnos_tenantId_empresaId_idx" ON "public"."turnos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "turnos_tenantId_idx" ON "public"."turnos"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_numeroDocumento_key" ON "public"."users"("numeroDocumento" ASC);

-- CreateIndex
CREATE INDEX "vehiculos_empresaId_idx" ON "public"."vehiculos"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "vehiculos_tenantId_empresaId_idx" ON "public"."vehiculos"("tenantId" ASC, "empresaId" ASC);

-- CreateIndex
CREATE INDEX "vehiculos_tenantId_idx" ON "public"."vehiculos"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "zonas_empresaId_idx" ON "public"."zonas"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "zonas_tenantId_idx" ON "public"."zonas"("tenantId" ASC);

-- AddForeignKey
ALTER TABLE "public"."anticipos" ADD CONSTRAINT "anticipos_consignacionId_fkey" FOREIGN KEY ("consignacionId") REFERENCES "public"."consignaciones_efectivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anticipos" ADD CONSTRAINT "anticipos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anticipos" ADD CONSTRAINT "anticipos_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anticipos" ADD CONSTRAINT "anticipos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auditorias" ADD CONSTRAINT "auditorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auditorias" ADD CONSTRAINT "auditorias_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auditorias" ADD CONSTRAINT "auditorias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "public"."consultorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "public"."paquetes_adquiridos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_psicologoId_fkey" FOREIGN KEY ("psicologoId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "public"."servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."citas_psicologos" ADD CONSTRAINT "citas_psicologos_tipoServicio_fkey" FOREIGN KEY ("tipoServicio") REFERENCES "public"."servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cliente_configuracion_operativa" ADD CONSTRAINT "cliente_configuracion_operativa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cliente_configuracion_operativa" ADD CONSTRAINT "cliente_configuracion_operativa_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "public"."direcciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cliente_configuracion_operativa" ADD CONSTRAINT "cliente_configuracion_operativa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cliente_configuracion_operativa" ADD CONSTRAINT "cliente_configuracion_operativa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "public"."tenant_memberships"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_riesgoId_fkey" FOREIGN KEY ("riesgoId") REFERENCES "public"."niveles_riesgo_operativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_segmentoId_fkey" FOREIGN KEY ("segmentoId") REFERENCES "public"."segmentos_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_tipoInteresId_fkey" FOREIGN KEY ("tipoInteresId") REFERENCES "public"."tipos_interes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_records" ADD CONSTRAINT "commission_records_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_records" ADD CONSTRAINT "commission_records_organizationNodeId_fkey" FOREIGN KEY ("organizationNodeId") REFERENCES "public"."organization_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_records" ADD CONSTRAINT "commission_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuracion_pagos" ADD CONSTRAINT "configuracion_pagos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuracion_pagos" ADD CONSTRAINT "configuracion_pagos_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuracion_pagos" ADD CONSTRAINT "configuracion_pagos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignacion_ordenes" ADD CONSTRAINT "consignacion_ordenes_consignacionId_fkey" FOREIGN KEY ("consignacionId") REFERENCES "public"."consignaciones_efectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignacion_ordenes" ADD CONSTRAINT "consignacion_ordenes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignacion_ordenes" ADD CONSTRAINT "consignacion_ordenes_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."ordenes_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignacion_ordenes" ADD CONSTRAINT "consignacion_ordenes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignaciones_efectivo" ADD CONSTRAINT "consignaciones_efectivo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignaciones_efectivo" ADD CONSTRAINT "consignaciones_efectivo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignaciones_efectivo" ADD CONSTRAINT "consignaciones_efectivo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consignaciones_efectivo" ADD CONSTRAINT "consignaciones_efectivo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consultorios" ADD CONSTRAINT "consultorios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consultorios" ADD CONSTRAINT "consultorios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cuentas_pago" ADD CONSTRAINT "cuentas_pago_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cuentas_pago" ADD CONSTRAINT "cuentas_pago_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cuentas_pago" ADD CONSTRAINT "cuentas_pago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."declaraciones_efectivo" ADD CONSTRAINT "declaraciones_efectivo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."declaraciones_efectivo" ADD CONSTRAINT "declaraciones_efectivo_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."ordenes_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."declaraciones_efectivo" ADD CONSTRAINT "declaraciones_efectivo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."declaraciones_efectivo" ADD CONSTRAINT "declaraciones_efectivo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direcciones" ADD CONSTRAINT "direcciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direcciones" ADD CONSTRAINT "direcciones_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direcciones" ADD CONSTRAINT "direcciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direcciones" ADD CONSTRAINT "direcciones_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "public"."municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direcciones" ADD CONSTRAINT "direcciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direcciones" ADD CONSTRAINT "direcciones_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "public"."zonas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egresos" ADD CONSTRAINT "egresos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egresos" ADD CONSTRAINT "egresos_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egresos" ADD CONSTRAINT "egresos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresa_memberships" ADD CONSTRAINT "empresa_memberships_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresa_memberships" ADD CONSTRAINT "empresa_memberships_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresa_memberships" ADD CONSTRAINT "empresa_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresa_memberships" ADD CONSTRAINT "empresa_memberships_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "public"."zonas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresas" ADD CONSTRAINT "empresas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."entidades_financieras" ADD CONSTRAINT "entidades_financieras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."entidades_financieras" ADD CONSTRAINT "entidades_financieras_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."estados_servicio" ADD CONSTRAINT "estados_servicio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."estados_servicio" ADD CONSTRAINT "estados_servicio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidencias_servicio" ADD CONSTRAINT "evidencias_servicio_ordenServicioId_fkey" FOREIGN KEY ("ordenServicioId") REFERENCES "public"."ordenes_servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidencias_servicio" ADD CONSTRAINT "evidencias_servicio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."geolocalizaciones" ADD CONSTRAINT "geolocalizaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."geolocalizaciones" ADD CONSTRAINT "geolocalizaciones_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."geolocalizaciones" ADD CONSTRAINT "geolocalizaciones_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."ordenes_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."geolocalizaciones" ADD CONSTRAINT "geolocalizaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."logs_evento" ADD CONSTRAINT "logs_evento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."logs_evento" ADD CONSTRAINT "logs_evento_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "public"."sesiones_actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."logs_evento" ADD CONSTRAINT "logs_evento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metodos_pago" ADD CONSTRAINT "metodos_pago_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."metodos_pago" ADD CONSTRAINT "metodos_pago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."municipalities" ADD CONSTRAINT "municipalities_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."niveles_riesgo_operativo" ADD CONSTRAINT "niveles_riesgo_operativo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nomina_detalles" ADD CONSTRAINT "nomina_detalles_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "public"."citas_psicologos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nomina_detalles" ADD CONSTRAINT "nomina_detalles_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nomina_detalles" ADD CONSTRAINT "nomina_detalles_nominaId_fkey" FOREIGN KEY ("nominaId") REFERENCES "public"."nominas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nomina_detalles" ADD CONSTRAINT "nomina_detalles_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."ordenes_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nomina_detalles" ADD CONSTRAINT "nomina_detalles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nominas" ADD CONSTRAINT "nominas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nominas" ADD CONSTRAINT "nominas_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nominas" ADD CONSTRAINT "nominas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "public"."direcciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_entidadFinancieraId_fkey" FOREIGN KEY ("entidadFinancieraId") REFERENCES "public"."entidades_financieras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_liquidadoPorId_fkey" FOREIGN KEY ("liquidadoPorId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "public"."metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_ordenPadreId_fkey" FOREIGN KEY ("ordenPadreId") REFERENCES "public"."ordenes_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "public"."vehiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "public"."zonas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organization_nodes" ADD CONSTRAINT "organization_nodes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organization_nodes" ADD CONSTRAINT "organization_nodes_empresaMembershipId_fkey" FOREIGN KEY ("empresaMembershipId") REFERENCES "public"."empresa_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organization_nodes" ADD CONSTRAINT "organization_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."organization_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organization_nodes" ADD CONSTRAINT "organization_nodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paquetes_adquiridos" ADD CONSTRAINT "paquetes_adquiridos_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "public"."terapias_psicologos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paquetes_adquiridos" ADD CONSTRAINT "paquetes_adquiridos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paquetes_adquiridos" ADD CONSTRAINT "paquetes_adquiridos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paquetes_adquiridos" ADD CONSTRAINT "paquetes_adquiridos_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paquetes_adquiridos" ADD CONSTRAINT "paquetes_adquiridos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permisos" ADD CONSTRAINT "permisos_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permisos" ADD CONSTRAINT "permisos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permisos" ADD CONSTRAINT "permisos_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permisos" ADD CONSTRAINT "permisos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pico_placa" ADD CONSTRAINT "pico_placa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pico_placa" ADD CONSTRAINT "pico_placa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "public"."proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos_solicitados" ADD CONSTRAINT "productos_solicitados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos_solicitados" ADD CONSTRAINT "productos_solicitados_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos_solicitados" ADD CONSTRAINT "productos_solicitados_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos_solicitados" ADD CONSTRAINT "productos_solicitados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proveedores" ADD CONSTRAINT "proveedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proveedores" ADD CONSTRAINT "proveedores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referidos" ADD CONSTRAINT "referidos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referidos" ADD CONSTRAINT "referidos_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referidos" ADD CONSTRAINT "referidos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."segmentos_negocio" ADD CONSTRAINT "segmentos_negocio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."servicios" ADD CONSTRAINT "servicios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."servicios" ADD CONSTRAINT "servicios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sesiones_actividad" ADD CONSTRAINT "sesiones_actividad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sesiones_actividad" ADD CONSTRAINT "sesiones_actividad_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sesiones_actividad" ADD CONSTRAINT "sesiones_actividad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sugerencias_seguimiento" ADD CONSTRAINT "sugerencias_seguimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sugerencias_seguimiento" ADD CONSTRAINT "sugerencias_seguimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sugerencias_seguimiento" ADD CONSTRAINT "sugerencias_seguimiento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_memberships" ADD CONSTRAINT "tenant_memberships_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "public"."municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."terapias_psicologos" ADD CONSTRAINT "terapias_psicologos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."terapias_psicologos" ADD CONSTRAINT "terapias_psicologos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tipos_interes" ADD CONSTRAINT "tipos_interes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tipos_servicio" ADD CONSTRAINT "tipos_servicio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tipos_servicio" ADD CONSTRAINT "tipos_servicio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."turnos" ADD CONSTRAINT "turnos_cuentaCobroId_fkey" FOREIGN KEY ("cuentaCobroId") REFERENCES "public"."cuentas_cobro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."turnos" ADD CONSTRAINT "turnos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."turnos" ADD CONSTRAINT "turnos_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."turnos" ADD CONSTRAINT "turnos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehiculos" ADD CONSTRAINT "vehiculos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehiculos" ADD CONSTRAINT "vehiculos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehiculos" ADD CONSTRAINT "vehiculos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zonas" ADD CONSTRAINT "zonas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zonas" ADD CONSTRAINT "zonas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

