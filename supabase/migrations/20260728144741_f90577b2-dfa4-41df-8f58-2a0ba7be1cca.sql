CREATE POLICY "equipements_photos_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'equipements');

CREATE POLICY "equipements_photos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'equipements');

CREATE POLICY "equipements_photos_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'equipements') WITH CHECK (bucket_id = 'equipements');

CREATE POLICY "equipements_photos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'equipements');