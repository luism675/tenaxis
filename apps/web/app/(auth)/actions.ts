"use server";

import { cookies } from "next/headers";
import {
  authClient,
  type LoginResponse,
  type RegisterPayload,
} from "@/lib/api/auth-client";

export async function loginAction(data: Record<string, unknown>) {
  try {
    const result = await authClient.login(data) as unknown as LoginResponse;
    const cookieStore = await cookies();
    
    const token = result.access_token;
    
    if (token) {
      // Intentar detectar si estamos en un entorno seguro (HTTPS)
      // En Server Actions, podemos intentar inferirlo de las cabeceras si es necesario,
      // pero por ahora usaremos una lógica más permisiva para facilitar el deploy.
      const isProd = process.env.NODE_ENV === "production";
      
      cookieStore.set("access_token", token, {
        path: "/",
        httpOnly: false, // Permitir que el cliente (hooks, etc) lo lea si es necesario
        secure: isProd, // En prod suele ser HTTPS, pero si falla el deploy puede ser por esto
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
    }
    
    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al iniciar sesión";
    return { success: false, error: message };
  }
}

export async function registerAction(data: RegisterPayload) {
  try {
    const result = await authClient.register(data);
    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al registrarse";
    return { success: false, error: message };
  }
}

export async function forgotPasswordAction(email: string) {
  try {
    const result = await authClient.forgotPassword(email);
    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al procesar solicitud";
    return { success: false, error: message };
  }
}

export async function logoutAction() {
  try {
    await authClient.logout();
  } catch (error) {
    console.error("Error calling logout API:", error);
  }
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("x-enterprise-id");
  cookieStore.delete("x-test-role");
  return { success: true };
}
