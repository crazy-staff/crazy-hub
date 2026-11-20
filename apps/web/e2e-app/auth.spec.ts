import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

/** The "Sign in" button in the panel's top bar. */
const signInButton = (page: Page) =>
  page.locator('main header').getByRole('button', { name: 'Sign in' })

/** Main path #4: sign up, sign out, sign in (password), and the guard's redirect back. */
test('sign up, sign out and sign in again', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  const password = 'e2e-password-123'

  await page.goto('/trainer/ideas')
  await signInButton(page).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/auth=signin/)

  // sign up
  await dialog.getByRole('tab', { name: 'Create account' }).click()
  await dialog.getByLabel('Name').fill('E2E Tester')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password').fill(password)
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/trainer\/ideas$/)
  await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('E2E Tester')

  // sign out
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(signInButton(page)).toBeVisible()

  // wrong password, then the right one
  await signInButton(page).click()
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password').fill('nope-nope-nope')
  await dialog.getByRole('button', { name: 'Sign in' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByLabel('Password').fill(password)
  await dialog.getByRole('button', { name: 'Sign in' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('E2E Tester')
})

test('the team guard sends visitors to sign in and back', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/auth=signin/)
  await expect(page).toHaveURL(/callbackUrl=%2Fadmin/)
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('dialog').getByLabel('Email').fill('demo@example.com')
  await page.getByRole('dialog').getByLabel('Password').fill('password')
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
})

test('old /auth/login links open the dialog', async ({ page }) => {
  await page.goto('/auth/login?callbackUrl=/trainer/docs')
  await expect(page).toHaveURL(/auth=signin/)
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('sign in again when the session ends: the dialog opens over the page and keeps the draft', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const sql = postgres(
    process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/quackback',
    { max: 1, onnotice: () => {} }
  )
  try {
    await sql`
      insert into crazy_project_boards (project_id, board_id)
      select p.id, b.id from crazy_projects p, boards b
      where p.slug = 'trainer' and b.deleted_at is null
      on conflict do nothing`
    const email = `e2e-again-${Date.now()}@example.com`
    await page.goto('/?auth=signup')
    const signup = page.getByRole('dialog')
    await signup.getByLabel('Name').fill('Again Person')
    await signup.getByLabel('Email').fill(email)
    await signup.getByLabel('Password').fill('e2e-password-123')
    await signup.getByRole('button', { name: 'Create account' }).click()
    await expect(signup).toBeHidden()

    // open an idea and start a comment
    await page.goto('/trainer/ideas')
    await page.waitForLoadState('networkidle')
    await page.locator('a[href*="/trainer/ideas/post_"]').first().click()
    await expect(page).toHaveURL(/\/trainer\/ideas\/post_/)
    const composer = page.locator('textarea[aria-label="Comment"]')
    await composer.fill('Written before the session ended')

    // the session ends (signed out elsewhere, expired)
    await sql`delete from session where user_id = (select id from "user" where email = ${email})`

    // posting fails for want of a session: "sign in again" opens with the e-mail filled in
    await page.getByRole('button', { name: 'Comment', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Sign in again', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Email')).toHaveValue(email)
    await expect(dialog.getByRole('tab', { name: 'Create account' })).toBeHidden()
    await dialog.getByLabel('Password').fill('e2e-password-123')
    await dialog.getByRole('button', { name: 'Sign in' }).click()
    await expect(dialog).toBeHidden()

    // same page, the draft is still there and now posts
    await expect(page).toHaveURL(/\/trainer\/ideas\/post_[^?]*$/)
    await expect(composer).toHaveValue('Written before the session ended')
    await page.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(page.getByText('Written before the session ended').last()).toBeVisible()
    await expect(composer).toHaveValue('')
  } finally {
    await sql.end()
  }
})
