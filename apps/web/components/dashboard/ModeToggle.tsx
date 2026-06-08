"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/components/ui/utils";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 animate-pulse" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Cambiar tema"
      className="relative flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 transition-all hover:shadow-xl hover:shadow-azul-1/10 group active:scale-90"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 100 100" 
        className={cn("h-8 w-8 lg:h-10 lg:w-10 theme-toggle", isDark && "dark")}
      >
        <defs>
          <filter id="glow-neon" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <mask id="moon-mask">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <circle cx="50" cy="50" r="24" fill="black" className="moon-cutout" />
          </mask>
        </defs>

        <style>{`
          .theme-toggle {
            cursor: pointer;
            color: #FFB300;
            transition: color 0.6s ease, transform 0.5s cubic-bezier(0.68, -0.6, 0.32, 1.6);
            overflow: visible;
          }

          .theme-toggle.dark {
            color: #00F0FF;
          }

          /* 1. Círculo Central (Sol/Luna) */
          .center-circle {
            transform-origin: 50px 50px;
            transition: transform 0.8s cubic-bezier(0.68, -0.6, 0.32, 1.6);
            fill: currentColor;
            filter: url(#glow-neon);
          }

          .theme-toggle.dark .center-circle {
            transform: scale(1.4);
          }

          /* 2. Animación de Hover para la Luna */
          .theme-toggle.dark:hover .center-circle {
            animation: moon-pulse 2s ease-in-out infinite;
          }

          @keyframes moon-pulse {
            0%, 100% { transform: scale(1.4); filter: brightness(1) url(#glow-neon); }
            50% { transform: scale(1.5); filter: brightness(1.3) url(#glow-neon); }
          }

          /* 3. Recorte de la Luna */
          .moon-cutout {
            transform-origin: 50px 50px;
            transform: translate(40px, -40px);
            transition: transform 0.8s cubic-bezier(0.68, -0.6, 0.32, 1.6);
          }

          .theme-toggle.dark .moon-cutout {
            transform: translate(14px, -14px);
          }

          /* 4. Rayos del Sol (Solo Modo Claro) */
          .sun-rays {
            transform-origin: 50px 50px;
            transition: transform 0.8s cubic-bezier(0.68, -0.6, 0.32, 1.6), opacity 0.4s ease;
            stroke: currentColor;
            filter: url(#glow-neon);
          }

          .theme-toggle:hover:not(.dark) .sun-rays {
            animation: spin 6s linear infinite;
          }

          @keyframes spin {
            100% { transform: rotate(360deg); }
          }

          .theme-toggle.dark .sun-rays {
            transform: rotate(180deg) scale(0);
            opacity: 0;
          }

          /* 5. Estrellas Mágicas */
          .star {
            fill: currentColor;
            filter: url(#glow-neon);
            opacity: 0;
            transform: scale(0) rotate(0deg);
            transition: transform 0.8s cubic-bezier(0.68, -0.6, 0.32, 1.6), opacity 0.6s ease;
          }

          .star-1 { transform-origin: 25px 25px; }
          .star-2 { transform-origin: 80px 20px; }
          .star-3 { transform-origin: 75px 80px; }

          .theme-toggle.dark .star-1 { transform: scale(1) rotate(180deg); opacity: 1; transition-delay: 0.1s; }
          .theme-toggle.dark .star-2 { transform: scale(0.8) rotate(180deg); opacity: 1; transition-delay: 0.2s; }
          .theme-toggle.dark .star-3 { transform: scale(0.6) rotate(180deg); opacity: 1; transition-delay: 0.3s; }

          /* Flote de estrellas en hover oscuro */
          .theme-toggle.dark:hover .star {
            animation: star-float 3s ease-in-out infinite;
          }

          @keyframes star-float {
            0%, 100% { transform: translateY(0) rotate(180deg) scale(var(--s, 1)); }
            50% { transform: translateY(-5px) rotate(200deg) scale(calc(var(--s, 1) + 0.1)); }
          }
          
          .star-1 { --s: 1; }
          .star-2 { --s: 0.8; }
          .star-3 { --s: 0.6; }
        `}</style>

        <path className="star star-1" d="M25,10 Q25,25 10,25 Q25,25 25,40 Q25,25 40,25 Q25,25 25,10 Z" />
        <path className="star star-2" d="M80,5 Q80,20 65,20 Q80,20 80,35 Q80,20 95,20 Q80,20 80,5 Z" />
        <path className="star star-3" d="M75,65 Q75,80 60,80 Q75,80 75,95 Q75,80 90,80 Q75,80 75,65 Z" />

        <circle className="center-circle" cx="50" cy="50" r="20" mask="url(#moon-mask)" />

        <g className="sun-rays" strokeWidth="6" strokeLinecap="round" fill="none">
          <line x1="50" y1="14" x2="50" y2="24" />
          <line x1="50" y1="76" x2="50" y2="86" />
          <line x1="14" y1="50" x2="24" y2="50" />
          <line x1="76" y1="50" x2="86" y2="50" />
          <line x1="24" y1="24" x2="31" y2="31" />
          <line x1="76" y1="76" x2="69" y2="69" />
          <line x1="24" y1="76" x2="31" y2="69" />
          <line x1="76" y1="24" x2="69" y2="31" />
        </g>
      </svg>
      <span className="sr-only">Cambiar tema</span>
    </button>
  );
}
