DROP POLICY IF EXISTS "own suppressions" ON public.suppressions;
CREATE POLICY "own suppressions" ON public.suppressions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);