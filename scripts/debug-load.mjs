import { chromium } from 'playwright-core'

const exe = '/home/hatch/workspace/.chrome-for-test/chrome-linux64/chrome'
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
const page = await browser.newPage()
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)))
page.on('pageerror', (e) => console.log('[pageerror]', (e.stack || String(e)).slice(0, 1200)))
page.on('requestfailed', (r) => console.log('[reqfail]', r.url().slice(0, 120), r.failure()?.errorText))
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
console.log('canvas:', await page.locator('#game-container canvas').count())
console.log('NEON_JUMP:', await page.evaluate(() => typeof window.NEON_JUMP))
console.log('__neonGame:', await page.evaluate(() => typeof window.__neonGame))
await browser.close()
