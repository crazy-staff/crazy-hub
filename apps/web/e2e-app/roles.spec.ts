import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

/**
 * Projects and roles (#22, decision 13). Discord can't be reached from a test, so the Discord account
 * and its cached 2FA answer are written straight into the test database (the live check fails and
 * keeps the cached answer, as on a Discord outage). Runs against the demo seed: demo@example.com is
 * the workspace admin. Clears every role assignment first, so the Owner can be claimed.
 */
const sql = postgres(
  process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/quackback',
  { max: 1, onnotice: () => {} }
)

test.afterAll(async () => {
  await sql.end()
})

/** Links a fake Discord account to the user, with 2FA on or off. */
async function linkDiscord(email: string, mfa: boolean) {
  const [user] = await sql`select id from "user" where email = ${email}`
  const discordId = `e2e-${user.id}`
  await sql`delete from account where user_id = ${user.id} and provider_id = 'discord'`
  const [account] = await sql`
    insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
    values (gen_random_uuid(), ${discordId}, 'discord', ${user.id}, now(), now())
    returning updated_at`
  await sql`
    insert into crazy_discord_mfa (user_id, discord_account_id, mfa_enabled, checked_at, account_updated_at)
    values (${user.id}, ${discordId}, ${mfa}, now(), ${account.updated_at})
    on conflict (user_id) do update set discord_account_id = excluded.discord_account_id,
      mfa_enabled = excluded.mfa_enabled, checked_at = now(), account_updated_at = excluded.account_updated_at`
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/?auth=signin')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password').fill(password)
  await dialog.getByRole('button', { name: 'Sign in' }).click()
  await expect(dialog).toBeHidden()
}

test('claim the Owner, give a project role (Discord with 2FA required), edit a project', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  await sql`delete from crazy_role_assignments`

  // someone to give a role to
  const modEmail = `e2e-mod-${Date.now()}@example.com`
  const signup = await browser.newPage()
  await signup.goto('/?auth=signup')
  const form = signup.getByRole('dialog')
  await form.getByLabel('Name').fill('Mod Person')
  await form.getByLabel('Email').fill(modEmail)
  await form.getByLabel('Password').fill('e2e-password-123')
  await form.getByRole('button', { name: 'Create account' }).click()
  await expect(form).toBeHidden()
  await signup.close()

  await linkDiscord('demo@example.com', true)
  await signIn(page, 'demo@example.com', 'password')

  // nobody is the Owner yet: the workspace admin claims it
  await page.goto('/admin/roles')
  // wait for hydration before clicking server-rendered buttons
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Nobody is the Owner yet')).toBeVisible()
  await page.getByRole('button', { name: 'Become the Owner' }).click()
  await expect(page.getByText('Nobody is the Owner yet')).toBeHidden()
  await expect(page.getByText('Owner', { exact: true }).first()).toBeVisible()

  const give = async () => {
    await page.getByRole('button', { name: 'Give a role' }).click()
    const dialog = page.getByRole('dialog', { name: 'Give a role' })
    await dialog.getByPlaceholder('Search by name or email').fill(modEmail)
    await dialog.getByRole('option', { name: /Mod Person/ }).click()
    await dialog.getByRole('combobox', { name: 'Role' }).click()
    await page.getByRole('option', { name: 'Team · Moderator' }).click()
    await dialog.getByRole('button', { name: 'Give a role' }).click()
    return dialog
  }

  // without Discord the role can't be given
  const refused = await give()
  await expect(refused.getByRole('alert')).toContainText('no Discord account')
  await refused.getByRole('button', { name: 'Cancel' }).click()

  // with Discord and 2FA it can
  await linkDiscord(modEmail, true)
  const given = await give()
  await expect(given).toBeHidden()
  await expect(page.getByText('Moderator · Crazy Gothic Trainer')).toBeVisible()

  // 2FA off suspends it (the next read of the person sees the cached answer)
  await linkDiscord(modEmail, false)
  await page.reload()
  await expect(page.getByText('Moderator · Crazy Gothic Trainer')).toBeVisible()
  await expect(page.getByText('· suspended')).toBeVisible()

  // as the Owner, edit a project: add and remove a dimension value (one sign-in for both parts:
  // sign-ins are rate limited)
  await page.goto('/admin/projects')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: /Crazy Gothic Trainer/ }).click()
  await page.getByRole('tab', { name: 'Dimensions' }).click()

  const game = page
    .locator('div')
    .filter({ has: page.getByText('Game', { exact: true }) })
    .first()
  await game.getByRole('button', { name: 'Add value' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add value' })
  await dialog.getByLabel('Label').fill('Gothic 3')
  await dialog.getByLabel('Badge').fill('G3')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('gothic-3')).toBeVisible()

  const row = page
    .locator('div')
    .filter({ hasText: /^G3Gothic 3/ })
    .last()
  await row.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('gothic-3')).toBeHidden()

  // a new board is created from the project's Boards tab and linked to it
  const boardName = `E2E board ${Date.now()}`
  await page.getByRole('tab', { name: 'Boards' }).click()
  await page.getByRole('button', { name: 'New board' }).click()
  const boardDialog = page.getByRole('dialog', { name: 'New board' })
  await boardDialog.getByLabel('Name').fill(boardName)
  await boardDialog.getByRole('button', { name: 'New board' }).click()
  await expect(boardDialog).toBeHidden()
  await expect(page.getByRole('checkbox', { name: new RegExp(boardName) })).toBeChecked()
  const [linked] = await sql`
    select count(*)::int as n from crazy_project_boards pb join boards b on b.id = pb.board_id
    where b.name = ${boardName}`
  expect(linked.n).toBe(1)
})
