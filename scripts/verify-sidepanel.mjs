import { chromium } from 'playwright';
import path from 'path';

const extensionPath = path.resolve('.output/chrome-mv3');

(async () => {
  console.log('Launching browser with extension...');
  const context = await chromium.launchPersistentContext('', {
    headless: false, // Must be false for extensions
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // Capture background worker logs
  let backgroundWorker = context.serviceWorkers().find(w => w.url().includes('background'));
  if (!backgroundWorker) {
    backgroundWorker = await context.waitForEvent('serviceworker');
  }

  // Extract extension ID from background worker URL
  const extensionUrl = new URL(backgroundWorker.url());
  const extensionId = extensionUrl.hostname;
  console.log(`Extension ID: ${extensionId}`);

  backgroundWorker.on('console', msg => {
    console.log(`[SW] ${msg.text()}`);
  });
  backgroundWorker.on('pageerror', err => {
    console.error(`[SW ERROR] ${err}`);
  });

  // Open the side panel as a normal tab so we can read its console logs
  const sidePanelPage = await context.newPage();
  sidePanelPage.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SidePanel]') || text.includes('[UI]')) {
      console.log(`[PANEL PAGE] ${text}`);
    }
  });
  sidePanelPage.on('pageerror', err => {
    console.error(`[PANEL PAGE ERROR] ${err}`);
  });

  console.log('Opening Side Panel...');
  await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await sidePanelPage.waitForTimeout(2000);

  // Open ChatGPT page
  const page = await context.newPage();
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Startup]') || 
        text.includes('[Observer]') || 
        text.includes('[Extractor]') ||
        text.includes('[UI]') ||
        text.includes('[SidePanel]')) {
      console.log(`[CONTENT SCRIPT] ${text}`);
    }
  });

  console.log('Navigating to test page...');
  await page.goto('https://chatgpt.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Injecting mock messages to trigger observer...');
  await page.evaluate(() => {
    // 1st message
    const article = document.createElement('article');
    article.setAttribute('data-message-author-role', 'user');
    article.setAttribute('data-message-id', 'msg-1');
    const inner = document.createElement('div');
    inner.className = 'whitespace-pre-wrap';
    inner.innerText = 'Hello, AI Context Tracker!';
    article.appendChild(inner);
    document.body.appendChild(article);
  });

  await page.waitForTimeout(2000);

  console.log('Injecting 2nd message...');
  await page.evaluate(() => {
    const article = document.createElement('article');
    article.setAttribute('data-message-author-role', 'assistant');
    article.setAttribute('data-message-id', 'msg-2');
    const inner = document.createElement('div');
    inner.className = 'whitespace-pre-wrap';
    inner.innerText = 'Hello! I am ready to help.';
    article.appendChild(inner);
    document.body.appendChild(article);
  });

  await page.waitForTimeout(2000);

  console.log('Injecting 3rd message (triggers summary threshold)...');
  await page.evaluate(() => {
    const article = document.createElement('article');
    article.setAttribute('data-message-author-role', 'user');
    article.setAttribute('data-message-id', 'msg-3');
    const inner = document.createElement('div');
    inner.className = 'whitespace-pre-wrap';
    inner.innerText = 'Great, let us begin.';
    article.appendChild(inner);
    document.body.appendChild(article);
  });

  await page.waitForTimeout(3000);
  
  console.log('Closing browser...');
  await context.close();
})();
