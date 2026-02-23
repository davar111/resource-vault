# AI Onboarding Setup (Groq + Supabase + Tavily)

## 1) API keys
- Groq:
  - Open: https://console.groq.com/keys
  - Create API key and copy it.
- Tavily:
  - Open: https://app.tavily.com
  - Create API key and copy it.

## 2) Apply DB schema
1. Open Supabase project.
2. Go to SQL Editor.
3. Run `supabase.sql`.

This creates:
- `public.users` with `ai_profile` JSONB.
- `public.links`, `public.collections`, `public.link_collections`, `public.saved_filters`, `public.collection_invites`.
- Full RLS policies for private/shared collections and onboarding profile.

`SupabaseSchema.sql` оставлен как legacy-референс для раннего AI-onboarding прототипа и не покрывает актуальные таблицы коллекций.

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
   - `supabase secrets set GROQ_API_KEY=...`
   - `supabase secrets set TAVILY_API_KEY=...`
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
  - Generates questions with Groq.
  - Builds final JSON profile.
  - Pulls internal resources from `links` by tags.
  - Pulls external resources via Tavily (or Dev.to/GitHub fallback).
  - Ranks and returns resources.
  - Saves `ai_profile` into `public.users`.
- Frontend can import returned resources into Vault.
