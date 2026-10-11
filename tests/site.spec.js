import { readdirSync, readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Same page list as vite.config.js.
const PAGES = [...readdirSync('.').filter(f => f.endsWith('.html')), 'chai-khana/index.html']

// Known third-party failures that aren't bugs in this repo. Keep this list short and explained.
const KNOWN_FAILURES = [
  /loremflickr\.com/, // Chai Khana placeholder photos, waiting on real images
]

// Pages that render WebGL (three.js) scenes. With several test workers rendering WebGL in software, the
// accessibility scan on these can take longer than the default 30 s, so that test gets more time.
const HEAVY_3D = PAGES.filter(f => /THREE\.|WebGLRenderer|getContext\(['"]webgl/.test(readFileSync(f, 'utf8')))

for (const page of PAGES) {
  test.describe(page, () => {
    test('loads without script errors or failed requests', async ({ page: p }) => {
      const problems = []
      p.on('pageerror', e => problems.push(`script error: ${e.message}`))
      p.on('requestfailed', r => {
        const reason = r.failure()?.errorText ?? ''
        if (!reason.includes('ERR_ABORTED') && !KNOWN_FAILURES.some(re => re.test(r.url()))) problems.push(`request failed: ${r.url()} (${reason})`)
      })
      p.on('response', r => {
        if (r.status() >= 400 && !KNOWN_FAILURES.some(re => re.test(r.url()))) problems.push(`HTTP ${r.status()}: ${r.url()}`)
      })
      await p.goto(page, { waitUntil: 'load' })
      await p.waitForTimeout(1500)
      expect(problems).toEqual([])
    })

    test('has no serious accessibility violations', async ({ page: p }) => {
      if (HEAVY_3D.includes(page)) test.setTimeout(90_000)
      await p.goto(page, { waitUntil: 'load' })
      await p.waitForTimeout(1000)
      const { violations } = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze()
      const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
    })

    test('does not scroll sideways on a phone', async ({ page: p }) => {
      await p.setViewportSize({ width: 390, height: 844 })
      await p.goto(page, { waitUntil: 'load' })
      await p.waitForTimeout(800)
      const { scrollWidth, clientWidth } = await p.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
    })
  })
}

test('every canonical URL points at its own page', () => {
  const base = 'https://hassansaeed14.github.io/brightstack-portfolio/'
  for (const page of PAGES) {
    const canonical = readFileSync(page, 'utf8').match(/<link rel="canonical" href="([^"]+)"/)?.[1]
    if (!canonical) continue // r3f-demo.html is noindex
    const expected = page === 'index.html' ? base : base + page.replace(/index\.html$/, '')
    expect(canonical === expected || canonical === base + page, `${page} -> ${canonical}`).toBe(true)
  }
})

test.describe('home page', () => {
  test('nav links land exactly on their sections', async ({ page }) => {
    await page.goto('index.html', { waitUntil: 'load' })
    await page.waitForTimeout(2500)
    for (const id of ['collections', 'projects']) {
      await page.click(`nav a[href="#${id}"]`)
      await page.waitForTimeout(2500)
      const offset = await page.evaluate(id => {
        let y = 0
        for (let n = document.getElementById(id); n; n = n.offsetParent) y += n.offsetTop
        return Math.round(scrollY - y)
      }, id)
      expect(Math.abs(offset), `#${id}`).toBeLessThanOrEqual(2)
    }
  })

  test('downloads the Spline viewer only when the visitor clicks "Spline"', async ({ page }) => {
    const requests = []
    // Serve an empty stub so the test doesn't depend on the CDN: only whether it's requested matters.
    await page.route(/spline-viewer/, route => { requests.push(route.request().url()); return route.fulfill({ contentType: 'text/javascript', body: '' }) })
    await page.goto('index.html', { waitUntil: 'load' })
    // Wait well past when the old idle prefetch fired (about 5.5 s after load).
    await page.waitForTimeout(8000)
    expect(requests).toEqual([])
    await page.click('button[data-scene="spline"]')
    await expect.poll(() => requests.length).toBe(1)
  })

  test('turns smooth scrolling off for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('index.html', { waitUntil: 'load' })
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => document.documentElement.classList.contains('lenis'))).toBe(false)
  })
})

test('Nexora converter shows USD to PKR from the rates API', async ({ page }) => {
  // Serve a fixed rate so the test doesn't depend on today's exchange rate or the network.
  await page.route(/currency-api/, route => route.fulfill({ json: { date: '2026-01-01', usd: { pkr: 280, eur: 0.9 } } }))
  await page.goto('nexora-flagship-project.html', { waitUntil: 'load' })
  await expect(page.locator('#apiResult')).toContainText('2,500.00 USD = 700,000.00 PKR')
  await expect(page.locator('#apiResult')).toContainText('2026-01-01')
})

test('churn model page loads Python only when training starts', async ({ page }) => {
  const pyodide = []
  page.on('request', r => { if (r.url().includes('pyodide')) pyodide.push(r.url()) })
  await page.goto('churn-risk-model.html', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  expect(pyodide).toEqual([])
  await expect(page.locator('#trainBtn')).toBeEnabled()
})
