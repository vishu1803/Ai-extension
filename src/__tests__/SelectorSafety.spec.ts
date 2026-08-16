import { describe, it, expect, beforeEach } from 'vitest';
import { safeQuerySelectorAll, safeQuerySelector } from '../adapters/utils';

describe('Selector Safety & QuerySelector Overhaul', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="container">
        <div class="opacity-100 transition-opacity ease-out">Sponsored options</div>
        <div class="opacity-100 transition-opacity ease-out">Regular content</div>
        <div class="font-claude-message">Claude reply</div>
        <article data-message-id="art-1">Article message</article>
      </div>
    `;
  });

  it('should safely query complex selector with :has-text without throwing native SyntaxError', () => {
    const selector = '.opacity-100.transition-opacity.ease-out:has-text(Sponsored options)';

    expect(() => {
      const results = safeQuerySelectorAll(selector);
      expect(results.length).toBe(1);
      expect(results[0].textContent).toContain('Sponsored options');
    }).not.toThrow();
  });

  it('should safely handle single quotes inside :has-text()', () => {
    const selector = '.opacity-100:has-text("Regular content")';
    const results = safeQuerySelectorAll(selector);
    expect(results.length).toBe(1);
    expect(results[0].textContent).toContain('Regular content');
  });

  it('should return empty array and log warning on completely invalid CSS syntax without crashing', () => {
    const invalidSelector = 'div[[[invalid===selector';
    expect(() => {
      const results = safeQuerySelectorAll(invalidSelector);
      expect(results).toEqual([]);
    }).not.toThrow();
  });

  it('should query standard CSS selectors cleanly via safeQuerySelector', () => {
    const el = safeQuerySelector('article[data-message-id="art-1"]');
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('Article message');
  });
});
