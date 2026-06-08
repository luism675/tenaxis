"use server";

import { cookies } from "next/headers";
import { authClient } from "@/lib/api/auth-client";
import { contabilidadClient } from "@/lib/api/contabilidad-client";
import { monitoringClient } from "@/lib/api/monitoreo-client";
import { resolveAccessScope } from "@/lib/access-scope";
import { 
  ApiResponse, 
  Session, 
  MonitoringStats, 
  MonitoringAlert, 
  MonitoringMetrics, 
  ExecutiveAuditMetrics,
  Audit,
  Log,
  MonitoringPayrollPreview,
  GenerateMonitoringPayrollResponse,
} from "./types";

export async function getMonitoringSessions(date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<Session[]>> {
  try {
    const data = await monitoringClient.getSessions({ date, startDate, endDate }) as Session[];
    return { data, message: "Success" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { data: [], message: msg };
  }
}

export async function getMonitoringStats(date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<MonitoringStats>> {
  try {
    const data = await monitoringClient.getStats({ date, startDate, endDate }) as unknown as MonitoringStats;
    return { data, message: "Success" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { data: { totalEvents: 0, activeSessions: 0, totalInactivity: 0 }, message: msg };
  }
}

export async function getMonitoringAlerts(date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<MonitoringAlert[]>> {
  try {
    const data = await monitoringClient.getAlerts({ date, startDate, endDate }) as MonitoringAlert[];
    return { data, message: "Success" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { data: [], message: msg };
  }
}

export async function getMonitoringMetrics(date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<MonitoringMetrics>> {
  try {
    const data = await monitoringClient.getMetrics({ date, startDate, endDate }) as unknown as MonitoringMetrics;
    return { data, message: "Success" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { data: { avgActiveTimeMin: 0, totalInactivityMin: 0, topInactivity: [], mttfeSec: 0, userCount: 0 }, message: msg };
  }
}

export async function getExecutiveAuditMetrics(date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<ExecutiveAuditMetrics>> {
  try {
    const data = await monitoringClient.getExecutiveAudit({ date, startDate, endDate }) as unknown as ExecutiveAuditMetrics;
    return { data, message: "Success" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { 
      data: { 
        today: { created: 0, updated: 0, deleted: 0, total: 0 }, 
        week: { created: 0, updated: 0, deleted: 0, total: 0 },
        topEntities: [],
        topUsers: [],
        successRate: 0
      }, 
      message: msg 
    };
  }
}

export async function getAudits(page: number = 1, limit: number = 20, date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<Audit[]>> {
  try {
    const result = await monitoringClient.getAudits({ page, limit, date, startDate, endDate }) as Record<string, unknown>;
    return {
      data: (result.results || result.data || result) as Audit[],
      meta: (result.meta || { total: 0, page, limit }) as Record<string, unknown>,
      message: "Success"
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { data: [], message: msg };
  }
}

export async function getRecentLogs(date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<Log[]>> {
  try {
    const data = await monitoringClient.getRecentLogs({ date, startDate, endDate }) as Log[];
    return { data, message: "Success" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { data: [], message: msg };
  }
}

export async function getMonitoringPayrollPreview(date?: string, startDate?: string, endDate?: string): Promise<ApiResponse<MonitoringPayrollPreview>> {
  try {
    const data = await monitoringClient.getPayrollPreview({ date, startDate, endDate }) as unknown as MonitoringPayrollPreview;
    return {
      data,
      message: "Success",
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      data: {
        date: date || startDate || new Date().toISOString().slice(0, 10),
        items: [],
        summary: {
          totalPersonas: 0,
          elegibles: 0,
          conIncidencias: 0,
          horasPagables: 0,
          totalEstimado: 0,
        },
      },
      message: msg,
    };
  }
}

export async function generateMonitoringPayrollAction(date: string, membershipIds?: string[]) {
  try {
    const profile = await authClient.getProfile();
    const accessScope = resolveAccessScope(profile);
    const cookieStore = await cookies();
    const cookieEmpresaId = cookieStore.get("x-enterprise-id")?.value;
    const empresaId =
      cookieEmpresaId ||
      accessScope.empresaId ||
      accessScope.empresaIds[0] ||
      null;

    if (!empresaId) {
      return {
        success: false,
        error: "No hay una empresa disponible para generar la nómina.",
      };
    }

    const result = await contabilidadClient.generarNominaDesdeMonitoreo({
      empresaId,
      fechaInicio: date,
      fechaFin: date,
      membershipIds,
      includeAllEligible: !membershipIds || membershipIds.length === 0,
    }) as GenerateMonitoringPayrollResponse;

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getMemberLogs(membershipId: string, date?: string): Promise<ApiResponse<Log[]>> {
  try {
    const data = await monitoringClient.getLogsByMembership(membershipId, { date }) as Log[];
    return { data, message: "Success" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { data: [], message: msg };
  }
}

export async function trackEventAction(tipo: string, descripcion?: string, ruta?: string) {
  try {
    return await monitoringClient.trackEvent({ tipo, descripcion, ruta });
  } catch (_error) {
    return null;
  }
}

export async function heartbeatAction(inactiveMinutes: number = 0) {
  try {
    return await monitoringClient.sendHeartbeat(inactiveMinutes);
  } catch (_error) {
    return null;
  }
}
