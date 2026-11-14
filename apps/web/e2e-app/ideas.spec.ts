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
  await dialog.getByLabel('Description').fill('Posted by the end-to-end test.')
  await dialog.getByRole('button', { name: 'Post', exact: true }).click()

  await expect(page).toHaveURL(/\/trainer\/ideas\/post_/)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

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
