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
  // ⊖ on the thread line folds it to "2 replies", which opens it again
  await page.getByRole('button', { name: 'Hide replies' }).click()
  await expect(page.locator('ol ol')).toHaveCount(0)
  await page.getByRole('button', { name: '2 replies' }).click()
  await expect(replies.getByText('Reply to the reply')).toBeVisible()
  // the thread line folds it too
  await page.getByRole('button', { name: 'Hide replies' }).click()
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

  // the profile counts the comment and the reply and lists them with what was written
  await page.getByRole('link', { name: 'Comment Author' }).first().click()
  await expect(page).toHaveURL(/\/u\/principal_/)
  // the first visit compiles the route on the dev server
  await expect(page.getByRole('heading', { level: 1, name: /Comment Author/ })).toBeVisible({
    timeout: 20_000,
  })
  const activity = page.getByRole('list').filter({ hasText: 'Replied in' })
  await expect(activity.getByText('An edited reply')).toBeVisible()
  await expect(activity.getByText('Commented on')).toBeVisible()
  await expect(activity.getByText('Posted an idea')).toBeVisible()
  await expect(page.getByText('Comments', { exact: true }).locator('..')).toContainText('2')
  await page.goto(url)

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
  // the moderation panel waits for the permission check
  await expect(mod.getByRole('region', { name: 'Moderation' })).toBeVisible({ timeout: 15_000 })
  // remove the author's comment
  await mod.getByRole('button', { name: 'Comment actions' }).first().click()
  await mod.getByRole('menuitem', { name: 'Remove comment' }).click()
  // a removed comment without replies disappears for everyone outside Quackback's team
  await expect(mod.getByText('First comment')).toBeHidden()
  // lock comments
  // the moderation panel on the right: move the idea to another board, then lock comments
  await mod.getByRole('combobox', { name: 'Board' }).click()
  await mod.getByRole('option', { selected: false }).first().click()
  await expect(mod.getByText('Idea moved.')).toBeVisible()
  await mod.getByRole('switch', { name: 'Lock comments' }).click()
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

test('mention someone in a comment: suggestions, a profile link and a notification', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  // the person to mention, with a name nobody else has; they posted an idea (a profile without any
  // activity stays hidden, as in Quackback)
  const token = Date.now().toString(36)
  const name = `Mentionee ${token}`
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await signUp(otherPage, name)
  await otherPage.goto('/trainer/ideas')
  await otherPage.waitForLoadState('networkidle')
  await postIdea(otherPage, `E2E mentionee ${token}`)
  await expect(otherPage).toHaveURL(/\/trainer\/ideas\/post_/, { timeout: 15_000 })
  await other.close()

  await signUp(page, 'Mention Author')
  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  const title = `E2E mentions ${Date.now()}`
  await postIdea(page, title)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  })

  // typing @ and part of the name lists the person; Enter picks them
  const composer = page.locator('textarea[aria-label="Comment"]')
  await composer.click()
  await composer.pressSequentially(`Thanks @mentionee ${token}`)
  const option = page.getByRole('option', { name })
  await expect(option).toBeVisible()
  await expect(composer).toHaveAttribute('aria-expanded', 'true')
  await composer.press('Enter')
  await expect(composer).toHaveValue(new RegExp(`^Thanks \\[@${name}\\]\\(/u/principal_\\w+\\) $`))
  await expect(page.getByRole('listbox', { name: 'People' })).toBeHidden()
  await composer.pressSequentially('for the idea')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()

  // the posted comment links to the profile
  const mention = page.locator('ol a.mention', { hasText: `@${name}` })
  await expect(mention).toBeVisible()
  await expect(mention).toHaveAttribute('href', /^\/u\/principal_/)
  await mention.click()
  await expect(page).toHaveURL(/\/u\/principal_/)
  await expect(page.getByRole('heading', { name })).toBeVisible()

  // the mentioned person got an in-app notification, once
  await expect
    .poll(
      async () =>
        (
          await sql`
            select count(*)::int as n from in_app_notifications n
            join principal p on p.id = n.principal_id
            where p.display_name = ${name} and n.type = 'comment_mentioned'`
        )[0]?.n
    )
    .toBe(1)
})

test('public role badges next to names; a role that needs Discord 2FA stays hidden without it', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const token = Date.now().toString(36)
  const name = `Badge Person ${token}`
  await signUp(page, name)
  // two public global roles: one without the Discord requirement, one with it (not met here)
  await sql`
    insert into crazy_roles (category_id, slug, name, scope, is_public, requires_discord_mfa, position)
    select id, ${`e2e-supporter-${token}`}, ${`Supporter ${token}`}, 'global', true, false, 90
    from crazy_role_categories where slug = 'testing'`
  await sql`
    insert into crazy_roles (category_id, slug, name, scope, is_public, requires_discord_mfa, position)
    select id, ${`e2e-veteran-${token}`}, ${`Veteran ${token}`}, 'global', true, true, 91
    from crazy_role_categories where slug = 'testing'`
  await sql`
    insert into crazy_role_assignments (role_id, principal_id)
    select r.id, p.id from crazy_roles r, principal p
    where r.slug in (${`e2e-supporter-${token}`}, ${`e2e-veteran-${token}`})
      and p.display_name = ${name}`

  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  const title = `E2E badges ${Date.now()}`
  await postIdea(page, title)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  })
  await page.locator('textarea[aria-label="Comment"]').fill('A comment with a badge.')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('A comment with a badge.')).toBeVisible()

  // by the idea's author and by the comment's author
  await expect(page.locator(`[data-role-badge="e2e-supporter-${token}"]`)).toHaveCount(2)
  await expect(page.locator(`[data-role-badge="e2e-veteran-${token}"]`)).toHaveCount(0)
})

test('held for review: an idea and a comment with a link wait for a moderator, and say so', async ({
  page,
}) => {
  test.setTimeout(90_000)
  // the workspace holds posts and comments with external links (settings are cached for 5s)
  const [before] = await sql`select portal_config from settings limit 1`
  const config = JSON.parse(before?.portal_config || '{}')
  const held = {
    ...config,
    moderationDefault: { requireApproval: 'none', ...config.moderationDefault, holdLinks: true },
  }
  const reset = async (value: string | null) => {
    await sql`update settings set portal_config = ${value}`
    await sql`delete from kv_store where key like 'settings:%'`
  }
  await reset(JSON.stringify(held))
  try {
    await page.waitForTimeout(6_000)
    await signUp(page, 'Held Author')
    await page.goto('/trainer/ideas')
    await page.waitForLoadState('networkidle')
    const title = `E2E held ${Date.now()}`
    await postIdea(page, title, 'See https://example.com/held for details.')
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('article').getByText('Waiting for review').first()).toBeVisible()

    await page.locator('textarea[aria-label="Comment"]').fill('More at https://example.com/more')
    await page.getByRole('button', { name: 'Comment', exact: true }).click()
    const comment = page.locator('li', { hasText: 'More at' }).first()
    await expect(comment.getByText('Waiting for review')).toBeVisible()
  } finally {
    await reset(before?.portal_config ?? null)
  }
})

test('similar ideas show while the title is written (any word matches)', async ({ page }) => {
  test.setTimeout(60_000)
  await signUp(page, 'Similar Writer')
  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Post an idea' }).click()
  const dialog = page.getByRole('dialog', { name: 'Post an idea' })
  await dialog.getByRole('radio', { name: /An idea/ }).click()
  await dialog.getByRole('button', { name: 'Next' }).click()
  // the demo seed has "Slack integration"
  await dialog.getByLabel('Title').fill('Slack notifications')
  await expect(dialog.getByText('Similar ideas: maybe yours is already here')).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Slack integration/ }).first()).toBeVisible()
})

test('a moderator merges a duplicate into the first idea and unmerges it', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  const token = `zq${Date.now().toString(36)}`
  await signUp(page, 'Merge Author')
  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  const first = `E2E first ${token} teleport`
  await postIdea(page, first)
  await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible({
    timeout: 15_000,
  })
  const firstUrl = page.url()
  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  const second = `E2E second ${token} teleport`
  await postIdea(page, second)
  await expect(page.getByRole('heading', { level: 1, name: second })).toBeVisible({
    timeout: 15_000,
  })
  const secondUrl = page.url()

  // a moderator of the trainer (the seeded Moderator role carries ideas.merge; Discord faked)
  const mod = await browser.newPage()
  const modEmail = await signUp(mod, 'Merge Moderator')
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

  // merge the second idea into the first: the search lists the older idea
  await mod.goto(secondUrl)
  await mod.waitForLoadState('networkidle')
  await expect(mod.getByRole('region', { name: 'Moderation' })).toBeVisible({ timeout: 15_000 })
  await mod.getByRole('button', { name: 'Merge into…' }).click()
  const dialog = mod.getByRole('dialog', { name: 'Merge into another idea' })
  await dialog.getByRole('searchbox').fill(token)
  await dialog.getByRole('radio', { name: new RegExp(first) }).click()
  await dialog.getByRole('button', { name: 'Merge', exact: true }).click()
  await expect(dialog).toBeHidden()
  // the duplicate says where it went; its comments continue there
  await expect(mod.getByRole('link', { name: first })).toBeVisible()
  await expect(mod.getByText('Comments are locked.')).toBeVisible()

  // the first idea lists it; the list no longer shows the duplicate
  await mod.goto(firstUrl)
  await expect(mod.getByRole('heading', { name: /Merged ideas/ })).toBeVisible()
  await expect(mod.getByRole('link', { name: new RegExp(second) })).toBeVisible()
  await mod.goto('/trainer/ideas')
  await mod.waitForLoadState('networkidle')
  await mod.getByRole('button', { name: 'Search ideas' }).click()
  await mod.getByRole('searchbox', { name: 'Search ideas' }).fill(token)
  await expect(mod.getByRole('link', { name: new RegExp(first) })).toBeVisible()
  await expect(mod.getByRole('link', { name: new RegExp(second) })).toBeHidden()

  // unmerge from the first idea's list
  await mod.goto(firstUrl)
  await mod.getByRole('button', { name: 'Unmerge' }).click()
  await expect(mod.getByText('The idea stands on its own again.')).toBeVisible()
  await expect(mod.getByRole('heading', { name: /Merged ideas/ })).toBeHidden()
  await mod.goto(secondUrl)
  await expect(mod.getByRole('link', { name: first })).toBeHidden()
  await mod.close()
})
