import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { type AiStatus, aiDownload, aiStatus, hasBuiltInAi } from '@/core/ai-host';
import { getLanguageName } from '@/core/languages';
import { geminiProvider, listGeminiModels } from '@/core/providers/gemini';
import { OPENAI_PRESETS, openaiProvider } from '@/core/providers/openai-compatible';
import type { TranslationProvider } from '@/core/providers/types';
import { findStyle } from '@/core/styles/presets';
import { t, uiLocale } from '@/utils/i18n';
import { sendToBackground } from '@/utils/messaging';
import { type AiEngine, DEFAULT_GEMINI_MODEL, type Secrets, type Settings } from '@/utils/settings';
import { Badge, Button, Field, inputClass, RadioCard, Section } from './ui';

interface EnginesProps {
  settings: Settings;
  secrets: Secrets;
  update: (patch: Partial<Settings>) => void;
  updateSecrets: (patch: Partial<Secrets>) => void;
}

type TestState = { status: 'idle' } | { status: 'running' } | { status: 'ok'; text: string } | { status: 'error'; text: string };

async function testProvider(provider: TranslationProvider, settings: Settings, secrets: Secrets): Promise<string> {
  const result = await provider.translate(
    ['Hello! This extension translates web pages for free.'],
    { from: 'en', to: settings.targetLang, format: 'text', style: findStyle('technology') },
    { settings, secrets },
  );
  return result.texts[0] ?? '';
}

function TestResult({ state }: { state: TestState }) {
  if (state.status === 'idle') return null;
  if (state.status === 'running') return <p class="text-xs text-ink-500">{t('testing')}</p>;
  return (
    <p
      class={`rounded-lg px-3 py-2 text-xs ${state.status === 'ok' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}
    >
      {state.status === 'ok' ? `✓ ${state.text}` : state.text}
    </p>
  );
}

function aiTone(value: string): 'ok' | 'warn' | 'off' {
  if (value === 'available') return 'ok';
  if (value === 'downloadable' || value === 'downloading') return 'warn';
  return 'off';
}

export function Engines({ settings, secrets, update, updateSecrets }: EnginesProps) {
  const [ai, setAi] = useState<AiStatus>();
  const [download, setDownload] = useState<number | null>(null);
  const [aiError, setAiError] = useState('');
  const [geminiTest, setGeminiTest] = useState<TestState>({ status: 'idle' });
  const [openaiTest, setOpenaiTest] = useState<TestState>({ status: 'idle' });
  const [models, setModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    void (hasBuiltInAi() ? aiStatus() : sendToBackground('ai:status', { force: true })).then(setAi, () =>
      setAi({ prompt: 'unsupported', translator: 'unsupported' }),
    );
  }, []);

  const runTest = async (provider: TranslationProvider, set: (s: TestState) => void) => {
    set({ status: 'running' });
    try {
      set({ status: 'ok', text: await testProvider(provider, settings, secrets) });
    } catch (e) {
      set({ status: 'error', text: (e as Error).message });
    }
  };

  const statusLabel = (value: string) => t(`aiStatus_${value}`);

  return (
    <Section id="engines" icon="cpu" title={t('sectionEngines')} description={t('sectionEnginesDesc')}>
      <Field label={t('standardEngine')} hint={t('standardEngineHint')}>
        <div class="grid gap-2 sm:grid-cols-2">
          <RadioCard
            name="standard"
            checked={settings.standardEngine === 'google'}
            onSelect={() => update({ standardEngine: 'google' })}
            title="Google Translate"
            description={t('engineGoogleDesc')}
          />
          <RadioCard
            name="standard"
            checked={settings.standardEngine === 'bing'}
            onSelect={() => update({ standardEngine: 'bing' })}
            title="Microsoft Bing"
            description={t('engineBingDesc')}
          />
        </div>
      </Field>

      <Field label={t('aiEngine')} hint={t('aiEngineHint')} htmlFor="ai-engine">
        <select
          id="ai-engine"
          class={inputClass}
          value={settings.aiEngine}
          onChange={(e) => update({ aiEngine: (e.currentTarget as HTMLSelectElement).value as AiEngine })}
        >
          <option value="auto">{t('aiEngineAuto')}</option>
          <option value="chrome">Chrome AI (Gemini Nano)</option>
          <option value="gemini">Google Gemini API</option>
          <option value="openai">{t('openaiCompatible')}</option>
        </select>
      </Field>

      {/* Chrome built-in AI */}
      <div class="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold">Chrome AI (Gemini Nano)</h3>
          <Badge tone="ok">{t('free')}</Badge>
          <Badge tone="ok">{t('private')}</Badge>
        </div>
        <p class="mb-3 text-xs text-ink-500 dark:text-ink-400">{t('chromeAiDesc')}</p>
        {ai && (
          <div class="mb-3 flex flex-wrap gap-2 text-xs">
            <span>
              Prompt API: <Badge tone={aiTone(ai.prompt)}>{statusLabel(ai.prompt)}</Badge>
            </span>
            <span>
              Translator API: <Badge tone={aiTone(ai.translator)}>{statusLabel(ai.translator)}</Badge>
            </span>
          </div>
        )}
        {ai && (ai.prompt === 'downloadable' || ai.prompt === 'downloading' || ai.translator === 'downloadable') && hasBuiltInAi() && (
          <Button
            variant="primary"
            disabled={download !== null}
            onClick={() => {
              setDownload(0);
              setAiError('');
              aiDownload(settings.targetLang, (ratio) => setDownload(ratio))
                .then(setAi, (e: Error) => setAiError(e.message))
                .finally(() => setDownload(null));
            }}
          >
            <Icon name="sparkles" />
            {download !== null
              ? t('downloadingModel', [String(Math.round(download * 100))])
              : t('downloadModel', [getLanguageName(settings.targetLang, uiLocale())])}
          </Button>
        )}
        {aiError && <p class="mt-2 text-xs text-red-600 dark:text-red-400">{aiError}</p>}
      </div>

      {/* Gemini */}
      <div class="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold">Google Gemini API</h3>
          <Badge tone="ok">{t('freeTier')}</Badge>
          {secrets.geminiKey ? <Badge tone="ok">{t('configured')}</Badge> : <Badge tone="off">{t('notConfigured')}</Badge>}
        </div>
        <p class="mb-3 text-xs text-ink-500 dark:text-ink-400">
          {t('geminiDesc')}{' '}
          <a
            class="inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline dark:text-brand-300"
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
          >
            {t('getFreeKey')} <Icon name="external" size={12} />
          </a>
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <Field label={t('apiKey')} htmlFor="gemini-key">
            <div class="flex gap-1.5">
              <input
                id="gemini-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellcheck={false}
                class={inputClass}
                placeholder="AIza…"
                value={secrets.geminiKey}
                onChange={(e) => updateSecrets({ geminiKey: (e.currentTarget as HTMLInputElement).value.trim() })}
              />
              <Button variant="ghost" title={t('showHide')} onClick={() => setShowKey(!showKey)}>
                <Icon name="eye" />
              </Button>
            </div>
          </Field>
          <Field label={t('model')} htmlFor="gemini-model">
            <div class="flex gap-1.5">
              <input
                id="gemini-model"
                list="gemini-models"
                class={inputClass}
                placeholder={DEFAULT_GEMINI_MODEL}
                value={settings.geminiModel}
                onChange={(e) => update({ geminiModel: (e.currentTarget as HTMLInputElement).value.trim() || DEFAULT_GEMINI_MODEL })}
              />
              <datalist id="gemini-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <Button
                disabled={!secrets.geminiKey}
                title={t('loadModels')}
                onClick={() =>
                  void listGeminiModels(secrets.geminiKey).then(setModels, (e: Error) =>
                    setGeminiTest({ status: 'error', text: e.message }),
                  )
                }
              >
                {t('loadModels')}
              </Button>
            </div>
          </Field>
        </div>
        <div class="mt-3 flex flex-col items-start gap-2">
          <Button
            disabled={!secrets.geminiKey || geminiTest.status === 'running'}
            onClick={() => void runTest(geminiProvider, setGeminiTest)}
          >
            {t('testConnection')}
          </Button>
          <TestResult state={geminiTest} />
        </div>
      </div>

      {/* OpenAI-compatible */}
      <div class="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold">{t('openaiCompatible')}</h3>
          {settings.openaiBaseUrl && settings.openaiModel ? (
            <Badge tone="ok">{t('configured')}</Badge>
          ) : (
            <Badge tone="off">{t('notConfigured')}</Badge>
          )}
        </div>
        <p class="mb-3 text-xs text-ink-500 dark:text-ink-400">{t('openaiDesc')}</p>
        <div class="mb-3 flex flex-wrap gap-1.5">
          {OPENAI_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              class={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                settings.openaiBaseUrl === preset.baseUrl
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'border-ink-200 hover:border-brand-300 dark:border-ink-700'
              }`}
              onClick={() => update({ openaiBaseUrl: preset.baseUrl, openaiModel: preset.model || settings.openaiModel })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <Field label={t('baseUrl')} htmlFor="openai-url">
            <input
              id="openai-url"
              class={inputClass}
              placeholder="https://api.groq.com/openai/v1"
              value={settings.openaiBaseUrl}
              onChange={(e) => update({ openaiBaseUrl: (e.currentTarget as HTMLInputElement).value.trim() })}
            />
          </Field>
          <Field label={t('apiKeyOptional')} htmlFor="openai-key">
            <input
              id="openai-key"
              type="password"
              autoComplete="off"
              class={inputClass}
              value={secrets.openaiKey}
              onChange={(e) => updateSecrets({ openaiKey: (e.currentTarget as HTMLInputElement).value.trim() })}
            />
          </Field>
          <Field label={t('model')} htmlFor="openai-model">
            <input
              id="openai-model"
              class={inputClass}
              value={settings.openaiModel}
              onChange={(e) => update({ openaiModel: (e.currentTarget as HTMLInputElement).value.trim() })}
            />
          </Field>
        </div>
        {OPENAI_PRESETS.find((p) => p.baseUrl === settings.openaiBaseUrl && p.keyUrl) && (
          <a
            class="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
            href={OPENAI_PRESETS.find((p) => p.baseUrl === settings.openaiBaseUrl)?.keyUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t('getFreeKey')} <Icon name="external" size={12} />
          </a>
        )}
        <div class="mt-3 flex flex-col items-start gap-2">
          <Button
            disabled={!settings.openaiBaseUrl || !settings.openaiModel || openaiTest.status === 'running'}
            onClick={() => void runTest(openaiProvider, setOpenaiTest)}
          >
            {t('testConnection')}
          </Button>
          <TestResult state={openaiTest} />
        </div>
      </div>
    </Section>
  );
}
