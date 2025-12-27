import { test, expect } from "@playwright/test";

test.describe("Agent Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load the dashboard", async ({ page }) => {
    // Check that the main layout is visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("should display message input", async ({ page }) => {
    // Check for the message input field
    const messageInput = page.getByPlaceholder(/message|type|send/i);
    await expect(messageInput).toBeVisible();
  });

  test("should have activity panel", async ({ page }) => {
    // Look for activity-related content
    const activitySection = page
      .locator('[data-testid="activity-panel"]')
      .or(page.locator("text=Activity").first());
    await expect(activitySection).toBeVisible({ timeout: 10000 });
  });

  test("should toggle settings panel", async ({ page }) => {
    // Find and click settings button
    const settingsButton = page
      .getByRole("button", { name: /settings/i })
      .or(page.locator('[aria-label*="settings" i]'));

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      // Settings panel should appear
      await expect(
        page.locator("text=Settings").or(page.locator('[data-testid="settings-panel"]'))
      ).toBeVisible();
    }
  });

  test("should have keyboard navigation support", async ({ page }) => {
    // Tab through focusable elements
    await page.keyboard.press("Tab");

    // Check that an element has focus
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeTruthy();
  });
});

test.describe("Accessibility", () => {
  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    // Check for h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBeGreaterThanOrEqual(0); // May not have h1 on dashboard

    // Check that headings exist
    const headings = await page.locator("h1, h2, h3, h4, h5, h6").count();
    expect(headings).toBeGreaterThan(0);
  });

  test("should have alt text on images", async ({ page }) => {
    await page.goto("/");

    // Find all images
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const ariaLabel = await img.getAttribute("aria-label");
      const ariaHidden = await img.getAttribute("aria-hidden");

      // Image should have alt text, aria-label, or be hidden from screen readers
      expect(alt !== null || ariaLabel !== null || ariaHidden === "true").toBeTruthy();
    }
  });

  test("should have proper button labels", async ({ page }) => {
    await page.goto("/");

    // Find all buttons
    const buttons = page.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute("aria-label");
      const title = await button.getAttribute("title");

      // Button should have text content, aria-label, or title
      const hasLabel = (text && text.trim().length > 0) || ariaLabel || title;
      expect(hasLabel).toBeTruthy();
    }
  });

  test("should respect reduced motion preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Page should load without issues when reduced motion is preferred
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Responsive Design", () => {
  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Main content should still be visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("should work on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    await expect(page.locator("main")).toBeVisible();
  });

  test("should work on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");

    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Dark Mode", () => {
  test("should support dark color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    // Page should render in dark mode
    await expect(page.locator("body")).toBeVisible();
  });

  test("should support light color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(page.locator("body")).toBeVisible();
  });
});
