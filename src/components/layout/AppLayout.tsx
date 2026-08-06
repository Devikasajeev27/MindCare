import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";
import { TherapistSidebar } from "./TherapistSidebar";
import { AdminSidebar } from "./AdminSidebar";
import { MindCareLogo } from "@/components/MindCareLogo";

interface AppLayoutProps {
  children: ReactNode;
  variant?: "user" | "therapist" | "admin";
}

export function AppLayout({ children, variant = "user" }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

  useEffect(() => {
    const checkResize = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
    };
    checkResize();
    window.addEventListener("resize", checkResize);
    return () => window.removeEventListener("resize", checkResize);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  return (
    <div className="relative flex min-h-screen bg-background">
      {sidebarOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          type="button"
        />
      ) : null}

      <div
        className={`fixed left-0 top-0 z-40 h-full transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        {...(isMobileOrTablet && !sidebarOpen ? { inert: "" } : {})}
      >
        {variant === "user" ? <AppSidebar onClose={() => setSidebarOpen(false)} /> : null}
        {variant === "therapist" ? <TherapistSidebar onClose={() => setSidebarOpen(false)} /> : null}
        {variant === "admin" ? <AdminSidebar onClose={() => setSidebarOpen(false)} /> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0"
            aria-label="Open sidebar"
            type="button"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <MindCareLogo size="sm" />
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
