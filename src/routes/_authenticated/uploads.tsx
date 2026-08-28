import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Download, FileText, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/uploads")({
  component: UploadsPage,
});

interface UploadedRow {
  id: string;
  title: string;
  subject: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

function UploadsPage() {
  const [rows, setRows] = useState<UploadedRow[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const { data, error } = await supabase.from("uploaded_notes").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (!error) setRows((data ?? []) as UploadedRow[]);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const upload = async () => {
    if (!file || !title.trim()) { toast.error("Title and file are required"); return; }
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { setUploading(false); return; }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
    const path = `${uid}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("staff-notes").upload(path, file, { upsert: false });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { error: dbErr } = await supabase.from("uploaded_notes").insert({
      user_id: uid, title: title.trim(), subject: subject.trim() || null,
      storage_path: path, file_name: file.name, file_size: file.size, mime_type: file.type || null,
    });
    setUploading(false);
    if (dbErr) { toast.error(dbErr.message); return; }
    setTitle(""); setSubject(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Uploaded");
    refresh();
  };

  const download = async (row: UploadedRow) => {
    const { data, error } = await supabase.storage.from("staff-notes").createSignedUrl(row.storage_path, 60);
    if (error || !data?.signedUrl) { toast.error(error?.message || "Cannot download"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const downloadAsPdf = async (row: UploadedRow) => {
    // If already PDF, download directly. If image, open in print window to save as PDF. Text/other -> text-to-pdf via print.
    if ((row.mime_type ?? "").includes("pdf")) return download(row);
    const { data, error } = await supabase.storage.from("staff-notes").createSignedUrl(row.storage_path, 60);
    if (error || !data?.signedUrl) { toast.error("Cannot fetch file"); return; }
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup blocked"); return; }
    const isImage = (row.mime_type ?? "").startsWith("image/");
    win.document.write(`<!doctype html><html><head><title>${row.title}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px}h1{margin:0 0 16px}img{max-width:100%}iframe{width:100%;height:90vh;border:0}</style>
    </head><body><h1>${row.title}</h1>${isImage
      ? `<img src="${data.signedUrl}" onload="setTimeout(()=>window.print(),300)"/>`
      : `<iframe src="${data.signedUrl}" onload="setTimeout(()=>window.print(),400)"></iframe>`}
    </body></html>`);
    win.document.close();
  };

  const remove = async (row: UploadedRow) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    await supabase.storage.from("staff-notes").remove([row.storage_path]);
    await supabase.from("uploaded_notes").delete().eq("id", row.id);
    toast.success("Deleted");
    refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Notes</h1>
        <p className="text-muted-foreground">Upload your lecture notes and download them as PDF.</p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unit 1 - Introduction" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Data Structures" />
          </div>
        </div>
        <div>
          <Label>File (PDF, image, DOCX, etc.)</Label>
          <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={upload} disabled={uploading}>
            <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? <div className="text-muted-foreground">Loading...</div> :
          rows.length === 0 ? <div className="glass rounded-2xl p-8 text-center text-muted-foreground">No uploads yet.</div> :
          rows.map((r) => (
            <div key={r.id} className="glass flex items-center gap-4 rounded-xl p-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/20 text-primary"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.subject ? `${r.subject} · ` : ""}{r.file_name} · {r.file_size ? `${Math.round(r.file_size / 1024)} KB` : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(r)}><Download className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => downloadAsPdf(r)}>PDF</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
      </div>
    </div>
  );
}
