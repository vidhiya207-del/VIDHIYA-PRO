import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { z } from "zod";

type Search = { mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  component: AuthPage,
});

const DEPARTMENTS = [
  "Computer Science", "Information Technology", "Mechanical", "Civil", "ECE", "EEE",
  "BBA", "MBA", "Arts", "Science", "Commerce", "Other",
];

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    staff_id: "",
    department: "Computer Science",
    college_name: "",
    mobile: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signInSchema = z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });
  const signUpSchema = signInSchema.extend({
    full_name: z.string().trim().min(2, "Enter your name").max(100),
    staff_id: z.string().trim().max(50).optional(),
    department: z.string().trim().min(1),
    college_name: z.string().trim().min(2, "Enter your college").max(150),
    mobile: z.string().trim().max(20).optional(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const data = signUpSchema.parse(form);
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: data.full_name,
              staff_id: data.staff_id ?? "",
              department: data.department,
              college_name: data.college_name,
              mobile: data.mobile ?? "",
            },
          },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
        navigate({ to: "/dashboard" });
      } else {
        const data = signInSchema.parse(form);
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      let msg = "Something went wrong. Please try again.";
      if (err instanceof z.ZodError) {
        msg = err.issues[0]!.message;
      } else if (err instanceof Error) {
        const raw = err.message.toLowerCase();
        if (raw.includes("invalid login") || raw.includes("invalid credentials")) {
          msg = "Incorrect email or password.";
        } else if (raw.includes("email not confirmed")) {
          msg = "Please confirm your email before signing in.";
        } else if (raw.includes("user already registered") || raw.includes("already been registered")) {
          msg = "An account with this email already exists. Try signing in.";
        } else if (raw.includes("user not found")) {
          msg = "No account found with that email.";
        } else if (raw.includes("network") || raw.includes("fetch")) {
          msg = "Network error. Check your connection and try again.";
        } else if (raw.includes("password")) {
          msg = err.message;
        } else {
          msg = err.message;
        }
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold">StaffMate <span className="text-gradient">AI</span></span>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Join in less than a minute." : "Sign in to your workspace."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                <Field label="Full name">
                  <Input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Dr. Priya Ramesh"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Staff ID">
                    <Input
                      value={form.staff_id}
                      onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Department">
                    <select
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="College name">
                  <Input
                    required
                    value={form.college_name}
                    onChange={(e) => setForm({ ...form, college_name: e.target.value })}
                    placeholder="e.g. Anna University"
                  />
                </Field>
                <Field label="Mobile number">
                  <Input
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
              </>
            )}
            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@college.edu"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 6 characters"
              />
            </Field>

            {mode === "signin" && (
              <div className="text-right text-sm">
                <a href="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</a>
              </div>
            )}

            <Button type="submit" className="w-full gradient-brand text-primary-foreground" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>


          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account?{" "}
                <button className="text-foreground underline" onClick={() => setMode("signin")}>Sign in</button>
              </>
            ) : (
              <>New here?{" "}
                <button className="text-foreground underline" onClick={() => setMode("signup")}>Create account</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
