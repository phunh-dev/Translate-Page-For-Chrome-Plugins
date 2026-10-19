import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { Icon, type IconName, Logo } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { StylePicker } from '@/components/StylePicker';
import { Toggle } from '@/components/Toggle';
import { t } from '@/utils/i18n';
import { sendToBackground } from '@/utils/messaging';
import {
  getSecrets,
  getSettings,
  type Secrets,
  type Settings,
  updateSecrets,
  updateSettings,
  watchSettings,
  withRecentLang,
} from '@/utils/settings';
import { Engines } from './Engines';
import { Sites } from './Sites';
import { Styles } from './Styles';
import { Button, Field, RadioCard, Section } from './ui';

const NAV: { id: string; icon: IconName; key: string }[] = [
  { id: 'general', icon: 'settings', key: 'sectionGeneral' },
  { id: 'engines', icon: 'cpu', key: 'sectionEngines' },
  { id: 'styles', icon: 'palette', key: 'sectionStyles' },
  { id: 'sites', icon: 'globe', key: 'sectionSites' },
  { id: 'shortcuts', icon: 'keyboard', key: 'sectionShortcuts' },
  { id: 'privacy', icon: 'shield', key: 'sectionPrivacy' },
];

interface Command {
  name?: string;
  description?: string;
  shortcut?: string;
}

export function App() {
  const [settings, setSettings] = useState<Settings>();
  const [secrets, setSecrets] = useState<Secrets>();
  const [commands, setCommands] = useState<Command[]>([]);
  const [saved, setSaved] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    void getSettings().then(setSettings);
    void getSecrets().then(setSecrets);
    void browser.commands.getAll().then(setCommands);
    return watchSettings(setSettings);
  }, []);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const update = (patch: Partial<Settings>) => {
    void updateSettings(patch).then((next) => {
      setSettings(next);
      flashSaved();
    });
  };

  const patchSecrets = (patch: Partial<Secrets>) => {
    void updateSecrets(patch).then((next) => {
      setSecrets(next);
      flashSaved();
    });
  };

  if (!settings || !secrets) return null;

  return (
    <div class="min-h-screen bg-ink-50 dark:bg-ink-950">
      <div class="mx-auto flex max-w-5xl gap-8 px-4 py-8 md:px-6">
        <aside class="sticky top-8 hidden h-fit w-52 shrink-0 md:block">
          <div class="mb-6 flex items-center gap-2.5">
            <Logo size={34} />
            <div>
              <p class="leading-tight font-semibold">{t('extShortName')}</p>
              <p class="text-xs text-ink-500 dark:text-ink-400">{t('settings')}</p>
            </div>
          </div>
          <nav class="space-y-0.5">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-600 transition hover:bg-white hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-850 dark:hover:text-white"
              >
                <Icon name={item.icon} size={16} />
                {t(item.key)}
              </a>
            ))}
          </nav>
        </aside>

        <main class="min-w-0 flex-1 space-y-6">
          <div class="flex items-center gap-2.5 md:hidden">
            <Logo size={30} />
            <h1 class="text-lg font-semibold">
              {t('extShortName')} – {t('settings')}
            </h1>
          </div>

          <Section id="general" icon="settings" title={t('sectionGeneral')} description={t('sectionGeneralDesc')}>
            <Field label={t('defaultTargetLanguage')} htmlFor="default-lang">
              <div class="max-w-sm">
                <LanguagePicker
                  id="default-lang"
                  value={settings.targetLang}
                  recent={settings.recentLangs}
                  onChange={(code) => update({ targetLang: code, recentLangs: withRecentLang(settings.recentLangs, code) })}
                />
              </div>
            </Field>
            <Field label={t('defaultStyle')}>
              <div class="max-w-xl">
                <StylePicker value={settings.style} customStyles={settings.customStyles} onChange={(id) => update({ style: id })} />
              </div>
            </Field>
            <Field label={t('displayMode')}>
              <div class="grid gap-2 sm:grid-cols-2">
                <RadioCard
                  name="mode"
                  checked={settings.displayMode === 'replace'}
                  onSelect={() => update({ displayMode: 'replace' })}
                  title={t('modeReplace')}
                  description={t('modeReplaceDesc')}
                />
                <RadioCard
                  name="mode"
                  checked={settings.displayMode === 'bilingual'}
                  onSelect={() => update({ displayMode: 'bilingual' })}
                  title={t('bilingualMode')}
                  description={t('bilingualModeDesc')}
                />
              </div>
            </Field>
            <div class="divide-y divide-ink-100 dark:divide-ink-800">
              <Toggle
                checked={settings.selectionIcon}
                onChange={(v) => update({ selectionIcon: v })}
                label={t('selectionIcon')}
                description={t('selectionIconDesc')}
              />
              <Toggle
                checked={settings.skipSameLanguage}
                onChange={(v) => update({ skipSameLanguage: v })}
                label={t('skipSameLanguage')}
                description={t('skipSameLanguageDesc')}
              />
            </div>
          </Section>

          <Engines settings={settings} secrets={secrets} update={update} updateSecrets={patchSecrets} />
          <Styles settings={settings} update={update} />
          <Sites settings={settings} update={update} />

          <Section id="shortcuts" icon="keyboard" title={t('sectionShortcuts')} description={t('sectionShortcutsDesc')}>
            <ul class="divide-y divide-ink-100 dark:divide-ink-800">
              {commands
                .filter((c) => c.description)
                .map((command) => (
                  <li key={command.name} class="flex items-center justify-between py-2 text-sm">
                    <span>{command.description}</span>
                    <kbd class="rounded-lg border border-ink-200 bg-ink-50 px-2 py-0.5 font-sans text-xs dark:border-ink-700 dark:bg-ink-900">
                      {command.shortcut || t('notSet')}
                    </kbd>
                  </li>
                ))}
            </ul>
            <Button onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
              <Icon name="external" />
              {t('changeShortcuts')}
            </Button>
          </Section>

          <Section id="privacy" icon="shield" title={t('sectionPrivacy')} description={t('sectionPrivacyDesc')}>
            <ul class="list-disc space-y-1 pl-5 text-sm text-ink-600 dark:text-ink-300">
              <li>{t('privacyPoint1')}</li>
              <li>{t('privacyPoint2')}</li>
              <li>{t('privacyPoint3')}</li>
            </ul>
            <div class="flex items-center gap-3">
              <Button
                variant="danger"
                onClick={() =>
                  void sendToBackground('cache:clear', {}).then(() => {
                    setCacheCleared(true);
                    setTimeout(() => setCacheCleared(false), 2000);
                  })
                }
              >
                <Icon name="database" />
                {t('clearCache')}
              </Button>
              {cacheCleared && <span class="text-sm text-emerald-600 dark:text-emerald-400">✓ {t('cacheCleared')}</span>}
            </div>
          </Section>

          <p class="pb-4 text-center text-xs text-ink-400">
            {t('extShortName')} v{browser.runtime.getManifest().version}
          </p>
        </main>
      </div>

      <div
        role="status"
        aria-live="polite"
        class={`fixed right-4 bottom-4 rounded-xl bg-ink-900 px-3 py-2 text-sm text-white shadow-lg transition-all dark:bg-white dark:text-ink-900 ${
          saved ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        ✓ {t('saved')}
      </div>
    </div>
  );
}
