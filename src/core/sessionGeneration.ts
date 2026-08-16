/**
 * Manages monotonically increasing conversation generation (epoch)
 * and projection states to fence asynchronous background operations across navigation.
 */
export interface ProjectionState {
  conversationId: string;
  generation: number;
  version: number;
  status: 'LOADING' | 'READY';
}

let currentGeneration = 0;
let currentActiveConversation: string | null = null;
let currentProjectionState: ProjectionState = {
  conversationId: '',
  generation: 0,
  version: 0,
  status: 'LOADING',
};

export const SessionGeneration = {
  getGeneration(): number {
    return currentGeneration;
  },

  getActiveConversation(): string | null {
    return currentActiveConversation;
  },

  getProjectionState(): ProjectionState {
    return { ...currentProjectionState };
  },

  switchConversation(conversationId: string): number {
    currentGeneration += 1;
    currentActiveConversation = conversationId;
    currentProjectionState = {
      conversationId,
      generation: currentGeneration,
      version: 0,
      status: 'LOADING',
    };
    return currentGeneration;
  },

  setReady(conversationId: string, generation: number, version: number): void {
    if (conversationId === currentActiveConversation && generation === currentGeneration) {
      currentProjectionState = {
        conversationId,
        generation,
        version,
        status: 'READY',
      };
    }
  },

  reset(): void {
    currentGeneration = 0;
    currentActiveConversation = null;
    currentProjectionState = {
      conversationId: '',
      generation: 0,
      version: 0,
      status: 'LOADING',
    };
  },
};
