import { expect, test } from '@playwright/test';
import { createDocxFixture, PNG_BYTES } from '../fixtures/documents';

test('converts multiple sources and renders the selected DOCX', async ({ page }) => {
  const docx = await createDocxFixture();
  await page.route('**/convert/image-to-docx', (route) => route.fulfill({
    status: 200,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    body: docx,
  }));

  await page.goto('/ocr');
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: PNG_BYTES },
    { name: 'second.png', mimeType: 'image/png', buffer: PNG_BYTES },
  ]);
  await page.getByRole('button', { name: 'Convert documents' }).click();

  await expect(page.getByText('Converted documents')).toBeVisible();
  await expect(page.getByText('first.docx').first()).toBeVisible();
  await expect(page.locator('.docx-preview-canvas')).toContainText('Generated OCR document');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
});
