export interface PluginOptions {
  enabled?: boolean;
  showThinkTokens?: boolean;
  showThinkDuration?: boolean;
  tagFormats?: Array<'xml' | 'minimax'>;
}

export interface TextCompleteInput {
  sessionID: string;
  messageID: string;
  partID: string;
}

export interface TextCompleteOutput {
  text: string;
}

export interface MessageInfo {
  role?: string;
}

export interface Part {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface Message {
  info?: MessageInfo;
  parts?: Part[];
}

export interface MessagesTransformInput {
  // empty object, all input is via output
}

export interface MessagesTransformOutput {
  messages: Message[];
}

export type StripFn = (text: string, tagFormats: Array<'xml' | 'minimax'>) => string;
export type CountTokensFn = (text: string, tagFormats: Array<'xml' | 'minimax'>) => number;
