# Public build and API security

## Edge rules

The main hardening work published and tested these Vercel edge rules. The results
below were reported by the main task; the manual build audit does not deploy
rules or verify the live firewall configuration.

| Match | Action |
| --- | --- |
| Request path starts with `/api/` | Rate limit by client IP: fixed window of 120 requests per 60 seconds; return HTTP 429 when exceeded. |
| Request path starts with `/api/` and `Sec-Fetch-Site: cross-site` | Reject the request at the edge. |

The rate limit is shared across matching API routes for an IP, including
`/api/visits`; it is not a separate allowance for each endpoint. Counters are per
region, not a single global quota. People behind the same office, carrier, VPN or
household IP share a bucket. Ordinary browsing should be unaffected except for
API bursts, including bursts from others sharing an IP. A fixed window permits
bursts around its boundary; slow or distributed scraping is not prevented.

The fetch-metadata rule supplements server protections; it is not authentication
or authorization. Browsers supply this header, but clients outside a browser can
spoof or omit it. Only the explicit `cross-site` value is rejected by this rule;
same-origin requests and missing headers are not rejected by this condition.

There is no CAPTCHA, general bot block, or F12/DevTools blocking in this policy.
These rules do not provide full bot detection.
Public pages and assets remain accessible. Anything delivered to a browser can
always be inspected and copied, including minified JavaScript and rendered data.

See [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

### Published checks and rollback

The main task reported these live checks:

- A same-origin request with an invalid ID returned HTTP 400.
- A request with `Sec-Fetch-Site: cross-site` returned HTTP 403.
- A series of 120 invalid-ID requests returned 118 HTTP 400 responses and two
  HTTP 429 responses. The 429 responses were plain text with no `Retry-After`
  header. Clients must not assume JSON or a retry-delay header on edge errors.
  This observed series does not establish an isolated fresh-window threshold;
  other matching traffic can already have consumed the shared allowance.

To roll back, open the project's Vercel Firewall rules, disable the relevant
rule by its exact ID, and publish/apply the change:

| Rule ID | Disable to roll back |
| --- | --- |
| `rule_api_burst_protection_kpEEkA` | The shared `/api/` IP burst limit. |
| `rule_reject_cross_site_api_use_9gsagZ` | Cross-site fetch-metadata rejection. |

Disable both IDs for a full rollback of these two controls. Recheck same-origin
and cross-site invalid-ID requests after publishing; disabling the cross-site
rule should allow those requests to reach normal API validation. Disabling the
burst rule removes this rule's 429 responses but does not rule out limits from
other infrastructure. Rollback does not require changing application code.

## Server secrets and source maps

Keep `MIGHTPULSE_API_KEY`, `DATABASE_URL` and `POSTGRES_URL` in server environment
variables and server code. Do not add a public environment prefix, embed their
values in browser modules, render them into HTML, or include them in API responses.
Local `.env.local` must remain untracked. The current `.gitignore` ignores all
`.env*` files except `.env.example`, which may contain placeholders only. Ignore
rules do not untrack files already in Git. A filename exemption does not validate
example file contents.

The current Astro configuration relies on Vite's default `build.sourcemap: false`.
The audit checks the actual output, since copied assets and future configuration
changes can still publish maps. Disabling source maps reduces source disclosure;
it cannot make browser code secret. See [Vite build options](https://vite.dev/config/build-options#build-sourcemap).

## Manual audit

From the repository root, using Node.js 20.12 or newer and Git:

```sh
npm run build
node scripts/audit-public-build.mjs
```

Run the audit only after the main build succeeds. It uses Node built-ins without
dependencies, resolves the repository relative to the script, and never modifies
the build, environment or Git index. It is deliberately not wired into package
scripts or deployment configuration.

The audit checks:

- Every file in `dist` for exact, nonempty secret values from `.env.local` and the
  process environment for the three names above. Both sources are checked when
  their values differ. No generic key-name regex is used.
- All public `.map` files, including hidden maps without a reference, and
  `sourceMappingURL` comment directives in JS, MJS, CJS and HTML (inline scripts).
- Tracked filenames from `git ls-files -z` and public filenames for `.env` and
  `.env.*` except `.env.example`; `.git`, `.ssh`, `.aws`, `.vercel` and `secrets`
  path segments; `.npmrc`, `.netrc`, `credentials.json`, `service-account.json`,
  conventional `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519` private keys; and
  `.pem`, `.key`, `.p12`, `.pfx`, `.keystore` extensions. This explicit policy
  flags credential containers for review even if a particular file is harmless.

Output contains only status and counts, never values, snippets or filenames.
Exit codes are `0` for passing available checks, `1` for findings, and `2` for an
incomplete audit (for example missing/empty `dist`, unreadable files, symlinks or
a Git failure). Fix the underlying issue and rerun before publishing.

Coverage counts identify unavailable secrets; when none are available the secret
scan explicitly reports `SKIP`. A pass cannot establish the absence of unknown
secrets. Node's dotenv parser handles quoting and comments but does not expand
variable references; supply resolved values in the process environment if local
values use interpolation. Matching is literal, not a search for encoded,
transformed or partial credentials. The audit does not inspect Git history,
remote deployment environment variables, live API responses, HTTP source-map
headers or nonpublic server bundles. It does not prove the build is fresh.

If a real secret is found in public output or tracked files, remove the exposure,
rotate the affected credential, rebuild and rerun the audit. Never paste the
value into an issue, terminal log or review comment.
