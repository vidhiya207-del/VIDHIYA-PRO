
CREATE TABLE public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fcm tokens" ON public.fcm_tokens FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_settings (
  user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notify_time TIME NOT NULL DEFAULT '19:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  last_sent_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notif settings" ON public.notification_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.uploaded_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_notes TO authenticated;
GRANT ALL ON public.uploaded_notes TO service_role;
ALTER TABLE public.uploaded_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own uploaded notes" ON public.uploaded_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "staff read own notes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'staff-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "staff insert own notes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'staff-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "staff delete own notes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'staff-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
