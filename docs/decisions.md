# Decisions

Settled in the planning conversation of 2026-11-13 (owner + Claude). Supersede by adding entries.

1. **Rewrite the frontend, keep the backend.** The patch approach (`transform.py` editing upstream UI,
   Fumadocs squeezed into the help center) produced spaghetti; it is frozen.
2. **Repo history.** This repo stays (`crazy-staff/crazy-hub`); `main` is rebuilt on Quackback's git
   history (v0.15.0) + our commits so backend updates can be cherry-picked/merged. Old code → branch
   `legacy-patch`.
3. **Parity tiers** as in `PARITY.md`: notifications stay (no email yet), auth and DB stay; unused modules
   keep their backend and get UI only when asked.
4. **Docs: a new module from scratch** with its own tables, API and admin panel; Quackback's help center is
   left untouched (renaming it to "Docs" in code was a mistake). Fumadocs (core) renders it.
5. **Docs content:** Markdown/MDX in the DB, edited on the site (TipTap 3 WYSIWYG + source view). Editing,
   translations, authors, categories and contributors live in the admin UI, never in git files. Features
   grow build by build.
6. **UI: crazy-ui** (`@crazy-staff/ui`, Base UI primitives) for every screen.
7. **i18n: Paraglide**, EN default + PL, DE, RU.
8. **Tests:** Vitest, Playwright e2e of main paths, visual tests, CI gate; screenshots of changed pages in
   every PR (Firefox, 3440×1440, owner's data).
9. **Feature flow:** idea on the hub → accepted → GitHub issue (spec, link to the post) → one conversation
   per issue → PR closes the issue → post status updates on the hub (webhooks).
10. **Order:** crazy-ui → crazy-hub → trainer. Hosting of the hub decided at the start of the hub phase.
11. **Hosting (2026-11-14, proposed at the start of the hub phase; supersede if the owner picks otherwise).**
    One EU VPS with Docker Compose behind Cloudflare (DNS, TLS, proxy): the hub's image (built in CI,
    pushed to GHCR, never built on the server) and Postgres with pgvector and pg_cron in a container, on a
    4 vCPU / 8 GB box (Hetzner CX33 ≈ €9/mo; if CX/CAX can't be ordered, netcup VPS 1000 or Hetzner CPX22,
    €14–20). Uploads in Cloudflare R2 (free tier covers our size). Backups: provider snapshots plus a nightly
    `pg_dump -Fc` to R2 with a 30-day retention rule; restore tested once. Outbound email later through a
    transactional provider (Resend/Postmark), never from the VPS. Rejected: Fly.io (managed Postgres has no
    pg_cron), Supabase/Neon + VPS (~3× the cost, DB latency), Railway kept as the low-ops fallback
    (~$15–30/mo, extensions template). Details: `docs/hosting.md`.
12. **How the hub is divided (2026-11-14, owner).** crazy-hub carries more than the trainer. The
    **product** is the main division and part of the URL (`/trainer/ideas`, `/trainer/docs`, …); a
    product's sections (ideas, roadmap, changelog, docs, downloads) belong to it. What is common to the
    whole hub (start page, later news, terms, contact, GitHub) sits outside the products: common rows at
    the top of the sidebar, links at its bottom. Each product has lower **divisions** (the trainer: game,
    then renderer), picked under the product in the sidebar and remembered per product; each section
    declares which divisions its content varies by (trainer: docs by game and renderer, downloads by
    game, ideas/roadmap/changelog shared). One list in `apps/web/src/app/lib/products.ts`.
13. **Projects, docs variants, downloads and roles (2026-11-14, owner; grilling session).** Supersedes the
    lower divisions of decision 12; the project (called "product" in decision 12 and in code so far) stays
    the main division and part of the URL.
    - **Scope.** Ideas, roadmap, changelog and downloads are per project only. Docs also vary by the
      project's **dimensions** (trainer: game, renderer). The sidebar holds the project picker at the top
      and the project's sections; dimension pickers leave the sidebar.
    - **Projects are managed in the admin**, nothing is hard-coded: name, slug, icon, enabled sections,
      private builds repository, one or more Quackback **boards** (the project's ideas are the posts of
      its boards; its roadmaps filter by those boards), and its dimensions with values and a default value.
      The trainer's dimensions are seeded; new projects start empty. Changelog entries are tied to a
      project by our own table (`changelog_entry ↔ project`), so Quackback's changelog categories stay
      free and upstream merges stay clean.
    - **Tags are `kind: value`.** A project's dimensions double as tag kinds for ideas, roadmap and
      changelog (one list, flag "used in docs"); a project may add tag-only kinds (e.g. `type: bug`).
    - **Docs variant picker.** A button next to the docs search shows the current pick ("Gothic 1 ·
      GD3D11") and opens a popover (a drawer on phones) with one group per dimension. The pick is stored
      locally per project; a URL search param (`?renderer=gd3d11`) overrides it and "Copy link" adds it.
      First visit: the project's default values, with a "Showing for … — Change" hint.
    - **Article applicability.** Each article declares, per dimension, "all" or a set of values. An
      article that doesn't apply to the current pick is hidden from the navigation; opening it from a link
      shows a notice and asks whether to switch (never switches silently).
    - **Differences inside an article** are conditional blocks: a block (paragraph, list, table, table
      row, image) marked "only for …", plus "instead" groups (one block per variant). Block level only for
      now, no inline fragments. The editor previews the article per variant and marks conditional blocks.
      In MDX: `<Only renderer="gd3d11">…</Only>`.
    - **Translations** are full copies of the article with the same conditional blocks, paired in the
      side-by-side editor; a missing translation shows the English article with a notice.
    - **Search** lists results for the current pick first, then a "In other variants" group with labels.
    - **No release-versioned docs**: docs show the current state; history lives in the changelog.
    - **Downloads** (`/<project>/downloads`): one page per project. Builds live in a **private** GitHub
      repository per project; the hub reads releases with its token and serves files only after checking
      access (no leaked alphas, download counts). The platform comes from the asset file name
      (`<name>-windows-x64.zip`, `<name>-linux-x64.zip`; unknown files go to "Other files"); the channel
      from the semver tag: `v1.3.0` stable, `v1.3.0-beta.N` beta, `v1.3.0-alpha.N` alpha. Stable: everyone;
      beta: signed-in users; alpha: the project's Alpha tester role. Page: a card for the latest release
      with a big button for the detected OS and the other platforms below, then an archive of older
      releases. The trainer itself requires signing in to the hub for tester mode, and alpha builds lock
      the menu until the user signs in (sign-in through the browser with a device code; separate issue).
    - **Roles.** A role has a scope: global (Owner, Admin, rank) or per project (Moderator, Docs editor,
      Alpha tester). Roles belong to **categories**; a category may be exclusive (one role from it per
      person, e.g. Team: Owner / Admin / Moderator, so an admin is never also a moderator), and a person
      can hold roles from many categories. Categories and roles are created in the admin; a role's
      permissions are checkboxes from a fixed list in code (each feature adds its permissions). A role
      can be shown publicly as a badge (on the hub and on Discord).
    - **Discord with 2FA is required** for every team or tester role, Owner and Admin included: the role
      can only be given to an account with a linked Discord account whose `mfa_enabled` is true (checked
      when the role is given and on every Discord sign-in). Unlinking Discord or turning 2FA off
      **suspends** the roles; they come back on their own when fixed. So 2FA is enforced by Discord, not
      by the hub.
    - **Enforcement.** Only Owner and Admin get Quackback's team role (its server functions check only the
      workspace role). Per-project rights are checked by our own server functions, which then call
      Quackback's services; the backend stays untouched.
    - **Later, separate issues:** reputation (#23; a rank earned by activity, making feedback more
      credible; high priority after the first version), the trainer's device-code sign-in (#24), a Discord
      bot that syncs hub roles to the server one way (#25; hub → Discord; only the server owner creates the
      hub-linked Discord roles, Discord-only roles like cosmetic ones stay with the server's admins and
      mods), and an "Apply for alpha" form (#26; until then the role is given in the admin).
    - Built first in #22 (projects, dimensions, roles), before the feedback list (#5).

14. **Components the hub builds first use UI SDK (2026-11-20, owner).** crazy-ui builds every new or
    rebuilt component with **UI SDK** (https://ui-sdk.dev; crazy-ui decision 18). When the hub needs a
    component before crazy-ui has it (a local one in `apps/web/src/app/components/`), it is built the same
    way: behaviours from `@ui-sdk/core` rendered with `@ui-sdk/react` (pinned exact versions), styled
    with crazy-ui's tokens and `tv()`, compound parts + one-line form, so it can move into crazy-ui as is.
    When the work on it is done, it is ported to crazy-ui (with a showcase page and tests) and the hub
    switches to the library version.

