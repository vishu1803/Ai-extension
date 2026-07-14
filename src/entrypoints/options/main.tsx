import { render } from 'preact';
import { App } from './App';
import { ThemeProvider } from '../../ui/components/ThemeProvider';

render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
  document.getElementById('app')!
);
