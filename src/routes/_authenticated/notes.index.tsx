import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Trash2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes/")({
  component: NotesList,
});

type Note = { id: string; subject: string; topic: string; department: string | null; is_favorite: boolean; created_at: string };

function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase.from("notes").select("id,subject,topic,department,is_favorite,created_at").order("created_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
  };
  useEffect(() => { load(); }, []);

  const toggleFav = async (n: Note) => {
    await supabase.from("notes").update({ is_favorite: !n.is_favorite }).eq("id", n.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Note deleted");
    load();
  };

  const filtered = notes.filter((n) =>
    (n.subject + " " + n.topic + " " + (n.department ?? "")).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Notes</h1>
          <p className="text-muted-foreground">AI-generated notes stored permanently in your cloud vault.</p>
        </div>
        <Link to="/notes/new" className="rounded-lg gradient-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-ring inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Generate New
        </Link>
      </div>

      <div className="glass rounded-xl p-2 flex items-center gap-2">
        <Search className="ml-2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by subject, topic, department…" className="border-0 bg-transparent focus-visible:ring-0" />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <p>No notes yet.</p>
          <Link to="/notes/new" className="mt-4 inline-block rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground">Generate your first</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <div key={n.id} className="group glass rounded-2xl p-5 transition hover:glow-ring">
              <Link to="/notes/$id" params={{ id: n.id }} className="block">
                <div className="text-xs uppercase tracking-widest text-primary">{n.subject}</div>
                <div className="mt-1 text-lg font-semibold">{n.topic}</div>
                <div className="mt-1 text-xs text-muted-foreground">{n.department ?? "General"} · {new Date(n.created_at).toLocaleDateString()}</div>
              </Link>
              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => toggleFav(n)} className="text-muted-foreground hover:text-primary">
                  <Star className={`h-4 w-4 ${n.is_favorite ? "fill-primary text-primary" : ""}`} />
                </button>
                <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
