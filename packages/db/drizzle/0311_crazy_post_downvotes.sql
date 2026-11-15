-- crazy-hub (#5): downvotes of ideas. Additive and replay-safe; Quackback's posts table is untouched.
CREATE TABLE IF NOT EXISTS "crazy_post_downvotes" (
  "post_id" uuid NOT NULL CONSTRAINT "crazy_post_downvotes_post_id_posts_id_fk" REFERENCES "posts"("id") ON DELETE CASCADE,
  "principal_id" uuid NOT NULL CONSTRAINT "crazy_post_downvotes_principal_id_principal_id_fk" REFERENCES "principal"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "crazy_post_downvotes_post_id_principal_id_pk" PRIMARY KEY ("post_id", "principal_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crazy_post_downvotes_principal_idx" ON "crazy_post_downvotes" ("principal_id");
