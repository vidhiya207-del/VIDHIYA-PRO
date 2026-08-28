import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Reset password – StaffMate AI" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <span className="font-semibold">StaffMate <span className="text-gradient">AI</span></span>
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Forgot your password?</h1>
        <p className="mb-6 text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
        {sent ? (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-sm">
            If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={sending}>{sending ? "Sending..." : "Send reset link"}</Button>
          </form>
        )}
        <div className="mt-6 text-center text-sm">
          <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
