/**
 * A utility to debounce DOM mutations.
 * Returns a function that triggers the callback after `delay` ms of no invocations.
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
  const elements = document.querySelectorAll(selectors);
  const textChunks: string[] = [];
  elements.forEach((el) => {
    const text = (el as HTMLElement).innerText;
    if (text) textChunks.push(text);
  });
  return textChunks.join('\n\n');
}
