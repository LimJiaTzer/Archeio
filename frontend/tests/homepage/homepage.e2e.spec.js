import { expect, test } from '@playwright/test';

test('layers workspace cards and hands their links into the final orbit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const toolboxCards = page.locator('.tool-card');
  await expect(toolboxCards).toHaveCount(6);

  const toolboxColumns = await page.locator('.tools-grid').evaluate(
    (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length,
  );
  expect(toolboxColumns).toBe(3);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.getElementById('tools')?.scrollIntoView({ block: 'start' });
  });
  await expect(page.locator('.tool-card[href="/compress"]')).toHaveCSS('opacity', '1');

  const workspaceCards = page.locator('.home-workspace-card');
  await expect(workspaceCards).toHaveCount(6);

  await page.evaluate(() => {
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

  expect(
    Math.abs(cardGeometry.convertTop - cardGeometry.compressTop),
    'the incoming card should fully cover the previous card',
  ).toBeLessThanOrEqual(10);
  expect(cardGeometry.convertZ).toBeGreaterThan(cardGeometry.compressZ);
  await expect(page.locator('#home-convert')).toHaveAttribute('data-active', 'true');

  const shadowHandoff = await page.evaluate(() => ({
    previous: getComputedStyle(document.getElementById('home-compress')).boxShadow,
    active: getComputedStyle(document.getElementById('home-convert')).boxShadow,
  }));
  expect(shadowHandoff.active).not.toBe(shadowHandoff.previous);

  const cardOverflow = await workspaceCards.evaluateAll((cards) => cards.map((card) => {
    const content = card.querySelector('.home-workspace-card-scroll');

    return {
      card: card.dataset.workspace,
      contentHeight: content.scrollHeight,
      visibleHeight: content.clientHeight,
      overflowY: getComputedStyle(content).overflowY,
    };
  }));

  expect(cardOverflow).toEqual(
    expect.arrayContaining(
      cardOverflow.map(() => expect.objectContaining({
        card: expect.any(String),
        overflowY: 'hidden',
      })),
    ),
  );
  cardOverflow.forEach(({ card, contentHeight, visibleHeight }) => {
    expect(
      contentHeight,
      `${card} content should fit without internal scrolling`,
    ).toBeLessThanOrEqual(visibleHeight + 1);
  });

  const previousCardShortcut = page.getByRole('link', {
    name: 'Jump to Smart Compression',
  });
  await previousCardShortcut.click();
  await expect(page.locator('#home-compress')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.home-workspace-rail-link .home-workspace-icon-label')).toHaveCount(0);

  await page.evaluate(() => {
    document.getElementById('home-qr')?.scrollIntoView({ block: 'start' });
  });

  const finalCardGeometry = await page.evaluate(() => {
    const pdf = document.getElementById('home-pdf').getBoundingClientRect();
    const qr = document.getElementById('home-qr').getBoundingClientRect();

    return {
      pdfTop: Math.round(pdf.top),
      qrTop: Math.round(qr.top),
    };
  });
  expect(
    Math.abs(finalCardGeometry.qrTop - finalCardGeometry.pdfTop),
    'the final card should fully cover the previous card',
  ).toBeLessThanOrEqual(10);

  await page.evaluate(() => {
    document.getElementById('home-feature-map-title')?.scrollIntoView({ block: 'center' });
  });

  const orbit = page.getByRole('navigation', { name: 'Jump to a workspace' });
  await expect(orbit).toBeVisible();
  await expect(orbit.getByRole('link')).toHaveCount(6);
  await orbit.getByRole('link', { name: 'Jump to Smart Compression' }).click({ force: true });
  await expect(page.locator('#home-compress')).toHaveAttribute('data-active', 'true');
  expect(new URL(page.url()).pathname).toBe('/');
});

test('uses an expanded, overflow-safe workspace layout on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.getElementById('workspace-tour')?.scrollIntoView({ block: 'start' });
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
