-- @contract: additive
-- crazy-hub (decision 13): projects, their boards, changelog links and dimensions, and the role system
-- (categories, roles, assignments, Discord 2FA cache). Our own tables, prefixed `crazy_`. Seeds the
-- Crazy Gothic Trainer project (linked to every existing board and changelog entry) and the starting
-- role categories and roles.
CREATE TABLE IF NOT EXISTS "crazy_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "short" text DEFAULT '' NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "sections" jsonb DEFAULT '["ideas","roadmap","changelog","docs","downloads"]'::jsonb NOT NULL,
  "builds_repo" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "archived_at" timestamptz,
  CONSTRAINT "crazy_projects_slug_unique" UNIQUE ("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_project_boards" (
  "project_id" uuid NOT NULL CONSTRAINT "crazy_project_boards_project_id_crazy_projects_id_fk" REFERENCES "crazy_projects"("id") ON DELETE CASCADE,
  "board_id" uuid NOT NULL CONSTRAINT "crazy_project_boards_board_id_boards_id_fk" REFERENCES "boards"("id") ON DELETE CASCADE,
  CONSTRAINT "crazy_project_boards_project_id_board_id_pk" PRIMARY KEY ("project_id", "board_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crazy_project_boards_board_idx" ON "crazy_project_boards" ("board_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_changelog_projects" (
  "changelog_entry_id" uuid NOT NULL CONSTRAINT "crazy_changelog_projects_entry_fk" REFERENCES "changelog_entries"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL CONSTRAINT "crazy_changelog_projects_project_id_crazy_projects_id_fk" REFERENCES "crazy_projects"("id") ON DELETE CASCADE,
  CONSTRAINT "crazy_changelog_projects_changelog_entry_id_project_id_pk" PRIMARY KEY ("changelog_entry_id", "project_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crazy_changelog_projects_project_idx" ON "crazy_changelog_projects" ("project_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_dimensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL CONSTRAINT "crazy_dimensions_project_id_crazy_projects_id_fk" REFERENCES "crazy_projects"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "used_in_docs" boolean DEFAULT true NOT NULL,
  "default_value" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crazy_dimensions_project_slug_idx" ON "crazy_dimensions" ("project_id", "slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_dimension_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dimension_id" uuid NOT NULL CONSTRAINT "crazy_dimension_values_dimension_id_crazy_dimensions_id_fk" REFERENCES "crazy_dimensions"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "short" text DEFAULT '' NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'available' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crazy_dimension_values_dimension_slug_idx" ON "crazy_dimension_values" ("dimension_id", "slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_role_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "exclusive" boolean DEFAULT false NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "crazy_role_categories_slug_unique" UNIQUE ("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL CONSTRAINT "crazy_roles_category_id_crazy_role_categories_id_fk" REFERENCES "crazy_role_categories"("id") ON DELETE RESTRICT,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "scope" text NOT NULL,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "requires_discord_mfa" boolean DEFAULT true NOT NULL,
  "system" boolean DEFAULT false NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "crazy_roles_slug_unique" UNIQUE ("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crazy_roles_category_idx" ON "crazy_roles" ("category_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_role_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "role_id" uuid NOT NULL CONSTRAINT "crazy_role_assignments_role_id_crazy_roles_id_fk" REFERENCES "crazy_roles"("id") ON DELETE CASCADE,
  "principal_id" uuid NOT NULL CONSTRAINT "crazy_role_assignments_principal_id_principal_id_fk" REFERENCES "principal"("id") ON DELETE CASCADE,
  "project_id" uuid CONSTRAINT "crazy_role_assignments_project_id_crazy_projects_id_fk" REFERENCES "crazy_projects"("id") ON DELETE CASCADE,
  "granted_by" uuid CONSTRAINT "crazy_role_assignments_granted_by_principal_id_fk" REFERENCES "principal"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crazy_role_assignments_principal_idx" ON "crazy_role_assignments" ("principal_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crazy_role_assignments_global_idx" ON "crazy_role_assignments" ("role_id", "principal_id") WHERE "project_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crazy_role_assignments_project_idx" ON "crazy_role_assignments" ("role_id", "principal_id", "project_id") WHERE "project_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crazy_discord_mfa" (
  "user_id" uuid PRIMARY KEY NOT NULL CONSTRAINT "crazy_discord_mfa_user_id_user_id_fk" REFERENCES "user"("id") ON DELETE CASCADE,
  "discord_account_id" text NOT NULL,
  "mfa_enabled" boolean NOT NULL,
  "checked_at" timestamptz DEFAULT now() NOT NULL,
  "account_updated_at" timestamptz
);
--> statement-breakpoint
-- Seed: the Crazy Gothic Trainer with its dimensions, its boards and changelog.
INSERT INTO "crazy_projects" ("slug", "name", "short", "description", "position")
VALUES ('trainer', 'Crazy Gothic Trainer', 'GT', 'In-game trainer for Gothic', 0)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "crazy_dimensions" ("project_id", "slug", "name", "position", "used_in_docs", "default_value")
SELECT p."id", d."slug", d."name", d."position", true, d."default_value"
FROM "crazy_projects" p,
  (VALUES ('game', 'Game', 0, 'gothic-1'), ('renderer', 'Renderer', 1, 'gd3d11'))
    AS d("slug", "name", "position", "default_value")
WHERE p."slug" = 'trainer'
ON CONFLICT ("project_id", "slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "crazy_dimension_values" ("dimension_id", "slug", "label", "short", "description", "status", "position")
SELECT dim."id", v."slug", v."label", v."short", v."description", v."status", v."position"
FROM "crazy_dimensions" dim
JOIN "crazy_projects" p ON p."id" = dim."project_id" AND p."slug" = 'trainer'
JOIN (VALUES
    ('game', 'gothic-1', 'Gothic 1', 'G1', 'Steam · GothicMod 1.08k', 'available', 0),
    ('game', 'gothic-2', 'Gothic 2', 'G2', 'Night of the Raven', 'planned', 1),
    ('game', 'chronicles-of-myrtana', 'Chronicles of Myrtana', 'CM', 'Story mod for Gothic 2', 'later', 2),
    ('renderer', 'gd3d11', 'GD3D11', 'DX', 'DirectX 11 renderer', 'available', 0),
    ('renderer', 'original', 'Original', 'D7', 'The game''s own DirectX 7 renderer', 'planned', 1)
  ) AS v("dimension", "slug", "label", "short", "description", "status", "position")
  ON v."dimension" = dim."slug"
ON CONFLICT ("dimension_id", "slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "crazy_project_boards" ("project_id", "board_id")
SELECT p."id", b."id" FROM "crazy_projects" p, "boards" b
WHERE p."slug" = 'trainer' AND b."deleted_at" IS NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "crazy_changelog_projects" ("changelog_entry_id", "project_id")
SELECT c."id", p."id" FROM "changelog_entries" c, "crazy_projects" p
WHERE p."slug" = 'trainer'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Seed: role categories and roles. Permission keys: apps/web/src/lib/shared/crazy/permissions.ts.
INSERT INTO "crazy_role_categories" ("slug", "name", "exclusive", "position")
VALUES ('team', 'Team', true, 0), ('content', 'Content', false, 1), ('testing', 'Testing', true, 2)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "crazy_roles" ("category_id", "slug", "name", "scope", "permissions", "is_public", "requires_discord_mfa", "system", "position")
SELECT c."id", r."slug", r."name", r."scope", r."permissions", true, true, r."system", r."position"
FROM "crazy_role_categories" c
JOIN (VALUES
    ('team', 'owner', 'Owner', 'global', '["hub.owner","projects.manage","roles.manage","roles.assign","ideas.moderate","roadmap.manage","changelog.publish","docs.edit","docs.publish","downloads.manage","downloads.alpha"]'::jsonb, true, 0),
    ('team', 'admin', 'Admin', 'global', '["projects.manage","roles.manage","roles.assign","ideas.moderate","roadmap.manage","changelog.publish","docs.edit","docs.publish","downloads.manage","downloads.alpha"]'::jsonb, true, 1),
    ('team', 'moderator', 'Moderator', 'project', '["ideas.moderate","roadmap.manage","changelog.publish"]'::jsonb, false, 2),
    ('content', 'docs-editor', 'Docs editor', 'project', '["docs.edit","docs.publish"]'::jsonb, false, 0),
    ('testing', 'alpha-tester', 'Alpha tester', 'project', '["downloads.alpha"]'::jsonb, false, 0)
  ) AS r("category", "slug", "name", "scope", "permissions", "system", "position")
  ON r."category" = c."slug"
ON CONFLICT ("slug") DO NOTHING;
