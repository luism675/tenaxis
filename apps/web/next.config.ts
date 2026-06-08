import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tenaxis/ui"],
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  async rewrites() {
    const apiUrl = process.env.NESTJS_API_URL || 'http://localhost:4000';
    const chatwootUrl = "https://chatwoot.servilutioncrm.cloud";

    return [
      // --- CAPA AGRESIVA DE TIEMPO REAL (Prioridad Máxima) ---
      {
        source: '/cable',
        destination: `${chatwootUrl}/cable`,
      },
      {
        source: '/api/v1/accounts/:account_id/conversations/:conversation_id/typing_notifications',
        destination: `${chatwootUrl}/api/v1/accounts/:account_id/conversations/:conversation_id/typing_notifications`,
      },
      {
        source: '/api/v1/accounts/:account_id/conversations/:conversation_id/assignments',
        destination: `${chatwootUrl}/api/v1/accounts/:account_id/conversations/:conversation_id/assignments`,
      },

      // --- AUTENTICACIÓN Y SESIÓN ---
      {
        source: '/auth/:path*',
        destination: `${chatwootUrl}/auth/:path*`,
      },

      // --- API GENERAL DE CHATWOOT ---
      {
        source: '/api/v1/:path*',
        destination: `${chatwootUrl}/api/v1/:path*`,
      },

      // --- RECURSOS Y ARCHIVOS ---
      {
        source: '/rails/:path*',
        destination: `${chatwootUrl}/rails/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `${chatwootUrl}/storage/:path*`,
      },
      {
        source: '/chatwoot-proxy/:path*',
        destination: `${chatwootUrl}/:path*`,
      },
      {
        source: '/app/:path*',
        destination: `${chatwootUrl}/app/:path*`,
      },
      {
        source: '/vite/:path*',
        destination: `${chatwootUrl}/vite/:path*`,
      },
      {
        source: '/assets/:path*',
        destination: `${chatwootUrl}/assets/:path*`,
      },
      {
        source: '/brand-assets/:path*',
        destination: `${chatwootUrl}/brand-assets/:path*`,
      },
      {
        source: '/sw.js',
        destination: `${chatwootUrl}/sw.js`,
      },

      // --- API DE TENAXIS (Final de la cola) ---
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
