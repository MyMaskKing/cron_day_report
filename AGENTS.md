# Repository Guidelines

## Project Structure & Module Organization

- `src/` is the Cloudflare Worker application: `index.js` contains the `fetch`/`scheduled` entry points, `api/` handles HTTP requests, `services/` contains business logic, `storage/` contains D1/KV/R2 adapters, `auth/` handles sessions, and `web/` holds server-rendered HTML/CSS/JS strings.
- Keep the dependency direction `api → service → storage`; do not put SQL directly in API or service code.
- `migrations/` contains numbered, idempotent SQL migrations. Add schema changes as the next `000N_*.sql` file.
- `android/` is a separate Gradle/Compose widget app. `mailrelay/` is a standalone Node.js HTTP-to-SMTP service. `docker/` supports running the Worker with Node.js and SQLite.

## Build, Test, and Development Commands

```bash
npm install              # Install Worker dependencies
npm run dev              # Start Wrangler local development
npm run test            # Start Wrangler with local persistence
npm run serve           # Run the Node.js/SQLite Docker-compatible server
npm run deploy          # Deploy to Cloudflare Workers
npm run tail            # Stream production logs
npm test --prefix mailrelay   # Run mailrelay unit tests
cd android && ./gradlew :app:assembleDebug
```

Use Node.js 18+ for the Worker and Node.js 20+ for `mailrelay`; Android builds require JDK 17.

## Coding Style & Naming Conventions

Use ES modules, 2-space indentation, semicolons, and the existing quote style. Name files by domain and layer, such as `todo.api.js`, `report.service.js`, and `d1-adapter.js`. Handler names should describe the action, for example `listTasks` and `createTask`. Kotlin follows the existing package and 4-space style under `android/`.

No ESLint or Prettier configuration is provided, so match surrounding code and avoid unrelated formatting changes. SQL comments in migrations must occupy standalone lines.

## Testing Guidelines

`mailrelay` uses Node’s built-in test runner and strict assertions; tests live in `mailrelay/test/*.test.js` and should describe the behavior and expected result. The main Worker has no dedicated unit-test suite: verify changes with `npm run dev`, exercise affected API/page flows, and run `node --check <changed-file>.js` for syntax validation. Android changes should at least pass `:app:assembleDebug`.

## Commit & Pull Request Guidelines

Commit history uses concise Chinese summaries, often prefixed by area or bug type, for example `座右铭: ...` or `修复...`. Include migration numbers when relevant. Pull requests should summarize the change, list verification steps, identify configuration or migration impact, and include screenshots for UI changes. Never commit `wrangler.toml`, `.dev.vars`, passwords, tokens, or keystore files.