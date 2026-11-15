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

/**
 * Goes through the step-by-step form: kind, what it concerns, details (the idea's structured fields;
 * "What should it do?" is required), review.
 */
async function postIdea(
  page: import('@playwright/test').Page,
  title: string,
  what = 'Something useful.',
  why = ''
) {
  await page.getByRole('button', { name: 'Post an idea' }).click()
  const dialog = page.getByRole('dialog', { name: 'Post an idea' })
  await dialog.getByRole('radio', { name: /An idea/ }).click()
  await dialog.getByRole('button', { name: 'Next' }).click()
  await dialog.getByLabel('Title').fill(title)
  // the description is required: Next says so instead of moving on
  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog.getByText('Fill this in to continue.')).toBeVisible()
  await dialog.getByRole('textbox', { name: 'What should it do?' }).fill(what)
  if (why) await dialog.getByRole('textbox', { name: 'Why is it useful?' }).fill(why)
  await dialog.getByRole('button', { name: 'Next' }).click()
  // the review shows the title as a heading and the sections as text
  await expect(dialog.getByRole('heading', { name: title })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'What should it do?' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Post', exact: true }).click()
}

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
  const title = `E2E idea ${Date.now()}`
  await postIdea(page, title, 'Posted by the **end-to-end** test.\n\n- one\n- two', 'Saves time.')

  await expect(page).toHaveURL(/\/trainer\/ideas\/post_/)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  })
  // markdown is stored as rich text
  await expect(page.locator('article strong', { hasText: 'end-to-end' })).toBeVisible()
  await expect(page.locator('article li', { hasText: 'two' })).toBeVisible()
  // the structured fields are headed sections of the one text
  await expect(page.locator('article h2', { hasText: 'Why is it useful?' })).toBeVisible()

  // the author's upvote counts from the start; take it back, vote down (the score may go below
  // the upvotes), switch back up
  const score = page.getByTestId('idea-score').first()
  const before = Number(await score.innerText())
  await page.getByRole('button', { name: 'Remove your vote' }).click()
  await expect(score).toHaveText(String(before - 1))
  await page.getByRole('button', { name: 'Vote against this idea' }).click()
  await expect(score).toHaveText(String(before - 2))
  await expect(page.getByRole('button', { name: 'Remove your downvote' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  // a downvote replaces the upvote and back
  await page.getByRole('button', { name: 'Vote for this idea' }).click()
  await expect(score).toHaveText(String(before))
  await page.reload()
  await expect(page.getByTestId('idea-score').first()).toHaveText(String(before))
  await expect(page.getByRole('button', { name: 'Remove your vote' })).toBeVisible()

  // it's in the list, and search finds it
  await page.getByRole('link', { name: 'All ideas' }).click()
  // search is an icon until opened
  await page.getByRole('button', { name: 'Search ideas' }).click()
  await page.getByRole('searchbox', { name: 'Search ideas' }).fill(title)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()

  // filter by status: the choice shows as a chip under the toolbar and can be removed there
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Open' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Filters (1 active)' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  await page.getByRole('button', { name: 'Remove filter: Status: Open' }).click()
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
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
  const title = `E2E comments ${Date.now()}`
  await postIdea(page, title)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  })
  const url = page.url()

  await page.getByRole('textbox', { name: 'Comment' }).fill('First _comment_')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.locator('ol em', { hasText: 'comment' })).toBeVisible()

  // react to the comment and take the reaction back
  await page.getByRole('button', { name: 'Add a reaction' }).first().click()
  await page.getByRole('button', { name: '🎉' }).click()
  await expect(page.getByRole('button', { name: '🎉 1' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '🎉 1' }).click()
  await expect(page.getByRole('button', { name: '🎉 1' })).toBeHidden()

  // the author follows their idea from the start (Quackback subscribes authors); stop and follow again
  await page.getByRole('button', { name: 'Following this idea' }).click()
  await page.getByRole('menuitem', { name: 'Stop following' }).click()
  await expect(page.getByRole('button', { name: 'Follow this idea' })).toBeVisible()
  await page.getByRole('button', { name: 'Follow this idea' }).click()
  await page.getByRole('menuitem', { name: 'Status changes only' }).click()
  await expect(page.getByRole('button', { name: 'Following this idea' })).toBeVisible()

  // reply
  await page.getByRole('button', { name: 'Reply' }).first().click()
  await page.getByRole('textbox', { name: 'Comment' }).last().fill('A reply')
  await page.getByRole('button', { name: 'Reply', exact: true }).last().click()
  const replies = page.locator('ol ol')
  await expect(replies.getByText('A reply')).toBeVisible()
  // a reply to a reply stays at one level and says what it answers
  await replies.getByRole('button', { name: 'Reply' }).click()
  await page.getByRole('textbox', { name: 'Comment' }).last().fill('Reply to the reply')
  await page.getByRole('button', { name: 'Reply', exact: true }).last().click()
  await expect(replies.getByText('Reply to the reply')).toBeVisible()
  await expect(page.locator('ol ol ol')).toHaveCount(0)
  await expect(replies.getByRole('button', { name: /Comment Author A reply/ })).toBeVisible()
  // a thread collapses to its reply count and opens again
  await page.getByRole('button', { name: '2 replies' }).click()
  await expect(page.locator('ol ol')).toHaveCount(0)
  await page.getByRole('button', { name: '2 replies' }).click()
  await expect(replies.getByText('Reply to the reply')).toBeVisible()
  // the thread line folds it too
  await page.getByRole('button', { name: 'Hide or show the replies' }).click()
  await expect(page.locator('ol ol')).toHaveCount(0)
  await page.getByRole('button', { name: '2 replies' }).click()

  // edit the first reply, delete the last one
  await replies.getByRole('button', { name: 'Comment actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('textbox', { name: 'Edit' }).fill('An edited reply')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(replies.getByText('An edited reply').first()).toBeVisible()
  await replies.getByRole('button', { name: 'Comment actions' }).last().click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  // deleting a comment asks first
  await page
    .getByRole('alertdialog', { name: 'Delete this comment?' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText('Reply to the reply')).toBeHidden()
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

test('closing the form with changes asks first; deleting an idea leaves its page', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signUp(page, 'Idea Deleter')
  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Post an idea' }).click()
  const dialog = page.getByRole('dialog', { name: 'Post an idea' })
  await dialog.getByRole('radio', { name: /An idea/ }).click()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Discard your changes?' })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click()
  await expect(dialog).toBeHidden()

  const title = `E2E delete ${Date.now()}`
  await postIdea(page, title)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/trainer\/ideas$/)
  await expect(page.getByText(title)).toBeHidden()
})
