import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/timetable")({
  component: Timetable,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Entry = {
  id: string;
  day_of_week: number;
  period: number;
  start_time: string | null;
  end_time: string | null;
  subject: string | null;
  class_name: string | null;
  room: string | null;
};

function Timetable() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState({
    day_of_week: 1, period: 1, start_time: "09:00", end_time: "09:50",
    subject: "", class_name: "", room: "",
  });

  const load = async () => {
    const { data } = await supabase.from("timetable_entries").select("*").order("day_of_week").order("period");
    setEntries((data ?? []) as Entry[]);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("timetable_entries").insert({ ...form, user_id: u.user.id });
    if (error) return toast.error(error.message);
    toast.success("Added");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("timetable_entries").delete().eq("id", id);
    load();
  };

  const byDay = (d: number) => entries.filter((e) => e.day_of_week === d);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Weekly Timetable</h1>
        <p className="text-muted-foreground">Manage your weekly class schedule.</p>
      </div>

      <form onSubmit={add} className="glass rounded-2xl p-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div>
          <Label>Day</Label>
          <select value={form.day_of_week} onChange={(e)=>setForm({...form,day_of_week:Number(e.target.value)})} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div><Label>Period</Label><Input type="number" min={1} max={12} className="mt-1" value={form.period} onChange={(e)=>setForm({...form,period:Number(e.target.value)})} /></div>
        <div><Label>Start</Label><Input type="time" className="mt-1" value={form.start_time} onChange={(e)=>setForm({...form,start_time:e.target.value})} /></div>
        <div><Label>End</Label><Input type="time" className="mt-1" value={form.end_time} onChange={(e)=>setForm({...form,end_time:e.target.value})} /></div>
        <div><Label>Subject</Label><Input className="mt-1" value={form.subject} onChange={(e)=>setForm({...form,subject:e.target.value})} placeholder="DBMS" /></div>
        <div><Label>Class</Label><Input className="mt-1" value={form.class_name} onChange={(e)=>setForm({...form,class_name:e.target.value})} placeholder="II CSE A" /></div>
        <div className="col-span-2 sm:col-span-1"><Label>Room</Label><Input className="mt-1" value={form.room} onChange={(e)=>setForm({...form,room:e.target.value})} placeholder="LH-3" /></div>
        <div className="col-span-2 sm:col-span-4 lg:col-span-7">
          <Button type="submit" className="w-full gradient-brand text-primary-foreground"><Plus className="mr-2 h-4 w-4"/>Add period</Button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DAYS.map((d, i) => (
          <div key={d} className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{d}</h3>
              <span className="text-xs text-muted-foreground">{byDay(i).length} periods</span>
            </div>
            {byDay(i).length === 0 ? (
              <div className="text-sm text-muted-foreground">No classes</div>
            ) : (
              <ul className="space-y-2">
                {byDay(i).map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-lg bg-secondary/40 p-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">P{e.period} · {e.start_time?.slice(0,5)}–{e.end_time?.slice(0,5)}</div>
                      <div className="font-medium">{e.subject}</div>
                      <div className="text-xs text-muted-foreground">{e.class_name}{e.room?` · ${e.room}`:""}</div>
                    </div>
                    <button onClick={()=>remove(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
