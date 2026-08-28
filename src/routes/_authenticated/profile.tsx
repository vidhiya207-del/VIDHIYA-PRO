import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function normalizeMobile(value: string): string | null {
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (!phone) return "";
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!phone.startsWith("+")) phone = /^\d{10}$/.test(phone) ? `+91${phone}` : `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [department, setDepartment] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [mobile, setMobile] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (profile) {
        setFullName(profile.full_name ?? "");
        setStaffId(profile.staff_id ?? "");
        setDepartment(profile.department ?? "");
        setCollegeName(profile.college_name ?? "");
        setMobile(profile.mobile ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const normalizedMobile = normalizeMobile(mobile);
    if (normalizedMobile === null) {
      toast.error("Enter a valid mobile number, for example +91 98765 43210.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return; }
    const { error } = await supabase.from("profiles").update({
      full_name: fullName, staff_id: staffId, department, college_name: collegeName, mobile: normalizedMobile,
      updated_at: new Date().toISOString(),
    }).eq("id", uid);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Staff Profile</h1>
        <p className="text-muted-foreground">Your account and department details.</p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-brand">
            <User className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <div className="text-lg font-semibold">{fullName || "Staff Member"}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Staff ID</Label>
            <Input value={staffId} onChange={(e) => setStaffId(e.target.value)} />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div>
            <Label>College</Label>
            <Input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Mobile (for SMS notifications)</Label>
            <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
