// Source of truth for UI strings. Run `node scripts/locales.mjs` to regenerate
// public/_locales/{en,vi}/messages.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** key → [English, Vietnamese] */
const MESSAGES = {
  extName: ['Translate Page – Free Translator for Chromium', 'Translate Page – Dịch trang miễn phí cho Chromium'],
  extShortName: ['Translate Page', 'Translate Page'],
  extDescription: [
    'Translate whole pages or selected text into 240+ languages for free, with domain styles (tech, medical, news, food…).',
    'Dịch toàn trang hoặc đoạn văn bôi đen sang hơn 240 ngôn ngữ, miễn phí, có phong cách theo lĩnh vực (công nghệ, y khoa, báo chí, ẩm thực…).',
  ],
  extTagline: ['Free page & selection translator', 'Dịch trang & đoạn văn miễn phí'],
  actionTitle: ['Translate this page', 'Dịch trang này'],
  cmdTranslatePage: ['Translate page / show original', 'Dịch trang / hiện bản gốc'],
  cmdTranslateSelection: ['Translate selected text', 'Dịch đoạn đã chọn'],
  menuTranslatePage: ['Translate this page / show original', 'Dịch trang này / hiện bản gốc'],
  menuTranslateSelection: ['Translate selection', 'Dịch đoạn đã chọn'],

  styleGeneral: ['General', 'Thông dụng'],
  styleGeneralDesc: [
    'Fast literal translation with the free engine. No AI needed.',
    'Dịch nhanh, sát nghĩa bằng engine miễn phí. Không cần AI.',
  ],
  styleTechnology: ['Technology', 'Công nghệ'],
  styleEngineering: ['Engineering', 'Kỹ thuật'],
  styleScience: ['Science', 'Khoa học'],
  styleMedical: ['Medical', 'Y khoa'],
  styleLegal: ['Legal', 'Pháp lý'],
  styleFinance: ['Finance', 'Tài chính'],
  styleJournalism: ['Journalism', 'Báo chí'],
  styleFood: ['Food', 'Ẩm thực'],
  styleMagazine: ['Magazine', 'Tạp chí'],
  styleAcademic: ['Academic', 'Học thuật'],
  styleMarketing: ['Marketing', 'Marketing'],
  styleGaming: ['Gaming', 'Game'],
  styleLiterature: ['Literature', 'Văn học'],
  styleCasual: ['Casual', 'Đời thường'],

  targetLanguage: ['Target language', 'Ngôn ngữ đích'],
  translateTo: ['Translate to', 'Dịch sang'],
  recentLanguages: ['Recent', 'Gần đây'],
  allLanguages: ['All languages', 'Tất cả ngôn ngữ'],
  searchLanguage: ['Search languages…', 'Tìm ngôn ngữ…'],
  noResults: ['No matching language', 'Không tìm thấy ngôn ngữ'],
  translationStyle: ['Translation style', 'Phong cách dịch'],
  copy: ['Copy', 'Sao chép'],
  speak: ['Listen', 'Nghe'],
  detecting: ['Detecting…', 'Đang nhận diện…'],
  autoDetect: ['Auto-detected', 'Tự nhận diện'],
  openSettings: ['Settings', 'Cài đặt'],
  settings: ['Settings', 'Cài đặt'],
  close: ['Close', 'Đóng'],
  retry: ['Retry', 'Thử lại'],
  translationFailed: ['Translation failed.', 'Dịch thất bại.'],
  styleNeedsAi: [
    'Styles need an AI engine. A literal translation was used instead.',
    'Phong cách dịch cần engine AI. Đã dùng bản dịch thông thường thay thế.',
  ],
  setupAi: ['Set up a free AI engine', 'Cài đặt AI miễn phí'],

  statusTranslating: ['Translating… $1%', 'Đang dịch… $1%'],
  statusTranslated: ['Translated to $1', 'Đã dịch sang $1'],
  statusOriginal: ['Showing original', 'Đang hiện bản gốc'],
  statusError: ['Translation failed', 'Dịch thất bại'],
  viaProvider: ['via $1', 'qua $1'],
  styleFallbackShort: ['Style unavailable – literal translation', 'Chưa có AI – dịch thông thường'],
  partialError: ['Some parts could not be translated', 'Một số đoạn chưa dịch được'],
  showOriginal: ['Show original', 'Hiện bản gốc'],
  showTranslation: ['Show translation', 'Hiện bản dịch'],
  bilingualMode: ['Bilingual', 'Song ngữ'],
  bilingualModeDesc: ['Show the translation under the original text', 'Hiện bản dịch ngay dưới bản gốc'],
  hideToolbar: ['Hide toolbar', 'Ẩn thanh công cụ'],
  translatePage: ['Translate this page', 'Dịch trang này'],
  translatingPercent: ['Translating… $1%', 'Đang dịch… $1%'],
  cannotTranslatePage: [
    'This page can’t be translated (browser or store page).',
    'Không thể dịch trang này (trang của trình duyệt hoặc cửa hàng).',
  ],
  alwaysTranslateSite: ['Always translate $1', 'Luôn dịch $1'],
  shortcutPage: ['page', 'dịch trang'],
  shortcutSelection: ['selection', 'dịch đoạn chọn'],

  sectionGeneral: ['General', 'Chung'],
  sectionGeneralDesc: [
    'Defaults used by the popup, the selection card and shortcuts.',
    'Mặc định cho popup, thẻ dịch đoạn chọn và phím tắt.',
  ],
  defaultTargetLanguage: ['Default target language', 'Ngôn ngữ đích mặc định'],
  defaultStyle: ['Default translation style', 'Phong cách dịch mặc định'],
  displayMode: ['Page display', 'Cách hiển thị trang'],
  modeReplace: ['Replace', 'Thay thế'],
  modeReplaceDesc: ['Replace the original text with the translation', 'Thay văn bản gốc bằng bản dịch'],
  selectionIcon: ['Show translate button on selection', 'Hiện nút dịch khi bôi đen'],
  selectionIconDesc: ['A small button appears next to selected text.', 'Một nút nhỏ xuất hiện cạnh đoạn văn được bôi đen.'],
  skipSameLanguage: ['Skip pages already in my language', 'Bỏ qua trang đã ở ngôn ngữ của tôi'],
  skipSameLanguageDesc: ['Applies to sites set to “always translate”.', 'Áp dụng cho các trang được đặt “luôn dịch”.'],

  sectionEngines: ['Translation engines', 'Engine dịch'],
  sectionEnginesDesc: [
    'Everything works for free out of the box. Add a free AI engine to unlock translation styles.',
    'Mọi tính năng dùng được miễn phí ngay. Thêm một engine AI miễn phí để dùng phong cách dịch.',
  ],
  standardEngine: ['Standard engine (no key needed)', 'Engine tiêu chuẩn (không cần key)'],
  standardEngineHint: [
    'Used for the General style; the other one is the automatic fallback.',
    'Dùng cho phong cách Thông dụng; engine còn lại là dự phòng tự động.',
  ],
  engineGoogleDesc: ['Fast, 240+ languages. Recommended.', 'Nhanh, hơn 240 ngôn ngữ. Khuyên dùng.'],
  engineBingDesc: ['Microsoft Translator, ~130 languages.', 'Microsoft Translator, khoảng 130 ngôn ngữ.'],
  aiEngine: ['AI engine for styles', 'Engine AI cho phong cách dịch'],
  aiEngineHint: [
    'Auto tries Chrome AI, then Gemini, then your OpenAI-compatible endpoint.',
    'Tự động thử Chrome AI, rồi Gemini, rồi endpoint tương thích OpenAI.',
  ],
  aiEngineAuto: ['Auto (recommended)', 'Tự động (khuyên dùng)'],
  openaiCompatible: ['OpenAI-compatible (Groq, OpenRouter, Ollama…)', 'Tương thích OpenAI (Groq, OpenRouter, Ollama…)'],
  free: ['Free', 'Miễn phí'],
  private: ['On-device', 'Chạy trên máy'],
  freeTier: ['Free tier', 'Gói miễn phí'],
  chromeAiDesc: [
    'Runs Gemini Nano on your computer: free, private, works offline. Requires a recent Chrome on a supported device; other Chromium browsers show “not supported”.',
    'Chạy Gemini Nano ngay trên máy: miễn phí, riêng tư, dùng được offline. Cần Chrome mới trên thiết bị được hỗ trợ; trình duyệt Chromium khác sẽ báo “không hỗ trợ”.',
  ],
  aiStatus_available: ['Ready', 'Sẵn sàng'],
  aiStatus_downloadable: ['Needs download', 'Cần tải về'],
  aiStatus_downloading: ['Downloading', 'Đang tải'],
  aiStatus_unavailable: ['Unavailable on this device', 'Không khả dụng trên máy này'],
  aiStatus_unsupported: ['Not supported by this browser', 'Trình duyệt không hỗ trợ'],
  downloadModel: ['Download models (English → $1)', 'Tải mô hình (Tiếng Anh → $1)'],
  downloadingModel: ['Downloading… $1%', 'Đang tải… $1%'],
  configured: ['Configured', 'Đã cấu hình'],
  notConfigured: ['Not configured', 'Chưa cấu hình'],
  geminiDesc: [
    'Google AI Studio gives free API keys with a generous daily quota.',
    'Google AI Studio cấp API key miễn phí với hạn mức hằng ngày khá rộng.',
  ],
  getFreeKey: ['Get a free key', 'Lấy key miễn phí'],
  apiKey: ['API key', 'API key'],
  apiKeyOptional: ['API key (optional)', 'API key (tuỳ chọn)'],
  showHide: ['Show / hide', 'Hiện / ẩn'],
  model: ['Model', 'Model'],
  loadModels: ['Load list', 'Tải danh sách'],
  testConnection: ['Test', 'Kiểm tra'],
  testing: ['Testing…', 'Đang kiểm tra…'],
  openaiDesc: [
    'Any /chat/completions endpoint: Groq and OpenRouter have free models, Ollama and LM Studio run locally.',
    'Bất kỳ endpoint /chat/completions nào: Groq và OpenRouter có model miễn phí, Ollama và LM Studio chạy trên máy.',
  ],
  baseUrl: ['Base URL', 'Base URL'],

  sectionStyles: ['Translation styles', 'Phong cách dịch'],
  sectionStylesDesc: [
    'Each style tells the AI engine how to write for a domain. Click a card to read its guide.',
    'Mỗi phong cách hướng dẫn AI cách viết cho một lĩnh vực. Bấm vào thẻ để xem hướng dẫn.',
  ],
  customStyles: ['Your styles', 'Phong cách của bạn'],
  noCustomStyles: ['No custom styles yet.', 'Chưa có phong cách tự tạo.'],
  edit: ['Edit', 'Sửa'],
  delete: ['Delete', 'Xoá'],
  icon: ['Icon', 'Biểu tượng'],
  styleNameLabel: ['Name', 'Tên'],
  styleNamePlaceholder: ['e.g. Crypto news', 'ví dụ: Tin tức crypto'],
  stylePromptLabel: ['Instructions for the AI', 'Hướng dẫn cho AI'],
  stylePromptHint: ['Describe the domain, tone and terms to keep.', 'Mô tả lĩnh vực, giọng văn và các thuật ngữ cần giữ nguyên.'],
  stylePromptPlaceholder: [
    'Domain: cryptocurrency news. Keep token tickers and English jargon (staking, airdrop) as is…',
    'Lĩnh vực: tin tức tiền mã hoá. Giữ nguyên mã token và thuật ngữ tiếng Anh (staking, airdrop)…',
  ],
  addStyle: ['Add style', 'Thêm phong cách'],
  saveStyle: ['Save', 'Lưu'],
  cancel: ['Cancel', 'Huỷ'],

  sectionSites: ['Sites', 'Trang web'],
  sectionSitesDesc: [
    'Translate some sites automatically, or never offer to translate others.',
    'Tự động dịch một số trang, hoặc không bao giờ dịch các trang khác.',
  ],
  alwaysTranslate: ['Always translate', 'Luôn dịch'],
  neverTranslate: ['Never translate', 'Không bao giờ dịch'],
  add: ['Add', 'Thêm'],
  noSites: ['No sites yet.', 'Chưa có trang nào.'],

  sectionShortcuts: ['Keyboard shortcuts', 'Phím tắt'],
  sectionShortcutsDesc: ['Shortcuts are managed by the browser.', 'Phím tắt do trình duyệt quản lý.'],
  notSet: ['Not set', 'Chưa đặt'],
  changeShortcuts: ['Change shortcuts', 'Đổi phím tắt'],

  sectionPrivacy: ['Privacy & data', 'Quyền riêng tư & dữ liệu'],
  sectionPrivacyDesc: ['What leaves your browser, and when.', 'Dữ liệu nào rời khỏi trình duyệt, và khi nào.'],
  privacyPoint1: [
    'Text is sent only when you ask for a translation, and only to the engine in use (Google, Microsoft, Gemini or your endpoint).',
    'Văn bản chỉ được gửi khi bạn yêu cầu dịch, và chỉ tới engine đang dùng (Google, Microsoft, Gemini hoặc endpoint của bạn).',
  ],
  privacyPoint2: ['Chrome AI translations never leave your device.', 'Bản dịch bằng Chrome AI không bao giờ rời khỏi máy.'],
  privacyPoint3: [
    'API keys are stored locally and never synced. Translations are cached on this device for 7 days.',
    'API key chỉ lưu trên máy, không đồng bộ. Bản dịch được lưu đệm trên máy trong 7 ngày.',
  ],
  clearCache: ['Clear translation cache', 'Xoá bộ nhớ đệm bản dịch'],
  cacheCleared: ['Cache cleared', 'Đã xoá bộ nhớ đệm'],
  saved: ['Saved', 'Đã lưu'],
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', '_locales');
['en', 'vi'].forEach((locale, column) => {
  const out = {};
  for (const [key, values] of Object.entries(MESSAGES)) out[key] = { message: values[column] };
  const file = join(root, locale, 'messages.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
});
console.log(`Wrote ${Object.keys(MESSAGES).length} messages × 2 locales`);
