import { test, expect } from "@playwright/test";
const { describe, beforeEach } = test;

const server = process.env.SERVER;
if (!(typeof server === "string")) {
  throw new Error(
    "Please set SERVER environment variable. Playwright requires an address to test. "
  );
}

describe("Counter UI Behaviours", () => {
  beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto(server);
  });

  test("Counter begins at 0", async ({ page }) => {
    const numberString = await page.textContent("h1");
    expect(numberString).toBe("Counter is 0");
  });

  test("User can add to Counter", async ({ page }) => {
    await page.click("text=Increase");
    await page.innerText("text=Counter is 1");
  });

  test("User can take from Counter", async ({ page }) => {
    await page.click("text=Decrease");
    await page.innerText("text=Counter is -1");
  });

  test("Repeated presses are all counted", async ({ page }) => {
    await page.click("text=Increase");
    await page.click("text=Increase");
    await page.click("text=Increase");
    await page.click("text=Increase");
    await page.innerText("text=Counter is 4");
  });
});
