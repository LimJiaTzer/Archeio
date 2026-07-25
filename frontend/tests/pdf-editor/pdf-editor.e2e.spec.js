import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { createPdfFixture } from '../fixtures/documents';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const pdfWorkerPath = path.resolve(
  currentDirectory,
  '../../node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
);

test('rotates and exports a parseable PDF', async ({ page }) => {
  await page.route('**/pdf.worker.min.mjs', (route) => route.fulfill({
    path: pdfWorkerPath,
    contentType: 'text/javascript',
  }));
  await page.goto('/pdfEditor');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'two-pages.pdf',
    mimeType: 'application/pdf',
    buffer: await createPdfFixture(),
  });

  await expect(page.getByText(/Pages \(2\)/)).toBeVisible();
  await page.getByRole('button', { name: /Rotate 90/ }).click();

  const exportButton = page.getByRole('button', { name: 'Export PDF' });
  await exportButton.click();
  await expect(page.getByText('PDF Render Successful!')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download/ }).click();
  const download = await downloadPromise;
  const bytes = await fs.readFile(await download.path());
  const exported = await PDFDocument.load(bytes);

  expect(exported.getPageCount()).toBe(2);
  expect(exported.getPage(0).getRotation().angle).toBe(90);
});
