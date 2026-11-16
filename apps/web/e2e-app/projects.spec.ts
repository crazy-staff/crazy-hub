import { expect, test } from '@playwright/test'

// Projects come from the database (decision 13); the migration seeds the trainer.
test('the sidebar shows the project picker and the project sections', async ({ page }) => {
  await page.goto('/trainer/roadmap')
  const nav = page.getByRole('complementary', { name: 'Main navigation' })
  await expect(nav.getByRole('button', { name: /Crazy Gothic Trainer/ })).toBeVisible()
  for (const section of ['Ideas', 'Roadmap', 'Changelog', 'Docs', 'Downloads']) {
    await expect(nav.getByRole('link', { name: section })).toBeVisible()
  }
  // the docs' game and renderer moved out of the sidebar (#14)
  await expect(nav.getByText('Renderer')).toHaveCount(0)
})

test('an unknown project is a 404', async ({ page }) => {
  const response = await page.goto('/no-such-project/ideas')
  expect(response?.status()).toBe(404)
})

// On a phone the menu opens from the bottom right and small menus open as drawers (round 7).
test('phone: the menu button and the language drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/trainer/ideas')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Open sidebar' }).click()
  await expect(page.getByRole('dialog', { name: 'Main navigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Language' }).click()
  const drawer = page.getByRole('dialog', { name: 'Language' })
  await expect(drawer.getByRole('button', { name: 'Polski' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})
