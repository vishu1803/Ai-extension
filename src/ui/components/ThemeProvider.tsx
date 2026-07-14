import { useEffect } from 'react';
import { useAppState } from '../hooks/useAppState';

export function ThemeProvider({ children }: { children: preact.ComponentChildren }) {
  const theme = useAppState((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    
    const applyTheme = (t: 'dark' | 'light') => {
      if (t === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(media.matches ? 'dark' : 'light');
      
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  // Provide theme via Tailwind dark mode class on document.documentElement
  // In Shadow DOM context, this component renders a wrapper div that holds the class.
  return <div className={theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'} style={{ height: '100%' }}>{children}</div>;
}
