import { z } from "zod";

export const UserProfileSchema = z.object({
  id: z.string().optional(),
  membershipId: z.string().optional(),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
  tipoDocumento: z.string().optional(),
  numeroDocumento: z.string().optional(),
  telefono: z.string().optional(), // Celular
  banco: z.string().optional(),
  tipoCuenta: z.string().optional(),
  numeroCuenta: z.string().optional(),
  valorHora: z.number().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export type UserProfileType = z.infer<typeof UserProfileSchema>;

export const ShiftSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  horaEntrada: z.string(),
  horaSalida: z.string(),
  fotoLlegada: z.string().optional(),
  fotoSalida: z.string().optional(),
  fotoLlegadaUrl: z.string().optional(),
  fotoSalidaUrl: z.string().optional(),
  descansoMinutos: z.number().default(0),
  observacion: z.string().optional(),
  totalHoras: z.number(),
  valorGenerado: z.number(),
  createdAt: z.string(),
});

export type ShiftType = z.infer<typeof ShiftSchema>;

export const PeriodSchema = z.object({
  id: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  fechaCierre: z.string(),
  numDias: z.number(),
  valorTotal: z.number(),
  horasTotales: z.number(),
  shifts: z.array(ShiftSchema),
  userSnapshot: UserProfileSchema,
});

export type PeriodType = z.infer<typeof PeriodSchema>;
