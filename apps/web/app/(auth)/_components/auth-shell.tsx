"use client";

import * as React from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { cn } from "@/components/ui/utils";

export function AuthShell({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="auth-shell relative min-h-[100dvh] flex flex-col items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100 overflow-hidden select-none">
      {/* Subtle Background Grids */}
      <div className="pointer-events-none absolute inset-0 auth-noise opacity-20" />
      <div className="absolute inset-0 auth-grid opacity-15 pointer-events-none" />

      {/* Centered Minimal Card */}
      <div className={cn(
        "w-full max-w-[460px] border border-white/[0.06] bg-[#121214] rounded-xl p-8 sm:p-10 relative z-10 shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-bottom-4 duration-500",
        className
      )}>
        {/* Decorative scanline top border */}
        <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

        {/* Brand Logo Header */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center transition-all duration-300 group-hover:border-emerald-500/60">
              <Layers className="w-4 h-4 text-emerald-500 transition-transform duration-300 group-hover:scale-105" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              TENAXIS
            </span>
          </Link>
        </div>

        {/* Title & Support description */}
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {description && (
            <p className="text-xs text-zinc-400 leading-relaxed font-sans px-2">
              {description}
            </p>
          )}
        </div>

        {/* Form Content */}
        <div className="space-y-6">
          {children}
        </div>

        {/* Footer Navigation */}
        {footer && (
          <div className="mt-8 pt-6 border-t border-white/[0.06]">
            {footer}
          </div>
        )}
      </div>

      {/* Page bottom metadata */}
      <div className="mt-8 text-[10px] font-mono text-zinc-600 tracking-wider">
        TENAXIS © {new Date().getFullYear()} | INFRASTRUCTURE CONSOLE
      </div>
    </div>
  );
}
