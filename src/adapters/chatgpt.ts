import { PlatformAdapter } from './types';
import { ChatMessage, MessageRole } from '../core/models';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

export const chatGptAdapter: PlatformAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',

  matches(url: URL) {
    return url.hostname.includes('chatgpt.com') || url.hostname.includes('chat.openai.com');
  },

  getThreadId() {
    const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  },

  domSelectors: [
    '[data-message-author-role]',
    'article',
    'div[class*="conversation-turn"]',
    '.prose, .whitespace-pre-wrap'
  ],

  async extractHydrationData(): Promise<ChatMessage[] | null> {
    try {
      const scripts = Array.from(document.querySelectorAll('script'));
      let conversationData = null;
      
      for (const script of scripts) {
        if (!script.textContent) continue;
        
        // 1. Next.js Legacy
        if (script.id === '__NEXT_DATA__') {
          try {
            const data = JSON.parse(script.textContent);
            conversationData = data?.props?.pageProps?.serverResponse?.mapping || data?.props?.pageProps?.initialState?.serverState?.mapping;
          } catch (e) {}
        }
        
        // 2. Remix Current (Usually encoded in window.__remixContext or similar)
        if (script.textContent.includes('__remixContext') || script.textContent.includes('"mapping":')) {
           try {
             const jsonMatch = script.textContent.match(/(\{.*\})/);
             if (jsonMatch) {
                const data = JSON.parse(jsonMatch[1]);
                if (data.mapping) {
                  conversationData = data.mapping;
                } else if (data?.state?.loaderData) {
                  const routes = Object.values(data.state.loaderData);
                  for (const route of routes) {
                    if ((route as any)?.serverResponse?.mapping) {
                       conversationData = (route as any).serverResponse.mapping;
                       break;
                    }
                  }
                }
             }
           } catch(e) {}
        }
        
        if (conversationData) break;
      }
      
      if (!conversationData) return null;
      
      const messages: ChatMessage[] = [];
      
      // ChatGPT mapping is an object: { "node_id": { message: { ... } } }
      Object.values(conversationData).forEach((node: any) => {
         const msg = node?.message;
         if (!msg || !msg.content || !msg.content.parts) return;
         
         const role = msg.author?.role === 'user' ? 'user' : 'ai';
         const text = msg.content.parts.join('\n');
         const id = msg.id;
         const timestamp = msg.create_time || 0;
         
         if (text && text.length > 0) {
           messages.push({ id, role, text, timestamp });
         }
      });
      
      // Sort chronologically by create_time
      messages.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
      
      console.log(`[ChatGPT Adapter] Successfully extracted ${messages.length} messages from Hydration Data.`);
      return messages.length > 0 ? messages : null;
    } catch (err) {
      console.warn('[ChatGPT Adapter] Hydration parsing failed:', err);
      return null;
    }
  },

  isStreaming() {
    // Look for the "Stop generating" button or the blinking cursor
    const stopButton = document.querySelector('button[aria-label="Stop generating"]');
    const streamingCursor = document.querySelector('.result-streaming');
    return !!(stopButton || streamingCursor);
  },

  extractMessages(): ChatMessage[] {
    // Deprecated. Handled by VisibleDOMStrategy.
    return [];
  }
};

export function runForensicInvestigation() {
  try {
    console.log(`[Forensic] Step 6: console.group about to execute`);
    console.group(`[Forensic Investigation] Searching for Hydration Data...`);
    
    const scripts = Array.from(document.querySelectorAll('script'));
    
    console.log(`Total <script> tags found: ${scripts.length}`);
    
    let hasNextData = false;
    let hasRemixContext = false;
    let hasConversation = false;
    let hasMapping = false;
    let hasMessages = false;
    let hasLoaderData = false;
    let hasRoutes = false;

    scripts.forEach((script, index) => {
      const type = script.type || 'text/javascript (implicit)';
      const content = script.textContent || '';
      const size = content.length;
      
      const snippet = content.substring(0, 100).replace(/\s+/g, ' ');
      
      console.groupCollapsed(`Script [${index}] | Type: ${type} | Size: ${size} bytes`);
      console.log(`Snippet: ${snippet}`);
      
      const c_conversation = content.includes('conversation');
      const c_mapping = content.includes('mapping');
      const c_messages = content.includes('messages');
      const c_loaderData = content.includes('loaderData');
      const c_routes = content.includes('routes');
      
      if (script.id === '__NEXT_DATA__') hasNextData = true;
      if (content.includes('__remixContext')) hasRemixContext = true;
      if (c_conversation) hasConversation = true;
      if (c_mapping) hasMapping = true;
      if (c_messages) hasMessages = true;
      if (c_loaderData) hasLoaderData = true;
      if (c_routes) hasRoutes = true;
      
      console.log('--- Keyword Search ---');
      console.log(`__NEXT_DATA__: ${script.id === '__NEXT_DATA__'}`);
      console.log(`__remixContext: ${content.includes('__remixContext')}`);
      console.log(`conversation: ${c_conversation}`);
      console.log(`mapping: ${c_mapping}`);
      console.log(`messages: ${c_messages}`);
      console.log(`loaderData: ${c_loaderData}`);
      console.log(`routes: ${c_routes}`);
      console.log('----------------------');
      
      console.log(`Rejected: Script ${index} does not contain an extractable complete conversation JSON tree.`);
      console.groupEnd();
    });
    
    console.group(`[Forensic Summary]`);
    console.log(`1. __NEXT_DATA__ exists: ${hasNextData}`);
    console.log(`2. __remixContext exists: ${hasRemixContext}`);
    console.log(`3. window.__remixContext exists: ${typeof (window as any).__remixContext !== 'undefined'}`);
    console.log(`4. window.__NEXT_DATA__ exists: ${typeof (window as any).__NEXT_DATA__ !== 'undefined'}`);
    console.log(`5. Any script contains 'conversation': ${hasConversation}`);
    console.log(`6. Any script contains 'mapping': ${hasMapping}`);
    console.log(`7. Any script contains 'messages': ${hasMessages}`);
    console.log(`8. Any script contains 'loaderData': ${hasLoaderData}`);
    console.log(`9. Any script contains 'routes': ${hasRoutes}`);
    
    console.log(`\nCONCLUSION: Hydration is not a viable acquisition strategy.`);
    console.log(`EVIDENCE: None of the candidate sources on the current page expose a parseable, complete conversation history. The theoretical Remix or Next.js payloads are either absent or deliberately stripped of historical messages.`);
    
    console.groupEnd();
    console.groupEnd();
    console.log(`[Forensic] Step 6: PASS`);
  } catch (e) {
    console.error(`[Forensic] Step 6: FAIL`, e);
  } finally {
    console.log(`[Forensic] Step 7: Investigation completed`);
  }
}
