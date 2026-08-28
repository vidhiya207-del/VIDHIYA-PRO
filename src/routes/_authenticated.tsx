import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, Presentation, ClipboardList, BookOpen,
  Calendar, Bell, Sparkles, LogOut, Menu, X, User, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notes", label: "AI Notes", icon: FileText },
  { to: "/ppt", label: "AI PPT", icon: Presentation },
  { to: "/question-papers", label: "Question Papers", icon: ClipboardList },
  { to: "/question-bank", label: "Question Bank", icon: BookOpen },
  { to: "/timetable", label: "Timetable", icon: Calendar },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/uploads", label: "Uploaded Notes", icon: Upload },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/diagnostics", label: "Diagnostics", icon: Bell },
  { to: "/ai-diagnostics", label: "AI Diagnostics", icon: Sparkles },
  { to: "/admin-notifications", label: "Admin", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;


function AppShell() {
  const router = useRouter();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border/40 glass px-4 py-3 lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">StaffMate <span className="text-gradient">AI</span></span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${open ? "block" : "hidden"} lg:block fixed lg:sticky inset-x-0 lg:inset-auto top-[56px] lg:top-0 z-30 lg:h-screen w-full lg:w-64 border-r border-border/40 bg-sidebar lg:bg-sidebar/60 lg:backdrop-blur-xl`}
        >
          <div className="hidden lg:flex items-center gap-2 px-6 py-6">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold leading-tight">StaffMate <span className="text-gradient">AI</span></div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Faculty Suite</div>
            </div>
            <div className="ml-auto"><ThemeToggle /></div>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {NAV.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? "gradient-brand text-primary-foreground glow-ring"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="glass rounded-xl p-3">
              <div className="truncate text-xs text-muted-foreground">Signed in as</div>
              <div className="truncate text-sm font-medium">{email}</div>
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-h-screen flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
