import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  manifest: {
    name: 'AI Context Tracker',
    description: 'Monitor AI chat context across ChatGPT, Claude, and Gemini.',
    version: '1.0.0',
    permissions: ['storage', 'offscreen', 'alarms', 'sidePanel'],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://*.chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://*.x.com/*',
      'https://*.grok.com/*',
      'https://*.perplexity.ai/*',
    ],
    content_security_policy: {
      extension_pages:
        process.env.NODE_ENV === 'development'
          ? "script-src 'self'; object-src 'self'; connect-src 'self' ws://localhost:3000 http://localhost:3000"
          : "script-src 'self'; object-src 'self'; connect-src 'none'",
    },
  },
  srcDir: 'src',
  vite: () => ({
    plugins: [preact(), tailwindcss()],
    resolve: {
      alias: {
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
  }),
});
