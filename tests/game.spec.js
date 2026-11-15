import { test, expect } from '@playwright/test'

// Neon Jump — Playwright checks for the Phaser page.
// Uses the window.NEON_JUMP hook for deterministic jumps; real pointer
// input is also exercised so touch/mouse regressions are caught.

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 15000 })
  await page.waitForFunction(() => window.NEON_JUMP, null, { timeout: 10000 })
})

test('loads without console errors and shows the start screen', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('./')
  await expect(page.locator('#overlay-start')).toBeVisible()
  await expect(page.locator('#btn-start')).toBeVisible()
  expect(errors).toEqual([])
})

test('start, charge with real pointer input, jump and land back safely', async ({ page }) => {
  await page.click('#btn-start')
  await expect(page.locator('#overlay-start')).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState())).toBe('idle')

  // Real pointer hold on the canvas: press, hold ~250ms, release.
  const box = await page.locator('#game-container canvas').boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.waitForTimeout(250)
  await expect(page.locator('#power-wrap')).toBeVisible()
  await page.mouse.up()
  // After release the ball is jumping or has landed again; it must not get stuck in charging.
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState())).not.toBe('charging')
})

test('deterministic jump lands on the next platform and scores +1', async ({ page }) => {
  await page.click('#btn-start')
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState())).toBe('idle')
  // First gap is fixed at 200px, same height. Power 26 flies ~229px,
  // landing ~29px off-centre: on the platform but not Perfect (see DESIGN.md).
  await page.evaluate(() => window.NEON_JUMP.forceNext(200, 0))
  await page.evaluate(() => window.NEON_JUMP.debugJump(26))
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState()), { timeout: 8000 }).toBe('idle')
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getScore())).toBe(1)
  await expect(page.locator('#score')).toHaveText('1')
})

test('perfect centre landing scores +2', async ({ page }) => {
  await page.click('#btn-start')
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState())).toBe('idle')
  // Power 20 flies ~206px on a 200px gap: ~6px off-centre, inside the
  // 12px Perfect window, so this calibrated jump scores +2.
  await page.evaluate(() => window.NEON_JUMP.forceNext(200, 0))
  await page.evaluate(() => window.NEON_JUMP.debugJump(20))
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState()), { timeout: 8000 }).toBe('idle')
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getScore())).toBe(2)
  await expect(page.locator('#score')).toHaveText('2')
})

test('a too-weak jump falls and shows game over, restart works', async ({ page }) => {
  await page.click('#btn-start')
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState())).toBe('idle')
  await page.evaluate(() => window.NEON_JUMP.forceNext(320, 0))
  await page.evaluate(() => window.NEON_JUMP.debugJump(5))
  // Generous timeout: headless SwiftShader can run well below 30fps,
  // which stretches game time (dt is clamped per frame).
  await expect(page.locator('#overlay-over')).toBeVisible({ timeout: 15000 })
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState()), { timeout: 15000 }).toBe('over')
  await page.click('#btn-restart')
  await expect.poll(() => page.evaluate(() => window.NEON_JUMP.getState())).toBe('idle')
  await expect(page.locator('#score')).toHaveText('0')
})

test('mobile viewport: no horizontal scroll, power bar and buttons usable', async ({ page }) => {
  await page.click('#btn-start')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
  await expect(page.locator('#btn-pause')).toBeVisible()
  await page.click('#btn-pause')
  await expect(page.locator('#overlay-pause')).toBeVisible()
  await page.click('#btn-resume')
  await expect(page.locator('#overlay-pause')).toBeHidden()
})
