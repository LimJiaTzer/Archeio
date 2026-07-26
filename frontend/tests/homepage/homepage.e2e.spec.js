import { expect, test } from '@playwright/test';

test('layers workspace cards and hands their links into the final orbit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const workspaceCards = page.locator('.home-workspace-card');
  await expect(workspaceCards).toHaveCount(6);

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.getElementById('home-convert')?.scrollIntoView({ block: 'start' });
  });

  const cardGeometry = await page.evaluate(() => {
    const compress = document.getElementById('home-compress');
    const convert = document.getElementById('home-convert');
    const compressRect = compress.getBoundingClientRect();
    const convertRect = convert.getBoundingClientRect();

    return {
      compressTop: Math.round(compressRect.top),
      convertTop: Math.round(convertRect.top),
      compressZ: Number(getComputedStyle(compress).zIndex),
      convertZ: Number(getComputedStyle(convert).zIndex),
    };
  });

  expect(cardGeometry.convertTop).toBe(cardGeometry.compressTop);
  expect(cardGeometry.convertZ).toBeGreaterThan(cardGeometry.compressZ);

  await page.evaluate(() => {
    document.getElementById('home-feature-map-title')?.scrollIntoView({ block: 'center' });
  });

  const orbit = page.getByRole('navigation', { name: 'Open a workspace' });
  await expect(orbit).toBeVisible();
  await expect(orbit.getByRole('link')).toHaveCount(6);
});

test('uses an expanded, overflow-safe workspace layout on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.getElementById('tools')?.scrollIntoView({ block: 'start' });
  });

  const mobileLayout = await page.evaluate(() => {
    const firstCard = document.querySelector('.home-workspace-card');

    return {
      cardPosition: getComputedStyle(firstCard).position,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(mobileLayout.cardPosition).toBe('relative');
  expect(mobileLayout.documentWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
  await expect(page.getByRole('navigation', { name: 'Workspace shortcuts' })).toBeVisible();
});
