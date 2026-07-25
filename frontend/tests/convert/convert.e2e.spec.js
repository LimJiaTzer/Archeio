import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PNG_BYTES } from '../fixtures/documents';

test('converts a PNG and downloads a real JPEG artifact', async ({ page }) => {
  await page.goto('/convert');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: PNG_BYTES,
  });

  await page.locator('main').getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByText('Conversion Complete! File ready')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const bytes = await fs.readFile(path);

  expect(download.suggestedFilename()).toBe('sample_converted.jpg');
  expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
});
