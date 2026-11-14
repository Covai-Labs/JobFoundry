import { defineExtensionMessaging } from '@webext-core/messaging';

export interface ScanNowResult {
  ok: boolean;
  scanned?: number;
  error?: string;
}

export interface JobsDiscoveredPayload {
  jobs: Array<Record<string, any>>;
}

export interface CaptureActiveTabPayload {
  tabId?: number;
}

export interface CaptureActiveTabResult {
  ok: boolean;
  job?: Record<string, unknown>;
  count?: number;
  error?: string;
}

export interface ExtractActiveJobResult {
  ok: boolean;
  jobs?: Array<Record<string, unknown>>;
  error?: string;
}

export interface AutoConnectResult {
  ok: boolean;
  serverUrl?: string;
  apiKey?: string;
  email?: string;
  name?: string;
  error?: string;
}

export interface JobsDiscoveredResult {
  ok: boolean;
  ingested?: number;
  error?: string;
}

export interface SearchBoardsResult {
  ok: boolean;
  termsSearched?: string[];
  totalFound?: number;
  newIngested?: number;
  droppedDedup?: number;
  errors?: string[];
  error?: string;
}

/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
interface JobFoundryProtocol {
  'popup:scanNow': () => ScanNowResult;
  'popup:searchBoardsNow': () => SearchBoardsResult;
  'popup:captureActiveTab': (payload?: CaptureActiveTabPayload) => CaptureActiveTabResult;
  'popup:autoConnect': () => AutoConnectResult;
  'content:jobsDiscovered': (payload: JobsDiscoveredPayload) => JobsDiscoveredResult;
  'content:extractActiveJob': () => ExtractActiveJobResult;
}
/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

export const { sendMessage, onMessage } = defineExtensionMessaging<JobFoundryProtocol>();
