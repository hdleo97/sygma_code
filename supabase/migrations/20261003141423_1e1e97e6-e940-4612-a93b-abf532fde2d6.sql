CREATE POLICY branding_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'branding');
CREATE POLICY branding_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(),'super_admin'));
CREATE POLICY branding_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(),'super_admin'));
CREATE POLICY branding_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(),'super_admin'));