import { expect, test } from '@playwright/test'
import postgres from 'postgres'

/**
 * Main path #5: post an idea and vote on it. CI seeds the demo boards after the migrations, so the
 * test links them to the trainer first (as the admin would in /admin/projects).
 */
const sql = postgres(
  process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/quackback',
  { max: 1, onnotice: () => {} }
)

test.beforeAll(async () => {
  await sql`
    insert into crazy_project_boards (project_id, board_id)
    select p.id, b.id from crazy_projects p, boards b
    where p.slug = 'trainer' and b.deleted_at is null
    on conflict do nothing`
})

test.afterAll(async () => {
  await sql.end()
})

async function signUp(page: import('@playwright/test').Page, name: string) {
  const email = `e2e-${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}@example.com`
  await page.goto('/?auth=signup')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password').fill('e2e-password-123')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(dialog).toBeHidden()
  return email
}

test('post an idea and vote on it', async ({ page }) => {
  test.setTimeout(60_000)
  const email = `e2e-ideas-${Date.now()}@example.com`
  await page.goto('/?auth=signup')
  const signup = page.getByRole('dialog')
  await signup.getByLabel('Name').fill('Idea Person')
  await signup.getByLabel('Email').fill(email)
  await signup.getByLabel('Password').fill('e2e-password-123')
  await signup.getByRole('button', { name: 'Create account' }).click()
  await expect(signup).toBeHidden()

  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Post an idea' }).click()
  const dialog = page.getByRole('dialog', { name: 'Post an idea' })
  const title = `E2E idea ${Date.now()}`
  await dialog.getByLabel('Title').fill(title)
  await dialog
    .getByRole('textbox', { name: 'Description' })
    .fill('Posted by the **end-to-end** test.\n\n- one\n- two')
  await dialog.getByRole('button', { name: 'Post', exact: true }).click()

  await expect(page).toHaveURL(/\/trainer\/ideas\/post_/)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  })
  // markdown is stored as rich text
  await expect(page.locator('article strong', { hasText: 'end-to-end' })).toBeVisible()
  await expect(page.locator('article li', { hasText: 'two' })).toBeVisible()

  // the author's vote counts from the start; take it back and give it again
  const vote = page.getByRole('button', { name: /vote/i }).first()
  const before = Number(await vote.innerText())
  await vote.click()
  await expect(vote).not.toHaveText(String(before))
  await vote.click()
  await expect(vote).toHaveText(String(before))

  // it's in the list, and search finds it
  await page.getByRole('link', { name: 'All ideas' }).click()
  await page.getByRole('searchbox', { name: 'Search ideas' }).fill(title)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
})

test('comment, reply, edit and delete; a moderator removes a comment and locks comments', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000)
  // an author posts an idea and a comment
  const authorEmail = await signUp(page, 'Comment Author')
  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Post an idea' }).click()
  const title = `E2E comments ${Date.now()}`
  const post = page.getByRole('dialog', { name: 'Post an idea' })
  await post.getByLabel('Title').fill(title)
  await post.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  })
  const url = page.url()

  await page.getByRole('textbox', { name: 'Comment' }).fill('First _comment_')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.locator('ol em', { hasText: 'comment' })).toBeVisible()

  // reply
  await page.getByRole('button', { name: 'Reply' }).first().click()
  await page.getByRole('textbox', { name: 'Comment' }).last().fill('A reply')
  await page.getByRole('button', { name: 'Reply', exact: true }).last().click()
  const replies = page.locator('ol ol')
  await expect(replies.getByText('A reply')).toBeVisible()

  // edit and delete the reply
  await replies.getByRole('button', { name: 'Comment actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('textbox', { name: 'Edit' }).fill('An edited reply')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(replies.getByText('An edited reply')).toBeVisible()
  await replies.getByRole('button', { name: 'Comment actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByText('An edited reply')).toBeHidden()
  await expect(page.getByText('First comment')).toBeVisible()

  // a moderator of the trainer (role given in the database, Discord faked)
  const mod = await browser.newPage()
  const modEmail = await signUp(mod, 'Idea Moderator')
  const [user] =
    await sql`select u.id as user_id, p.id as principal_id from "user" u join principal p on p.user_id = u.id where u.email = ${modEmail}`
  const [account] = await sql`
    insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
    values (gen_random_uuid(), ${'e2e-' + user.user_id}, 'discord', ${user.user_id}, now(), now())
    returning updated_at`
  await sql`
    insert into crazy_discord_mfa (user_id, discord_account_id, mfa_enabled, checked_at, account_updated_at)
    values (${user.user_id}, ${'e2e-' + user.user_id}, true, now(), ${account.updated_at})`
  await sql`
    insert into crazy_role_assignments (role_id, principal_id, project_id)
    select r.id, ${user.principal_id}, p.id from crazy_roles r, crazy_projects p
    where r.slug = 'moderator' and p.slug = 'trainer'`

  await mod.goto(url)
  await mod.waitForLoadState('networkidle')
  await expect(mod.getByText('Moderation')).toBeVisible()
  // remove the author's comment
  await mod.getByRole('button', { name: 'Comment actions' }).first().click()
  await mod.getByRole('menuitem', { name: 'Remove comment' }).click()
  // a removed comment without replies disappears for everyone outside Quackback's team
  await expect(mod.getByText('First comment')).toBeHidden()
  // lock comments
  await mod.getByRole('button', { name: 'Lock comments' }).click()
  await expect(mod.getByText('Comments are locked.')).toBeVisible()
  await mod.close()
  expect(authorEmail).toContain('@')
})
