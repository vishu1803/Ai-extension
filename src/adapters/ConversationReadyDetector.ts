import { PlatformAdapter } from './types';
import { safeQuerySelector } from './utils';
import { NetworkHistoryStore } from '../core/acquisition/strategies/NetworkInterceptStrategy';
import { isExtensionContextInvalidated } from '../messaging/client';
import { logger } from '../shared/logger';

export type ReadyState = 'STARTING' | 'READY' | 'FINISHED';

export class ConversationReadyDetector {
  private adapter: PlatformAdapter;
  private onReady: () => void;
  private state: ReadyState = 'STARTING';

  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private mutationObserver: MutationObserver | null = null;
  private destroyed = false;

  constructor(adapter: PlatformAdapter, onReady: () => void) {
    this.adapter = adapter;
    this.onReady = onReady;
  }

  public start(): void {
    if (this.destroyed) return;
    this.state = 'STARTING';

    const threadId = this.adapter.getThreadId ? this.adapter.getThreadId() : null;
    const storedNetworkHistory = NetworkHistoryStore.get(threadId);

    // Fast-path: If network history is already available, ready immediately
    if (storedNetworkHistory && storedNetworkHistory.messages.length > 0) {
      this.emitReady('Network history available');
      return;
    }

    // Check if main target is already in DOM
    const mainTarget =
      safeQuerySelector('main') || (typeof document !== 'undefined' ? document.body : null);
    if (mainTarget) {
      // Passive microtask / short debounce to ensure DOM tree is stable
      this.readyTimer = setTimeout(() => {
        if (!this.destroyed) {
          this.emitReady('Main container available');
        }
      }, 50);
      return;
    }

    // Wait for container to appear via single mutation observer (zero polling loops)
    if (typeof document !== 'undefined' && document.documentElement) {
      this.mutationObserver = new MutationObserver(() => {
        if (this.destroyed) return;
        const target = safeQuerySelector('main') || document.body;
        if (target) {
          if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
          }
          this.readyTimer = setTimeout(() => {
            if (!this.destroyed) {
              this.emitReady('Container attached');
            }
          }, 50);
        }
      });

      this.mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      // Fallback timeout
      this.readyTimer = setTimeout(() => {
        if (!this.destroyed) {
          this.emitReady('Readiness timeout fallback');
        }
      }, 1000);
    } else {
      this.emitReady('Fallback ready');
    }
  }

  public stop(): void {
    this.destroyed = true;
    this.cleanup();
  }

  public reset(): void {
    this.stop();
    this.destroyed = false;
    this.state = 'STARTING';
    this.start();
  }

  private cleanup(): void {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  private emitReady(reason: string): void {
    if (this.destroyed || this.state === 'FINISHED') return;
    if (isExtensionContextInvalidated()) {
      this.stop();
      return;
    }

    this.state = 'READY';
    this.cleanup();

    try {
      this.onReady();
    } catch (err) {
      logger.error('ConversationReadyDetector onReady error', err);
    }

    this.state = 'FINISHED';
  }
}
