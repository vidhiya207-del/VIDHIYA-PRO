CREATE POLICY "own staff-notes update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-notes' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'staff-notes' AND auth.uid()::text = (storage.foldername(name))[1]);