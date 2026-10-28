# LaporFasilitas: Plain HTML/CSS/JS Frontend Prototype

## Goal
Build a polished, responsive, frontend-only prototype for **LaporFasilitas**, a site where citizens report damaged public facilities. It ships as exactly three runtime files, `index.html`, `style.css` and `script.js`, written in plain HTML5, CSS3 and vanilla JavaScript. All UI text is in Bahasa Indonesia. Nothing depends on Figma or a backend. Data comes from mock objects behind an API-shaped service layer that can later be switched to `fetch()` calls to an Express.js REST API.

## Decisions (confirmed)
- **Persistence:** login state, new reports, status changes and profile edits are kept in `sessionStorage`. They survive a refresh and reset when the tab closes. Uploaded photos are compressed with a canvas so they fit. If the storage quota is exceeded, the app falls back to memory and shows a warning toast.
- **Status demo:** the report detail modal includes a clearly labeled **"Simulasi Petugas (Demo)"** control that calls `updateReportStatus()`. The status change shows up immediately in the badges, the timeline and the stats.
- **Status Laporan page:** shows only the logged-in user's reports ("Laporan Saya"). The Dashboard shows all public reports.

## Workspace facts and environment handling
- The repo is an empty React + Vite + Tailwind scaffold (`src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`). The Make preview runs on Vite, which serves the root `index.html`.
- **Plan:**
  1. Replace the root `index.html` with the plain HTML app. Use `lang="id"`, a real `<title>` and a meta description, and remove the `<!-- figma:* -->` slots so the file works standalone.
  2. Add `style.css` and `script.js` at the repo root, next to `index.html`, linked by relative paths (`./style.css`, `./script.js`). The script is a **classic** `<script src="./script.js" defer>`, not a module, so opening `index.html` straight from disk (`file://`) works.
  3. Delete the unused React files in `src/` (`App.tsx`, `main.tsx`, `index.css`, `vite-env.d.ts`). Leave `package.json` and dependencies alone; they are Make tooling only.
  4. Add one small Make-only plugin to `vite.config.ts` (with a comment noting it is not part of the deliverable). Vite does not bundle or copy classic scripts, so the plugin emits `script.js` into `dist/` during `generateBundle` (via `this.emitFile({type:'asset', fileName:'script.js', source})`). Deploys then keep working. Confirm with a single `vite build` that the site-config `transformIndexHtml` plugin handles missing slots (it should be a no-op).
- Do not start a dev server; the supervised one hot-reloads.

## External resources (all optional at runtime, with graceful fallbacks)
- Font: **Plus Jakarta Sans** (designed in Indonesia) via a Google Fonts `<link>` with `display=swap`, falling back to `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Photos: hotlinked Unsplash image URLs (`images.unsplash.com/...?w=…&q=…&auto=format&fit=crop`), chosen with the `make/unsplash` skill during implementation. Needed: one hero image (modern Indonesian or Asian cityscape or infrastructure), about 12 report photos (pothole or broken road, damaged sidewalk, broken streetlight, clogged drainage or gutter, flooded street, damaged park bench or playground, cracked public building wall, broken bus stop, damaged bridge railing, fallen tree or sign), and one portrait for the user avatar. Every `<img>` gets meaningful `alt`, `loading="lazy"` (except the hero), and an `onerror` handler that swaps in a neutral SVG placeholder.
- Icons: an **inline SVG `<symbol>` sprite** at the top of `index.html` (Lucide-style 24px stroke icons drawn by hand: home, info, list-checks, log-in, user-plus, layout-dashboard, file-plus, clipboard-list, book-open, user, log-out, map-pin, calendar, tag, search, filter, camera, upload, x, check-circle, clock, alert-circle, menu, chevron-left/right, eye, edit, mail, phone, shield, globe, image). Used via `<svg class="icon"><use href="#i-map-pin"/></svg>` with `aria-hidden="true"`. No icon libraries.
- No frameworks, no CSS libraries, no build step required.

## Application architecture (single page, hash router)

### Routes
| Hash | View | Access |
|---|---|---|
| `#/` (default) | Landing (Home with About, How It Works, Stats, Footer) | public |
| `#/masuk` | Login | public (redirects to dashboard if already logged in) |
| `#/daftar` | Register | public (same redirect) |
| `#/dashboard` | Dashboard overview and report list | protected |
| `#/buat-laporan` | Create report | protected |
| `#/status` | Status Laporan (Laporan Saya) | protected |
| `#/panduan` | Panduan Pelaporan / Tentang | protected (inside app shell) |
| `#/profil` | Profil Akun | protected |
| `#/laporan/:id` | Opens the detail modal on top of the previous view (deep-linkable; closing restores the previous hash) | protected |

- Landing nav links "Beranda / Tentang / Cara Kerja" are in-page anchors that scroll smoothly to `#beranda`, `#tentang` and `#cara-kerja`. The router ignores them because they are not `#/...` hashes. The navbar also has "Masuk" and "Daftar".
- Protected routes without a session redirect to `#/masuk`, show the toast "Silakan masuk terlebih dahulu", and return to the originally requested route after login.
- When logged in, the landing navbar swaps Masuk/Daftar for a "Ke Dashboard" button.
- Unknown route: a friendly 404 view with a "Kembali ke Beranda" link.
- On every route change: update `document.title` (e.g. "Buat Laporan · LaporFasilitas"), move focus to the view's `<h1>` (`tabindex="-1"`), scroll to the top, set `aria-current="page"` on the active nav item, and close the mobile drawer.

### DOM structure in `index.html`
- Skip link "Lewati ke konten utama".
- `<div id="public-shell">`: public navbar, `<main id="public-view">`, footer.
- `<div id="app-shell" hidden>`: sidebar `<nav>`, top header (mobile menu button, page title, search shortcut, notification-less avatar chip linking to the profile), `<main id="app-view">`.
- `<template>` elements for repeated markup (report card, status table row, empty state, skeleton card) so markup stays in HTML and JS only fills in data.
- `<dialog id="report-dialog">` for report details, `<dialog id="confirm-dialog">` for logout confirmation, `<dialog id="profile-dialog">` for editing the profile. Native `<dialog>` with `showModal()` gives focus trapping, Esc to close, and a backdrop.
- `<div id="toast-region" role="status" aria-live="polite">`.
- Static page content (landing sections, guide page, login/register forms) is written in HTML inside `<template id="tpl-page-…">` blocks that the router clones into the right `<main>`. Dynamic parts are filled in by the renderers.

## Data model (shared contract for the future backend)
```js
// Report
{
  id: "LF-2025-0012",          // string ID
  title: "Jalan berlubang di depan SDN 03",
  description: "…",
  category: "jalan",           // key from CATEGORIES
  location: "Jl. Merdeka No. 21, Kel. Sukajadi, Kota Bandung",
  photoUrl: "https://…",       // URL (mock) or compressed dataURL (new report)
  createdAt: "2025-05-14T08:30:00+07:00",  // ISO 8601
  updatedAt: "…",
  status: "baru" | "proses" | "selesai",
  reporterId: "u-001",
  reporterName: "Rina Wulandari",
  isPublic: true,
  history: [{ status, date, note }]        // drives the status timeline
}
// User
{ id, fullName, email, phone, city, avatarUrl, joinedAt, role: "warga" }
```
- `CATEGORIES`: `jalan` "Jalan & Trotoar", `lampu` "Lampu Jalan", `gedung` "Gedung Publik", `drainase` "Drainase & Saluran Air", `taman` "Taman & Ruang Terbuka", `lainnya` "Fasilitas Lainnya". Each has an icon ID.
- `STATUSES`: `baru` → label "Baru", `proses` → "Dalam Proses", `selesai` → "Selesai". Each has a CSS modifier class, icon and description (reused on the guide page).
- Mock data: 12 realistic reports across Bandung, Jakarta, Surabaya, Yogyakarta, Semarang and Medan, with dates spread over the last 2 months and a status mix of roughly 4 baru / 4 proses / 4 selesai. Four of them belong to the demo user `u-001` (Rina Wulandari, `warga@laporfasilitas.id`), plus one or two more demo users.

## `script.js` organization (`'use strict'`, wrapped in an IIFE, clearly commented sections)
1. **CONFIG**: `const API_CONFIG = { USE_MOCK: true, BASE_URL: 'http://localhost:3000/api' /* future Express.js */, MOCK_LATENCY_MS: 600 }`, plus the storage key names.
2. **MOCK DATA**: `MOCK_USERS`, `MOCK_REPORTS`, `CATEGORIES`, `STATUSES`.
3. **STORAGE helpers**: `loadState()` and `saveState()`. These merge the `sessionStorage` copy over the seed data, wrap writes in try/catch, and on quota errors switch to in-memory mode once with a warning toast.
4. **SERVICE / API LAYER**: every function is `async`, returns plain data (deep-cloned), and awaits `mockDelay()` to imitate network latency so the loading states are real. Each one has a `// TODO(API): …` block showing the exact future `fetch` call. No real requests are made.
   - `getReports({ search, category, status, reporterId } = {})` → future `GET /api/reports?search=&category=&status=`
   - `getReportById(id)` → `GET /api/reports/:id`
   - `createReport(reportData)` → `POST /api/reports` (multipart `FormData` with the photo). The mock generates the ID, `createdAt`, `status:'baru'` and the first history entry.
   - `updateReportStatus(id, status, note)` → `PATCH /api/reports/:id/status` (officer only in the future)
   - `getDashboardStats(reports?)` → `GET /api/reports/stats`. The mock computes `{ total, belumSelesai, selesai, baru, proses }` from the same report dataset.
   - `getMyReports()` → `GET /api/users/me/reports`
   - `loginUser({ email, password })` → `POST /api/auth/login` (future JWT or cookie). Mock rule: valid email format and a password of at least 6 characters. Signs in as the matching mock user, or otherwise builds a user from the email. Session token `mock-token-…`.
   - `registerUser({ fullName, email, phone, password })` → `POST /api/auth/register`. The mock rejects an email that already exists ("Email sudah terdaftar"), then auto-logs in.
   - `logoutUser()`, `getCurrentUser()`, `updateUserProfile(data)` → `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/users/me`
   - Pure helper `filterReports(reports, criteria)` matches case- and diacritic-insensitive search on title, location, description and category label, plus a category or status filter. It is shared by the mock `getReports` and by the client-side filtering.
   - `calculateStats(reports)` is a pure function used by `getDashboardStats`.
5. **UTILITIES**: `escapeHTML`, `formatDate` (`Intl.DateTimeFormat('id-ID', { day:'numeric', month:'long', year:'numeric' })`), `formatRelative` ("3 hari lalu"), `debounce`, `compressImage(file, maxSide=1280, quality=0.78)` → dataURL, `$`/`$$` helpers, `generateId()`.
6. **UI COMPONENTS**: `renderStatusBadge`, `renderReportCard`, `renderStatusRow`, `renderStatCard`, `renderEmptyState`, `renderSkeletons`, `showToast(message, type)`, `openReportDialog(id)`, `confirmDialog(text)`, and `setButtonLoading(btn, bool)` (spinner, `aria-busy`, disabled). All user text goes through `textContent` or `escapeHTML` to prevent XSS.
7. **PAGE CONTROLLERS**: `initLanding`, `initLogin`, `initRegister`, `initDashboard`, `initCreateReport`, `initStatus`, `initGuide`, `initProfile`. Each is called by the router after cloning its template, and uses event delegation.
8. **ROUTER and APP SHELL**: `routes` map, `navigate()`, guards, sidebar and drawer behavior.
9. **INIT**: on `DOMContentLoaded`, load state, then render the current route.

## Page specifications

### 1. Landing (`#/`)
- **Sticky navbar:** logo mark (SVG shield + pin) and "LaporFasilitas". Links Beranda, Tentang, Cara Kerja, then a "Masuk" ghost button and a "Daftar" solid button. Turns solid white with a shadow after scrolling. On mobile, a hamburger opens a dropdown panel (`aria-expanded`, Esc closes).
- **Hero:** full-bleed city image with a navy gradient overlay for contrast. Eyebrow "Platform Pelaporan Fasilitas Publik". H1 "Bersama Wujudkan Fasilitas Publik yang Lebih Baik". Short description. CTAs "Daftar Sekarang" (primary) and "Masuk" (outline-light). Trust row: "Gratis · Transparan · Dapat dipantau publik". A floating glass card shows a live sample report with its status badge.
- **Tentang:** purpose text and 3–4 benefit cards (Transparan, Cepat Ditindaklanjuti, Berbasis Lokasi, Partisipasi Warga), plus a "Bagaimana Anda dapat berkontribusi" list.
- **Cara Kerja:** 3 numbered steps connected by a line: Kirim Laporan → Pantau Progres → Masalah Terselesaikan, each with an icon.
- **Statistik Laporan Publik:** Total, Dalam Proses/Belum Selesai, Selesai, computed from `calculateStats(state.reports)`, with a count-up animation that respects `prefers-reduced-motion`. Note text "Data contoh untuk demonstrasi".
- **CTA band:** "Siap melaporkan kerusakan di sekitar Anda?" with Daftar/Masuk buttons.
- **Footer:** description, nav links, contact placeholders (email `halo@laporfasilitas.id`, phone `(021) 0000-0000`, address placeholder), © year.

### 2. Login (`#/masuk`) and Register (`#/daftar`)
- Split layout: an image or brand panel on the left (hidden on mobile) and a form card on the right. A "← Kembali ke Beranda" link.
- **Login:** Email, Kata Sandi (show/hide toggle), "Ingat saya" (cosmetic), and a "Masuk" submit with a loading state. A demo hint box offers a "Gunakan akun demo" button that fills `warga@laporfasilitas.id` / `demo123`. Inline errors and a form-level error alert. A link to Daftar.
- **Register:** Nama Lengkap, Email, No. HP (optional, Indonesian pattern), Kata Sandi (≥8 chars, with a strength hint), Konfirmasi Kata Sandi (must match), and a required checkbox for the terms and public-visibility notice. Success: toast "Akun berhasil dibuat" and auto-login to the dashboard.
- Both forms state that this is a demo simulation.

### 3. App shell (after login)
- **Sidebar items**, each with an icon and label: Dashboard, Buat Pelaporan, Status Laporan, Panduan & Tentang, Profil Akun, separator, Logout. Logout opens the confirm dialog, then `logoutUser()`, then `#/` with the toast "Anda telah keluar".
- **Desktop/tablet (≥768px):** a collapsed 76px icon rail by default. On `:hover` or `:focus-within` it expands to 264px as an **overlay** with a shadow, so content doesn't reflow. Labels fade in, and collapsed items have `title` and `aria-label` tooltips. A toggle button (chevron, `aria-expanded`, `aria-controls`) **pins** it open, which pushes the content (margin transition); the pin state is saved in sessionStorage. Hover expansion uses a short delay to avoid flicker.
- **Mobile (<768px):** the sidebar is hidden off-canvas. A header menu button opens it as a drawer with a backdrop. Backdrop click, Esc or choosing a link closes it, and focus returns to the menu button. Focus moves into the drawer when it opens, and body scroll is locked.
- **Top header:** page title, a primary "Buat Laporan" button (icon-only on mobile), and a user chip (avatar and first name) linking to Profil.

### 4. Dashboard (`#/dashboard`)
- Greeting "Selamat datang kembali, Rina" plus today's date (no emoji).
- **3 stat cards** from `getDashboardStats()`: Belum Selesai (orange/red tones, clock icon, subtext "Baru: x · Dalam Proses: y"), Selesai (green, check icon), Total Laporan (navy, clipboard icon). Each has a percentage bar of total.
- **Report list** titled "Laporan Fasilitas Publik Terkini":
  - Toolbar: search input (debounced 250ms, clear button, `role="search"`), Kategori `<select>`, status filter as segmented chips (Semua / Baru / Dalam Proses / Selesai) with `aria-pressed`, and a result count "Menampilkan 8 laporan" (`aria-live`).
  - Responsive card grid (1 / 2 / 3 columns). Each card: 16:10 thumbnail with the status badge overlaid, category tag with icon, title (2-line clamp), location with pin icon, date with calendar icon, description (2-line clamp), and a "Lihat Detail" button. The whole card is not one giant link, only the button, for accessibility.
  - Sorted newest first. The loading state shows 6 skeleton cards. When nothing matches: illustration icon, "Laporan tidak ditemukan", hint text, and a "Reset filter" button.

### 5. Buat Laporan (`#/buat-laporan`)
- Two columns on desktop: the form on the left, a tips aside on the right (photo tips, link to Panduan). Single column on mobile.
- A prominent **public visibility notice** (info banner with a globe icon): "Laporan dan foto yang Anda kirim akan ditampilkan secara publik. Jangan sertakan data pribadi atau wajah orang yang dapat dikenali."
- **Fields:**
  - Judul Laporan: required, 10–100 characters, with a counter.
  - Kategori Fasilitas: required radio-card group with icons (6 categories), keyboard navigable.
  - Deskripsi Kerusakan: required, 30–1000 characters, with a counter and placeholder guidance.
  - Lokasi / Alamat: required, ≥10 characters. Optional "Patokan" landmark field appended to the location. Optional "Gunakan lokasi saat ini" button using `navigator.geolocation` that adds coordinates to the field; handle denied or unsupported with a toast, and note that address lookup comes later via the API.
  - Foto Kerusakan: required. A dropzone (click, Enter/Space, drag-and-drop) backed by a hidden but accessible `<input type="file" accept="image/jpeg,image/png,image/webp">`. Validates type and a 5 MB maximum. Preview shows the image, file name and size, plus "Ganti" and "Hapus" buttons.
  - Required consent checkbox: "Saya memahami bahwa laporan ini akan dapat dilihat publik."
- **Validation:** `novalidate` with custom JS. Validate on blur and on submit. Errors appear inline with `aria-invalid`, `aria-describedby` and red text with an icon. A summary alert lists the errors on submit, and focus moves to the first invalid field.
- **Submit:** button loading state "Mengirim laporan…" → `compressImage` → `createReport` → a success panel replaces the form. It shows a check icon, "Laporan berhasil dikirim!", the report ID, and buttons "Lihat Detail", "Lihat Status Laporan" and "Buat Laporan Lain" (which resets the form). Success toast. The report now appears first on the Dashboard and in Status, and the stats update. On failure (mock throws on quota/compress error): error toast, and the form data is kept.
- Leaving with unsaved input: no blocking prompt; keep it simple.

### 6. Status Laporan (`#/status`)
- Header "Status Laporan Saya", with mini counters per status that double as filter chips.
- Toolbar: search and status filter (Semua/Baru/Dalam Proses/Selesai), plus a category select.
- **Desktop/tablet:** a semantic `<table>` (caption visually hidden) with columns Judul (with ID and small thumbnail), Tanggal, Kategori, Lokasi, Status, Aksi ("Detail"). Rows get a colored left border per status.
- **Mobile (<640px):** the same rows reflow into stacked cards (CSS, using `data-label` attributes).
- Empty states: if the user has no reports, "Anda belum membuat laporan" with a "Buat Laporan" CTA. If filters match nothing, a reset option.

### 7. Report detail modal (`#/laporan/:id`)
- Large photo, status badge, ID, title, category, location (with a "Salin alamat" button), dates, reporter name, full description, and a "Dapat dilihat publik" tag.
- **Status timeline** from `history`: Baru → Dalam Proses → Selesai, with the reached steps colored and dated.
- **"Simulasi Petugas (Demo)"** panel with a dashed border and an explanatory note "Fitur ini hanya untuk demonstrasi; di sistem nyata dilakukan oleh petugas." It holds a status select plus an optional note and an "Perbarui Status" button → `updateReportStatus` → toast, then re-render the modal and the underlying view and stats.
- Not-found ID: the modal shows "Laporan tidak ditemukan".

### 8. Panduan & Tentang (`#/panduan`)
- Intro and "Tentang LaporFasilitas".
- 4 reporting steps (Masuk akun → Isi formulir → Unggah foto & lokasi → Pantau status).
- **Tips Foto yang Baik**, as do/don't cards: good lighting, show the scale of the damage, include a landmark, a few angles, no faces or plates, no blurry photos.
- **Pentingnya Lokasi Akurat**: why it matters, plus examples of a good and a bad address.
- **Arti Status Laporan**: the 3 status badges with explanations (taken from `STATUSES`).
- FAQ using `<details>`/`<summary>`. A CTA to "Buat Laporan".

### 9. Profil Akun (`#/profil`)
- Profile header card: avatar (image, or initials fallback), full name, email, a role badge "Warga Terverifikasi (Demo)", and "Bergabung sejak …".
- Account info list: Nama Lengkap, Email, No. HP, Kota, ID Pengguna, Jumlah laporan per status (computed).
- Buttons: "Edit Profil" opens the profile dialog (name, phone and city with validation) → `updateUserProfile` → toast, and the header chip updates. A "Keluar" danger-outline button opens the logout confirmation.

## Visual design system (`style.css`)
- CSS custom properties in `:root`:
  - Navy palette: `--navy-900 #0B1F3A`, `--navy-800 #12305A`, `--navy-700 #1B4079`, `--primary #1D4ED8` for links and focus accents, `--primary-600 #1E40AF`.
  - Grays: `--gray-50 #F5F7FB`, `--gray-100 #EEF1F6`, `--gray-200 #E2E7EF`, `--gray-500 #64748B`, `--gray-700 #334155`, `--gray-900 #0F172A`.
  - Status pairs, chosen for ≥4.5:1 contrast: Baru red text `#B42318` on `#FEF3F2`, border `#FECDCA`. Dalam Proses orange text `#B54708` on `#FFFAEB`, border `#FEDF89`. Selesai green text `#067647` on `#ECFDF3`, border `#ABEFC6`.
  - Radii 8/12/16px, a shadow scale (sm/md/lg, soft and navy-tinted), spacing on a 4px scale, and transition tokens.
- Typography: base 16px with line-height 1.6. Fluid headings via `clamp()`, weights 400/500/600/700/800.
- Section order: reset/base → tokens → layout utilities (container, grid, stack) → components (buttons: primary/secondary/outline/ghost/danger in sm/md/lg sizes; inputs; badges; cards; chips; table; dialog; toast; skeleton; dropzone; timeline; sidebar) → pages → responsive media queries (breakpoints 640 / 768 / 1024 / 1280).
- States: hover (lift and shadow on cards, darker buttons), `:focus-visible` with a 3px ring `rgba(29,78,216,.45)` plus offset, `:active` scale 0.98, disabled, loading spinner, skeleton shimmer.
- `@media (prefers-reduced-motion: reduce)` disables transitions and animations.
- Status is never shown by color alone: badges always have an icon and a text label.

## Accessibility checklist
- Semantic landmarks: `header`, `nav` (with `aria-label`), `main`, `footer`. One `h1` per view with a logical heading order.
- Every interactive element is reachable and operable by keyboard. Dialogs are native. The drawer handles focus and Esc. Chip groups use buttons with `aria-pressed`.
- Form labels are always visible (not placeholder-only). Errors are linked with `aria-describedby`. The live region announces result counts and toasts.
- Alt text on every image. Uploaded photos use the alt text "Foto laporan: {judul}".

## Verification
1. One `pnpm build` (repo script) to confirm Vite emits `index.html`, the CSS and `script.js` without errors; fix the copy plugin if `script.js` is missing.
2. Check the Make preview manually: landing anchors and mobile nav; demo login and register validation; route guard redirect; sidebar collapsed, hover/focus expansion, pin toggle and mobile drawer; dashboard stats match the counts in the list; search, category and status filters plus empty-state reset; create report with invalid, then valid input, image preview, remove/replace, success, then the new report appears first, Total and Belum Selesai go up by 1, and it shows under Status; Simulasi Petugas changes status and the stats update; refresh keeps the session data; profile edit and logout.
3. Check responsive behavior at about 375, 768, 1024 and 1440px. Do a keyboard-only pass (Tab, Enter, Esc) over the nav, forms and dialogs.
4. `grep` the three files to confirm there is no `react`, `import`, `fetch(` (outside comments), `figma` or `type="module"`. Confirm `index.html` uses only relative `./style.css` and `./script.js`, so it opens directly from disk.

## Out of scope
- A real backend, authentication, database, maps or geocoding, notifications, an admin panel (beyond the demo status control), or i18n beyond Bahasa Indonesia.

## Files touched
- `index.html`: rewritten.
- `style.css`: new, at the root.
- `script.js`: new, at the root.
- `vite.config.ts`: add the small Make-only plugin that copies `script.js` into the build.
- `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`: deleted (unused React scaffold).
