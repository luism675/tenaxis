import type { Metadata } from "next";
import { ActivityTracker } from "@/components/dashboard/ActivityTracker";
import { PersistentChatwootPanel } from "@/components/dashboard/PersistentChatwootPanel";

export const metadata: Metadata = {
  title: "Dashboard | Tenaxis",
  description: "Panel de control administrativo de Tenaxis.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ActivityTracker />
      <PersistentChatwootPanel />
    </>
  );
}
