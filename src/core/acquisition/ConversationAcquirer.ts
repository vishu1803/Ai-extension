import { PlatformId } from '../../shared/types';
import {
  AcquisitionResult,
  AcquisitionStatus,
  ConversationAcquirerInterface,
  AcquisitionStrategy,
} from './types';
import { logger, DEBUG_TRACKER } from '../../shared/logger';

export class ConversationAcquirer implements ConversationAcquirerInterface {
  private strategies: AcquisitionStrategy[] = [];
  private statusListeners: Set<(status: AcquisitionStatus) => void> = new Set();
  private abortController: AbortController | null = null;

  constructor(strategies: AcquisitionStrategy[]) {
    this.strategies = strategies;
  }

  public registerStrategy(strategy: AcquisitionStrategy) {
    this.strategies.push(strategy);
  }

  public async acquire(threadId: string, platform: PlatformId): Promise<AcquisitionResult> {
    this.cancel();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    let result: AcquisitionResult = {
      strategy: 'FALLBACK',
      success: false,
      messages: [],
      isComplete: false,
      error: new Error('No valid strategies found'),
    };

    let totalMessagesFound = 0;

    const notifyStatus = (status: AcquisitionStatus) => {
      this.statusListeners.forEach((listener) => listener(status));
    };

    notifyStatus({ state: 'ACQUIRING', messagesFound: 0 });

    try {
      for (const strategy of this.strategies) {
        if (signal.aborted) {
          notifyStatus({ state: 'ABORTED', messagesFound: totalMessagesFound });
          return result;
        }

        if (!strategy.canExecute(platform, threadId)) {
          continue;
        }

        notifyStatus({
          state: 'ACQUIRING',
          currentStrategy: strategy.type,
          messagesFound: totalMessagesFound,
        });

        try {
          const stratResult = await strategy.execute(threadId, signal, (status) => {
            totalMessagesFound = Math.max(totalMessagesFound, status.messagesFound);
            notifyStatus({
              ...status,
              currentStrategy: strategy.type,
            });
          });

          if (stratResult.success && stratResult.messages.length > 0) {
            result = stratResult;
            totalMessagesFound = Math.max(totalMessagesFound, stratResult.messages.length);

            if (stratResult.isComplete || strategy.type === 'NETWORK_INTERCEPT') {
              notifyStatus({
                state: 'SUCCESS',
                currentStrategy: strategy.type,
                messagesFound: totalMessagesFound,
              });
              break;
            }
          }
        } catch (err) {
          logger.debug(`Strategy ${strategy.type} failed:`, err);
        }
      }

      if (result.success && totalMessagesFound > 0) {
        notifyStatus({ state: 'SUCCESS', messagesFound: totalMessagesFound });
        if (DEBUG_TRACKER) {
          console.log(
            `[ACQUISITION]\n` +
              `conversationId=${threadId}\n` +
              `networkHistoryAvailable=${result.strategy === 'NETWORK_INTERCEPT'}\n` +
              `selectedStrategy=${result.strategy}\n` +
              `directApiAttempted=${result.strategy !== 'NETWORK_INTERCEPT'}`
          );
          console.log(
            `[TRACE:HISTORY_ACQUIRED]\nconversationId=${threadId}\nmessages=${totalMessagesFound}`
          );
        }
      } else {
        notifyStatus({ state: 'FAILED', messagesFound: totalMessagesFound });
      }

      return result;
    } finally {
      this.abortController = null;
    }
  }

  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public onStatusChange(callback: (status: AcquisitionStatus) => void): void {
    this.statusListeners.add(callback);
  }

  public removeStatusListener(callback: (status: AcquisitionStatus) => void): void {
    this.statusListeners.delete(callback);
  }
}
