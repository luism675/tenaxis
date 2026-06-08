"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Database,
  Globe,
  Layers,
  Menu,
  Navigation,
  RefreshCw,
  Server,
  Shield,
  Wifi,
  WifiOff,
  X,
  Clock,
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "idle" | "en-route" | "active" | "offline";
  coords: { x: number; y: number };
  task?: string;
}

const INITIAL_AGENTS: Agent[] = [
  { id: "TX-401", name: "Gabriel Soto", role: "Soporte de Enlace", status: "active", coords: { x: 35, y: 45 }, task: "Reparación Nodo B" },
  { id: "TX-402", name: "Martina Paz", role: "Ing. de Campo", status: "en-route", coords: { x: 65, y: 30 }, task: "Fibra Troncal G3" },
  { id: "TX-403", name: "Esteban R.", role: "Técnico Eléctrico", status: "idle", coords: { x: 45, y: 70 }, task: "Inspección Preventiva" },
  { id: "TX-404", name: "Sofía Gómez", role: "Instalador Senior", status: "offline", coords: { x: 80, y: 60 } },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent>(INITIAL_AGENTS[0]);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cachedReports, setCachedReports] = useState(0);
  
  // Terminal system logs (simulating real-time operations)
  const [logs, setLogs] = useState<string[]>([
    "SYS_INIT: Consola de control iniciada en nodo principal.",
    "CON_OK: Enlace con NestJS API establecido.",
    "SYNC: 4 agentes de campo sincronizados.",
  ]);

  // GSAP animation refs
  const mainScopeRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Simulate real-time logs and technician movements
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          if (agent.status === "active" || agent.status === "en-route") {
            const dx = (Math.random() - 0.5) * 5;
            const dy = (Math.random() - 0.5) * 5;
            return {
              ...agent,
              coords: {
                x: Math.max(12, Math.min(88, agent.coords.x + dx)),
                y: Math.max(12, Math.min(88, agent.coords.y + dy)),
              },
            };
          }
          return agent;
        })
      );

      const randomLogType = Math.random();
      let newLog = "";
      if (randomLogType < 0.25) {
        const ag = agents[Math.floor(Math.random() * agents.length)];
        newLog = `AGENT_UPDATE: ${ag.id} (${ag.name}) actualizó posición GPS.`;
      } else if (randomLogType < 0.45) {
        newLog = `DESPACHO: Orden de trabajo #${Math.floor(2000 + Math.random() * 8000)} asignada vía algoritmo óptimo.`;
      } else if (randomLogType < 0.60) {
        newLog = `BD_SYS: Latencia multitenant: ${Math.floor(6 + Math.random() * 10)}ms [Conexión Prisma OK]`;
      }

      if (newLog) {
        setLogs((prev) => [newLog, ...prev.slice(0, 7)]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [agents]);

  // Handle mock task assignment
  const handleAssignTask = (agentId: string) => {
    const tasks = [
      "Calibración de Antena de Enlace",
      "Sustitución Switch Capa 3",
      "Mantenimiento Nodo Central G2",
      "Revisión de Cableado Troncal",
    ];
    const chosenTask = tasks[Math.floor(Math.random() * tasks.length)];

    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === agentId) {
          const updated: Agent = { ...agent, status: "en-route", task: chosenTask };
          if (selectedAgent.id === agent.id) {
            setSelectedAgent(updated);
          }
          return updated;
        }
        return agent;
      })
    );

    setLogs((prev) => [
      `COMANDO_DESPACHO: Nueva misión asignada a ${agentId} -> "${chosenTask}"`,
      ...prev,
    ]);

    // Animate assignment confirmation on the log widget
    gsap.fromTo(
      ".telemetry-log-item:first-child",
      { backgroundColor: "rgba(16, 185, 129, 0.2)", x: -10 },
      { backgroundColor: "transparent", x: 0, duration: 0.8, ease: "power2.out" }
    );
  };

  // Simulate offline caching
  const simulateOfflineReport = () => {
    setCachedReports((prev) => prev + 1);
    setLogs((prev) => [
      `OFFLINE_CACHE: Reporte de servicio guardado localmente (Total: ${cachedReports + 1}).`,
      ...prev,
    ]);
  };

  const handleSyncNow = () => {
    if (cachedReports === 0) return;
    setLogs((prev) => [
      `SYNC_PUSH: Sincronizando ${cachedReports} reportes pendientes a NestJS API...`,
      "SYNC_OK: Reconciliación exitosa en PostgreSQL mediante Prisma ORM.",
      ...prev,
    ]);
    setCachedReports(0);
  };

  // Premium GSAP Animations
  useGSAP(() => {
    // 1. Split Hero Title Animation (Slide Up + Fade In word by word)
    if (heroTitleRef.current) {
      const words = heroTitleRef.current.innerText.split(" ");
      heroTitleRef.current.innerHTML = words
        .map((word) => `<span class="inline-block opacity-0 translate-y-6 hero-word">${word}</span>`)
        .join(" ");

      gsap.to(".hero-word", {
        opacity: 1,
        y: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: "power4.out",
        delay: 0.2,
      });
    }

    // 2. Fade in and slide up text elements inside the Hero
    gsap.fromTo(
      ".hero-fade-in",
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.15,
        duration: 1,
        ease: "power3.out",
        delay: 0.5,
      }
    );

    // 3. Elastic entry for the console mockup
    if (consoleRef.current) {
      gsap.fromTo(
        consoleRef.current,
        { opacity: 0, scale: 0.95, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1.2,
          ease: "back.out(1.2)",
          delay: 0.8,
        }
      );
    }

    // 4. Subtle scanner pulse loop on base headquarters
    gsap.to(".map-hub-ring", {
      scale: 1.8,
      opacity: 0,
      repeat: -1,
      duration: 2.5,
      ease: "power1.out",
    });

    // 5. ScrollTrigger animations for sections and cards
    gsap.fromTo(
      ".scroll-section-header",
      { opacity: 0, y: 30 },
      {
        scrollTrigger: {
          trigger: ".scroll-section-header",
          start: "top 85%",
        },
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power2.out",
      }
    );

    gsap.fromTo(
      ".feature-card",
      { opacity: 0, y: 40 },
      {
        scrollTrigger: {
          trigger: ".feature-card",
          start: "top 80%",
        },
        opacity: 1,
        y: 0,
        stagger: 0.2,
        duration: 1,
        ease: "power3.out",
      }
    );

    // 6. Tech stack cards entry trigger
    gsap.fromTo(
      ".tech-spec-card",
      { opacity: 0, y: 30 },
      {
        scrollTrigger: {
          trigger: ".tech-spec-card",
          start: "top 85%",
        },
        opacity: 1,
        y: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: "power2.out",
      }
    );

    // 7. Telemetry stats counter simulation
    gsap.fromTo(
      ".stat-number",
      { opacity: 0, y: 20 },
      {
        scrollTrigger: {
          trigger: ".stat-number",
          start: "top 90%",
        },
        opacity: 1,
        y: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: "power2.out",
      }
    );
  }, { scope: mainScopeRef });

  return (
    <div
      ref={mainScopeRef}
      className="min-h-[100dvh] bg-[#09090b] text-zinc-100 selection:bg-emerald-600/30 selection:text-emerald-400 font-sans overflow-x-hidden antialiased"
    >
      {/* Structural Accent Top Border */}
      <div className="h-1 w-full bg-emerald-600" />

      {/* Navigation Header */}
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center transition-all duration-300 group-hover:border-emerald-500/60">
                <Layers className="w-4 h-4 text-emerald-500 transition-transform duration-300 group-hover:scale-110" />
              </div>
              <span className="font-semibold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                TENAXIS
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400 font-medium">
              <a href="#soluciones" className="hover:text-zinc-100 transition-colors">Consola</a>
              <a href="#tecnologia" className="hover:text-zinc-100 transition-colors">Tecnología</a>
              <a href="#metricas" className="hover:text-zinc-100 transition-colors">Métricas</a>
              <a href="#contacto" className="hover:text-zinc-100 transition-colors">Contacto</a>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/iniciar-sesion"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 px-4 py-2 rounded-md hover:bg-white/[0.03] transition-all"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/registro"
              className="text-sm font-medium bg-zinc-100 text-zinc-950 px-4 py-2 rounded-md hover:bg-zinc-200 transition-all font-mono shadow-sm active:translate-y-[1px]"
            >
              Registrar Empresa
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/[0.06] bg-[#09090b] px-6 py-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <a
              href="#soluciones"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-zinc-400 hover:text-zinc-100 py-1"
            >
              Consola
            </a>
            <a
              href="#tecnologia"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-zinc-400 hover:text-zinc-100 py-1"
            >
              Tecnología
            </a>
            <a
              href="#metricas"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-zinc-400 hover:text-zinc-100 py-1"
            >
              Métricas
            </a>
            <a
              href="#contacto"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-zinc-400 hover:text-zinc-100 py-1"
            >
              Contacto
            </a>
            <div className="h-[1px] bg-white/[0.06] my-1" />
            <Link
              href="/iniciar-sesion"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-zinc-400 py-1"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/registro"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-center bg-zinc-100 text-zinc-950 py-2.5 rounded-md font-mono font-medium"
            >
              Registrar Empresa
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative max-w-[1400px] mx-auto px-6 pt-12 md:pt-20 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Decorative Gridline Background */}
        <div className="absolute inset-0 auth-grid pointer-events-none opacity-40 z-0" />

        {/* Left Side: Headline & CTAs */}
        <div className="lg:col-span-5 relative z-10 flex flex-col items-start text-left">
          <div className="hero-fade-in inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/30 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-400 tracking-wider uppercase font-mono">
              SaaS B2B Multitenant de Infraestructura
            </span>
          </div>

          <h1
            ref={heroTitleRef}
            className="text-4xl sm:text-5xl md:text-[52px] font-bold tracking-tight text-white leading-[1.08] mb-6"
          >
            Operaciones de campo, sincronizadas.
          </h1>

          <p className="hero-fade-in text-zinc-400 text-base sm:text-lg mb-8 leading-relaxed max-w-[480px]">
            La consola operativa definitiva para empresas de infraestructura. Coordina despachos técnicos en tiempo real, sincroniza reportes en modo offline y unifica la administración de servicios de campo.
          </p>

          <div className="hero-fade-in flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            <Link
              href="/registro"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-md font-medium text-sm flex items-center justify-center gap-2 group transition-all duration-300 font-mono shadow-md hover:scale-[1.01] active:translate-y-[1px]"
            >
              Iniciar Despliegue
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href="#soluciones"
              className="border border-white/[0.08] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] text-zinc-300 px-6 py-3.5 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-all font-mono active:translate-y-[1px]"
            >
              Explorar Consola
            </a>
          </div>

          {/* Interactive Live Log Terminal widget */}
          <div className="hero-fade-in mt-12 w-full max-w-[440px] border border-white/[0.06] bg-white/[0.02] rounded-lg p-4 font-mono text-[11px] text-zinc-400 flex flex-col gap-1.5">
            <div className="flex justify-between border-b border-white/[0.06] pb-2 mb-1.5">
              <span className="text-zinc-300 font-semibold uppercase">TELEMETRÍA EN VIVO</span>
              <span className="text-emerald-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                CONEXIÓN OK
              </span>
            </div>
            {logs.slice(0, 3).map((log, idx) => (
              <div
                key={idx}
                className="telemetry-log-item flex gap-2 text-zinc-500 overflow-hidden text-ellipsis whitespace-nowrap"
              >
                <span className="text-emerald-600 shrink-0">❯</span>
                <span className="text-zinc-400">{log}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Interactive FSM Dispatch Console Simulator */}
        <div ref={consoleRef} className="lg:col-span-7 relative z-10">
          <div className="relative border border-white/[0.08] bg-[#0c0c0e] rounded-xl overflow-hidden shadow-2xl shadow-emerald-950/10">
            {/* Console Toolbar */}
            <div className="h-11 border-b border-white/[0.06] bg-[#101012] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-800" />
                <div className="w-3 h-3 rounded-full bg-zinc-800" />
                <div className="w-3 h-3 rounded-full bg-zinc-800" />
                <span className="h-3.5 w-[1px] bg-white/[0.06] mx-1" />
                <span className="text-[11px] font-mono text-zinc-500 tracking-wider">
                  DISPATCH_CONSOLE // TENAXIS
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  MAPA ACTIVO
                </span>
              </div>
            </div>

            {/* Split Panel: Interactive Map & Operator Details */}
            <div className="grid grid-cols-1 md:grid-cols-12 h-[380px] sm:h-[440px]">
              {/* Simulated Dispatch Map Grid */}
              <div className="md:col-span-8 relative border-r border-white/[0.06] bg-[#0e0e10] overflow-hidden flex items-center justify-center">
                {/* Simulated Grid Lines */}
                <div className="absolute inset-0 opacity-15">
                  <div className="absolute top-0 bottom-0 left-[25%] w-[1px] bg-white" />
                  <div className="absolute top-0 bottom-0 left-[50%] w-[1px] bg-white" />
                  <div className="absolute top-0 bottom-0 left-[75%] w-[1px] bg-white" />
                  <div className="absolute left-0 right-0 top-[30%] h-[1px] bg-white" />
                  <div className="absolute left-0 right-0 top-[60%] h-[1px] bg-white" />
                  <div className="absolute left-0 right-0 top-[85%] h-[1px] bg-white" />
                </div>

                <div className="absolute inset-4 border border-dashed border-white/5 pointer-events-none" />

                {/* Draw Route Line if agent is en route */}
                {selectedAgent.status === "en-route" && selectedAgent.coords && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line
                      x1="50%"
                      y1="50%"
                      x2={`${selectedAgent.coords.x}%`}
                      y2={`${selectedAgent.coords.y}%`}
                      stroke="rgba(16, 185, 129, 0.4)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      className="animate-[dash_2s_linear_infinite]"
                    />
                  </svg>
                )}

                {/* Headquarters Hub */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                  <div className="relative w-8 h-8 rounded-full bg-white/5 border border-white/20 flex items-center justify-center backdrop-blur-md">
                    <span className="map-hub-ring absolute inset-0 rounded-full border border-emerald-500/50 pointer-events-none" />
                    <Server className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 mt-1 uppercase tracking-wider">
                    Base Central
                  </span>
                </div>

                {/* Map Markers */}
                {agents.map((agent) => {
                  const isSelected = selectedAgent.id === agent.id;
                  const statusColors = {
                    active: "bg-emerald-500",
                    "en-route": "bg-sky-500",
                    idle: "bg-amber-500",
                    offline: "bg-zinc-600",
                  };

                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      style={{ left: `${agent.coords.x}%`, top: `${agent.coords.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group transition-all duration-300 ${
                        isSelected ? "scale-125 z-30" : "hover:scale-110"
                      }`}
                    >
                      <span className="relative flex h-3 w-3">
                        {agent.status !== "offline" && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColors[agent.status]} opacity-60`} />
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${statusColors[agent.status]} border border-[#0c0c0e] ${
                          isSelected ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0c0c0e]" : ""
                        }`} />
                      </span>

                      {/* Tooltip on marker hover */}
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-5 bg-[#141416] border border-white/[0.08] text-[9px] font-mono px-1.5 py-0.5 rounded text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-30">
                        {agent.id} : {agent.name}
                      </span>
                    </button>
                  );
                })}

                <div className="absolute bottom-3 left-3 bg-[#101012]/80 border border-white/[0.06] rounded px-2 py-1 font-mono text-[9px] text-zinc-500 backdrop-blur-sm">
                  COORDS_GRID: AUTO_NAV_ENABLE
                </div>
              </div>

              {/* Inspector Panel for Selected Operator */}
              <div className="md:col-span-4 bg-[#101012] p-4 flex flex-col justify-between overflow-y-auto">
                <div className="flex flex-col gap-4">
                  <div className="border-b border-white/[0.06] pb-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                      Operador Técnico
                    </span>
                    <span className="text-[13px] font-semibold text-white tracking-tight">
                      {selectedAgent.name}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">ID Enlace:</span>
                      <span className="text-zinc-300 font-semibold">{selectedAgent.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Rol:</span>
                      <span className="text-zinc-300">{selectedAgent.role}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Estado:</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            selectedAgent.status === "active"
                              ? "bg-emerald-500"
                              : selectedAgent.status === "en-route"
                              ? "bg-sky-500"
                              : selectedAgent.status === "idle"
                              ? "bg-amber-500"
                              : "bg-zinc-500"
                          }`}
                        />
                        <span className="text-zinc-300 uppercase text-[10px]">
                          {selectedAgent.status}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-col border-t border-white/[0.04] pt-2 mt-1">
                      <span className="text-zinc-500 mb-1">Orden asignada:</span>
                      <span className="text-zinc-200 text-xs italic">
                        {selectedAgent.task ? `"${selectedAgent.task}"` : "En espera (Disponible)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/[0.06] flex flex-col gap-2">
                  <button
                    onClick={() => handleAssignTask(selectedAgent.id)}
                    disabled={selectedAgent.status === "offline"}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2 rounded text-[11px] font-mono transition-all font-semibold active:translate-y-[1px] cursor-pointer"
                  >
                    Asignar Tarea de Campo
                  </button>
                  <span className="text-[9px] font-mono text-zinc-500 text-center block">
                    Control directo vía API Gateway
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grayscale Client Logos Section */}
      <section className="border-y border-white/[0.06] bg-[#0b0b0d] py-10 relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 text-center">
          <p className="text-zinc-500 text-[10px] font-mono tracking-widest uppercase mb-8">
            Empresas coordinando infraestructura crítica con Tenaxis
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 opacity-45 grayscale contrast-200">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-zinc-400" />
              <span className="font-bold text-zinc-400 font-mono tracking-tighter text-lg">RED_INFRA</span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-zinc-400" />
              <span className="font-bold text-zinc-400 font-mono tracking-tighter text-lg">TELECOM_SUD</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-zinc-400" />
              <span className="font-bold text-zinc-400 font-mono tracking-tighter text-lg">ECO_ENERGIA</span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-zinc-400" />
              <span className="font-bold text-zinc-400 font-mono tracking-tighter text-lg">LOGISTICA_A</span>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions / Platform features Section */}
      <section id="soluciones" className="max-w-[1400px] mx-auto px-6 py-24 relative z-10">
        <div className="scroll-section-header text-center max-w-[600px] mx-auto mb-16">
          <span className="text-xs font-mono text-emerald-500 tracking-widest uppercase block mb-3">
            Módulos de la Plataforma
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
            Infraestructura optimizada para operaciones técnicas
          </h2>
          <p className="text-zinc-400 text-sm">
            Una suite unificada construida sobre una arquitectura modular sólida, garantizando consistencia y seguridad.
          </p>
        </div>

        {/* Asymmetric Features Grid with ScrollTrigger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Large Card: Real-time Dispatch Map (7 cols) */}
          <div className="feature-card lg:col-span-7 border border-white/[0.06] bg-[#0c0c0e] rounded-xl p-8 flex flex-col justify-between group transition-all duration-300 hover:border-white/[0.12] hover:bg-[#0e0e11] hover:shadow-lg hover:shadow-emerald-950/5">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center mb-6">
                <Navigation className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Despacho Inteligente y Ruteo Técnico
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Algoritmos automatizados que asignan tareas al técnico más cercano con las capacidades requeridas. Optimiza traslados y reduce el consumo logístico utilizando nuestra consola en tiempo real.
              </p>
            </div>

            {/* Visual simulation block */}
            <div className="border border-white/[0.06] bg-[#08080a] rounded-lg p-4 font-mono text-[11px] text-zinc-500">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
                <span className="text-zinc-300 font-semibold text-[10px] uppercase">RUTEADOR AUTOMATIZADO</span>
                <span className="text-emerald-400">LATENCIA: 11ms</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-zinc-400 font-medium">Asignación Óptima:</span>
                  <span className="text-zinc-300">OT-8192 ➔ Martina Paz (Distancia: 1.2km)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-zinc-700" />
                  <span className="text-zinc-500 font-medium">Ruta Calculada:</span>
                  <span className="text-zinc-500">Est. Ahorro Combustible: 15%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Offline Sync & Multi-tenant isolation (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* Card 1: Offline Sync Capabilities */}
            <div className="feature-card border border-white/[0.06] bg-[#0c0c0e] rounded-xl p-8 flex flex-col justify-between group transition-all duration-300 hover:border-white/[0.12] hover:bg-[#0e0e11]">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-emerald-500" />
                  </div>

                  {/* Offline switch toggler */}
                  <button
                    onClick={() => {
                      setIsOfflineMode(!isOfflineMode);
                      setLogs((prev) => [
                        `CONN_STATUS: Modo simulado cambiado a ${!isOfflineMode ? "OFFLINE" : "ONLINE"}.`,
                        ...prev,
                      ]);
                    }}
                    className={`px-3 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                      isOfflineMode
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}
                  >
                    {isOfflineMode ? "SIMULAR: OFFLINE" : "SIMULAR: ONLINE"}
                  </button>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  Sincronización Offline (Cero Pérdida)
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  La aplicación móvil almacena de forma local reportes técnicos, lecturas y firmas de clientes. Al recuperar la red, la API en NestJS sincroniza y consolida la información de forma automática.
                </p>
              </div>

              {/* Interactive Offline Sim Area */}
              <div className="border border-white/[0.06] bg-[#08080a] rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">Conectividad de red:</span>
                  <span className="flex items-center gap-1">
                    {isOfflineMode ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-red-400 uppercase">Sin Conexión</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <span className="text-emerald-400 uppercase">Conectado</span>
                      </>
                    )}
                  </span>
                </div>

                {isOfflineMode ? (
                  <div className="flex gap-2">
                    <button
                      onClick={simulateOfflineReport}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-1.5 rounded font-mono text-[10px] font-medium transition-all cursor-pointer"
                    >
                      Crear Reporte Local
                    </button>
                    <div className="flex items-center justify-center px-3 rounded bg-zinc-900 border border-white/[0.06] font-mono text-[11px] text-zinc-300">
                      {cachedReports} en caché
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSyncNow}
                    disabled={cachedReports === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800/40 disabled:border text-white py-1.5 rounded font-mono text-[10px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${cachedReports > 0 ? "animate-spin" : ""}`} />
                    Sincronizar {cachedReports} reportes
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Multitenant Isolation */}
            <div className="feature-card border border-white/[0.06] bg-[#0c0c0e] rounded-xl p-8 flex flex-col justify-between group transition-all duration-300 hover:border-white/[0.12] hover:bg-[#0e0e11]">
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center mb-6">
                  <Shield className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Aislamiento Hermético Multitenant
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Seguridad y segregación absoluta a nivel base de datos. Cada petición inyecta de forma obligatoria el <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400 font-mono">tenant_id</code> extraído del token JWT en Prisma para bloquear cualquier posibilidad de filtración de datos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tecnologia" className="border-t border-white/[0.06] bg-[#09090b]">
        <div className="max-w-[1400px] mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 flex flex-col items-start text-left">
            <span className="text-xs font-mono text-emerald-500 tracking-widest uppercase block mb-3">
              Arquitectura de Cero Confianza
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
              Ingeniería de software robusta sin atajos
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              El frontend en Next.js se encarga estrictamente de la capa de presentación y la interacción del usuario. Toda la lógica de negocio, cálculos de rutas y mutaciones a la base de datos PostgreSQL se resuelven exclusivamente del lado del servidor mediante una API NestJS modular.
            </p>
            <div className="flex flex-col gap-3 font-mono text-xs text-zinc-400">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Next.js App Router para una carga fluida de pantallas.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Backend robusto en NestJS con autenticación segura por JWT.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Colas en Redis con BullMQ para procesar reportes en background.</span>
              </div>
            </div>
          </div>

          {/* Technical cards grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="tech-spec-card border border-white/[0.06] bg-[#0c0c0e] rounded-xl p-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                <span className="font-mono text-xs font-bold text-white uppercase">NÚCLEO BACKEND</span>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">NestJS</span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Toda la lógica de despacho, facturación y control multitenant se ejecuta encapsulada y protegida en nuestra API Gateway para mayor control.
              </p>
            </div>
            <div className="tech-spec-card border border-white/[0.06] bg-[#0c0c0e] rounded-xl p-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                <span className="font-mono text-xs font-bold text-white uppercase">BASE DE DATOS</span>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Prisma + Postgres</span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Mapeo de datos multitenant optimizado que inyecta automáticamente el ID corporativo en cada query para resguardar la segregación.
              </p>
            </div>
            <div className="tech-spec-card border border-white/[0.06] bg-[#0c0c0e] rounded-xl p-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                <span className="font-mono text-xs font-bold text-white uppercase">GESTIÓN DE ARCHIVOS</span>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Presigned URLs</span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Las evidencias y firmas técnicas se suben de forma directa desde la app al Storage de Supabase mediante URLs firmadas, optimizando la RAM del servidor.
              </p>
            </div>
            <div className="tech-spec-card border border-white/[0.06] bg-[#0c0c0e] rounded-xl p-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                <span className="font-mono text-xs font-bold text-white uppercase">TECNOLOGÍA MÓVIL</span>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">React Native</span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Aplicación ágil y de alto desempeño para operarios en campo. GPS en segundo plano, soporte sin red y sincronización inteligente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics / Telemetry Section */}
      <section id="metricas" className="border-t border-white/[0.06] bg-[#0b0b0d] py-24 relative z-10">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="stat-number text-center md:text-left border-l-2 border-emerald-600 pl-6 py-2">
              <span className="text-[36px] sm:text-[44px] font-bold text-white font-mono tracking-tight block leading-none">
                +45%
              </span>
              <span className="text-zinc-400 text-xs font-mono tracking-wider uppercase mt-2 block">
                Eficiencia en Traslados y Tiempos
              </span>
            </div>
            <div className="stat-number text-center md:text-left border-l-2 border-emerald-600 pl-6 py-2">
              <span className="text-[36px] sm:text-[44px] font-bold text-white font-mono tracking-tight block leading-none">
                &lt; 12ms
              </span>
              <span className="text-zinc-400 text-xs font-mono tracking-wider uppercase mt-2 block">
                Latencia API en NestJS
              </span>
            </div>
            <div className="stat-number text-center md:text-left border-l-2 border-emerald-600 pl-6 py-2">
              <span className="text-[36px] sm:text-[44px] font-bold text-white font-mono tracking-tight block leading-none">
                100%
              </span>
              <span className="text-zinc-400 text-xs font-mono tracking-wider uppercase mt-2 block">
                Hermetismo en Datos B2B
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contacto" className="border-t border-white/[0.06] bg-[#09090b] py-24 relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Contact Details */}
          <div className="lg:col-span-5 flex flex-col items-start justify-center">
            <span className="text-xs font-mono text-emerald-500 tracking-widest uppercase block mb-3">
              Consola Comercial
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
              Integra Tenaxis a tu infraestructura operativa
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Coordinemos una demostración técnica guiada con nuestros ingenieros. Diseñamos el mapeo de roles, configuración multitenant y zonas que mejor se adapten a tu modelo de negocio.
            </p>
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full border border-white/[0.06] bg-[#101012] flex items-center justify-center">
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-zinc-300 text-xs font-mono block">Respuesta de Arquitectura Técnica</span>
                <span className="text-white text-sm font-semibold">Menos de 2 horas hábiles</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-7">
            <div className="border border-white/[0.08] bg-[#0c0c0e] rounded-xl p-8 shadow-xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setLogs((prev) => [
                    "CONTACTO: Solicitud comercial recibida de forma exitosa.",
                    "SYS_COM: Enviando alerta de lead técnico al canal comercial...",
                    "SYNC_SUCCESS: Contacto agendado en consola.",
                    ...prev,
                  ]);
                  alert("Solicitud recibida. Nos comunicaremos con tu equipo comercial a la brevedad.");
                }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="nombre" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Nombre Completo
                    </label>
                    <input
                      id="nombre"
                      type="text"
                      required
                      className="bg-[#101012] border border-white/[0.06] rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Correo Corporativo
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      className="bg-[#101012] border border-white/[0.06] rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="empresa" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Nombre de la Empresa
                    </label>
                    <input
                      id="empresa"
                      type="text"
                      required
                      className="bg-[#101012] border border-white/[0.06] rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="tecnicos" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Volumen de Técnicos de Campo
                    </label>
                    <select
                      id="tecnicos"
                      className="bg-[#101012] border border-white/[0.06] rounded px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all cursor-pointer"
                    >
                      <option value="1-20">1 - 20 operarios de campo</option>
                      <option value="21-100">21 - 100 operarios de campo</option>
                      <option value="101-500">101 - 500 operarios de campo</option>
                      <option value="500+">Más de 500 operarios de campo</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="mensaje" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Requerimientos o Detalles del Proyecto
                  </label>
                  <textarea
                    id="mensaje"
                    rows={4}
                    required
                    className="bg-[#101012] border border-white/[0.06] rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded font-mono text-sm font-semibold transition-all active:translate-y-[1px] shadow-md shadow-emerald-950/10 cursor-pointer"
                >
                  Solicitar Acceso a Demostración
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#09090b] py-12 relative z-10 text-xs text-zinc-500 font-mono">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-widest uppercase">Tenaxis SaaS</span>
            <span className="text-zinc-600">|</span>
            <span>Consola de Control de Infraestructura</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} Tenaxis. Todos los derechos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
