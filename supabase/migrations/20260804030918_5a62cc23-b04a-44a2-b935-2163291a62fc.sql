ALTER TABLE public.fcm_tokens ALTER COLUMN device_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_device_key ON public.fcm_tokens (user_id, device_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;