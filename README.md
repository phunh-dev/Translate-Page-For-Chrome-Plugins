# Translate Page – Free translator for every Chromium browser

Extension Manifest V3 giúp **dịch toàn bộ trang** hoặc **đoạn văn bôi đen** sang hơn 240 ngôn ngữ, miễn phí, có **phong cách dịch theo lĩnh vực** (công nghệ, kỹ thuật, khoa học, y khoa, báo chí, ẩm thực, tạp chí…). Chạy trên Chrome, Edge, Brave, Opera, Vivaldi, Cốc Cốc, Arc.

*A free Manifest V3 extension that translates whole pages or selected text into 240+ languages, with domain-specific translation styles. English summary at the bottom.*

## Tính năng

| | |
|---|---|
| **Dịch toàn trang** | Bấm "Dịch trang này" trong popup, chuột phải → *Dịch trang này*, hoặc `Alt+A`. Ưu tiên dịch phần đang hiển thị, phần còn lại dịch khi cuộn tới. Tự dịch nội dung mới (SPA, infinite scroll). Chế độ **Thay thế** hoặc **Song ngữ**. Khôi phục bản gốc ngay lập tức. |
| **Dịch đoạn bôi đen** | Bôi đen → nút dịch nổi → thẻ dịch: đổi ngôn ngữ, đổi phong cách, sao chép, nghe đọc. Hoặc chuột phải → *Dịch đoạn đã chọn*, hoặc `Alt+T`. |
| **Mọi ngôn ngữ** | 249 ngôn ngữ đích của Google; tên ngôn ngữ hiển thị theo ngôn ngữ giao diện; tự nhận diện ngôn ngữ nguồn. |
| **Phong cách dịch** | 15 preset (Thông dụng, Công nghệ, Kỹ thuật, Khoa học, Y khoa, Pháp lý, Tài chính, Báo chí, Ẩm thực, Tạp chí, Học thuật, Marketing, Game, Văn học, Đời thường) và phong cách tự tạo với prompt riêng. |
| **Theo trang web** | "Luôn dịch" / "Không bao giờ dịch" theo tên miền; bỏ qua trang đã ở ngôn ngữ của bạn. |
| **Giao diện** | Tiếng Việt + English (theo ngôn ngữ trình duyệt), dark mode, bàn phím & screen reader. |

## Miễn phí như thế nào?

Engine được chọn tự động; người dùng không cần làm gì để dùng ngay:

```
Phong cách "Thông dụng"  →  Google Translate (free endpoint)  →  Microsoft Bing  →  Chrome on-device Translator
Phong cách lĩnh vực      →  Chrome AI (Gemini Nano, on-device)  →  Gemini API free tier  →  OpenAI-compatible
                             └─ nếu không có engine AI nào: dùng bản dịch thông thường + gợi ý cài AI miễn phí
```

- **Google / Bing**: endpoint web miễn phí, không cần key. Đây là endpoint không chính thức, nên router có fallback, cache 7 ngày, gom batch, rate-limit và cooldown khi gặp lỗi 429.
- **Chrome AI**: Gemini Nano chạy trên máy (Chrome mới, thiết bị hỗ trợ). Mở *Cài đặt → Engine dịch* để tải mô hình.
- **Gemini API**: lấy key miễn phí tại [Google AI Studio](https://aistudio.google.com/apikey), dán vào *Cài đặt*.
- **OpenAI-compatible**: Groq, OpenRouter (model `:free`), Ollama / LM Studio chạy local.

## Tech stack

| Hạng mục | Lựa chọn |
|---|---|
| Framework | [WXT](https://wxt.dev) 0.21 (Vite 8), Manifest V3, build `chrome-mv3` dùng chung cho mọi trình duyệt Chromium |
| Ngôn ngữ | TypeScript 5.9 (strict) |
| Popup / Options | Preact 10 + Tailwind CSS 4 |
| UI chèn vào trang | TypeScript thuần + CSS trong Shadow DOM (constructable stylesheets). Không dùng `innerHTML`, nên chạy được cả trên trang có CSP chặt / Trusted Types |
| Cache | LRU trong bộ nhớ + IndexedDB (`idb-keyval`), TTL 7 ngày |
| Lint / format | Biome 2 |
| Test | Vitest 4 + happy-dom (unit), Playwright (E2E, nạp extension thật) |
| Package manager | pnpm 10 (qua Corepack) |
| CI | GitHub Actions: lint → typecheck → test → build → size budget → zip → E2E |

## Kiến trúc

```
src/
├─ entrypoints/
│  ├─ background.ts                 # router dịch, context menu, phím tắt, inject script theo yêu cầu
│  ├─ content.ts                    # loader 3 KB trên mọi trang: nút dịch khi bôi đen + quy tắc "luôn dịch"
│  ├─ page-translator.content.ts    # inject khi bấm dịch trang (registration: runtime)
│  ├─ selection-ui.content.ts       # thẻ dịch đoạn chọn (registration: runtime)
│  ├─ offscreen/                    # host cho Chrome built-in AI (không có trong service worker)
│  ├─ popup/  options/              # Preact + Tailwind
├─ core/
│  ├─ providers/                    # google, bing, gemini, openai-compatible, chrome-ai
│  ├─ router.ts batcher.ts cache.ts rate-limit.ts
│  ├─ dom/                          # walker, segmenter (<xN> placeholders), renderer, page-translator
│  ├─ styles/                       # presets + prompt builder
│  └─ languages.ts ai-host.ts html.ts
├─ ui/                              # Shadow-DOM UI: selection card, page toolbar
├─ components/                      # LanguagePicker, StylePicker, Toggle, Icon
└─ utils/                           # settings (storage), messaging, i18n
```

Một số điểm thiết kế đáng chú ý:

- **Chỉ đổi `nodeValue`** ở chế độ Thay thế. Không di chuyển hay tạo lại element, nên React/Vue không bị hỏng khi trang được dịch.
- Mỗi khối văn bản là một *segment*. Thẻ inline (`a`, `b`, `span`…) được thay bằng placeholder `<x0>…</x0>`, nên link và định dạng vẫn giữ nguyên. Nếu engine trả về placeholder bị hỏng, extension tự dịch lại từng text node.
- **Hiệu năng**: trên mọi trang chỉ chạy loader 3 KB gzip; các phần còn lại chỉ được inject khi cần. Ngân sách kích thước được kiểm tra bằng `pnpm size` (loader ≤ 10 KB, page translator ≤ 30 KB, popup ≤ 50 KB, đều tính gzip).

## Phát triển

```bash
corepack enable          # hoặc: npm i -g pnpm
pnpm install
pnpm dev                 # mở trình duyệt với extension (xem web-ext.config.example.ts)
pnpm build               # → .output/chrome-mv3  (Load unpacked trên mọi trình duyệt Chromium)
pnpm zip                 # → .output/*.zip để upload lên Chrome Web Store / Edge Add-ons
pnpm check               # lint + typecheck + unit test + build + size budget
pnpm exec playwright install chromium
pnpm test:e2e            # E2E trên Chromium (cần mạng)
# E2E_CHANNEL=msedge pnpm test:e2e            → Microsoft Edge
# E2E_EXECUTABLE=<đường dẫn exe> pnpm test:e2e → Brave, Opera… (trình duyệt Chromium bất kỳ)
# E2E_CDP_URL=http://127.0.0.1:9333 …          → trình duyệt tự mở với --remote-debugging-port
pnpm icons | pnpm locales  # sinh lại icon PNG / _locales từ scripts/
```

> Google Chrome bản chính thức (từ 137) bỏ qua `--load-extension`. Khi dev, dùng Chromium/Edge/Brave, hoặc vào `chrome://extensions` → *Load unpacked* → `.output/chrome-mv3`.

Chuỗi giao diện nằm trong [scripts/locales.mjs](scripts/locales.mjs). Sửa ở đó rồi chạy `pnpm locales`.

## Tương thích đã kiểm chứng

| Trình duyệt | Phiên bản | Kết quả |
|---|---|---|
| Chromium (Playwright) | 153 | E2E 6/6 |
| Microsoft Edge | 155 | E2E 6/6 |
| Brave | 1.100.6 | E2E 6/6 |
| Opera | 137 | E2E 6/6 (sau khi sửa lỗi Chrome AI bị treo trên Opera) |
| Vivaldi | 8.2 | Chưa kiểm chứng: trên máy test, chính Vivaldi crash khi khởi động (cả khi không có extension, cả bản giải nén lẫn bản cài standalone). Trước khi crash, extension đã nạp được, service worker chạy, quyền và storage hoạt động. Cần kiểm tra tay. |
| Cốc Cốc | 147 | Chưa kiểm chứng: không có bản portable. Cần cài rồi kiểm tra tay. |

Opera expose `LanguageModel` / `Translator` nhưng các promise của chúng không bao giờ resolve. Vì vậy mọi lời gọi Chrome AI đều có timeout (xem [src/core/timeout.ts](src/core/timeout.ts)).

## Quyền & quyền riêng tư

Quyền sử dụng: `storage`, `activeTab`, `scripting`, `contextMenus`, `offscreen` và host `<all_urls>`.

Content script trên mọi trang đã kéo theo cảnh báo "đọc và thay đổi dữ liệu trên mọi trang web", nên thêm host `<all_urls>` không làm xuất hiện cảnh báo mới. Quyền này cho phép inject script theo yêu cầu và gọi tới các engine dịch.

Chi tiết dữ liệu nào được gửi đi, gửi tới đâu: [PRIVACY.md](PRIVACY.md).

---

## English summary

Translate Page translates the **whole page** (replace or bilingual mode, viewport-first, dynamic content aware, instant restore) or **selected text** (floating button, context menu, `Alt+T`) into **249 languages**, for **free**.

- **Literal translation** uses the free Google endpoint, with Bing and Chrome's on-device Translator as fallbacks.
- **15 domain styles** plus custom prompts use an AI engine: Chrome built-in AI (Gemini Nano, on-device), the free tier of the Gemini API, or any OpenAI-compatible endpoint (Groq, OpenRouter, Ollama).
- **Stack**: WXT + TypeScript, Preact + Tailwind for extension pages, vanilla Shadow-DOM UI for in-page widgets, Biome, Vitest, Playwright, pnpm.
- **Compatibility**: one `chrome-mv3` build for all Chromium browsers. E2E tests pass on Chromium, Microsoft Edge, Brave and Opera; Vivaldi and Cốc Cốc still need a manual check.
