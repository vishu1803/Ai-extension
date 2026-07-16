import { createShadowRootUi } from 'wxt/client';
import type { ContentScriptContext } from 'wxt/client';
import { render } from 'preact';
import { Widget } from './Widget';
import { ThemeProvider } from '../../../ui/components/ThemeProvider';
import { NotificationManager } from '../../../ui/components/NotificationManager';

import { useAppState } from '../../../ui/hooks/useAppState';

export const mountWidget = async (ctx: ContentScriptContext) => {
  // Initialize the state safely after the context is ready
  useAppState.getState().init();

  const ui = await createShadowRootUi(ctx, {
    name: 'ai-context-tracker-widget',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    onMount(container) {
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
    },
  });

  ui.mount();
};
