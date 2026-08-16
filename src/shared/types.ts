import { StructuredSummary } from '../engines/summary/types';

export type PlatformId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

export type HealthStatus = 'healthy' | 'caution' | 'warning' | 'critical';

export interface TokenEstimate {
  count: number;
  inputCount: number;
  outputCount: number;
  confidence: number; // 0-1
  isStreaming: boolean;
  baselineCount?: number;
  liveDelta?: number;
  liveUserTokens?: number;
  liveAssistantTokens?: number;
}

export interface ContextHealthMetrics {
  repetition: 'Low' | 'Medium' | 'High';
  lengthDrift: 'Stable' | 'Growing' | 'Shrinking';
  instruction: 'Good' | 'Fair' | 'Poor';
  explicit: 'None' | 'Some' | 'High';
}

export interface HealthSignal {
  value: number;
  weight: number;
  label: string;
  description: string;
}

export interface HealthScore {
  overall: number;
  status: HealthStatus;
  signals: Record<string, HealthSignal>;
}

export interface ConversationStats {
  turns: number;
  avgTokensPerTurn: number;
  contextLimit: number;
  healthMetrics: ContextHealthMetrics;
}

export interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  platform: PlatformId | null;
  model: string;
  tokenCount: number;
  tags: string[];
  summary: StructuredSummary | null;
}

export interface DerivedConversationState {
  conversationId: string;
  generation?: number;
  version?: number;
  platform: PlatformId | null;
  status: HealthStatus;
  tokenEstimate: TokenEstimate;
  stats: ConversationStats;
  currentSummary: StructuredSummary | null;
  estimatedContext?: EstimatedContext;
  summaryVersion?: number;
  sourceVersion?: number;
}

export interface AppState {
  theme: 'dark' | 'light' | 'system';
  platform: PlatformId | null;
  status: HealthStatus;
  tokenEstimate: TokenEstimate;
  stats: ConversationStats;
  thresholds: {
    caution: number;
    warning: number;
    critical: number;
  };
  currentSummary: StructuredSummary | null;
  widgetPosition: { x: number; y: number };
  widgetCollapsed: boolean;
  notificationsEnabled: boolean;
  trackingEnabled: boolean;
  onboardingComplete: boolean;
  snapshots: Snapshot[];

  // Conversation Session Scoping
  activeConversationId?: string | null;
  derivedState?: Record<string, DerivedConversationState>;

  // Settings
  supportedPlatforms: {
    chatgpt: boolean;
    claude: boolean;
    gemini: boolean;
    grok: boolean;
    perplexity: boolean;
  };
  summaryFrequency: number;
  exportFormat: 'markdown' | 'text' | 'json';
  storageLocation: 'local' | 'sync';
  privacy: {
    enableHistory: boolean;
    allowAnalytics: boolean;
  };
  estimatedContext?: EstimatedContext;
}

export interface EstimatedContext {
  observedTokens: number;
  estimatedTokens: number;
  observedTurns: number;
  estimatedTurns: number;
  coverageRatio: number;
  confidence?: number;
  estimationSource: string;
}
