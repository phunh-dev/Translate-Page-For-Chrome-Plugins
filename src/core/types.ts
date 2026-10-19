/** Google-style language code ("vi", "zh-CN", "pt-PT"…) or "auto" for detection. */
export type LangCode = string;

/**
 * - `html`: segments may contain `<xN>…</xN>` / `<xN/>` placeholders and HTML-escaped text.
 * - `text`: plain text (selection translation); newlines are meaningful.
 */
export type TextFormat = 'html' | 'text';

export interface TranslateRequest {
  texts: string[];
  from: LangCode;
  to: LangCode;
  /** Style preset id or custom style id; `general` (or empty) means a literal translation. */
  style?: string;
  format: TextFormat;
}

export interface TranslateResponse {
  texts: string[];
  /** Id of the provider that produced (most of) the result, or `cache`. */
  provider: string;
  /** Most frequent detected source language, when the provider reports one. */
  detected?: LangCode;
  /** A style was requested but no AI engine was usable, so a literal engine was used. */
  styleFallback?: boolean;
}

export type DisplayMode = 'replace' | 'bilingual';

export type PageStatus = 'idle' | 'translating' | 'translated' | 'error';

export interface PageState {
  status: PageStatus;
  target?: LangCode;
  style?: string;
  mode?: DisplayMode;
  done: number;
  total: number;
  provider?: string;
  styleFallback?: boolean;
  error?: string;
}

export interface PageStartOptions {
  to: LangCode;
  style: string;
  mode: DisplayMode;
}
