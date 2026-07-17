import { PlatformId } from '../../../shared/types';
import { PlatformAdapter } from '../../../adapters/types';
import { AcquisitionResult, AcquisitionStatus, AcquisitionStrategy, AcquisitionStrategyType } from '../types';

export class HydrationStrategy implements AcquisitionStrategy {
  public type: AcquisitionStrategyType = 'HYDRATION';
  private adapter: PlatformAdapter;
  private hasExecuted = false; // Hydration only makes sense once per instance/session

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }

  public canExecute(platform: PlatformId): boolean {
    return !!this.adapter.extractHydrationData && !this.hasExecuted;
  }

  public async execute(
    threadId: string,
    signal?: AbortSignal,
    onProgress?: (status: AcquisitionStatus) => void
  ): Promise<AcquisitionResult> {
    
    if (signal?.aborted) {
      return { strategy: this.type, success: false, messages: [], isComplete: false };
    }

    if (!this.adapter.extractHydrationData) {
      return { strategy: this.type, success: false, messages: [], isComplete: false, error: new Error('Not supported by adapter') };
    }

    try {
      this.hasExecuted = true;
      const messages = await this.adapter.extractHydrationData();
      
      if (messages && messages.length > 0) {
        // We consider hydration data to be the complete history up to the point of page load
        return {
          strategy: this.type,
          success: true,
          messages,
          isComplete: true 
        };
      }

      return {
        strategy: this.type,
        success: false,
        messages: [],
        isComplete: false,
        error: new Error('No hydration data found')
      };
    } catch (error) {
      return {
        strategy: this.type,
        success: false,
        messages: [],
        isComplete: false,
        error: error as Error
      };
    }
  }
}
