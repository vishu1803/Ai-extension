export type ExportFormat = 'markdown' | 'text' | 'json';
export type TargetLLM = 'claude' | 'chatgpt' | 'gemini' | 'generic';

export interface TransferOptions {
  format: ExportFormat;
  target: TargetLLM;
  includeMemory: boolean;
  includeCompleted: boolean;
  includePending: boolean;
  nextPrompt?: string;
}

export interface TransferResult {
  content: string;
  mimeType: string;
  extension: string;
}
