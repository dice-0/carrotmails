DROP POLICY IF EXISTS "own profile read" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
WITH CHECK (auth.uid() = id AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);