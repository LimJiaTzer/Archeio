import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('generates a scannable QR code and downloads PNG bytes', async ({ page }) => {
  await page.goto('/QRCodeCreator');
  await page.getByPlaceholder('https://example.com').fill('https://archeio.test/qr');
  await expect(page.getByText('High Scanability')).toBeVisible();

  await page.getByRole('button', { name: 'Export QR Code' }).click();
  await expect(page.getByText('QR code ready')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download' }).click();
  const download = await downloadPromise;
  const bytes = await fs.readFile(await download.path());

  expect(download.suggestedFilename()).toBe('custom-qrcode.png');
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
