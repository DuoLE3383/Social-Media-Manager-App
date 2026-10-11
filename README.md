# Social Studio

A React workspace for social media planning and AI-assisted drafting. It includes 15 prompt workflows, editable prompts, browser-local brand context and run history, an Ollama/OpenAI-compatible API, optional Supabase email authentication, and a Supabase starter schema with row-level security.

## Run locally

Requirements: Node.js 18+ (the API uses native `fetch`) and npm.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and adjust values as needed.
3. Start Ollama and pull the model configured in `LLM_MODEL` (default: `llama3.2`), or configure an OpenAI API key.
4. Start both frontend and API together: `npm run all`. The script picks an available frontend port from 3000–3099 and runs the API on `API_PORT` (8787 by default). Press Ctrl+C to stop both.

You can also run the services separately with `npm start` and `npm run server` in two terminals.

The React development server proxies `/api` to `http://localhost:8787`. The default Ollama URL is `http://127.0.0.1:11434`. The API binds to loopback by default.

## AI providers

The server selects one provider using environment variables. Provider credentials stay on the server and are never sent to the browser.

**Ollama:** set `LLM_PROVIDER=ollama`, `OLLAMA_URL`, and `LLM_MODEL`. This works when the API process can reach that Ollama host. A hosted SaaS backend cannot reach Ollama on a customer's computer via its own `localhost`; supporting that requires a local companion/agent or a secure customer-managed tunnel. Do not expose Ollama's unauthenticated port directly to the public internet.

**OpenAI-compatible API:** set `LLM_PROVIDER=openai`, `LLM_MODEL`, and `OPENAI_API_KEY`. Optionally set `OPENAI_BASE_URL` for a compatible endpoint. **Anthropic:** set `LLM_PROVIDER=anthropic`, `LLM_MODEL`, and `ANTHROPIC_API_KEY`. The current router selects one server-configured provider; per-user tier routing and provider failover are not implemented.

The API has a small in-memory per-user rate limit and payload limit. When server Supabase credentials are set, it verifies the Supabase bearer token before generation. Before internet-facing production use, add persistent quotas, distributed rate limiting, request timeouts/observability, billing enforcement, and a deployment-specific origin allowlist. Never expose the Supabase service-role key to the frontend.

## Connect Facebook Pages

This integration connects **Pages the signed-in person manages**. It does not publish to personal profiles.

1. Create a Meta app at [Meta for Developers](https://developers.facebook.com/apps/) and add Facebook Login for the Web.
2. Add the exact OAuth callback URI from `META_REDIRECT_URI` (local default: `http://localhost:8787/api/meta/callback`) to the Facebook Login Valid OAuth Redirect URIs. Set the app domain and allowed web origin for the frontend.
3. Put `META_APP_ID`, `META_APP_SECRET`, and the callback URI in the server `.env`. Never expose the app secret in a `REACT_APP_*` variable.
4. Generate a random 32-byte base64 `META_TOKEN_ENCRYPTION_KEY`. Set `SUPABASE_SERVICE_ROLE_KEY` on the server only. Apply the Supabase migration so its private `meta_page_connections` table exists.
5. For public users, set the Meta app live and request review/advanced access for `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`. App roles/testers can test in development mode subject to Meta's current app rules.
6. Restart the API, sign into the app with Supabase, then open **Connections → Connect Facebook**. The user grants access through Facebook and chooses which managed Pages are saved.

Page access tokens are encrypted at rest with AES-256-GCM in Supabase and are only read by the server service role. The browser can list connected Page names and request actions, but never receives tokens. Page publishing is immediate and requires an explicit confirmation in the UI. Use HTTPS and a production callback URL when deployed; update both `META_REDIRECT_URI` and the Meta dashboard to match exactly. Facebook may require additional review or business verification depending on app access and Page roles.

### Data deletion and privacy

- Public deletion instructions: `https://<your-deployed-domain>/privacy/data-deletion`.
- Meta data-deletion callback: `https://<your-deployed-domain>/api/meta/data-deletion`. Configure this callback in the Meta app's data deletion settings. Requests are accepted only after validating Meta's signed request, and delete Page-token records associated with that Facebook app-scoped user ID.
- Apply both SQL files in `supabase/migrations/` before enabling this callback. The second migration adds the Facebook user ID to Page-token records.
- Signed-in users can permanently delete their Social Studio account from the public deletion page after typing `DELETE` and confirming. The API verifies their Supabase session and uses the server-only service role to delete the auth user; foreign-key cascades remove associated workspace rows.
- Upload `public/social-studio-meta-app-icon-1024.png` as the Meta app icon. `public/meta-app-icon.html` is also a browser export utility, and `public/social-studio-meta-app-icon.svg` is its vector source.

Meta must be able to reach the deletion instructions and callback over public HTTPS. Localhost URLs are for local preview only and cannot be submitted as production URLs.

The app currently supports text posts to Facebook Pages. Images, scheduling, Instagram publishing, analytics, token rotation automation, and Meta webhook handling are not included.

## Supabase authentication and data

1. Create a Supabase project and configure email authentication and redirect URLs.
2. Copy the project URL and anon/publishable key into `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` in `.env`.
3. Set the same URL and anon key as server variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The server uses them only to validate signed-in users.
4. Apply `supabase/migrations/202610110001_initial_saas.sql` in the Supabase SQL editor.

Without client Supabase settings, login is explicitly a local demo profile; it is not authentication. Prompt drafts and generated history stay in browser local storage. With Supabase configured and the migration applied, brand voice and prompt run history also sync to the signed-in user's account. Stripe billing and plan-based limits are not wired yet.

## Environment variables

See `.env.example`. CRA only exposes variables prefixed with `REACT_APP_`; keep all provider secrets in unprefixed server variables.

## Main areas

- `src/data/promptTemplates.js`: 15 editable prompt workflows.
- `src/components/PromptStudio.js`: search, category filters, prompt editor, generation, and local run history.
- `server/index.mjs`: small Node HTTP API with provider routing, auth verification, rate limiting, payload validation, and health status.
- `supabase/migrations/`: user-owned SaaS data schema and RLS policies.
- Existing `/dashboard` feed and `/profile` remain as demo social-network screens; `/prompts` is the content workspace.
