# storeadmin — working rules

Live multi-tenant billing SaaS. `client/` admin web (React 19, Vite, Apollo, Redux, Tailwind v4), `server/` GraphQL API (Express, Apollo Server 3, Mongoose 7), `clientapp/` React Native app, `clientweb/` shop website. The apps share the server API.

## Must
- Never break live behaviour. Existing GraphQL fields, args and results stay as they are; add new ones as optional.
- No data migrations or scripts on existing records. New fields have no default that changes old documents (Mongoose applies schema defaults on read).
- Every record is tenant-scoped (`admin` or `adminid`). Never trust a client id over the login token for new code.
- Deletes are soft (`status: false` or the model's own flag). "Clear" sets `cleared: true` and only applies to deleted records.
- Bill and voucher numbers: only the main series is final; offline device numbers are provisional.
- Offline / local-first work follows `OFFLINE.md`.

## Code style
- Simple, small code. Reuse helpers (`server/src/utils/listquery.ts`, `client/src/hooks/useservertable.ts`, `client/src/graphql/hooks/common`) before writing new ones.
- Comments: one short line, only for the non-obvious "why". No paragraphs, history, banners or emoji.
- No new files unless needed; no stray `.tmp`, notes or scripts in the repo.
- Keep existing names, props, routes and file names.
- UI: indigo-600 primary, slate neutrals, `h-8` controls, `text-[13px]`, lucide-react icons.

## Checks before a commit
- Server: `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx ts-node --transpile-only src/scripts/check-schema.ts`.
- Client: `npx tsc --noEmit -p tsconfig.app.json` adds no errors in touched files; `npx vite build` passes.
- Comment-only or cleanup changes must compile to identical JavaScript.

## Git
- Work on a feature branch, one commit per finished step. Never push or touch other branches unless asked.

## Working style
- Independent modules can be done in parallel; never let two workers edit the same file.
