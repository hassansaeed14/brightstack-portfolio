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

    // The test above misses pages that hide their own sideways scroll (overflow: hidden on html/body), where
    // content past the edge simply can't be reached. This checks the visible buttons, links and headings instead.
    test('keeps its buttons, links and headings on screen on a phone', async ({ page: p }) => {
      await p.setViewportSize({ width: 390, height: 844 })
      await p.goto(page, { waitUntil: 'load' })
      await p.waitForTimeout(800)
      expect(await p.evaluate(offScreenRight)).toEqual([])
    })

    test('makes no compliance or clinical claims in its visible text', async ({ page: p }) => {
      await p.goto(page, { waitUntil: 'domcontentloaded' })
      const text = await p.evaluate(() => document.body.innerText)
      expect(text.match(/SOC ?2|GDPR|HIPAA|HL7|Quantum-Resistant/gi) ?? []).toEqual([])
    })
  })
}

// Visible buttons, links and headings whose right edge is more than 4px past the viewport. Things that can be
// reached by scrolling their own box, and closed off-canvas drawers (a fixed or transformed box parked wholly
// past the right edge), don't count.
function offScreenRight() {
  const vw = document.documentElement.clientWidth, out = []
  for (const el of document.querySelectorAll('button, a, h1, h2, h3, h4, h5, h6, [role="heading"], [role="button"]')) {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) continue
    let clipRight = Infinity, parked = false
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a), ar = a.getBoundingClientRect()
      if (cs.overflowX !== 'visible') clipRight = Math.min(clipRight, ar.right)
      if ((cs.position === 'fixed' || cs.transform !== 'none') && ar.left >= vw - 1) parked = true
    }
    if (parked || r.left >= clipRight) continue
    if (r.right > vw + 4) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}" ends at ${Math.round(r.right)}px`)
  }
  return out
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
    { button: 'Class Timetable', panel: '#view-timetable' },
    { button: 'Calorie Calculator', panel: '#view-calculator' },
    { button: 'Coaches', panel: '#view-faculty' },
    { button: 'Settings', panel: '#view-protocols' },
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

test.describe('home page 3D loading', () => {
  const SCENE_CODE = /\/assets\/(three|stack3d|bg3d)-[^/]*\.js$/
  // Resource timings for the 3D chunks, on the same clock as first-contentful-paint.
  const sceneTimings = page => page.evaluate(src => {
    const re = new RegExp(src)
    return {
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      chunks: performance.getEntriesByType('resource').filter(r => re.test(new URL(r.name).pathname)).map(r => ({ path: new URL(r.name).pathname, start: r.startTime })),
    }
  }, SCENE_CODE.source)

  test('does not request three.js before the first paint, and still loads the scenes afterwards', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('index.html', { waitUntil: 'load' })
    await expect.poll(async () => (await sceneTimings(page)).chunks.filter(c => /three-/.test(c.path)).length, { timeout: 30_000 }).toBeGreaterThan(0)
    const { fcp, chunks } = await sceneTimings(page)
    expect(fcp).not.toBeNull()
    for (const c of chunks) expect(c.start, c.path).toBeGreaterThan(fcp)
  })

  // On real screens the stack sits on the first screen (in the hero on desktop, under the hero text on
  // phones), so it starts right after the page has loaded. A very short window puts it more than the
  // 200px preload margin below the fold, which shows that its code waits until it is scrolled near.
  test("#stack3d's code loads only after scrolling to it", async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 390, height: 260 })
    const requested = []
    page.on('request', r => { const path = new URL(r.url()).pathname; if (SCENE_CODE.test(path)) requested.push(path) })
    await page.goto('index.html', { waitUntil: 'load' })
    // The background scene starting means the page has loaded and gone idle, which is when the stack could start too.
    await expect.poll(() => requested.some(p => /bg3d-/.test(p)), { timeout: 30_000 }).toBe(true)
    await page.waitForTimeout(1000)
    expect(requested.filter(p => /stack3d-/.test(p))).toEqual([])
    await page.evaluate(() => document.getElementById('stack3d').scrollIntoView({ block: 'center' }))
    await expect.poll(() => requested.some(p => /stack3d-/.test(p)), { timeout: 15_000 }).toBe(true)
  })
})

// These pages used to load vanilla-tilt from cdnjs; they now bundle it, so the effect can't break if the CDN is down.
for (const name of ['ai-inquiry-router', 'atlas-knowledge-copilot', 'aviary-case-study', 'booking-system-demo', 'cadence-beatmaker',
  'cartel-shop', 'churn-risk-model', 'ember-oak-ai-assistant', 'forge-agent-orchestration', 'kindred-wireframes', 'loop-wireframes', 'nexus-ops-agent']) {
  test(`${name}.html tilts its cards without cdnjs`, async ({ page }) => {
    const cdn = [], errors = []
    page.on('request', r => { if (r.url().includes('cdnjs.cloudflare.com')) cdn.push(r.url()) })
    page.on('pageerror', e => errors.push(e.message))
    await page.route(/cdnjs\.cloudflare\.com/, route => route.abort())
    await page.goto(`${name}.html`, { waitUntil: 'load' })
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.vanillaTilt).length)).toBeGreaterThan(0)
    expect(cdn).toEqual([])
    expect(errors).toEqual([])
  })
}

test('Chai Khana lazy-loads every image except the hero, and gives each one its size', async ({ page }) => {
  await page.goto('chai-khana/index.html', { waitUntil: 'domcontentloaded' })
  const images = await page.$$eval('img', imgs => imgs.map(i => ({ src: i.getAttribute('src'), loading: i.getAttribute('loading'), decoding: i.getAttribute('decoding'), width: i.getAttribute('width'), height: i.getAttribute('height') })))
  expect(images.length).toBeGreaterThan(0)
  for (const i of images) expect(i, i.src).toMatchObject({ loading: 'lazy', decoding: 'async', width: expect.stringMatching(/^\d+$/), height: expect.stringMatching(/^\d+$/) })
  // The hero is the first section's CSS background: preloaded with high priority instead of lazy-loaded.
  const heroUrl = await page.$eval('section', s => getComputedStyle(s).backgroundImage.match(/url\("([^"]+)"\)/)?.[1])
  const preload = await page.$eval('link[rel="preload"][as="image"]', l => ({ href: l.href, priority: l.getAttribute('fetchpriority') }))
  expect(preload).toEqual({ href: heroUrl, priority: 'high' })
})

test('the booking calendar opens on the current month and still pages through months', async ({ page }) => {
  await page.goto('booking-system-demo.html', { waitUntil: 'load' })
  // The browser's own clock, so the test agrees with the page whatever the date or time zone.
  const monthLabel = offset => page.evaluate(offset => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear() }, offset)
  await expect(page.locator('#calMonth')).toHaveText(await monthLabel(0))
  await expect(page.locator('#calGrid .has-booking')).toHaveCount(5) // the demo bookings
  await page.locator('.cal-nav button').last().click()
  await expect(page.locator('#calMonth')).toHaveText(await monthLabel(1))
  await page.locator('.cal-nav button').first().click()
  await page.locator('.cal-nav button').first().click()
  await expect(page.locator('#calMonth')).toHaveText(await monthLabel(-1))
})

test.describe('phone menus on the app-style demos', () => {
  // Presses Tab until the element has focus, so the test only uses the keyboard.
  const tabTo = async (page, locator) => {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      if (await locator.evaluate(el => el === document.activeElement)) return
    }
    throw new Error('could not reach the element with Tab')
  }

  for (const { file, nav, item, done } of [
    { file: 'nexora-flagship-project.html', nav: '#sideNav', item: 'Currency & Invoices', done: page => expect(page.locator('#view-forex')).toBeVisible() },
    { file: 'loop-wireframes.html', nav: '#sideNav', item: 'Focus Timer', done: page => expect(page.locator('#view-pomodoro')).toBeVisible() },
    { file: 'loom-workflow-builder.html', nav: '#nodePalette', item: 'Webhook Trigger', done: (page, before) => expect(page.locator('#nodesLayer .node')).toHaveCount(before + 1) },
  ]) {
    test(`${file}: the Menu button opens and closes the menu with the keyboard at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(file, { waitUntil: 'load' })
      const menu = page.getByRole('button', { name: 'Menu' })
      await expect(menu).toHaveAttribute('aria-controls', nav.slice(1))
      await expect(page.locator(nav)).toBeHidden()

      await tabTo(page, menu)
      await page.keyboard.press('Enter')
      await expect(menu).toHaveAttribute('aria-expanded', 'true')
      await expect(page.locator(nav)).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(menu).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator(nav)).toBeHidden()
      await expect(menu).toBeFocused()

      // Open with Space, pick an item with Enter: the menu closes and focus goes back to the Menu button.
      await page.keyboard.press('Space')
      await expect(page.locator(nav)).toBeVisible()
      const before = await page.locator('#nodesLayer .node').count()
      const choice = page.locator(nav).getByRole('button', { name: item })
      await tabTo(page, choice)
      await page.keyboard.press('Enter')
      await done(page, before)
      await expect(page.locator(nav)).toBeHidden()
      await expect(menu).toHaveAttribute('aria-expanded', 'false')
      await expect(menu).toBeFocused()
    })
  }
})

// Each project has one plain name. It must read the same on its own page (title, social titles and the logo
// or main heading), on its collection page and, where it is listed, on the homepage.
test.describe('project names match everywhere', () => {
  const PROJECTS = [
    ['booking-system-demo.html', 'Glow Studio', 'salon booking', '.brand'],
    ['nexora-flagship-project.html', 'Nexora', 'agency dashboard', '.brand-name'],
    ['momentum-fitness.html', 'Momentum', 'gym website', '.brand-name'],
    ['larkspur-photography.html', 'Larkspur', "photographer's site", '.brand-name'],
    ['webapp-dashboard-demo.html', 'Flowdesk', 'orders & invoices', '.side-logo'],
    ['loom-workflow-builder.html', 'Loom', 'workflow builder', '.sb-brand-name'],
    ['loop-wireframes.html', 'Loop', 'habit tracker', '.brand-name'],
    ['kindred-wireframes.html', 'Aether', 'dating app', '.brand-name'],
    ['cartel-shop.html', 'Cartel', 'online shop', '.brand-logo'],
    ['cadence-beatmaker.html', 'Cadence', 'beat maker', 'header .brand'],
    ['pulse-wireframes.html', 'Pulse', 'breathing app', 'h1'],
    ['surge-prototype.html', 'Surge', 'workout tracker', 'h1'],
    ['reprise-content-engine.html', 'Reprise', 'post rewriter', '.brand-name'],
    ['sift-screening-pipeline.html', 'Sift', 'resume screening', '.brand-name'],
    ['vantage-autonomous-agent.html', 'Vantage', 'support helpdesk', '.brand-name'],
    ['forge-agent-orchestration.html', 'Forge', 'research assistant', '.brand-name'],
    ['ember-oak-ai-assistant.html', 'Ember & Oak', 'sales chat', '.brand-name'],
    ['nexus-ops-agent.html', 'Nexus', 'order support bot', '.brand-name'],
    ['churn-risk-model.html', 'Churn Model', 'customer churn predictor', 'h1'],
    ['ai-inquiry-router.html', 'Inquiry Router', 'sorts customer messages', 'h1'],
    ['noor-bakehouse.html', 'Noor Bakehouse', 'bakery website', '.logo'],
  ]
  // Collection pages list their projects in inline data: {n:'Name', …, h:'file.html'} or ['Name', 'tier', 'file.html', …].
  const COLLECTIONS = ['web-apps-collection.html', 'web-design-collection.html', 'uiux-collection.html', 'ai-automation-collection.html']
  const listed = {}
  for (const c of COLLECTIONS) {
    const src = readFileSync(c, 'utf8')
    for (const m of src.matchAll(/\{n:'([^']+)'[^}]*?h:'([^']+\.html)'/g)) (listed[m[2]] ??= []).push(`${c}: ${m[1]}`)
    for (const m of src.matchAll(/\[\s*'([^']+)',\s*'[a-z]+',\s*'([^']+\.html)'/g)) (listed[m[2]] ??= []).push(`${c}: ${m[1]}`)
  }
  const home = readFileSync('index.html', 'utf8')

  for (const [file, name, desc, brand] of PROJECTS) {
    test(`${name} (${file})`, async ({ page }) => {
      const full = `${name} · ${desc}`
      await page.goto(file, { waitUntil: 'domcontentloaded' })
      expect(await page.title()).toBe(`${full} | BrightStack Co.`)
      expect(await page.getAttribute('meta[property="og:title"]', 'content')).toBe(full)
      expect(await page.getAttribute('meta[name="twitter:title"]', 'content')).toBe(full)
      // The logo text, without a decorative letter mark (Flowdesk's "F" tile sits inside its logo).
      const logo = await page.locator(brand).first().evaluate(el => { const c = el.cloneNode(true); c.querySelectorAll('.brand-mark').forEach(m => m.remove()); return c.textContent })
      expect(logo.replace(/\s+/g, ' ').trim()).toBe(name)

      // Its collection card.
      const entries = listed[file] ?? []
      expect(entries.length, `${file} is on a collection page`).toBeGreaterThan(0)
      for (const e of entries) expect(e.split(': ').slice(1).join(': '), e).toBe(name)

      // The homepage, where the project is listed (featured rows and the quick-jump list).
      if (home.includes(`href="${file}"`) || home.includes(`h: '${file}'`)) {
        await page.goto('index.html', { waitUntil: 'domcontentloaded' })
        await expect(page.locator(`a.project-row[href="${file}"] .p-title`)).toHaveText(full)
        const jump = home.match(new RegExp(`t: '([^']+)', s: 'project', h: '${file.replace('.', '\\.')}'`))?.[1]
        expect(jump).toBe(full)
      }
    })
  }
})
