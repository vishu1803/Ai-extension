import { PlatformId } from '../../shared/types';
import { conversationManager } from '../ConversationManager';
import { ConversationAcquirerInterface, HistoryLoaderInterface, AcquisitionStatus } from './types';

export class HistoryLoader implements HistoryLoaderInterface {
  private acquirer: ConversationAcquirerInterface;
  private currentPlatform: PlatformId;
  private lastStatus: Map<string, AcquisitionStatus> = new Map();

  constructor(acquirer: ConversationAcquirerInterface, currentPlatform: PlatformId) {
    this.acquirer = acquirer;
    this.currentPlatform = currentPlatform;

    this.acquirer.onStatusChange((status) => {
      // In a real app we'd scope this by threadId, but for now we just track latest globally
      this.lastStatus.set('latest', status);
    });
  }

  public async ensureCompleteHistory(threadId: string): Promise<void> {
    const result = await this.acquirer.acquire(threadId, this.currentPlatform);
    
    if (result.success && result.messages.length > 0) {
      // Emit to ConversationManager
      await conversationManager.processMutation({
        platform: this.currentPlatform,
        threadId: threadId,
        url: window.location.href, // Rough approximation
        pageTitle: document.title,
        messages: result.messages,
        isStreaming: false
      });
    }
  }

  public getStatus(threadId: string): AcquisitionStatus {
    return this.lastStatus.get('latest') || { state: 'IDLE', messagesFound: 0 };
  }
}
