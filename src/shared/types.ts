import { StructuredSummary } from '../engines/summary/types';

export type PlatformId = 'chatgpt' | 'claude' | 'gemini';

export type HealthStatus = 'healthy' | 'caution' | 'warning' | 'critical';

export interface TokenEstimate {
  count: number;
  confidence: number; // 0-1
  isStreaming: boolean;
}

export interface ConversationStats {
  turns: number;
  avgTokensPerTurn: number;
  contextLimit: number;
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
  snapshots: Snapshot[];
  
  // Settings
  supportedPlatforms: {
    chatgpt: boolean;
    claude: boolean;
    gemini: boolean;
  };
  summaryFrequency: number;
  exportFormat: 'markdown' | 'text' | 'json';
  storageLocation: 'local' | 'sync';
  privacy: {
    enableHistory: boolean;
    allowAnalytics: boolean;
  };
}
