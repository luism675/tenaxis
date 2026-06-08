"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { FollowUpNotificationsBridge } from "./FollowUpNotificationsBridge";
import { cn } from "@/components/ui/utils";

export function DashboardLayout({ 
  children,
  overflowHidden = false 
}: { 
  children: React.ReactNode;
  overflowHidden?: boolean;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Set initial state
    handleResize();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const setSidebarOffset = () => {
      const sidebarOffset =
        window.innerWidth >= 1024 && isSidebarOpen ? "288px" : "0px";
      document.documentElement.style.setProperty(
        "--dashboard-sidebar-offset",
        sidebarOffset
      );
    };

    setSidebarOffset();
    window.addEventListener("resize", setSidebarOffset);

    return () => {
      window.removeEventListener("resize", setSidebarOffset);
    };
  }, [isSidebarOpen]);

  return (
    <div className="h-screen bg-[#F8FAFC] dark:bg-background">
      <FollowUpNotificationsBridge />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className={cn(
        "h-full flex flex-col transition-all duration-300",
        isSidebarOpen ? "lg:pl-72" : "pl-0"
      )}>
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        <main className={cn(
          "flex-1 min-h-0",
          overflowHidden ? "overflow-hidden" : "p-4 sm:p-6 lg:p-10 overflow-y-auto"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
