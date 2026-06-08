generator client {
  provider        = "prisma-client"
  output          = "../src/generated/client"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
}

model User {
  id              String               @id @default(uuid()) @db.Uuid
  email           String               @unique
  password        String
  isActive        Boolean              @default(true)
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
  apellido        String
  nombre          String
  numeroDocumento String?              @unique
  telefono        String?
  tipoDocumento   String?
  sessions        AuthSession[]
  resetTokens     PasswordResetToken[]
  memberships     TenantMembership[]

  @@map("users")
}

model Tenant {
  id                        String                          @id @default(uuid()) @db.Uuid
  slug                      String                          @unique
  isActive                  Boolean                         @default(true)
  createdAt                 DateTime                        @default(now())
  updatedAt                 DateTime                        @updatedAt
  correo                    String?
  nit                       String?
  nombre                    String
  numero                    String?
  pagina                    String?
  anticipos                 Anticipos[]
  auditorias                Auditoria[]
  authSessions              AuthSession[]
  citasPsicologos           CitasPsicologos[]
  configuracionesOperativas ClienteConfiguracionOperativa[]
  clientes                  Cliente[]
  commissions               CommissionRecord[]
  configuracionPagos        ConfiguracionPagos[]
  consignacionOrdenes       ConsignacionOrden[]
  consignaciones            ConsignacionEfectivo[]
  consultorios              Consultorio[]
  contratosCliente          ContratoCliente[]
  cuentasCobro              CuentaCobro[]
  cuentasPago               CuentasPago[]
  dashboardPresets          DashboardPreset[]
  declaraciones             DeclaracionEfectivo[]
  direcciones               Direccion[]
  egresos                   Egresos[]
  empresaMemberships        EmpresaMembership[]
  empresas                  Empresa[]
  entidadesFinancieras      EntidadFinanciera[]
  estadosServicio           EstadoServicio[]
  evidenciasServicio        EvidenciaServicio[]
  geolocalizaciones         Geolocalizacion[]
  logsEvento                LogEvento[]
  metodosPago               MetodoPago[]
  nominaDetalles            NominaDetalle[]
  nominas                   Nomina[]
  ordenesServicio           OrdenServicio[]
  seguimientosOrdenServicio OrdenServicioSeguimiento[]
  orgNodes                  OrganizationNode[]
  paquetesAdquiridos        PaqueteAdquirido[]
  resetTokens               PasswordResetToken[]
  permisos                  Permiso[]
  picoPlaca                 PicoPlaca[]
  productos                 Producto[]
  productosSolicitados      ProductoSolicitado[]
  proveedores               Proveedores[]
  referidos                 Referidos[]
  servicios                 Servicio[]
  sesionesActividad         SesionActividad[]
  subscription              Subscription?
  sugerencias               SugerenciaSeguimiento[]
  membershipDepartmentScopes  TenantMembershipDepartmentScope[]
  membershipMunicipalityScopes TenantMembershipMunicipalityScope[]
  memberships               TenantMembership[]
  terapiasPsicologos        TerapiasPsicologos[]
  tiposInteres              TipoInteres[]
  tiposServicio             TipoServicio[]
  turnos                    Turno[]
  vehiculos                 Vehiculo[]
  zonas                     Zona[]

  @@map("tenants")
}

model Plan {
  id            String         @id @default(uuid()) @db.Uuid
  durationDays  Int
  maxUsers      Int
  maxOperators  Int
  price         Decimal        @db.Decimal(12, 2)
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  descripcion   String?
  maxEmpresas   Int
  nombre        String
  updatedAt     DateTime       @updatedAt
  subscriptions Subscription[]

  @@map("plans")
}

model Subscription {
  id               String             @id @default(uuid()) @db.Uuid
  tenantId         String             @unique @db.Uuid
  planId           String             @db.Uuid
  startDate        DateTime
  endDate          DateTime
  graceUntil       DateTime?
  status           SubscriptionStatus @default(ACTIVE)
  blocked          Boolean            @default(false)
  autoRenew        Boolean            @default(false)
  lastPaymentDate  DateTime?
  nextReminderDate DateTime?
  plan             Plan               @relation(fields: [planId], references: [id])
  tenant           Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([status])
  @@index([endDate])
  @@map("subscriptions")
}

model TenantMembership {
  id                      String                     @id @default(uuid()) @db.Uuid
  userId                  String                     @db.Uuid
  tenantId                String                     @db.Uuid
  role                    Role
  granularPermissions     MembershipPermission[]     @default([]) @map("granular_permissions")
  status                  MembershipStatus           @default(ACTIVE)
  createdAt               DateTime                   @default(now())
  updatedAt               DateTime                   @updatedAt
  activo                  Boolean                    @default(true)
  aprobado                Boolean                    @default(false)
  codigoReferido          String?
  moto                    Boolean?
  numberId                String?
  placa                   String?
  pushToken               String?
  username                String?
  whatsappGroupId         String?
  direccion               String?
  municipioId             String?                    @db.Uuid
  anticipos               Anticipos[]
  auditorias              Auditoria[]
  citasComoCreador        CitasPsicologos[]          @relation("CitasCreadoPor")
  citasComoPsicologo      CitasPsicologos[]          @relation("CitasPsicologo")
  clientesCreados         Cliente[]
  configuracionPagos      ConfiguracionPagos[]
  consignacionesCreadas   ConsignacionEfectivo[]     @relation("ConsignacionCreador")
  consignacionesTecnico   ConsignacionEfectivo[]     @relation("ConsignacionTecnico")
  cuentasCobro            CuentaCobro[]
  cuentasPago             CuentasPago[]
  dashboardPresets        DashboardPreset[]
  declaracionesEfectivo   DeclaracionEfectivo[]
  egresos                 Egresos[]
  empresaMemberships      EmpresaMembership[]
  geolocalizaciones       Geolocalizacion[]
  nominas                 Nomina[]
  serviciosCreados        OrdenServicio[]            @relation("ServiciosCreados")
  serviciosEliminados     OrdenServicio[]            @relation("ServiciosEliminados")
  serviciosLiquidados     OrdenServicio[]            @relation("ServiciosLiquidados")
  serviciosAsignados      OrdenServicio[]            @relation("ServiciosAsignados")
  seguimientosCompletados OrdenServicioSeguimiento[] @relation("SeguimientosCompletados")
  seguimientosCreados     OrdenServicioSeguimiento[] @relation("SeguimientosCreados")
  paquetesAdquiridos      PaqueteAdquirido[]
  permisosAprobados       Permiso[]                  @relation("PermisosAprobados")
  permisosSolicitados     Permiso[]                  @relation("PermisosSolicitados")
  productosSolicitados    ProductoSolicitado[]
  referidos               Referidos[]
  sesionesActividad       SesionActividad[]
  departmentScopes        TenantMembershipDepartmentScope[]
  municipalityScopes      TenantMembershipMunicipalityScope[]
  municipio               Municipality?              @relation(fields: [municipioId], references: [id])
  tenant                  Tenant                     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user                    User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  turnos                  Turno[]

  @@unique([userId, tenantId])
  @@index([tenantId])
  @@index([role])
  @@map("tenant_memberships")
}

model DashboardPreset {
  id                    String                @id @default(uuid()) @db.Uuid
  tenantId              String                @map("tenant_id") @db.Uuid
  createdByMembershipId String                @map("created_by_membership_id") @db.Uuid
  module                DashboardPresetModule
  name                  String
  colorToken            String                @map("color_token")
  isShared              Boolean               @default(false) @map("is_shared")
  filters               Json
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime?             @updatedAt @map("updated_at")
  createdByMembership   TenantMembership      @relation(fields: [createdByMembershipId], references: [id], onDelete: Cascade)
  tenant                Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, module])
  @@index([createdByMembershipId, module])
  @@index([tenantId, module, isShared])
  @@map("dashboard_presets")
}

model Empresa {
  id                        String                          @id @default(uuid()) @db.Uuid
  tenantId                  String                          @db.Uuid
  nombre                    String
  createdAt                 DateTime                        @default(now())
  updatedAt                 DateTime                        @updatedAt
  activo                    Boolean                         @default(true)
  deletedAt                 DateTime?
  anticipos                 Anticipos[]
  auditorias                Auditoria[]
  authSessions              AuthSession[]
  citasPsicologos           CitasPsicologos[]
  configuracionesOperativas ClienteConfiguracionOperativa[]
  clientes                  Cliente[]
  commissions               CommissionRecord[]
  configuracionPagos        ConfiguracionPagos[]
  consignacionOrdenes       ConsignacionOrden[]
  consignaciones            ConsignacionEfectivo[]
  consultorios              Consultorio[]
  contratosCliente          ContratoCliente[]
  cuentasCobro              CuentaCobro[]
  cuentasPago               CuentasPago[]
  declaraciones             DeclaracionEfectivo[]
  direcciones               Direccion[]
  egresos                   Egresos[]
  memberships               EmpresaMembership[]
  tenant                    Tenant                          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  entidadesFinancieras      EntidadFinanciera[]
  estadosServicio           EstadoServicio[]
  geolocalizaciones         Geolocalizacion[]
  logsEvento                LogEvento[]
  metodosPago               MetodoPago[]
  nominaDetalles            NominaDetalle[]
  nominas                   Nomina[]
  ordenesServicio           OrdenServicio[]
  seguimientosOrdenServicio OrdenServicioSeguimiento[]
  orgNodes                  OrganizationNode[]
  paquetesAdquiridos        PaqueteAdquirido[]
  resetTokens               PasswordResetToken[]
  permisos                  Permiso[]
  picoPlaca                 PicoPlaca[]
  productos                 Producto[]
  productosSolicitados      ProductoSolicitado[]
  proveedores               Proveedores[]
  referidos                 Referidos[]
  servicios                 Servicio[]
  sesionesActividad         SesionActividad[]
  sugerencias               SugerenciaSeguimiento[]
  terapiasPsicologos        TerapiasPsicologos[]
  tiposServicio             TipoServicio[]
  turnos                    Turno[]
  vehiculos                 Vehiculo[]
  zonas                     Zona[]

  @@index([tenantId])
  @@map("empresas")
}

model EmpresaMembership {
  id           String            @id @default(uuid()) @db.Uuid
  tenantId     String            @db.Uuid
  membershipId String            @db.Uuid
  empresaId    String            @db.Uuid
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  zonaId       String?           @db.Uuid
  role         Role?             @default(OPERADOR)
  activo       Boolean           @default(true)
  deletedAt    DateTime?
  empresa      Empresa           @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  membership   TenantMembership  @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  tenant       Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  zona         Zona?             @relation(fields: [zonaId], references: [id])
  orgNode      OrganizationNode?

  @@unique([membershipId, empresaId])
  @@index([tenantId])
  @@index([empresaId])
  @@map("empresa_memberships")
}

model OrganizationNode {
  id                     String             @id @default(uuid()) @db.Uuid
  tenantId               String             @db.Uuid
  parentId               String?            @db.Uuid
  nivel                  Int                @default(0)
  puedeTenerSubordinados Boolean            @default(false)
  porcentajeComision     Decimal?           @db.Decimal(5, 2)
  createdAt              DateTime           @default(now())
  empresaId              String             @db.Uuid
  empresaMembershipId    String             @unique @db.Uuid
  updatedAt              DateTime           @updatedAt
  commissions            CommissionRecord[]
  empresa                Empresa            @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  empresaMembership      EmpresaMembership  @relation(fields: [empresaMembershipId], references: [id], onDelete: Cascade)
  parent                 OrganizationNode?  @relation("OrgHierarchy", fields: [parentId], references: [id])
  children               OrganizationNode[] @relation("OrgHierarchy")
  tenant                 Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([parentId])
  @@map("organization_nodes")
}

model CommissionRecord {
  id                 String             @id @default(uuid()) @db.Uuid
  tenantId           String             @db.Uuid
  organizationNodeId String             @db.Uuid
  porcentaje         Decimal            @db.Decimal(5, 2)
  valorBase          Decimal            @db.Decimal(12, 2)
  valorComision      Decimal            @db.Decimal(12, 2)
  createdAt          DateTime           @default(now())
  citaPsicologoId    String?            @db.Uuid
  concepto           String?
  empresaId          String             @db.Uuid
  estadoPago         EstadoPagoComision @default(PENDIENTE)
  fechaPago          DateTime?
  ordenServicioId    String?            @db.Uuid
  empresa            Empresa            @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  organizationNode   OrganizationNode   @relation(fields: [organizationNodeId], references: [id], onDelete: Cascade)
  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([organizationNodeId])
  @@index([estadoPago])
  @@index([createdAt])
  @@map("commission_records")
}

model TipoInteres {
  id                 String    @id @default(uuid()) @db.Uuid
  tenantId           String    @db.Uuid
  nombre             String
  descripcion        String?
  activo             Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  frecuenciaSugerida Int?      @default(30)
  riesgoSugerido     String?   @default("BAJO")
  clientes           Cliente[]
  tenant             Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("tipos_interes")
}

model Department {
  id               String                         @id @default(uuid()) @db.Uuid
  name             String
  code             String                         @unique
  direcciones      Direccion[]
  municipalities   Municipality[]
  membershipScopes TenantMembershipDepartmentScope[]

  @@map("departments")
}

model Municipality {
  id               String                           @id @default(uuid()) @db.Uuid
  name             String
  code             String                           @unique
  departmentId     String                           @db.Uuid
  direcciones      Direccion[]
  department       Department                       @relation(fields: [departmentId], references: [id])
  memberships      TenantMembership[]
  membershipScopes TenantMembershipMunicipalityScope[]

  @@map("municipalities")
}

model TenantMembershipDepartmentScope {
  id           String           @id @default(uuid()) @db.Uuid
  tenantId     String           @db.Uuid
  membershipId String           @db.Uuid
  departmentId String           @db.Uuid
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  department   Department       @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  membership   TenantMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  tenant       Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([membershipId, departmentId])
  @@index([tenantId])
  @@index([membershipId])
  @@index([departmentId])
  @@index([tenantId, departmentId])
  @@map("tenant_membership_department_scopes")
}

model TenantMembershipMunicipalityScope {
  id             String           @id @default(uuid()) @db.Uuid
  tenantId       String           @db.Uuid
  membershipId   String           @db.Uuid
  municipalityId String           @db.Uuid
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  membership     TenantMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  municipality   Municipality     @relation(fields: [municipalityId], references: [id], onDelete: Cascade)
  tenant         Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([membershipId, municipalityId])
  @@index([tenantId])
  @@index([membershipId])
  @@index([municipalityId])
  @@index([tenantId, municipalityId])
  @@map("tenant_membership_municipality_scopes")
}

model Cliente {
  id                        String                          @id @default(uuid()) @db.Uuid
  tenantId                  String                          @db.Uuid
  empresaId                 String?                         @db.Uuid
  nombre                    String?
  apellido                  String?
  telefono                  String                          @unique
  telefono2                 String?
  correo                    String?
  numeroDocumento           String?
  tipoDocumento             String?
  registroDocumento         String?
  documentoPath             String?
  creadoPorId               String?                         @db.Uuid
  createdAt                 DateTime                        @default(now())
  deletedAt                 DateTime?
  aceptaMarketing           Boolean                         @default(false)
  cargoContacto             String?
  clasificacion             ClasificacionCliente?           @default(BRONCE)
  fechaConsentimiento       DateTime?
  frecuenciaServicio        Int?
  nit                       String?
  planActual                String?
  proximaVisita             DateTime?
  razonSocial               String?
  representanteLegal        String?
  score                     Int?                            @default(0)
  subsegmento               String?
  ticketPromedio            Decimal?                        @db.Decimal(12, 2)
  tipoCliente               TipoCliente                     @default(PERSONA)
  ultimaVisita              DateTime?
  updatedAt                 DateTime                        @updatedAt
  actividadEconomica        String?
  metrajeTotal              Decimal?                        @db.Decimal(12, 2)
  origenCliente             String?
  tipoInteresId             String?                         @db.Uuid
  segmento                  SegmentoCliente                 @default(OTRO)
  nivelRiesgo               NivelRiesgo                     @default(MEDIO)
  citasPsicologos           CitasPsicologos[]
  configuracionesOperativas ClienteConfiguracionOperativa[]
  creadoPor                 TenantMembership?               @relation(fields: [creadoPorId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  empresa                   Empresa?                        @relation(fields: [empresaId], references: [id])
  tenant                    Tenant                          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tipoInteres               TipoInteres?                    @relation(fields: [tipoInteresId], references: [id])
  contratosCliente          ContratoCliente[]
  direcciones               Direccion[]
  ordenesServicio           OrdenServicio[]
  paquetesAdquiridos        PaqueteAdquirido[]
  sugerencias               SugerenciaSeguimiento[]
  vehiculos                 Vehiculo[]

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([numeroDocumento])
  @@index([nombre, apellido])
  @@index([segmento])
  @@index([nivelRiesgo])
  @@map("clientes")
}

model ContratoCliente {
  id                     String                @id @default(uuid()) @db.Uuid
  tenantId               String                @db.Uuid
  clienteId              String                @db.Uuid
  empresaId              String                @db.Uuid
  estado                 EstadoContratoCliente @default(ACTIVO)
  fechaInicio            DateTime
  fechaFin               DateTime?
  serviciosComprometidos Int?
  frecuenciaServicio     Int?
  tipoFacturacion        TipoFacturacion
  observaciones          String?
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt
  cliente                Cliente               @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  empresa                Empresa               @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  tenant                 Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ordenesServicio        OrdenServicio[]

  @@index([tenantId])
  @@index([clienteId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([tenantId, clienteId, empresaId, estado])
  @@map("contratos_cliente")
}

model Vehiculo {
  id              String          @id @default(uuid()) @db.Uuid
  tenantId        String          @db.Uuid
  empresaId       String?         @db.Uuid
  clienteId       String          @db.Uuid
  placa           String
  marca           String?
  modelo          String?
  color           String?
  tipo            String?
  createdAt       DateTime        @default(now())
  ordenesServicio OrdenServicio[]
  cliente         Cliente         @relation(fields: [clienteId], references: [id])
  empresa         Empresa?        @relation(fields: [empresaId], references: [id])
  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@map("vehiculos")
}

model Direccion {
  id                        String                          @id @default(uuid()) @db.Uuid
  tenantId                  String                          @db.Uuid
  empresaId                 String?                         @db.Uuid
  clienteId                 String                          @db.Uuid
  direccion                 String
  piso                      String?
  bloque                    String?
  unidad                    String?
  barrio                    String?
  municipio                 String?
  linkMaps                  String?
  createdAt                 DateTime                        @default(now())
  latitud                   Float?
  longitud                  Float?
  nombreSede                String?
  updatedAt                 DateTime                        @updatedAt
  activa                    Boolean                         @default(true)
  bloqueada                 Boolean                         @default(false)
  cargoContacto             String?
  clasificacionPunto        String?
  horarioFin                String?
  horarioInicio             String?
  motivoBloqueo             String?
  municipioId               String?                         @db.Uuid
  nombreContacto            String?
  precisionGPS              Decimal?                        @db.Decimal(10, 2)
  restricciones             String?
  telefonoContacto          String?
  tipoUbicacion             String?
  validadoPorSistema        Boolean                         @default(false)
  departmentId              String?                         @db.Uuid
  zonaId                    String?                         @db.Uuid
  configuracionesOperativas ClienteConfiguracionOperativa[]
  cliente                   Cliente                         @relation(fields: [clienteId], references: [id])
  departmentRel             Department?                     @relation(fields: [departmentId], references: [id])
  empresa                   Empresa?                        @relation(fields: [empresaId], references: [id])
  municipioRel              Municipality?                   @relation(fields: [municipioId], references: [id])
  tenant                    Tenant                          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  zona                      Zona?                           @relation(fields: [zonaId], references: [id])
  ordenesServicio           OrdenServicio[]

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@map("direcciones")
}

model Zona {
  id                 String              @id @default(uuid()) @db.Uuid
  tenantId           String              @db.Uuid
  nombre             String
  estado             Boolean             @default(true)
  deletedAt          DateTime?
  createdAt          DateTime            @default(now())
  empresaId          String              @db.Uuid
  direcciones        Direccion[]
  empresaMemberships EmpresaMembership[]
  ordenes            OrdenServicio[]
  empresa            Empresa             @relation(fields: [empresaId], references: [id])
  tenant             Tenant              @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([empresaId])
  @@map("zonas")
}

model Servicio {
  id                           String            @id @default(uuid()) @db.Uuid
  tenantId                     String            @db.Uuid
  empresaId                    String            @db.Uuid
  nombre                       String
  activo                       Boolean           @default(true)
  deleteAt                     DateTime?
  createdAt                    DateTime          @default(now())
  requiereSeguimiento          Boolean           @default(false)
  primerSeguimientoDias        Int?
  requiereSeguimientoTresMeses Boolean           @default(true)
  citasComoServicio            CitasPsicologos[] @relation("CitasServicio")
  citasComoTipoServicio        CitasPsicologos[] @relation("CitasTipoServicio")
  ordenes                      OrdenServicio[]
  empresa                      Empresa           @relation(fields: [empresaId], references: [id])
  tenant                       Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@map("servicios")
}

model TipoServicio {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  nombre    String
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
  empresaId String   @db.Uuid
  empresa   Empresa  @relation(fields: [empresaId], references: [id])
  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([empresaId])
  @@map("tipos_servicio")
}

model MetodoPago {
  id        String          @id @default(uuid()) @db.Uuid
  tenantId  String          @db.Uuid
  nombre    String
  activo    Boolean         @default(true)
  createdAt DateTime        @default(now())
  empresaId String          @db.Uuid
  empresa   Empresa         @relation(fields: [empresaId], references: [id])
  tenant    Tenant          @relation(fields: [tenantId], references: [id])
  ordenes   OrdenServicio[]

  @@index([tenantId])
  @@index([empresaId])
  @@map("metodos_pago")
}

model EstadoServicio {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  nombre    String
  activo    Boolean
  createdAt DateTime @default(now())
  empresaId String   @db.Uuid
  empresa   Empresa  @relation(fields: [empresaId], references: [id])
  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([empresaId])
  @@map("estados_servicio")
}

model OrdenServicio {
  id                           String                     @id @default(uuid()) @db.Uuid
  tenantId                     String                     @db.Uuid
  empresaId                    String                     @db.Uuid
  clienteId                    String                     @db.Uuid
  servicioId                   String                     @db.Uuid
  creadoPorId                  String?                    @db.Uuid
  tecnicoId                    String?                    @db.Uuid
  direccionId                  String?                    @db.Uuid
  direccionTexto               String
  piso                         String?
  bloque                       String?
  unidad                       String?
  barrio                       String?
  municipio                    String?
  departamento                 String?
  linkMaps                     String?
  zonaId                       String?                    @db.Uuid
  vehiculoId                   String?                    @db.Uuid
  metodoPagoId                 String?                    @db.Uuid
  numeroOrden                  String?
  fechaVisita                  DateTime?
  horaInicio                   DateTime?
  horaFin                      DateTime?
  observacion                  String?
  observacionFinal             String?
  condicionesHigiene           String?
  condicionesLocal             String?
  valorCotizado                Decimal?                   @db.Decimal(12, 2)
  valorPagado                  Decimal?                   @db.Decimal(12, 2)
  valorRepuestos               Decimal?                   @default(0) @db.Decimal(12, 2)
  valorRepuestosTecnico        Decimal?                   @default(0) @db.Decimal(12, 2)
  facturaPath                  String?
  facturaElectronica           String?
  evidenciaPath                String?
  desglosePago                 Json?
  referenciaPago               String?
  fechaPago                    DateTime?
  entidadFinancieraId          String?                    @db.Uuid
  estadoPago                   EstadoPagoOrden            @default(PENDIENTE)
  seguimientoRevisado          Boolean?                   @default(false)
  liquidadoPorId               String?                    @db.Uuid
  liquidadoAt                  DateTime?
  ordenPadreId                 String?                    @db.Uuid
  createdAt                    DateTime                   @default(now())
  updatedAt                    DateTime                   @updatedAt
  frecuenciaSugerida           Int?
  tipoFacturacion              TipoFacturacion?
  tipoVisita                   TipoVisita?
  nivelInfestacion             NivelInfestacion?
  urgencia                     UrgenciaOrden?
  estadoServicio               EstadoOrden                @default(NUEVO)
  contratoClienteId            String?                    @db.Uuid
  serviciosSeleccionados       Json?
  diagnosticoTecnico           String?
  hallazgosEstructurales       String?
  horaFinReal                  DateTime?
  horaInicioReal               DateTime?
  huboRecomendacionEstructural Boolean?
  huboSellamiento              Boolean?
  intervencionRealizada        String?
  recomendacionesObligatorias  String?
  deletedAt                    DateTime?
  deletedById                  String?                    @db.Uuid
  deletedReason                String?
  comprobantePago              Json?
  consignacionOrden            ConsignacionOrden?
  declaracionEfectivo          DeclaracionEfectivo?
  evidencias                   EvidenciaServicio[]
  geolocalizaciones            Geolocalizacion[]
  nominaDetalles               NominaDetalle[]
  cliente                      Cliente                    @relation(fields: [clienteId], references: [id])
  contratoCliente              ContratoCliente?           @relation(fields: [contratoClienteId], references: [id])
  creadoPor                    TenantMembership?          @relation("ServiciosCreados", fields: [creadoPorId], references: [id])
  deletedBy                    TenantMembership?          @relation("ServiciosEliminados", fields: [deletedById], references: [id])
  direccion                    Direccion?                 @relation(fields: [direccionId], references: [id])
  empresa                      Empresa                    @relation(fields: [empresaId], references: [id])
  entidadFinanciera            EntidadFinanciera?         @relation(fields: [entidadFinancieraId], references: [id])
  liquidadoPor                 TenantMembership?          @relation("ServiciosLiquidados", fields: [liquidadoPorId], references: [id])
  metodoPago                   MetodoPago?                @relation(fields: [metodoPagoId], references: [id])
  ordenPadre                   OrdenServicio?             @relation("OrdenRefuerzo", fields: [ordenPadreId], references: [id])
  ordenesHijas                 OrdenServicio[]            @relation("OrdenRefuerzo")
  servicio                     Servicio                   @relation(fields: [servicioId], references: [id])
  tecnico                      TenantMembership?          @relation("ServiciosAsignados", fields: [tecnicoId], references: [id])
  tenant                       Tenant                     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  vehiculo                     Vehiculo?                  @relation(fields: [vehiculoId], references: [id])
  zona                         Zona?                      @relation(fields: [zonaId], references: [id])
  seguimientos                 OrdenServicioSeguimiento[]

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([clienteId])
  @@index([tecnicoId])
  @@index([entidadFinancieraId])
  @@index([contratoClienteId])
  @@index([estadoServicio])
  @@index([deletedAt])
  @@index([numeroOrden])
  @@index([fechaVisita])
  @@map("ordenes_servicio")
}

model OrdenServicioSeguimiento {
  id                      String            @id @default(uuid()) @db.Uuid
  tenantId                String            @db.Uuid
  empresaId               String            @db.Uuid
  ordenServicioId         String            @db.Uuid
  createdByMembershipId   String            @db.Uuid
  completedByMembershipId String?           @db.Uuid
  followUpType            String
  status                  String            @default("PENDIENTE")
  dueAt                   DateTime
  contactedAt             DateTime?
  channel                 String?
  outcome                 String?
  notes                   String?
  completedAt             DateTime?
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt
  completedByMembership   TenantMembership? @relation("SeguimientosCompletados", fields: [completedByMembershipId], references: [id])
  createdByMembership     TenantMembership  @relation("SeguimientosCreados", fields: [createdByMembershipId], references: [id])
  empresa                 Empresa           @relation(fields: [empresaId], references: [id])
  ordenServicio           OrdenServicio     @relation(fields: [ordenServicioId], references: [id], onDelete: Cascade)
  tenant                  Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([createdByMembershipId])
  @@index([ordenServicioId])
  @@index([status])
  @@index([dueAt])
  @@map("ordenes_servicio_seguimientos")
}

model EntidadFinanciera {
  id        String          @id @default(uuid()) @db.Uuid
  tenantId  String          @db.Uuid
  empresaId String          @db.Uuid
  nombre    String
  activo    Boolean         @default(true)
  createdAt DateTime        @default(now())
  empresa   Empresa         @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  tenant    Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ordenes   OrdenServicio[]

  @@unique([empresaId, nombre])
  @@index([tenantId])
  @@index([empresaId])
  @@map("entidades_financieras")
}

model Geolocalizacion {
  id           String           @id @default(uuid()) @db.Uuid
  tenantId     String           @db.Uuid
  empresaId    String           @db.Uuid
  membershipId String           @db.Uuid
  ordenId      String           @db.Uuid
  latitud      Float?
  longitud     Float?
  llegada      DateTime
  salida       DateTime?
  fotoLlegada  String?
  fotoSalida   String?
  linkMaps     String?
  createdAt    DateTime         @default(now())
  empresa      Empresa          @relation(fields: [empresaId], references: [id])
  membership   TenantMembership @relation(fields: [membershipId], references: [id])
  orden        OrdenServicio    @relation(fields: [ordenId], references: [id])
  tenant       Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@index([ordenId])
  @@map("geolocalizaciones")
}

model Nomina {
  id                 String           @id @default(uuid()) @db.Uuid
  tenantId           String           @db.Uuid
  empresaId          String           @db.Uuid
  membershipId       String           @db.Uuid
  fechaInicio        DateTime
  fechaFin           DateTime
  fechaGeneracion    DateTime         @default(now())
  totalServicios     Int
  totalValorPagado   Decimal          @db.Decimal(12, 2)
  totalRepuestos     Decimal          @db.Decimal(12, 2)
  totalIva           Decimal          @default(0) @db.Decimal(12, 2)
  baseComisionable   Decimal          @db.Decimal(12, 2)
  porcentajeAplicado Decimal?         @db.Decimal(5, 2)
  salarioFijo        Decimal?         @db.Decimal(12, 2)
  totalComisiones    Decimal          @default(0) @db.Decimal(12, 2)
  totalPagar         Decimal          @db.Decimal(12, 2)
  estado             EstadoNomina     @default(BORRADOR)
  observaciones      String?
  detalles           NominaDetalle[]
  empresa            Empresa          @relation(fields: [empresaId], references: [id])
  membership         TenantMembership @relation(fields: [membershipId], references: [id])
  tenant             Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@index([estado])
  @@map("nominas")
}

model NominaDetalle {
  id            String           @id @default(uuid()) @db.Uuid
  tenantId      String           @db.Uuid
  empresaId     String           @db.Uuid
  nominaId      String           @db.Uuid
  ordenId       String?          @db.Uuid
  citaId        String?          @db.Uuid
  valorServicio Decimal          @db.Decimal(12, 2)
  concepto      String?
  cita          CitasPsicologos? @relation(fields: [citaId], references: [id])
  empresa       Empresa          @relation(fields: [empresaId], references: [id])
  nomina        Nomina           @relation(fields: [nominaId], references: [id])
  orden         OrdenServicio?   @relation(fields: [ordenId], references: [id])
  tenant        Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([nominaId])
  @@map("nomina_detalles")
}

model CitasPsicologos {
  id              String            @id @default(uuid()) @db.Uuid
  tenantId        String            @db.Uuid
  empresaId       String            @db.Uuid
  pacienteId      String            @db.Uuid
  servicioId      String?           @db.Uuid
  creadoPorId     String?           @db.Uuid
  psicologoId     String?           @db.Uuid
  tipoServicio    String?           @db.Uuid
  consultorioId   String?           @db.Uuid
  paqueteId       String?           @db.Uuid
  fechaCita       DateTime?
  horaInicio      DateTime?
  horaFin         DateTime?
  valor           Decimal?          @db.Decimal(12, 2)
  metodoPago      String?
  comprobantePath String?
  observacion     String?
  realizada       Boolean           @default(false)
  estadoPago      EstadoPagoOrden?  @default(PENDIENTE)
  createdAt       DateTime          @default(now())
  consultorio     Consultorio?      @relation(fields: [consultorioId], references: [id])
  creadoPor       TenantMembership? @relation("CitasCreadoPor", fields: [creadoPorId], references: [id])
  empresa         Empresa           @relation(fields: [empresaId], references: [id])
  paciente        Cliente           @relation(fields: [pacienteId], references: [id])
  paquete         PaqueteAdquirido? @relation(fields: [paqueteId], references: [id])
  psicologo       TenantMembership? @relation("CitasPsicologo", fields: [psicologoId], references: [id])
  servicio        Servicio?         @relation("CitasServicio", fields: [servicioId], references: [id])
  tenant          Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tipoServicioRel Servicio?         @relation("CitasTipoServicio", fields: [tipoServicio], references: [id])
  nominaDetalles  NominaDetalle[]

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([pacienteId])
  @@index([psicologoId])
  @@map("citas_psicologos")
}

model Consultorio {
  id        String            @id @default(uuid()) @db.Uuid
  tenantId  String            @db.Uuid
  empresaId String            @db.Uuid
  nombre    String
  createdAt DateTime          @default(now())
  citas     CitasPsicologos[]
  empresa   Empresa           @relation(fields: [empresaId], references: [id])
  tenant    Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@map("consultorios")
}

model TerapiasPsicologos {
  id                 String             @id @default(uuid()) @db.Uuid
  tenantId           String             @db.Uuid
  empresaId          String             @db.Uuid
  nombre             String
  descripcion        String?
  categoria          String?
  cantidadSesiones   Int                @default(1)
  precioBase         Decimal            @db.Decimal(12, 2)
  activo             Boolean            @default(true)
  createdAt          DateTime           @default(now())
  paquetesAdquiridos PaqueteAdquirido[]
  empresa            Empresa            @relation(fields: [empresaId], references: [id])
  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@map("terapias_psicologos")
}

model PaqueteAdquirido {
  id                 String             @id @default(uuid()) @db.Uuid
  tenantId           String             @db.Uuid
  empresaId          String             @db.Uuid
  clienteId          String             @db.Uuid
  catalogoId         String             @db.Uuid
  membershipId       String?            @db.Uuid
  sesionesTotales    Int
  sesionesConsumidas Int                @default(0)
  saldoRestante      Int
  fechaCompra        DateTime           @default(now())
  fechaVencimiento   DateTime?
  precioPagado       Decimal            @db.Decimal(12, 2)
  estado             EstadoPaquete      @default(ACTIVO)
  citas              CitasPsicologos[]
  catalogo           TerapiasPsicologos @relation(fields: [catalogoId], references: [id])
  cliente            Cliente            @relation(fields: [clienteId], references: [id])
  empresa            Empresa            @relation(fields: [empresaId], references: [id])
  membership         TenantMembership?  @relation(fields: [membershipId], references: [id])
  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([clienteId])
  @@index([estado])
  @@map("paquetes_adquiridos")
}

model Turno {
  id             String           @id @default(uuid()) @db.Uuid
  tenantId       String           @db.Uuid
  empresaId      String           @db.Uuid
  membershipId   String           @db.Uuid
  cuentaCobroId  String?          @db.Uuid
  fecha          DateTime
  horaEntrada    DateTime
  horaSalida     DateTime
  tiempoDescanso Int
  valorTotal     Decimal?         @db.Decimal(12, 2)
  observaciones  String?
  fotoEntrada    String?
  fotoSalida     String?
  createdAt      DateTime         @default(now())
  cuentaCobro    CuentaCobro?     @relation(fields: [cuentaCobroId], references: [id])
  empresa        Empresa          @relation(fields: [empresaId], references: [id])
  membership     TenantMembership @relation(fields: [membershipId], references: [id])
  tenant         Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("turnos")
}

model CuentaCobro {
  id           String            @id @default(uuid()) @db.Uuid
  tenantId     String            @db.Uuid
  empresaId    String            @db.Uuid
  membershipId String            @db.Uuid
  fechaInicio  DateTime
  fechaFin     DateTime
  valorTotal   Decimal           @db.Decimal(12, 2)
  estado       EstadoCuentaCobro @default(GENERADA)
  createdAt    DateTime          @default(now())
  empresa      Empresa           @relation(fields: [empresaId], references: [id])
  membership   TenantMembership  @relation(fields: [membershipId], references: [id])
  tenant       Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  turnos       Turno[]

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("cuentas_cobro")
}

model DeclaracionEfectivo {
  id               String           @id @default(uuid()) @db.Uuid
  tenantId         String           @db.Uuid
  empresaId        String           @db.Uuid
  ordenId          String           @unique @db.Uuid
  tecnicoId        String           @db.Uuid
  valorDeclarado   Decimal          @db.Decimal(12, 2)
  evidenciaPath    String
  observacion      String?
  consignado       Boolean          @default(false)
  fechaDeclaracion DateTime         @default(now())
  empresa          Empresa          @relation(fields: [empresaId], references: [id])
  orden            OrdenServicio    @relation(fields: [ordenId], references: [id])
  tecnico          TenantMembership @relation(fields: [tecnicoId], references: [id])
  tenant           Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([tecnicoId])
  @@index([consignado])
  @@map("declaraciones_efectivo")
}

model ConsignacionEfectivo {
  id                String              @id @default(uuid()) @db.Uuid
  tenantId          String              @db.Uuid
  empresaId         String              @db.Uuid
  tecnicoId         String              @db.Uuid
  creadoPorId       String              @db.Uuid
  fechaConsignacion DateTime
  valorConsignado   Decimal             @db.Decimal(12, 2)
  referenciaBanco   String
  comprobantePath   String
  estado            EstadoConsignacion  @default(PENDIENTE)
  diferencia        Decimal?            @db.Decimal(12, 2)
  observacion       String?
  createdAt         DateTime            @default(now())
  anticipos         Anticipos[]
  ordenes           ConsignacionOrden[]
  creadoPor         TenantMembership    @relation("ConsignacionCreador", fields: [creadoPorId], references: [id])
  empresa           Empresa             @relation(fields: [empresaId], references: [id])
  tecnico           TenantMembership    @relation("ConsignacionTecnico", fields: [tecnicoId], references: [id])
  tenant            Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([tecnicoId])
  @@index([estado])
  @@map("consignaciones_efectivo")
}

model ConsignacionOrden {
  id             String               @id @default(uuid()) @db.Uuid
  tenantId       String               @db.Uuid
  empresaId      String               @db.Uuid
  consignacionId String               @db.Uuid
  ordenId        String               @unique @db.Uuid
  consignacion   ConsignacionEfectivo @relation(fields: [consignacionId], references: [id])
  empresa        Empresa              @relation(fields: [empresaId], references: [id])
  orden          OrdenServicio        @relation(fields: [ordenId], references: [id])
  tenant         Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@map("consignacion_ordenes")
}

model Anticipos {
  id             String                @id @default(uuid()) @db.Uuid
  tenantId       String                @db.Uuid
  empresaId      String                @db.Uuid
  membershipId   String                @db.Uuid
  consignacionId String?               @db.Uuid
  monto          Decimal               @db.Decimal(12, 2)
  razon          String?
  createdAt      DateTime              @default(now())
  consignacion   ConsignacionEfectivo? @relation(fields: [consignacionId], references: [id])
  empresa        Empresa               @relation(fields: [empresaId], references: [id])
  membership     TenantMembership      @relation(fields: [membershipId], references: [id])
  tenant         Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("anticipos")
}

model Producto {
  id               String               @id @default(uuid()) @db.Uuid
  tenantId         String               @db.Uuid
  proveedorId      String?              @db.Uuid
  categoria        String?
  nombre           String
  descripcion      String?
  unidadMedida     String?
  precio           Decimal?             @db.Decimal(12, 2)
  moneda           String?
  stockActual      Int?
  stockMinimo      Int?
  tiempoReposicion Int?
  activo           Boolean              @default(true)
  createdAt        DateTime             @default(now())
  empresaId        String               @db.Uuid
  empresa          Empresa              @relation(fields: [empresaId], references: [id])
  proveedor        Proveedores?         @relation(fields: [proveedorId], references: [id])
  tenant           Tenant               @relation(fields: [tenantId], references: [id])
  solicitudes      ProductoSolicitado[]

  @@index([tenantId])
  @@index([empresaId])
  @@map("productos")
}

model ProductoSolicitado {
  id           String                   @id @default(uuid()) @db.Uuid
  tenantId     String                   @db.Uuid
  empresaId    String                   @db.Uuid
  membershipId String                   @db.Uuid
  productoId   String                   @db.Uuid
  cantidad     String
  unidadMedida String?
  estado       EstadoSolicitudProductos @default(PENDIENTE)
  createdAt    DateTime                 @default(now())
  empresa      Empresa                  @relation(fields: [empresaId], references: [id])
  membership   TenantMembership         @relation(fields: [membershipId], references: [id])
  producto     Producto                 @relation(fields: [productoId], references: [id])
  tenant       Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("productos_solicitados")
}

model Proveedores {
  id           String     @id @default(uuid()) @db.Uuid
  tenantId     String     @db.Uuid
  nombre       String
  nit          String?
  pais         String?
  departamento String?
  ciudad       String?
  direccion    String?
  telefono     String?
  email        String?
  activo       Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  empresaId    String     @db.Uuid
  productos    Producto[]
  empresa      Empresa    @relation(fields: [empresaId], references: [id])
  tenant       Tenant     @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([empresaId])
  @@map("proveedores")
}

model Permiso {
  id              String            @id @default(uuid()) @db.Uuid
  tenantId        String            @db.Uuid
  empresaId       String            @db.Uuid
  membershipId    String            @db.Uuid
  adminId         String?           @db.Uuid
  tipo            TipoPermiso
  entidadId       String?
  motivo          String?
  estado          EstadoPermiso     @default(PENDIENTE)
  fechaSolicitud  DateTime          @default(now())
  fechaAprobacion DateTime?
  fechaExpiracion DateTime?
  admin           TenantMembership? @relation("PermisosAprobados", fields: [adminId], references: [id])
  empresa         Empresa           @relation(fields: [empresaId], references: [id])
  membership      TenantMembership  @relation("PermisosSolicitados", fields: [membershipId], references: [id])
  tenant          Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@index([estado])
  @@map("permisos")
}

model ConfiguracionPagos {
  id                 String           @id @default(uuid()) @db.Uuid
  tenantId           String           @db.Uuid
  empresaId          String           @db.Uuid
  membershipId       String           @db.Uuid
  tipo               TipoPago?
  valorParticipacion Decimal?         @db.Decimal(12, 2)
  salarioBase        Decimal?         @db.Decimal(12, 2)
  createdAt          DateTime         @default(now())
  empresa            Empresa          @relation(fields: [empresaId], references: [id])
  membership         TenantMembership @relation(fields: [membershipId], references: [id])
  tenant             Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("configuracion_pagos")
}

model CuentasPago {
  id           String           @id @default(uuid()) @db.Uuid
  tenantId     String           @db.Uuid
  empresaId    String           @db.Uuid
  membershipId String           @db.Uuid
  banco        String
  tipoCuenta   String
  numeroCuenta String
  valorHora    Decimal?         @db.Decimal(12, 2)
  createdAt    DateTime         @default(now())
  empresa      Empresa          @relation(fields: [empresaId], references: [id])
  membership   TenantMembership @relation(fields: [membershipId], references: [id])
  tenant       Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("cuentas_pago")
}

model Egresos {
  id           String            @id @default(uuid()) @db.Uuid
  tenantId     String            @db.Uuid
  empresaId    String            @db.Uuid
  membershipId String?           @db.Uuid
  titulo       String
  monto        Decimal           @db.Decimal(12, 2)
  razon        String?
  createdAt    DateTime          @default(now())
  categoria    String?           @default("GENERAL")
  empresa      Empresa           @relation(fields: [empresaId], references: [id])
  membership   TenantMembership? @relation(fields: [membershipId], references: [id])
  tenant       Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("egresos")
}

model PicoPlaca {
  id        String    @id @default(uuid()) @db.Uuid
  tenantId  String    @db.Uuid
  numeroUno Int
  numeroDos Int
  activo    Boolean   @default(true)
  createdAt DateTime  @default(now())
  empresaId String    @db.Uuid
  dia       DiaSemana
  empresa   Empresa   @relation(fields: [empresaId], references: [id])
  tenant    Tenant    @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([empresaId])
  @@map("pico_placa")
}

model Referidos {
  id           String           @id @default(uuid()) @db.Uuid
  tenantId     String           @db.Uuid
  empresaId    String           @db.Uuid
  membershipId String           @db.Uuid
  nombre       String?
  apellido     String?
  telefono     String?
  codigo       String?
  createdAt    DateTime         @default(now())
  empresa      Empresa          @relation(fields: [empresaId], references: [id])
  membership   TenantMembership @relation(fields: [membershipId], references: [id])
  tenant       Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@map("referidos")
}

model Auditoria {
  id           String            @id @default(uuid()) @db.Uuid
  tenantId     String            @db.Uuid
  membershipId String?           @db.Uuid
  accion       String
  entidad      String
  entidadId    String
  detalles     Json?
  metadata     Json?
  createdAt    DateTime          @default(now())
  empresaId    String?           @db.Uuid
  empresa      Empresa?          @relation(fields: [empresaId], references: [id])
  membership   TenantMembership? @relation(fields: [membershipId], references: [id])
  tenant       Tenant            @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([empresaId])
  @@index([createdAt])
  @@index([entidad, entidadId])
  @@map("auditorias")
}

model SesionActividad {
  id             String           @id @default(uuid()) @db.Uuid
  tenantId       String           @db.Uuid
  empresaId      String           @db.Uuid
  membershipId   String           @db.Uuid
  fechaInicio    DateTime         @default(now())
  fechaFin       DateTime?
  duracionMin    Int?
  tiempoInactivo Int              @default(0)
  dispositivo    String?
  ip             String?
  updatedAt      DateTime         @default(now()) @updatedAt
  logs           LogEvento[]
  empresa        Empresa          @relation(fields: [empresaId], references: [id])
  membership     TenantMembership @relation(fields: [membershipId], references: [id])
  tenant         Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([membershipId])
  @@index([fechaInicio])
  @@map("sesiones_actividad")
}

model LogEvento {
  id          String          @id @default(uuid()) @db.Uuid
  tenantId    String          @db.Uuid
  empresaId   String          @db.Uuid
  sesionId    String          @db.Uuid
  tipo        String
  descripcion String?
  ruta        String?
  createdAt   DateTime        @default(now())
  empresa     Empresa         @relation(fields: [empresaId], references: [id])
  sesion      SesionActividad @relation(fields: [sesionId], references: [id])
  tenant      Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([tenantId, empresaId])
  @@index([sesionId])
  @@map("logs_evento")
}

model AuthSession {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @db.Uuid
  refreshTokenHash String
  revoked          Boolean  @default(false)
  createdAt        DateTime @default(now())
  expiresAt        DateTime
  empresaId        String?  @db.Uuid
  tenantId         String?  @db.Uuid
  empresa          Empresa? @relation(fields: [empresaId], references: [id])
  tenant           Tenant?  @relation(fields: [tenantId], references: [id])
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tenantId])
  @@index([empresaId])
  @@index([expiresAt])
  @@map("auth_sessions")
}

model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @db.Uuid
  tokenHash String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  empresaId String?   @db.Uuid
  tenantId  String?   @db.Uuid
  empresa   Empresa?  @relation(fields: [empresaId], references: [id])
  tenant    Tenant?   @relation(fields: [tenantId], references: [id])
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}

model ClienteConfiguracionOperativa {
  id                     String     @id @default(uuid()) @db.Uuid
  clienteId              String     @db.Uuid
  empresaId              String     @db.Uuid
  tenantId               String     @db.Uuid
  direccionId            String?    @db.Uuid
  protocoloServicio      String?
  observacionesFijas     String?
  requiereFirmaDigital   Boolean    @default(true)
  requiereFotosEvidencia Boolean    @default(true)
  duracionEstimada       Int?       @default(60)
  frecuenciaSugerida     Int?       @default(30)
  elementosPredefinidos  Json?
  createdAt              DateTime   @default(now())
  updatedAt              DateTime   @updatedAt
  cliente                Cliente    @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  direccion              Direccion? @relation(fields: [direccionId], references: [id])
  empresa                Empresa    @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  tenant                 Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([clienteId])
  @@index([empresaId])
  @@index([direccionId])
  @@index([tenantId])
  @@map("cliente_configuracion_operativa")
}

model EvidenciaServicio {
  id              String        @id @default(uuid()) @db.Uuid
  tenantId        String        @db.Uuid
  ordenServicioId String        @db.Uuid
  path            String
  createdAt       DateTime      @default(now())
  ordenServicio   OrdenServicio @relation(fields: [ordenServicioId], references: [id], onDelete: Cascade)
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([ordenServicioId])
  @@index([tenantId])
  @@map("evidencias_servicio")
}

model SugerenciaSeguimiento {
  id             String              @id @default(uuid()) @db.Uuid
  tenantId       String              @db.Uuid
  empresaId      String?             @db.Uuid
  clienteId      String              @db.Uuid
  tipo           String
  prioridad      PrioridadSugerencia @default(MEDIA)
  estado         EstadoSugerencia    @default(PENDIENTE)
  titulo         String
  descripcion    String
  metadata       Json?
  fechaSugerida  DateTime            @default(now())
  fechaEjecutada DateTime?
  creadoAt       DateTime            @default(now())
  actualizadoAt  DateTime            @updatedAt
  cliente        Cliente             @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  empresa        Empresa?            @relation(fields: [empresaId], references: [id])
  tenant         Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([empresaId])
  @@index([estado])
  @@index([fechaSugerida])
  @@map("sugerencias_seguimiento")
}

enum DiaSemana {
  LUNES
  MARTES
  MIERCOLES
  JUEVES
  VIERNES
  SABADO
  DOMINGO
}

enum Role {
  SU_ADMIN
  ADMIN
  COORDINADOR
  ASESOR
  OPERADOR
}

enum MembershipPermission {
  TEAM_EDIT
}

enum MembershipStatus {
  ACTIVE
  INVITED
  SUSPENDED
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  SUSPENDED
}

enum TipoPago {
  PORCENTAJE
  SALARIO_FIJO
}

enum EstadoNomina {
  BORRADOR
  PAGADO
  ANULADO
}

enum EstadoPaquete {
  ACTIVO
  FINALIZADO
  CANCELADO
  VENCIDO
}

enum EstadoCuentaCobro {
  PAGADA
  PENDIENTE
  RECHAZADA
  GENERADA
}

enum EstadoSolicitudProductos {
  PENDIENTE
  RECHAZADA
  ACEPTADA
}

enum TipoPermiso {
  EDITAR_VALOR_COTIZADO
  EDITAR_TIPO_SERVICIO
  DESCARGAR_EXCEL
  DESBLOQUEO_ASIGNACION_SERVICIOS
}

enum EstadoPermiso {
  PENDIENTE
  APROBADO
  RECHAZADO
  EXPIRADO
}

enum EstadoPagoOrden {
  PENDIENTE
  EFECTIVO_DECLARADO
  CONSIGNADO
  CONCILIADO
  ANTICIPO
  PAGADO
  CREDITO
  PARCIAL
  CORTESIA
}

enum MetodoPagoBase {
  EFECTIVO
  TRANSFERENCIA
  CREDITO
  BONO
  CORTESIA
  PENDIENTE
}

enum NivelInfestacion {
  BAJO
  MEDIO
  ALTO
  CRITICO
  PREVENTIVO
}

enum UrgenciaOrden {
  BAJA
  MEDIA
  ALTA
  CRITICA
}

enum TipoVisita {
  CITA_VERIFICACION
  NO_CONCRETADO
  SERVICIO_REFUERZO
  NUEVO
  REPROGRAMADO
  DIAGNOSTICO_INICIAL
  GARANTIA
}

enum TipoFacturacion {
  UNICO
  CONTRATO_MENSUAL
  PLAN_TRIMESTRAL
  PLAN_SEMESTRAL
  PLAN_ANUAL
}

enum EstadoContratoCliente {
  ACTIVO
  PAUSADO
  VENCIDO
  CANCELADO
}

enum EstadoConsignacion {
  PENDIENTE
  VALIDADA
  OBSERVADA
}

enum EstadoPagoComision {
  PENDIENTE
  PAGADA
  ANULADA
}

enum TipoCliente {
  PERSONA
  EMPRESA
}

enum SegmentoCliente {
  HOGAR
  COMERCIO
  INDUSTRIA
  SALUD
  EDUCACION
  HORECA
  OFICINA
  OTRO
}

enum NivelRiesgo {
  BAJO
  MEDIO
  ALTO
  CRITICO
}

enum ClasificacionCliente {
  ORO
  PLATA
  BRONCE
  RIESGO
}

enum EstadoOrden {
  NUEVO
  PROCESO
  CANCELADO
  PROGRAMADO
  LIQUIDADO
  TECNICO_FINALIZO
  REPROGRAMADO
  SIN_CONCRETAR
}

enum DashboardPresetModule {
  SERVICIOS
  CLIENTES
}

enum EstadoSugerencia {
  PENDIENTE
  ACEPTADA
  DESCARTADA
  EJECUTADA
}

enum PrioridadSugerencia {
  BAJA
  MEDIA
  ALTA
  CRITICA
}
