# AI Social

A React workspace for social media planning and AI-assisted drafting. It includes 15 prompt workflows, editable prompts, browser-local brand context and run history, an Ollama/OpenAI-compatible API, optional Supabase email authentication, and a Supabase starter schema with row-level security.

## Run locally

Requirements: Node.js 18+ (the API uses native `fetch`) and npm.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and adjust values as needed.
3. Start Ollama and pull the models configured in `LLM_MODEL` (`qwen2.5:3b`), `LLM_MODEL_PREMIUM` (`qwen2.5:7b`), and `LLM_MODEL_EMBED` (`nomic-embed-text`), or configure a cloud provider.
4. Start both frontend and API together: `npm run all`. The script picks an available frontend port from 3000–3099 and runs the API on `API_PORT` (8787 by default). Press Ctrl+C to stop both.

You can also run the services separately with `npm start` and `npm run server` in two terminals.

The React development server proxies `/api` to `http://localhost:8787`. The default Ollama URL is `http://127.0.0.1:11434`. The API binds to loopback by default.

## Deploy the frontend to a Cloudflare Worker

`wrangler.toml` configures the Worker and CRA output directory (`build`). Set its `name` to the exact Worker name in your Cloudflare account. Then run `npx wrangler login` once and deploy with `npm run deploy:cloudflare`. Wrangler uploads the built static frontend; it does not deploy the Node API in `server/`.

The deployment command builds on your machine, so put `REACT_APP_SUPABASE_URL` and either `REACT_APP_SUPABASE_ANON_KEY` or `REACT_APP_SUPABASE_PUBLISHABLE_KEY` in your local ignored `.env` before deploying. These frontend keys are public; never put `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`, or other server secrets in a `REACT_APP_*` variable or commit `.env`.

The API must be deployed separately to a reachable HTTPS server and the frontend configured to call it. The `package.json` development proxy only works in local development, so uploading the static build alone does not make API routes available on this Worker. For a temporary local Ollama setup, run `npm run server`, start `npm run tunnel` in another terminal, set `REACT_APP_API_BASE_URL` in `.env` to the printed HTTPS tunnel URL, and redeploy. Add the Worker origin to server-side `CORS_ORIGINS` (a comma-separated list); keep the API and tunnel running while you use the deployed site. A random Quick Tunnel URL changes on restart, so rebuild/redeploy the frontend with the new URL each time. Cloudflare Worker runtime variables are not injected into CRA's browser bundle; provide the public Supabase and API base URL variables when running the build command.

## AI providers

The server selects one provider using environment variables. Provider credentials stay on the server and are never sent to the browser.

**Ollama:** set `LLM_PROVIDER=ollama`, `OLLAMA_URL`, and `LLM_MODEL`. This works when the API process can reach that Ollama host. A hosted SaaS backend cannot reach Ollama on a customer's computer via its own `localhost`; supporting that requires a local companion/agent or a secure customer-managed tunnel. Do not expose Ollama's unauthenticated port directly to the public internet.

Generation requests use tier-specific `LLM_TIMEOUT_DEFAULT` (90 seconds) and `LLM_TIMEOUT_PREMIUM` (300 seconds) limits, retry transient Ollama failures twice with backoff, check installed models before generation, and fall back from premium to the default model when `LLM_FALLBACK_ENABLED=true`. Ollama requests are serialized in a bounded process-wide queue (`OLLAMA_QUEUE_LIMIT=4` includes the active request); users can cancel active and queued requests from Prompt Studio. Embeddings use `LLM_TIMEOUT_EMBED` (30 seconds). All timeout values are milliseconds.

**OpenAI-compatible API:** set `LLM_PROVIDER=openai`, `LLM_MODEL`, and `OPENAI_API_KEY`. Optionally set `OPENAI_BASE_URL` for a compatible endpoint. **Anthropic:** set `LLM_PROVIDER=anthropic`, `LLM_MODEL`, and `ANTHROPIC_API_KEY`. The current router selects one server-configured provider; billing enforcement and provider failover are not implemented.

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

## Connect Threads

Threads publishing uses the Threads API and the same Supabase project and token-encryption key as Facebook.

1. In Meta for Developers, add the **Threads API** use case/product and configure the exact callback URI from `THREADS_REDIRECT_URI` (local default: `http://localhost:8787/api/threads/callback`).
2. Grant `threads_basic` and `threads_content_publish`. Add your account as a tester while the Meta app is in development mode; request App Review for other users.
3. Set `THREADS_APP_ID` and `THREADS_APP_SECRET`, or leave them empty to reuse `META_APP_ID` and `META_APP_SECRET`. Set `THREADS_REDIRECT_URI`; `THREADS_STATE_SECRET` is optional and defaults to the Threads app secret. Keep secrets and `SUPABASE_SERVICE_ROLE_KEY` server-side.
4. Apply `supabase/migrations/202610120001_threads.sql` in Supabase SQL Editor. It creates encrypted connection and post tables, a private media bucket (up to 100 MB), and per-user Storage policies. If you change `SUPABASE_STORAGE_BUCKET`, edit the bucket ID in the migration to match before applying it.
5. Restart the app, sign in with Supabase, open **Connections**, and connect Threads. You can publish text, a single image or MP4 video, or a carousel of 2–20 images/videos. Media is uploaded to private Supabase Storage and passed to Threads with a temporary signed HTTPS URL.

The API refreshes stored Threads tokens before publishing when they are within seven days of expiry. The 30-day planner queues the supplied topics and publishes due items from the backend; keep the API process online for automatic publishing. Scheduled posts and their state persist in Supabase. Apply `202610130001_threads_scheduling.sql` before using the planner. Automatic image generation keeps prompt writing on local Ollama. It tries local ComfyUI first (install an SDXL checkpoint and set `COMFYUI_URL`/`COMFYUI_CHECKPOINT`), then falls back to the free community AI Horde; anonymous Horde requests need no account key but have the lowest queue priority and can take several minutes. You can optionally set `HORDE_API_KEY` from a free AI Horde account to improve queue priority. Generated image bytes are saved to the private Threads Storage bucket before publishing. This $0-only configuration intentionally does not call Pollinations or Hugging Face: Pollinations currently requires an API key and Hugging Face inference can bill users without included credits. ComfyUI's local API flow follows [ComfyUI's official API example](https://github.com/Comfy-Org/ComfyUI/blob/master/script_examples/websockets_api_example.py). Account deletion removes uploaded media from the configured Threads bucket and cascades connection and post rows. Meta must reach the OAuth callback and signed media URLs; use HTTPS callback URLs after deployment. The API creates a Threads media container and publishes it as a separate call, following [Meta's Threads API collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api).

### Data deletion and privacy

- Public policy pages included under `public/privacy/`: `/privacy/data-deletion.html`, `/privacy/privacy-policy.html`, and `/privacy/terms.html`. They are served as static pages by the frontend deployment.
- Public interactive deletion page: `https://<your-deployed-domain>/privacy/data-deletion`.
- Meta data-deletion callback: `https://<your-deployed-domain>/api/meta/data-deletion`. Configure this callback in the Meta app's data deletion settings. Requests are accepted only after validating Meta's signed request, and delete Page-token records associated with that Facebook app-scoped user ID.
- Apply both SQL files in `supabase/migrations/` before enabling this callback. The second migration adds the Facebook user ID to Page-token records.
- Signed-in users can permanently delete their AI Social account from the public deletion page after typing `DELETE` and confirming. The API verifies their Supabase session and uses the server-only service role to delete the auth user; foreign-key cascades remove associated workspace rows.
- Upload `public/social-studio-meta-app-icon-1024.png` as the Meta app icon. `public/meta-app-icon.html` is also a browser export utility, and `public/social-studio-meta-app-icon.svg` is its vector source.

Meta must be able to reach the deletion instructions and callback over public HTTPS. Localhost URLs are for local preview only and cannot be submitted as production URLs.

Facebook Page publishing currently supports text posts. Threads supports text, image, video, and carousel posts. Scheduling, Instagram publishing, analytics, and Meta webhook handling are not included.

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
