import { logger, DEBUG_TRACKER } from '../shared/logger';

/**
 * A utility to debounce DOM mutations.
 */
export function debounce<T extends (...args: unknown[]) => void>(func: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * Extracts innerText from a list of DOM elements and joins them with newlines.
 */
export function extractTextFromElements(selectors: string): string {
  const elements = safeQuerySelectorAll(selectors);
  const textChunks: string[] = [];
  elements.forEach((el) => {
    const text = (el as HTMLElement).innerText;
    if (text) textChunks.push(text);
  });
  return textChunks.join('\n\n');
}

/**
 * Safely executes querySelectorAll handling non-standard pseudo-selectors like :has-text() and :contains()
 * and preventing unhandled SyntaxErrors from interrupting execution.
 */
export function safeQuerySelectorAll(
  selector: string,
  parent: Element | Document = document
): Element[] {
  try {
    if (!selector || typeof selector !== 'string') return [];

    if (selector.includes(':has-text(') || selector.includes(':contains(')) {
      const match = selector.match(/:(?:has-text|contains)\((['"]?)(.*?)\1\)/);
      if (match) {
        const fullPseudo = match[0];
        const searchText = match[2];
        const baseSelector = selector.replace(fullPseudo, '').trim() || '*';
        try {
          const baseElements = Array.from(parent.querySelectorAll(baseSelector));
          return baseElements.filter((el) => el.textContent?.includes(searchText));
        } catch {
          const all = Array.from(parent.querySelectorAll('*'));
          return all.filter((el) => el.textContent?.includes(searchText));
        }
      }
    }

    return Array.from(parent.querySelectorAll(selector));
  } catch (err) {
    logger.warn(`Invalid selector avoided: "${selector}"`);
    return [];
  }
}

export function safeQuerySelector(
  selector: string,
  parent: Element | Document = document
): Element | null {
  const elements = safeQuerySelectorAll(selector, parent);
  return elements.length > 0 ? elements[0] : null;
}

export function getDOMPath(el: Element | null): string {
  if (!el) return 'null';
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      if (classes) selector += `.${classes}`;
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(' > ');
}

export function tagAllCandidateScrollContainers(): void {
  // Utility for tagging candidate scroll containers
}

export function inspectScrollContainer(el: Element | null, componentName: string): void {
  if (!el || !DEBUG_TRACKER) return;
  console.log(
    `[ScrollContainer][${componentName}] <${el.tagName.toLowerCase()}> scrollHeight=${el.scrollHeight}`
  );
}
