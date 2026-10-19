import { render } from 'preact';
import '@/assets/tailwind.css';
import { t, uiLocale } from '@/utils/i18n';
import { App } from './App';

document.documentElement.lang = uiLocale();
document.title = `${t('extShortName')} – ${t('settings')}`;
render(<App />, document.getElementById('app') as HTMLElement);
