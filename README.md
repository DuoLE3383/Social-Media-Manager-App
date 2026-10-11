# Social Studio

A React workspace for social media planning and AI-assisted drafting. It includes 15 prompt workflows, editable prompts, browser-local brand context and run history, an Ollama/OpenAI-compatible API, optional Supabase email authentication, and a Supabase starter schema with row-level security.

## Run locally

Requirements: Node.js 18+ (the API uses native `fetch`) and npm.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and adjust values as needed.
3. Start Ollama and pull the model configured in `LLM_MODEL` (default: `llama3.2`), or configure an OpenAI API key.
4. Start the API: `npm run server`
5. In another terminal start the React app: `npm start`

The React development server proxies `/api` to `http://localhost:8787`. The default Ollama URL is `http://127.0.0.1:11434`. The API binds to loopback by default.

## AI providers

The server selects one provider using environment variables. Provider credentials stay on the server and are never sent to the browser.

**Ollama:** set `LLM_PROVIDER=ollama`, `OLLAMA_URL`, and `LLM_MODEL`. This works when the API process can reach that Ollama host. A hosted SaaS backend cannot reach Ollama on a customer's computer via its own `localhost`; supporting that requires a local companion/agent or a secure customer-managed tunnel. Do not expose Ollama's unauthenticated port directly to the public internet.

**OpenAI-compatible API:** set `LLM_PROVIDER=openai`, `LLM_MODEL`, and `OPENAI_API_KEY`. Optionally set `OPENAI_BASE_URL` for a compatible endpoint. **Anthropic:** set `LLM_PROVIDER=anthropic`, `LLM_MODEL`, and `ANTHROPIC_API_KEY`. The current router selects one server-configured provider; per-user tier routing and provider failover are not implemented.

The API has a small in-memory per-user rate limit and payload limit. When server Supabase credentials are set, it verifies the Supabase bearer token before generation. Before internet-facing production use, add persistent quotas, distributed rate limiting, request timeouts/observability, billing enforcement, and a deployment-specific origin allowlist. Never expose the Supabase service-role key to the frontend.

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
