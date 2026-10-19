// Minimal typings for Chrome's built-in AI APIs (Translator, LanguageDetector, Prompt API).
// https://developer.chrome.com/docs/ai/built-in-apis

type AIAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface AIDownloadMonitor extends EventTarget {
  addEventListener(type: 'downloadprogress', listener: (event: Event & { loaded: number }) => void): void;
}

interface AICreateOptions {
  monitor?: (monitor: AIDownloadMonitor) => void;
  signal?: AbortSignal;
}

interface AITranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

interface AITranslator {
  translate(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

interface AITranslatorStatic {
  availability(options: AITranslatorOptions): Promise<AIAvailability>;
  create(options: AITranslatorOptions & AICreateOptions): Promise<AITranslator>;
}

interface AILanguageDetector {
  detect(input: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
  destroy(): void;
}

interface AILanguageDetectorStatic {
  availability(): Promise<AIAvailability>;
  create(options?: AICreateOptions): Promise<AILanguageDetector>;
}

interface AILanguageModelExpected {
  type: 'text';
  languages?: string[];
}

interface AILanguageModelOptions {
  initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
  expectedInputs?: AILanguageModelExpected[];
  expectedOutputs?: AILanguageModelExpected[];
}

interface AILanguageModel {
  prompt(input: string, options?: { signal?: AbortSignal; responseConstraint?: object }): Promise<string>;
  clone(): Promise<AILanguageModel>;
  destroy(): void;
}

interface AILanguageModelStatic {
  availability(options?: AILanguageModelOptions): Promise<AIAvailability>;
  create(options?: AILanguageModelOptions & AICreateOptions): Promise<AILanguageModel>;
}

declare var Translator: AITranslatorStatic | undefined;
declare var LanguageDetector: AILanguageDetectorStatic | undefined;
declare var LanguageModel: AILanguageModelStatic | undefined;
