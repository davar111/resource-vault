# AI Onboarding Setup (Gemini + Supabase + Serper)

## 1) Free API keys
- Gemini (Google AI Studio):
  - Open: https://aistudio.google.com/app/apikey
  - Create API key and copy it.
- Serper:
  - Open: https://serper.dev
  - Sign up and create API key from dashboard.

## 2) Apply DB schema
1. Open Supabase project.
2. Go to SQL Editor.
3. Run `SupabaseSchema.sql`.

This creates:
- `public.users` with `ai_profile` JSONB.
- `public.links` with tags + indexes + RLS.

## 3) Add basic test data for `links`
Run in SQL Editor (replace `YOUR_USER_ID`):

```sql
insert into public.links (user_id, url, title, note, tags, source, type)
values
  ('YOUR_USER_ID', 'https://react.dev/learn', 'React Learn', 'Official React docs', array['frontend','react','docs'], 'site', 'article'),
  ('YOUR_USER_ID', 'https://www.figma.com/community', 'Figma Community', 'UI kits and templates', array['uiux','figma','templates'], 'site', 'asset'),
  ('YOUR_USER_ID', 'https://github.com/topics/product-management', 'PM GitHub Topics', 'Product management repos', array['pm','management','tools'], 'site', 'tool');
```

## 4) Deploy Edge Function
1. Install Supabase CLI:
   - https://supabase.com/docs/guides/cli
2. Login and link project:
   - `supabase login`
   - `supabase link --project-ref <your-project-ref>`
3. Set function secrets:
   - `supabase secrets set GEMINI_API_KEY=...`
   - `supabase secrets set SERPER_API_KEY=...`
4. Deploy:
   - `supabase functions deploy ai-onboarding --no-verify-jwt=false`

## 5) Required env in frontend
In `.env`:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-publishable-anon-key>
```

## 6) Runtime flow
- User opens `AI interview` button in sidebar.
- Frontend calls `ai-onboarding` function with JWT.
- Function:
  - Generates questions with Gemini.
  - Builds final JSON profile.
  - Pulls internal resources from `links` by tags.
  - Pulls external resources via Serper (or Dev.to/GitHub fallback).
  - Ranks and returns resources.
  - Saves `ai_profile` into `public.users`.
- Frontend can import returned resources into Vault.
