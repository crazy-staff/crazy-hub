# Rewrite kickoff

Everything the first crazy-hub rewrite session needs, written when crazy-ui shipped (2026-11-14). Read this
with `CLAUDE.md`, `docs/decisions.md` and `PARITY.md`.

## Where things stand

- **crazy-ui is done for now:** [`@crazy-staff/ui` 0.2.0](https://www.npmjs.com/package/@crazy-staff/ui) on
  npm, source in [crazy-staff/crazy-ui](https://github.com/crazy-staff/crazy-ui) (`main`). 60 components,
  docs app in `apps/showcase`, rules in its `docs/guidelines.md`, decisions 16–17 in its `docs/decisions.md`.
  Releases go out by npm trusted publishing from its `release.yml`.
- **This repo** still holds the frozen patch approach. Nothing of the rewrite exists yet.
- **Order of work** (decision 10): crazy-ui ✅ → crazy-hub (now) → trainer.

## First steps, in order

1. **Repo history (decision 2).** Move the current `main` to branch `legacy-patch`. Rebuild `main` on
   Quackback's own git history at tag `v0.15.0` (`QUACKBACK_VERSION`), add `upstream` as a remote, then
   commit our files on top: `CLAUDE.md`, `PARITY.md`, `docs/` (this file included). Force-pushing `main`
   needs the owner's go-ahead in that session.
2. **Hosting** — decide at the start (decision 10). Needs Postgres + pgvector, S3-compatible storage and a
   long-running Bun server. Default plan: Docker on a VPS behind Cloudflare. Record the choice as a new
   decision.
3. **Owner's data for screenshots** — ask for a dump of his local portal (decision 8: screenshots on his
   real data, never only seed data).
4. **App skeleton on crazy-ui:** remove Quackback's UI from the build path (keep every backend module, see
   `CLAUDE.md` → Architecture), add `@crazy-staff/ui`, the theme, fonts, `registerSquircles()`, Paraglide
   (EN default + PL, DE, RU) and the layout below. Then the first `PARITY.md` row: sign in / sign up.
5. **One GitHub issue per feature** (decision 9) with the spec; one conversation per issue.

## Using crazy-ui

```sh
bun add @crazy-staff/ui @fontsource-variable/inter @fontsource-variable/geist-mono
```

```css
@import 'tailwindcss';
@import '@crazy-staff/ui/theme.css';
@import '@fontsource-variable/inter';
@import '@fontsource-variable/geist-mono';
@source '../node_modules/@crazy-staff/ui/dist';
```

```ts
import { registerSquircles } from '@crazy-staff/ui'
registerSquircles() // once on the client
```

Dark mode: `dark` class on `<html>`. Components never use `dark:`; only `--cui-*` token values change.

### Layout to reuse

The crazy-ui docs (`crazy-ui/apps/showcase`) already are the hub's look; copy the patterns, don't
reinvent them:

- **Frame:** sidebar on the frame colour, page in a rounded panel (Fumadocs spacious layout there; the
  library `Sidebar` component for app screens). Sidebar fully collapsible, 4px between rows, one neutral
  hover block that glides (`glide`/`useGlide`), active row with the soft accent fill, rows next to a
  gliding block use `squircle-motion`.
- **Top right of the panel:** theme button (one button, sun/moon) — the hub adds the account menu and
  notifications there.
- **Search:** built on `Command.Dialog` with filters and a fixed "Clear filters" slot
  (`apps/showcase/src/components/search.tsx`).
- **Pages:** accent glow top left on every page, progressive blur at the panel's bottom while there is more
  to scroll and at the top once scrolled, page transitions from the direction of the sidebar link,
  blocks rising top to bottom, skeleton while loading (`apps/showcase/src/routes/docs*`,
  `src/components/docs/*`).
- **Docs module (decision 4):** the showcase's docs pages (On this page with scroll spy, View code,
  TypeTable) show what the hub's docs reader should feel like; the hub renders DB content with
  fumadocs-core instead of MDX files.

### Rules learned in crazy-ui (they apply here too)

- Check WCAG contrast before any colour change; borders are opaque; no neon.
- Every variant of a control has the same box (transparent border) — no layout shift.
- Squircle polyfill rules: no shadow on inputs or transparent backgrounds, outlines are borders, moving
  shapes use `squircle-motion`.
- Pointer cursor on everything clickable; gentle press; motion only on transform/opacity with reduced
  motion respected.
- Names and states (2026-11-20, #5): public role badges are small soft chips right after the name (like
  "Team"); something only its author sees until a moderator approves it carries a warning chip
  ("Waiting for review") or, for a whole idea, a warning alert above its text.
- Declutter (owner, 2026-11-15): no text where an icon carries the meaning (icon-only buttons with
  `aria-label` + tooltip, counts in badges), generous whitespace, controls in one row share one size,
  no outline around an already clear group. Full rule: crazy-ui `docs/guidelines.md` → _Declutter_.
- Destructive actions are always red (owner, 2026-11-15): delete, remove, ban, avatar removal… use the
  danger tone (red text/icon, red hover tint; `IconButton tone="danger"`, `DropdownMenu.Item danger`,
  `AlertDialog tone="danger"`) and ask for confirmation first.
- Mobile (owner, round 7, 2026-11-16): below `sm` whatever is small and opens is a bottom drawer with
  48px rows (`components/adaptive.tsx`: `AdaptiveMenu`, `AdaptivePopover`; `lib/use-phone.ts`);
  toggles that don't fit become a button that opens a drawer (`components/choice-field.tsx`); the menu
  button floats bottom right; management panels open from an icon button among the page's controls
  (`components/side-panel.tsx`: column on wide screens, drawer with touch sizes on narrow ones).
  Full rule: crazy-ui `docs/guidelines.md` → _Mobile_.
- Suggestions while typing (2026-11-20, #5 mentions): a list that answers what is being typed (people
  for `@`) opens inside the field, right under the text, on every screen size — never a drawer or a
  floating popup, which would cover the text or close the phone keyboard. The field keeps the focus;
  arrows move, Enter/Tab pick, Escape closes; rows are 40px, 48px on phones. Full rule: crazy-ui
  `docs/guidelines.md` → _Mobile_.
- **Keep the design rules current**: when the owner settles a design question in a review, write the
  rule into crazy-ui `docs/guidelines.md` and this list in the same change.
- Give the owner status updates while long work runs (parallel agents are fine, silence is not); list
  every change with the page/link where it can be seen.

## Things to move or import

- The trainer repo's `portal/` and `tools/portal/` belong to the old approach; they move out when this
  rewrite starts.
- The trainer's `docs/pages` content is imported **once** into the new docs module; after that the hub is
  the source of truth.

## Environment notes

- The cloud sandbox has **no Playwright Firefox** (its download host is blocked): screenshots are Chromium;
  check the Firefox squircle path with the polyfill forced. The owner's Zen browser is the source of truth.
- On Windows, `bun run --filter … dev` doesn't stop on Ctrl+C: run dev servers directly
  (`cd apps/web && bun run dev`).
- The owner's clones live in `F:\Documents\projects\<repo>`; his shell is PowerShell 7.
