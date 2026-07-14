import { createShadowRootUi } from 'wxt/client';
import type { ContentScriptContext } from 'wxt/client';
import { render } from 'preact';
import { Widget } from './Widget';
import { ThemeProvider } from '../../../ui/components/ThemeProvider';
// Tailwind generated styles injected directly into Shadow DOM
import tailwindStyles from '../../../ui/styles/tailwind.css?raw';
import { NotificationManager } from '../../../ui/components/NotificationManager';

export const mountWidget = async (ctx: ContentScriptContext) => {
  const ui = await createShadowRootUi(ctx, {
    name: 'ai-context-tracker-widget',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    onMount(container) {
      // Inject Tailwind into the Shadow DOM
      const style = document.createElement('style');
      style.textContent = tailwindStyles.replace(/:root/g, ':host');
      container.appendChild(style);

      // Render Preact Widget
      const appRoot = document.createElement('div');
      container.appendChild(appRoot);
      
      render(
        <ThemeProvider>
          <Widget />
          <NotificationManager />
        </ThemeProvider>,
        appRoot
      );

      return appRoot;
    },
    onRemove(appRoot) {
      if (appRoot) render(null, appRoot);
    }
  });

  ui.mount();
};
