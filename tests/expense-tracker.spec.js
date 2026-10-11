import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

// Kharcha expense tracker (expense-tracker.html). Each test starts with empty local storage.
const PAGE = 'expense-tracker.html'

async function addEntry(page, { date, description, category, amount, status }) {
  await page.getByRole('button', { name: '+ Add entry' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add entry' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Date').fill(date)
  await dialog.getByLabel('Amount (PKR)').fill(String(amount))
  await dialog.getByLabel('Description').fill(description)
  await dialog.getByLabel('Category').selectOption(category)
  await dialog.getByLabel(status === 'paid' ? 'Paid' : 'Unpaid', { exact: true }).check()
  await dialog.getByRole('button', { name: 'Save entry' }).click()
  await expect(dialog).toBeHidden()
}

const rows = page => page.locator('#entriesBody tr')
const row = (page, text) => page.locator('#entriesBody tr', { hasText: text })
const totals = async page => ({
  paid: await page.locator('#totalPaid').textContent(),
  unpaid: await page.locator('#totalUnpaid').textContent(),
  overall: await page.locator('#totalOverall').textContent(),
})

// Three entries used by several tests.
const RENT = { date: '2026-03-01', description: 'Office rent March', category: 'Rent', amount: 60000, status: 'paid' }
const INVOICE = { date: '2026-03-05', description: 'Logo design invoice', category: 'Invoice', amount: 25000, status: 'unpaid' }
const BILL = { date: '2026-03-03', description: 'Electricity bill', category: 'Utilities', amount: 8450.5, status: 'unpaid' }

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE)
})

test('shows an empty state on the first visit', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'No entries yet' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Add your first entry' })).toBeVisible()
  await expect(page.locator('#entriesTable')).toBeHidden()
  expect(await totals(page)).toEqual({ paid: 'Rs 0', unpaid: 'Rs 0', overall: 'Rs 0' })
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
})

test('adds an entry', async ({ page }) => {
  await addEntry(page, RENT)
  await expect(rows(page)).toHaveCount(1)
  const r = row(page, 'Office rent March')
  await expect(r).toContainText('01 Mar 2026')
  await expect(r).toContainText('Rent')
  await expect(r).toContainText('Rs 60,000')
  await expect(r).toContainText('Paid')
  await expect(page.getByRole('heading', { name: 'No entries yet' })).toBeHidden()
})

test('rejects an entry without a description or amount', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add entry' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add entry' })
  await dialog.getByRole('button', { name: 'Save entry' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Please enter a description.')
  await dialog.getByLabel('Description').fill('Paper')
  await dialog.getByRole('button', { name: 'Save entry' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Please enter an amount greater than zero.')
  await expect(dialog).toBeVisible()
  await expect(rows(page)).toHaveCount(0)
})

test('edits an entry', async ({ page }) => {
  await addEntry(page, INVOICE)
  await page.getByRole('button', { name: 'Edit “Logo design invoice”' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit entry' })
  await expect(dialog.getByLabel('Description')).toHaveValue('Logo design invoice')
  await dialog.getByLabel('Description').fill('Logo design invoice (final)')
  await dialog.getByLabel('Amount (PKR)').fill('27500')
  await dialog.getByLabel('Paid', { exact: true }).check()
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toBeHidden()
  await expect(rows(page)).toHaveCount(1)
  const r = row(page, 'Logo design invoice (final)')
  await expect(r).toContainText('Rs 27,500')
  await expect(r).toContainText('Paid')
  expect(await totals(page)).toEqual({ paid: 'Rs 27,500', unpaid: 'Rs 0', overall: 'Rs 27,500' })
})

test('deletes an entry after confirming, and cancel keeps it', async ({ page }) => {
  await addEntry(page, RENT)
  await addEntry(page, BILL)
  await page.getByRole('button', { name: 'Delete “Electricity bill”' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete entry?' })
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(rows(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'Delete “Electricity bill”' }).click()
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(row(page, 'Electricity bill')).toHaveCount(0)
  expect(await totals(page)).toEqual({ paid: 'Rs 60,000', unpaid: 'Rs 0', overall: 'Rs 60,000' })
})

test('totals paid, unpaid and overall', async ({ page }) => {
  for (const e of [RENT, INVOICE, BILL]) await addEntry(page, e)
  expect(await totals(page)).toEqual({ paid: 'Rs 60,000', unpaid: 'Rs 33,450.50', overall: 'Rs 93,450.50' })
  await expect(page.locator('#countPaid')).toHaveText('1 entry')
  await expect(page.locator('#countUnpaid')).toHaveText('2 entries')
  await expect(page.locator('#countOverall')).toHaveText('3 entries')
})

test('filters by status and category, and searches', async ({ page }) => {
  for (const e of [RENT, INVOICE, BILL]) await addEntry(page, e)
  // Newest first.
  await expect(rows(page).locator('td.desc')).toHaveText(['Logo design invoice', 'Electricity bill', 'Office rent March'])

  await page.locator('.filters').getByLabel('Status').selectOption('unpaid')
  await expect(rows(page)).toHaveCount(2)
  expect(await totals(page)).toEqual({ paid: 'Rs 0', unpaid: 'Rs 33,450.50', overall: 'Rs 33,450.50' })
  await expect(page.locator('#totalsNote')).toContainText('of 3 in total')

  await page.locator('.filters').getByLabel('Category').selectOption('Utilities')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Electricity bill')

  await page.locator('.filters').getByLabel('Status').selectOption('paid')
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No matching entries' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await expect(rows(page)).toHaveCount(3)

  await page.locator('.filters').getByLabel('Search').fill('rent')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Office rent March')
  await page.locator('.filters').getByLabel('Search').fill('INVOICE')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Logo design invoice')
})

test('exports the shown entries to CSV', async ({ page }) => {
  for (const e of [RENT, INVOICE, { ...BILL, description: 'Bill, "urgent"' }]) await addEntry(page, e)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()])
  expect(download.suggestedFilename()).toMatch(/^kharcha-entries-\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = readFileSync(await download.path(), 'utf8').replace(/^﻿/, '')
  expect(csv.split('\r\n')).toEqual([
    'Date,Description,Category,Amount (PKR),Status',
    '2026-03-05,Logo design invoice,Invoice,25000.00,Unpaid',
    '2026-03-03,"Bill, ""urgent""",Utilities,8450.50,Unpaid',
    '2026-03-01,Office rent March,Rent,60000.00,Paid',
    '',
  ])

  // Only what the filters show is exported.
  await page.locator('.filters').getByLabel('Status').selectOption('paid')
  const [paidOnly] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()])
  expect(readFileSync(await paidOnly.path(), 'utf8').replace(/^﻿/, '').trim().split('\r\n')).toEqual([
    'Date,Description,Category,Amount (PKR),Status',
    '2026-03-01,Office rent March,Rent,60000.00,Paid',
  ])
})

test('keeps entries after a reload', async ({ page }) => {
  await addEntry(page, RENT)
  await addEntry(page, INVOICE)
  await page.getByRole('button', { name: 'Edit “Office rent March”' }).click()
  await page.getByRole('dialog', { name: 'Edit entry' }).getByLabel('Amount (PKR)').fill('61000')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.reload()
  await expect(rows(page)).toHaveCount(2)
  await expect(row(page, 'Office rent March')).toContainText('Rs 61,000')
  expect(await totals(page)).toEqual({ paid: 'Rs 61,000', unpaid: 'Rs 25,000', overall: 'Rs 86,000' })
})

test('loads clearly marked sample data and removes it with Clear all', async ({ page }) => {
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await expect(rows(page)).toHaveCount(5)
  await expect(page.locator('#sampleNotice')).toBeVisible()
  for (const d of await rows(page).locator('td.desc').allTextContents()) expect(d).toMatch(/^Sample: /)
  await page.reload()
  await expect(rows(page)).toHaveCount(5)

  await page.getByRole('button', { name: 'Clear all' }).click()
  await page.getByRole('dialog', { name: 'Clear all entries?' }).getByRole('button', { name: 'Clear all' }).click()
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No entries yet' })).toBeVisible()
  await expect(page.locator('#sampleNotice')).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No entries yet' })).toBeVisible()
})

test('works at phone width without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await addEntry(page, { ...RENT, description: 'A very long description that should wrap neatly inside the card on a small phone screen' })
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  // Every row and its buttons stay inside the screen.
  const overflow = await page.$$eval('#entriesBody tr, #entriesBody button', els => els.filter(e => e.getBoundingClientRect().right > innerWidth + 0.5).length)
  expect(overflow).toBe(0)
})
