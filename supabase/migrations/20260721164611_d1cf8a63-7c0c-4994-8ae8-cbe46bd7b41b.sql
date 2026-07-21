DROP POLICY IF EXISTS "own templates" ON public.templates;
CREATE POLICY "own templates" ON public.templates FOR ALL TO authenticated
USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);