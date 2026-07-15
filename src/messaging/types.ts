import { ChatMessage } from '../adapters/engineTypes';
import { PlatformId } from '../shared/types';

export type MessageType =
  | 'GET_STATE'
  | 'STATE_UPDATED'
  | 'UPDATE_TOKEN_COUNT'
  | 'CONTENT_MUTATION'
  | 'OPEN_SIDE_PANEL'
  | 'REGENERATE_SUMMARY'
  | 'TOKENIZE_REQUEST';

export interface BaseMessage {
  type: MessageType;
}

export interface GetStateMessage extends BaseMessage {
  type: 'GET_STATE';
}

export interface StateUpdatedMessage extends BaseMessage {
  type: 'STATE_UPDATED';
  payload: unknown;
}

export interface UpdateTokenCountMessage extends BaseMessage {
  type: 'UPDATE_TOKEN_COUNT';
  payload: {
    count: number;
    platform: PlatformId;
  };
}

export interface ContentMutationMessage extends BaseMessage {
  type: 'CONTENT_MUTATION';
  payload: {
    messages: ChatMessage[];
    platform: PlatformId;
  };
}

export interface OpenSidePanelMessage extends BaseMessage {
  type: 'OPEN_SIDE_PANEL';
}

export interface RegenerateSummaryMessage extends BaseMessage {
  type: 'REGENERATE_SUMMARY';
}

export interface TokenizeRequestMessage extends BaseMessage {
  type: 'TOKENIZE_REQUEST';
  payload: {
    platformId: string;
    maxContext: number;
    messages: ChatMessage[];
  };
}

export type ExtensionMessage =
  | GetStateMessage
  | StateUpdatedMessage
  | UpdateTokenCountMessage
  | ContentMutationMessage
  | OpenSidePanelMessage
  | RegenerateSummaryMessage
  | TokenizeRequestMessage;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
