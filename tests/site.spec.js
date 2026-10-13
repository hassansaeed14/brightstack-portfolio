import { readdirSync, readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Same page list as vite.config.js.
const PAGES = [...readdirSync('.').filter(f => f.endsWith('.html')), 'chai-khana/index.html']

// Known third-party failures that aren't bugs in this repo. Keep this list short and explained.
const KNOWN_FAILURES = []

// While other test workers render the site's WebGL (three.js) pages in software, an accessibility scan
// can take longer than the default 30 s, on those pages and on any page tested alongside them (seen on
// vantage-autonomous-agent, which has no 3D itself), so every accessibility test gets more time.
const ACCESSIBILITY_TIMEOUT = 90_000

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
      test.setTimeout(ACCESSIBILITY_TIMEOUT)
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

// Tablet widths, where layouts switch between their phone and desktop versions.
for (const page of ['index.html', 'chai-khana/index.html']) {
  for (const width of [768, 1024]) {
    test(`${page} does not scroll sideways at ${width}px`, async ({ page: p }) => {
      await p.setViewportSize({ width, height: 900 })
      await p.goto(page, { waitUntil: 'load' })
      await p.waitForTimeout(800)
      const { scrollWidth, clientWidth } = await p.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
    })
  }
}

test.describe('home page', () => {
  // The scroll tests wait on the page's state instead of fixed pauses: for smooth scrolling (Lenis) to be ready,
  // then for each scroll to land or settle. While other workers render the WebGL pages, loading the home page and
  // the smooth scroll itself can be very slow, so these waits allow up to 30 s and the tests get more time overall.
  const SCROLL_WAIT = 30_000
  const SCROLL_TEST_TIMEOUT = 90_000
  const waitForSmoothScroll = page => expect(page.locator('html')).toHaveClass(/(^|\s)lenis(\s|$)/, { timeout: SCROLL_WAIT })
  // Settled means the position has stopped changing and Lenis has finished handling the scroll (it removes
  // its lenis-scrolling class), so its idea of the scroll position matches the page's.
  const waitForScrollToSettle = async page => {
    let last = NaN
    await expect.poll(async () => {
      const { y, lenisBusy } = await page.evaluate(() => ({ y: scrollY, lenisBusy: document.documentElement.classList.contains('lenis-scrolling') }))
      const settled = y === last && !lenisBusy
      last = y
      return settled
    }, { intervals: [250], timeout: SCROLL_WAIT }).toBe(true)
  }

  test('nav links land exactly on their sections', async ({ page }) => {
    test.setTimeout(SCROLL_TEST_TIMEOUT)
    await page.goto('index.html', { waitUntil: 'load' })
    await waitForSmoothScroll(page)
    for (const id of ['collections', 'projects']) {
      await page.click(`nav a[href="#${id}"]`)
      await expect.poll(() => page.evaluate(id => {
        let y = 0
        for (let n = document.getElementById(id); n; n = n.offsetParent) y += n.offsetTop
        return Math.abs(Math.round(scrollY - y))
      }, id), { message: `#${id}`, timeout: SCROLL_WAIT }).toBeLessThanOrEqual(2)
      await waitForScrollToSettle(page)
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

  // #contact is the last section, so the page may not scroll far enough to put it at the very top:
  // these check that the section is brought into view instead. Waiting for the scroll to settle before jumping
  // back to the top means a smooth scroll still running can't carry the page back down to #contact.
  test('the nav "Contact" link and "Start a conversation" both reach the contact section', async ({ page }) => {
    test.setTimeout(SCROLL_TEST_TIMEOUT)
    await page.goto('index.html', { waitUntil: 'load' })
    await waitForSmoothScroll(page)
    const heading = page.getByRole('heading', { name: "Let's talk about your project." })
    await page.click('nav a[href="#contact"]')
    await expect(heading).toBeInViewport({ timeout: SCROLL_WAIT })
    await waitForScrollToSettle(page)
    await page.evaluate(() => scrollTo(0, 0))
    await waitForScrollToSettle(page)
    await expect(heading).not.toBeInViewport()
    // Bring the button into view and let that scroll settle before clicking. Clicking in the same frame as the
    // jump to the button starts the smooth scroll from a stale position, and it stops short of #contact.
    const cta = page.getByRole('link', { name: /Start a conversation/ })
    await cta.scrollIntoViewIfNeeded()
    await waitForScrollToSettle(page)
    await cta.click()
    await expect(heading).toBeInViewport({ timeout: SCROLL_WAIT })
  })

  test('the phone menu "Contact" link reaches the contact section', async ({ page }) => {
    test.setTimeout(SCROLL_TEST_TIMEOUT)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('index.html', { waitUntil: 'load' })
    await waitForSmoothScroll(page)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.click('nav a[href="#contact"]')
    await expect(page.locator('#contact')).toBeInViewport({ timeout: SCROLL_WAIT })
  })

  test('contact links use the exact addresses', async ({ page }) => {
    await page.goto('index.html', { waitUntil: 'load' })
    const links = await page.$$eval('#contact a', as => as.map(a => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })))
    expect(links).toEqual([
      { href: 'mailto:19hsnkhan@gmail.com?subject=Project%20enquiry%20%E2%80%94%20BrightStack', target: null, rel: null },
      { href: "https://wa.me/923175091910?text=Hi%20BrightStack%2C%20I'd%20like%20to%20talk%20about%20a%20project.", target: '_blank', rel: 'noopener' },
      { href: 'https://www.fiverr.com/brightstackco', target: '_blank', rel: 'noopener' },
      { href: 'https://www.linkedin.com/in/hassan-saeed-30a845394', target: '_blank', rel: 'noopener noreferrer' },
    ])
    expect(decodeURIComponent(links[0].href.split('subject=')[1])).toBe('Project enquiry — BrightStack')
  })

  test('contact card values fit their cards at 1440px without splitting a word', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('index.html', { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    const values = await page.$$eval('#contact .contact-card strong', ss => ss.map(s => {
      const height = () => s.getBoundingClientRect().height
      const wrapped = height()
      // One line of this text, for counting lines.
      s.style.whiteSpace = 'nowrap'
      const oneLine = height()
      // Without emergency breaks a word can only wrap at normal break points (spaces, hyphens), so if the
      // height or width changes, the card was relying on splitting a word.
      s.style.whiteSpace = ''
      s.style.overflowWrap = 'normal'
      const splitsWord = height() !== wrapped || s.scrollWidth > s.clientWidth
      s.style.overflowWrap = ''
      return { text: s.textContent, lines: Math.round(wrapped / oneLine), splitsWord }
    }))
    expect(values).toHaveLength(4)
    for (const v of values) {
      expect(v.lines, v.text).toBeLessThanOrEqual(2)
      expect(v.splitsWord, v.text).toBe(false)
    }
    expect(values.find(v => v.text.includes('@gmail.com')).lines).toBe(1)
    expect(values.find(v => v.text.includes('fiverr.com')).lines).toBe(1)
  })
})

test.describe('Momentum', () => {
  const VIEWS = [
    { button: 'Operational Schedule', panel: '#view-timetable' },
    { button: 'Biometric Macro Engine', panel: '#view-calculator' },
    { button: 'Elite Coaching Roster', panel: '#view-faculty' },
    { button: 'System Parameters', panel: '#view-protocols' },
  ]
  const navButton = (page, name) => page.locator('#sideNav').getByRole('button', { name })
  const viewport = width => ({ width, height: width === 390 ? 844 : 900 })

  // The page-wide scan above only sees the default view; this switches to every view so the others
  // get scanned too, on a phone and on a desktop.
  for (const width of [390, 1440]) {
    test(`has no serious accessibility violations in any view at ${width}px`, async ({ page }) => {
      test.setTimeout(ACCESSIBILITY_TIMEOUT)
      await page.setViewportSize(viewport(width))
      await page.goto('momentum-fitness.html', { waitUntil: 'load' })
      const problems = []
      for (const view of VIEWS) {
        if (width === 390) await page.getByRole('button', { name: 'Menu' }).click()
        await navButton(page, view.button).click()
        await expect(page.locator(view.panel)).toBeVisible()
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        for (const v of violations.filter(v => v.impact === 'serious' || v.impact === 'critical'))
          problems.push(`${view.panel} ${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
      }
      expect(problems).toEqual([])
    })
  }

  // Presses Tab until the element has focus, so the test only uses the keyboard.
  const tabTo = async (page, locator) => {
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      if (await locator.evaluate(el => el === document.activeElement)) return
    }
    throw new Error('could not reach the element with Tab')
  }

  for (const width of [390, 1440]) {
    test(`every view can be opened with the keyboard alone at ${width}px`, async ({ page }) => {
      await page.setViewportSize(viewport(width))
      await page.goto('momentum-fitness.html', { waitUntil: 'load' })
      // Ends on the default view, so every press changes the view. Alternates Enter and Space.
      for (const [i, view] of [...VIEWS.slice(1), VIEWS[0]].entries()) {
        if (width === 390) {
          const menu = page.getByRole('button', { name: 'Menu' })
          await tabTo(page, menu)
          await page.keyboard.press('Enter')
          await expect(menu).toHaveAttribute('aria-expanded', 'true')
        }
        const button = navButton(page, view.button)
        await tabTo(page, button)
        await expect(button).toHaveCSS('outline-style', 'solid')
        await page.keyboard.press(i % 2 ? 'Space' : 'Enter')
        await expect(page.locator(view.panel)).toBeVisible()
        // On a phone the menu closes after a choice and focus goes back to the menu button.
        if (width === 390) await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused()
        await expect(page.locator('#sideNav').getByRole('button', { name: view.button, includeHidden: true })).toHaveAttribute('aria-current', 'page')
        await expect(page.locator('#sideNav [aria-current]')).toHaveCount(1)
        for (const other of VIEWS.filter(v => v !== view)) await expect(page.locator(other.panel)).toBeHidden()
      }
    })
  }

  test('the "Portfolio Hub" button never covers the concept label on a phone', async ({ page }) => {
    await page.setViewportSize(viewport(390))
    await page.goto('momentum-fitness.html', { waitUntil: 'load' })
    for (const open of [false, true]) {
      if (open) await page.getByRole('button', { name: 'Menu' }).click()
      for (const view of VIEWS) {
        await page.evaluate(panel => { for (const p of document.querySelectorAll('.view-panel')) p.classList.toggle('active', '#' + p.id === panel) }, view.panel)
        // Steps through every scroll position and compares only the part of the label the scroll area shows.
        const covered = await page.evaluate(async () => {
          const main = document.querySelector('.main'), label = document.querySelector('.concept-bar p')
          const hub = document.querySelector('.back-link').getBoundingClientRect()
          const hits = []
          for (let top = 0; top <= main.scrollHeight; top += 20) {
            main.scrollTop = top
            await new Promise(r => requestAnimationFrame(r))
            const l = label.getBoundingClientRect(), m = main.getBoundingClientRect()
            const visTop = Math.max(l.top, m.top), visBottom = Math.min(l.bottom, m.bottom)
            if (visBottom > visTop && visTop < hub.bottom && visBottom > hub.top && l.left < hub.right && l.right > hub.left) hits.push(main.scrollTop)
          }
          return hits
        })
        expect(covered, `menu ${open ? 'open' : 'closed'}, ${view.panel}`).toEqual([])
      }
    }
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
