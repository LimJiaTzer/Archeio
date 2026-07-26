import { expect, test } from '@playwright/test';

test('moves workspace icons from the toolbox into the overview and stack', async ({ page }) => {
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
  await expect(page.locator('.tool-card-motion')).toHaveCount(6);
  await page.waitForTimeout(1500);

  const toolboxGeometry = await toolboxCards.evaluateAll((cards) => cards.map((card) => {
    const bounds = card.getBoundingClientRect();

    return {
      height: Math.round(bounds.height),
      href: card.getAttribute('href'),
      left: Math.round(bounds.left),
      top: Math.round(bounds.top),
      width: Math.round(bounds.width),
    };
  }));
  const toolboxTokens = page.locator(
    '.workspace-journey-token[data-phase="toolbox"]',
  );
  await expect(toolboxTokens).toHaveCount(6);
  const toolboxIconColors = await toolboxTokens.evaluateAll(
    (tokens) => tokens.map((token) => getComputedStyle(token).color),
  );
  const toolboxTokenWidths = await toolboxTokens.evaluateAll(
    (tokens) => tokens.map((token) => token.getBoundingClientRect().width),
  );

  const workspaceCards = page.locator('.home-workspace-card');
  await expect(workspaceCards).toHaveCount(6);

  const sectionOrder = await page.evaluate(() => {
    const toolbox = document.getElementById('tools');
    const overview = document.getElementById('home-feature-map');
    const stack = document.querySelector('.home-workspace-experience');

    return {
      toolboxBeforeOverview: Boolean(
        toolbox.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      overviewBeforeStack: Boolean(
        overview.compareDocumentPosition(stack) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    };
  });
  expect(sectionOrder).toEqual({
    toolboxBeforeOverview: true,
    overviewBeforeStack: true,
  });

  await page.evaluate(() => {
    document.getElementById('home-feature-map-title')?.scrollIntoView({ block: 'center' });
  });

  const orbit = page.getByRole('navigation', { name: 'Jump to a workspace' });
  await expect(orbit).toBeVisible();
  await expect(orbit.getByRole('link')).toHaveCount(6);
  await expect(toolboxTokens).toHaveCount(0);
  const orbitTokens = page.locator(
    '.home-feature-orbit .workspace-journey-token[data-phase="orbit"]',
  );
  await expect(orbitTokens).toHaveCount(6);
  await expect(
    page.locator('.home-feature-orbit .workspace-journey-token-label'),
  ).toHaveCount(6);
  await page.waitForTimeout(900);
  const orbitIconColors = await page
    .locator('.home-feature-orbit .workspace-journey-token')
    .evaluateAll((icons) => icons.map((icon) => getComputedStyle(icon).color));
  expect(orbitIconColors).toEqual(toolboxIconColors);
  const orbitTokenWidths = await orbitTokens.evaluateAll(
    (tokens) => tokens.map((token) => token.getBoundingClientRect().width),
  );
  orbitTokenWidths.forEach((width, index) => {
    expect(width).toBeGreaterThan(toolboxTokenWidths[index] + 50);
  });
  await expect(
    page.getByRole('navigation', { name: 'Workspace shortcuts' }),
  ).toHaveCount(0);

  const setOrbitProgress = async (progress) => {
    await page.evaluate((nextProgress) => {
      const overview = document.getElementById('home-feature-map');
      const stack = document.querySelector('.home-workspace-experience');
      const overviewTop = window.scrollY + overview.getBoundingClientRect().top;
      const stackTop = window.scrollY + stack.getBoundingClientRect().top;
      const orbitStart = overviewTop - (window.innerHeight * 0.72);
      const orbitEnd = stackTop - (window.innerHeight * 0.68);

      window.scrollTo({
        top: orbitStart + ((orbitEnd - orbitStart) * nextProgress),
        behavior: 'auto',
      });
    }, progress);
  };
  const readOrbitPositions = () => page.locator('.home-feature-orbit-motion').evaluateAll(
    (tokens) => tokens.map((token) => {
      const styles = getComputedStyle(token);

      return {
        left: Number.parseFloat(styles.left),
        top: Number.parseFloat(styles.top),
      };
    }),
  );

  await setOrbitProgress(0.25);
  await expect(page.locator('.home-feature-journey')).toHaveAttribute(
    'data-icon-phase',
    'orbit',
  );
  await page.waitForTimeout(300);
  const firstOrbitProgress = Number(
    await page.locator('.home-feature-journey').getAttribute('data-orbit-progress'),
  );
  const firstOrbitPositions = await readOrbitPositions();

  await setOrbitProgress(0.58);
  await page.waitForTimeout(300);
  const secondOrbitProgress = Number(
    await page.locator('.home-feature-journey').getAttribute('data-orbit-progress'),
  );
  const secondOrbitPositions = await readOrbitPositions();
  expect(secondOrbitProgress).toBeGreaterThan(firstOrbitProgress + 0.25);
  secondOrbitPositions.forEach((position, index) => {
    expect(
      Math.hypot(
        position.left - firstOrbitPositions[index].left,
        position.top - firstOrbitPositions[index].top,
      ),
      'each workspace token should orbit as the page scrolls',
    ).toBeGreaterThan(25);
  });

  const floatingTransforms = await page.locator('.home-feature-orbit-link').evaluateAll(
    (links) => links.map((link) => getComputedStyle(link).transform),
  );
  await page.waitForTimeout(450);
  const restingOrbitPositions = await readOrbitPositions();
  const restingFloatingTransforms = await page
    .locator('.home-feature-orbit-link')
    .evaluateAll((links) => links.map((link) => getComputedStyle(link).transform));
  restingOrbitPositions.forEach((position, index) => {
    expect(Math.abs(position.left - secondOrbitPositions[index].left)).toBeLessThan(1);
    expect(Math.abs(position.top - secondOrbitPositions[index].top)).toBeLessThan(1);
  });
  expect(
    restingFloatingTransforms.some((transform, index) => (
      transform !== floatingTransforms[index]
    )),
    'the local floating motion should continue after scrolling stops',
  ).toBe(true);

  await orbit.getByRole('link', { name: 'Jump to Smart Compression' }).click({ force: true });
  await expect(page.locator('#home-compress')).toHaveAttribute('data-active', 'true');
  expect(new URL(page.url()).pathname).toBe('/');
  await page.waitForTimeout(750);
  await expect(
    page.getByRole('navigation', { name: 'Workspace shortcuts' }),
  ).toBeVisible();
  const railIconColors = await page
    .locator('.home-workspace-rail .workspace-journey-token')
    .evaluateAll((icons) => icons.map((icon) => getComputedStyle(icon).color));
  expect(railIconColors).toEqual(toolboxIconColors);
  const railTokenWidths = await page
    .locator('.home-workspace-rail .workspace-journey-token')
    .evaluateAll((tokens) => tokens.map((token) => token.getBoundingClientRect().width));
  railTokenWidths.forEach((width, index) => {
    expect(width).toBeLessThan(orbitTokenWidths[index]);
  });

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
  await expect(
    page.locator('.home-workspace-rail-link .workspace-journey-token-label'),
  ).toHaveCount(0);

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
    document.getElementById('tools')?.scrollIntoView({ block: 'start' });
  });
  await expect(page.locator('.home-feature-journey')).toHaveAttribute(
    'data-icon-phase',
    'toolbox',
  );
  await expect(toolboxTokens).toHaveCount(6);
  await page.waitForTimeout(900);

  const returnedToolboxGeometry = await toolboxCards.evaluateAll((cards) => cards.map((card) => {
    const bounds = card.getBoundingClientRect();

    return {
      height: Math.round(bounds.height),
      href: card.getAttribute('href'),
      left: Math.round(bounds.left),
      top: Math.round(bounds.top),
      width: Math.round(bounds.width),
    };
  }));
  expect(returnedToolboxGeometry).toEqual(toolboxGeometry);

  const convertCard = page.locator('.tool-card[href="/convert"]');
  const convertBeforeHover = await convertCard.evaluate((card) => {
    const bounds = card.getBoundingClientRect();
    return { left: bounds.left + window.scrollX, top: bounds.top + window.scrollY };
  });
  await convertCard.hover();
  await page.waitForTimeout(300);
  const convertDuringHover = await convertCard.evaluate((card) => {
    const bounds = card.getBoundingClientRect();
    return { left: bounds.left + window.scrollX, top: bounds.top + window.scrollY };
  });
  expect(Math.abs(convertDuringHover.left - convertBeforeHover.left)).toBeLessThan(1);
  expect(convertDuringHover.top).toBeLessThan(convertBeforeHover.top - 4);

  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  const convertAfterHover = await convertCard.evaluate((card) => {
    const bounds = card.getBoundingClientRect();
    return { left: bounds.left + window.scrollX, top: bounds.top + window.scrollY };
  });
  expect(Math.abs(convertAfterHover.left - convertBeforeHover.left)).toBeLessThan(1);
  expect(Math.abs(convertAfterHover.top - convertBeforeHover.top)).toBeLessThan(1);
});

test('uses an expanded, overflow-safe workspace layout on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('.home-workspace-experience')?.scrollIntoView({ block: 'start' });
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
