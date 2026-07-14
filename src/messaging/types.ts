export type MessageType = 
  | 'GET_STATE'
  | 'STATE_UPDATED'
  | 'UPDATE_TOKEN_COUNT'
  | 'CONTENT_MUTATION'
  | 'OPEN_SIDE_PANEL';

export interface BaseMessage {
  type: MessageType;
}

export interface GetStateMessage extends BaseMessage {
  type: 'GET_STATE';
}

export interface StateUpdatedMessage extends BaseMessage {
  type: 'STATE_UPDATED';
  payload: any; // We'll refine this later with the exact state shape
}

export interface UpdateTokenCountMessage extends BaseMessage {
  type: 'UPDATE_TOKEN_COUNT';
  payload: {
    count: number;
    platform: string;
  };
}

import { ChatMessage } from '../adapters/engineTypes';
import { PlatformId } from '../shared/types';

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

export type ExtensionMessage = 
  | GetStateMessage 
  | StateUpdatedMessage 
  | UpdateTokenCountMessage 
  | ContentMutationMessage
  | OpenSidePanelMessage;

// Generic response type
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
