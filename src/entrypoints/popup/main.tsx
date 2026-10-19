import { render } from 'preact';
import '@/assets/tailwind.css';
import { uiLocale } from '@/utils/i18n';
import { App } from './App';

document.documentElement.lang = uiLocale();
render(<App />, document.getElementById('app') as HTMLElement);
