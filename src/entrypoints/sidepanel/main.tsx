import { render } from 'preact';
import { App } from './App';
import { ThemeProvider } from '../../ui/components/ThemeProvider';
import { useAppState } from '../../ui/hooks/useAppState';

// Initialize the side panel's state synchronization
useAppState.getState().init();
console.log('[SidePanel] Storage subscription established');

render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
  document.getElementById('app')!
);
