import {
  type AIMessageChunk,
  type AIMessage,
  type BaseMessageChunk,
} from "@langchain/core/messages";
import {
  type BaseChatModelCallOptions,
  type BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import { type EnhancedIncident } from "@editor-extensions/shared";
import { type RunnableConfig } from "@langchain/core/runnables";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { type BaseLanguageModelInput } from "@langchain/core/language_models/base";

import { SolutionServerClient } from "./clients/solutionServerClient";

export interface BaseWorkflowMessage<KaiWorkflowMessageType, D> {
  type: KaiWorkflowMessageType;
  id: string;
  data: D;
}

export enum KaiWorkflowMessageType {
  LLMResponseChunk,
  LLMResponse,
  ModifiedFile,
  ToolCall,
  UserInteraction,
  Error,
}

export interface KaiModifiedFile {
  path: string;
  content: string;
}

export interface KaiToolCall {
  id: string;
  name?: string;
  args?: string;
  status: "generating" | "running" | "succeeded" | "failed";
}

export interface KaiUserInteraction {
  type: "yesNo" | "choice" | "tasks";
  systemMessage: {
    yesNo?: string;
    choice?: string[];
  };
  response?: {
    yesNo?: boolean;
    choice?: number;
    tasks?: {
      uri: string;
      task: string;
    }[];
  };
}

export type KaiWorkflowMessage =
  | BaseWorkflowMessage<KaiWorkflowMessageType.LLMResponseChunk, AIMessageChunk>
  | BaseWorkflowMessage<KaiWorkflowMessageType.LLMResponse, AIMessage>
  | BaseWorkflowMessage<KaiWorkflowMessageType.ModifiedFile, KaiModifiedFile>
  | BaseWorkflowMessage<KaiWorkflowMessageType.UserInteraction, KaiUserInteraction>
  | BaseWorkflowMessage<KaiWorkflowMessageType.ToolCall, KaiToolCall>
  | BaseWorkflowMessage<KaiWorkflowMessageType.Error, string>;

export type KaiUserInteractionMessage = BaseWorkflowMessage<
  KaiWorkflowMessageType.UserInteraction,
  KaiUserInteraction
>;

export interface KaiWorkflowEvents {
  on(event: "workflowMessage", listener: (msg: KaiWorkflowMessage) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(): void;
}

export interface KaiWorkflowInitOptions {
  modelProvider: KaiModelProvider;
  workspaceDir: string;
  fsCache: KaiFsCache;
  solutionServerClient: SolutionServerClient;
}

export interface KaiWorkflowInput {
  //TODO (pgaikwad) - think about this input more
  incidents?: EnhancedIncident[];
  runnableConfig?: RunnableConfig;
}

export interface KaiWorkflowResponse {
  modified_files: KaiModifiedFile[];
  errors: Error[];
}

export interface PendingUserInteraction {
  resolve(response: KaiUserInteractionMessage | PromiseLike<KaiUserInteractionMessage>): void;
  reject(reason: any): void;
}

export interface KaiWorkflow<TWorkflowInput extends KaiWorkflowInput = KaiWorkflowInput>
  extends KaiWorkflowEvents {
  init(options: KaiWorkflowInitOptions): Promise<void>;
  run(input: TWorkflowInput): Promise<KaiWorkflowResponse>;
  resolveUserInteraction(response: KaiUserInteractionMessage): Promise<void>;
}

export interface KaiModelProviderInvokeCallOptions extends BaseChatModelCallOptions {
  cacheKey: string;
}

/**
 * An interface for a model provider expected by the agentic module which:
 * - makes model capabilities around tools explicit
 * - adds the ability to take custom call options e.g. cache key
 * All langchain providers should be compatible with this interface with minor changes.
 */
export interface KaiModelProvider<
  InvokeCallOptions extends KaiModelProviderInvokeCallOptions = KaiModelProviderInvokeCallOptions,
  OutputMessageType extends BaseMessageChunk = AIMessageChunk,
  RunInput = any,
  RunOutput = any,
  StreamCallOptions extends RunnableConfig = RunnableConfig,
> {
  stream(
    input: RunInput,
    options?: Partial<StreamCallOptions>,
  ): Promise<IterableReadableStream<RunOutput>>;
  invoke(input: BaseLanguageModelInput, options?: InvokeCallOptions): Promise<OutputMessageType>;
  bindTools(tools: BindToolsInput[], kwargs?: Partial<InvokeCallOptions>): KaiModelProvider;
  toolCallsSupported(): boolean;
  toolCallsSupportedInStreaming(): boolean;
}

/**
 * Filesystem cache layer for agents. Agents do not write
 * to disk, they write to cache. Callers are supposed to
 * invalidate cache when files change on disk. In 99% cases,
 * only agents call set() to store changes they make. Others
 * are discouraged to call set() to keep memory footprint low.
 * They may call set() to notify in-flight file changes but
 * only if the uri already exists in the cache making sure
 * agents always get the most recent picture of disk.
 */
export interface KaiFsCache {
  invalidate(uri: string): Promise<void>;
  set(uri: string, content: string): Promise<void>;
  get(uri: string): Promise<string | undefined>;
  reset(): Promise<void>;

  on(event: "cacheInvalidated", listener: (uri: string) => void): this;
  on(event: "cacheSet", listener: (uri: string, content: string) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
