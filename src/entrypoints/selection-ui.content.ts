// Injected on demand (by the loader or the background) into the frame holding the selection.
import { defineContentScript } from 'wxt/utils/define-content-script';
import { SelectionCard } from '@/ui/selection-card';

export default defineContentScript({
  registration: 'runtime',
  main() {
    globalThis.__tpcSelectionCard ??= new SelectionCard();
  },
});
