import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const extensionPath = path.join(__dirname, '../.output/chrome-mv3');
  const artifactPath = 'C:\\Users\\VISHW\\.gemini\\antigravity-ide\\brain\\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\\verify-widget.png';

  console.log('Loading extension from:', extensionPath);

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await context.newPage();
  console.log('Navigating to chatgpt.com...');
  await page.goto('https://chatgpt.com/');

  // Wait for our widget container to be attached to the body
  console.log('Waiting for widget...');
  await page.waitForTimeout(3000); // Wait 3 seconds for WXT to inject UI

  await page.screenshot({ path: artifactPath });
  console.log('Screenshot saved to:', artifactPath);

  await context.close();
})();
