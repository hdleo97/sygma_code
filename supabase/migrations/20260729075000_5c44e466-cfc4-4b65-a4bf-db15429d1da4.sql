CREATE POLICY "demandes_read" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'demandes');

CREATE POLICY "demandes_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'demandes' AND owner = auth.uid());

CREATE POLICY "demandes_delete" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'demandes' AND owner = auth.uid());