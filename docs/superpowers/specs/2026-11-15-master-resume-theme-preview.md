# Specification: Master Resume Multi-Theme Preview & Selection

## 1. Overview & Objectives
Enable JobFoundry users to visually preview their validated master resume across 14 curated, ATS-safe and print-optimized JSON Resume themes, and set their preferred default theme directly from the Master Resume page (`ResumeManager`).

Preview generation is restricted strictly to the **Master Resume** data and utilizes content-hash caching (`SHA256(master_resume) + theme`) to ensure instant previews after the initial one-time render.

---

## 2. Curated Theme Catalog (14 Themes)

| Slug | Display Name | Category | Engine |
| :--- | :--- | :--- | :--- |
| `jsonresume-theme-folio` | **Folio** | Single Page / ATS-Optimized | `folio-export` |
| `jsonresume-theme-stackoverflow` | **StackOverflow** | Developer Classic | `resumed` |
| `jsonresume-theme-pro` | **Pro** | Typeset Serif Executive | `resumed` |
| `jsonresume-theme-harvard-classic` | **Harvard Classic** | Ivy League Standard | `resumed` |
| `jsonresume-theme-jake-technical` | **Jake Technical** | CS / Engineering Standard | `resumed` |
| `jsonresume-theme-awesome-professional` | **Awesome Professional** | Modern Clean Typography | `resumed` |
| `jsonresume-theme-compact-developer` | **Compact Developer** | High Density Engineering | `resumed` |
| `jsonresume-theme-charter-serif` | **Charter Serif** | Editorial Serif | `resumed` |
| `jsonresume-theme-diplomat-cv` | **Diplomat CV** | Policy & Executive | `resumed` |
| `jsonresume-theme-ledger-professional` | **Ledger Professional** | Structured Columnar Layout | `resumed` |
| `jsonresume-theme-stewardship-cv` | **Stewardship** | Leadership & Non-Profit | `resumed` |
| `jsonresume-theme-europass-inspired` | **Europass Inspired** | International Standard CV | `resumed` |
| `jsonresume-theme-first-role` | **First Role** | Early Career / Graduate | `resumed` |
| `jsonresume-theme-academic-classic` | **Academic Classic** | Full Publications & Research | `resumed` |

*(Note: `jsonresume-theme-folio-concise` is officially retired in favour of `folio`)*.

---

## 3. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph UI ["Master Resume Page (ResumeManager)"]
        MR[Master Resume Data] --> Valid{Schema Valid?}
        Valid -->|Yes| TV[Theme Preview Mode]
        Valid -->|No| Fix[Show Validation Warnings]
        TV --> ClickTheme[User Selects Theme Card]
        ClickTheme --> FetchPDF[Fetch Preview PDF]
        TV --> SetDef[Click 'Set as Default Theme']
        SetDef --> SaveSetting[PUT /api/v1/settings: tailor_theme]
    end

    subgraph Backend ["FastAPI Tailor / Web Server"]
        FetchPDF --> CheckCache{Cache exists for SHA256(resume) + theme?}
        CheckCache -->|Yes| StreamPDF[Stream cached PDF]
        CheckCache -->|No| Render[Spawn folio-export or resumed]
        Render --> WriteCache[Store in /data/artifacts/master-previews/]
        WriteCache --> StreamPDF
    end
```

---

## 4. Backend Implementation Details

1. **Theme Package Dependencies & Allowed Themes**:
   - Update `ALLOWED_THEMES` default configuration in:
     - `jobfoundry/server/tailor/src/resume_ops_api/core/config.py`
     - `jobfoundry/compose.yaml`, `jobfoundry/Dockerfile`, `jobfoundry/server/tailor/.env.example`
     - Packaging scripts (`build-appimage.sh`, `build-windows.sh`, `build-macos.sh`).
   - Add the 12 theme packages to `NPM_THEMES` / npm dependencies.

2. **Master Resume Preview Endpoint**:
   - `GET /api/v1/master-resume/preview-pdf?theme={theme}`
   - Calculates `sha256(canonical_json(master_resume))`.
   - Cache path: `DATA_DIR/artifacts/master-previews/{hash}/{theme}.pdf`.
   - If cache hit: returns the file directly as `application/pdf`.
   - If cache miss: executes `ResumeRenderer.render()` using the master resume JSON, saves to cache path, and returns the PDF.
   - Cleans up stale hash directories when a new master resume is saved.

---

## 5. Frontend Implementation Details (`ResumeManager.tsx`)

1. **View Modes**:
   - Current modes: `Form Editor` | `JSON Editor`.
   - Add third mode / tab: **`Theme Preview`** (available as soon as JSON validation passes).
   - If the user is on the Form or JSON editor, a badge or preview toggle shows: *"Preview in 14 Themes"*.

2. **Theme Gallery & Preview Layout**:
   - **Left / Top Bar**: Responsive grid or carousel of the 14 theme cards.
     - Each card displays theme name, tags (e.g. `Single Page`, `ATS-Safe`, `Engineering`), and an active badge if it is the current `tailor_theme`.
   - **Main Viewer**:
     - Embedded PDF viewer (`<object>` or `<iframe>`) rendering the preview PDF.
     - Action bar:
       - **Set as Active Theme**: Calls `api.updateSettings({ tailor_theme: selectedTheme })` and shows a confirmation toast.
       - **Download PDF**: Downloads the currently previewed PDF directly with a sanitized filename.
     - Smooth loading spinner while generating a PDF preview for the first time.

---

## 6. Verification & Testing

1. **Unit & Integration Tests**:
   - `test_services.py`: Test that each of the 14 themes resolves and calls `resumed` / `folio-export` with correct arguments.
   - `test_routes.py`: Test `GET /api/v1/master-resume/preview-pdf` with cache hits and cache misses, and test invalid theme rejection.
2. **Frontend Component Tests**:
   - `ResumeManager.test.tsx`: Test switching to "Theme Preview" tab, selecting different themes, preview URL updates, and clicking "Set as Default Theme".
3. **Manual Smoke Test**:
   - Edit master resume -> switch to Theme Preview -> cycle through themes -> set default -> verify default persists across page reload.
