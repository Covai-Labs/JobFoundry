# Master Resume Multi-Theme Preview & Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable JobFoundry users to preview their master resume rendered across 14 curated JSON Resume themes and select their default theme directly from the Master Resume page.

**Architecture:**
- Update `ALLOWED_THEMES` configuration across backend, Dockerfile, and packaging scripts to include the 14 curated themes and drop `folio-concise`.
- Add `GET /api/v1/master-resume/preview-pdf?theme={theme}` in FastAPI `server/tailor` with SHA256 content-hash caching so previews are generated once and served instantly.
- Create a dedicated "Theme Preview" view mode in `ResumeManager.tsx` with a responsive theme gallery, PDF viewer, and one-click "Set as Default Theme" action updating user settings (`tailor_theme`).

**Tech Stack:** Python 3.14 (FastAPI, pytest), Node.js / resumed, folio-export, TypeScript, React 19, Vite, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-15-master-resume-theme-preview.md`

## Global Constraints
- Curated themes: `jsonresume-theme-folio`, `jsonresume-theme-stackoverflow`, `jsonresume-theme-pro`, `jsonresume-theme-harvard-classic`, `jsonresume-theme-jake-technical`, `jsonresume-theme-awesome-professional`, `jsonresume-theme-compact-developer`, `jsonresume-theme-charter-serif`, `jsonresume-theme-diplomat-cv`, `jsonresume-theme-ledger-professional`, `jsonresume-theme-stewardship-cv`, `jsonresume-theme-europass-inspired`, `jsonresume-theme-first-role`, `jsonresume-theme-academic-classic`.
- Remove `jsonresume-theme-folio-concise` from active allowlists.
- Preview generation is scoped strictly to Master Resume data; tailored resumes are not previewed across all themes.
- Selected theme persists in user profile settings (`tailor_theme`), leaving master resume JSON free of presentation metadata.
- Previews are cached at `DATA_DIR/artifacts/master-previews/{sha256_hash}/{theme}.pdf`.

## Review Focus
1. Master resume missing / unconfigured -> returns 400 with `resume_missing`.
2. Theme requested is not in `ALLOWED_THEMES` -> returns 400 with `invalid_theme`.
3. Master resume is invalid JSON Schema -> UI disables Theme Preview tab with clear notice until errors are resolved.
4. Cache invalidation -> when master resume is edited, new hash ensures stale theme PDFs are never served.
5. Renderer failure -> UI displays clear error state with retry button without crashing the editor.

---

### Task 1: Update Allowed Themes & Catalog Metadata

**Files:**
- Modify: `jobfoundry/server/tailor/src/resume_ops_api/core/config.py`
- Modify: `jobfoundry/server/tailor/.env.example`
- Modify: `jobfoundry/compose.yaml`
- Modify: `jobfoundry/Dockerfile`
- Modify: `jobfoundry/packaging/appimage/build-appimage.sh`
- Modify: `jobfoundry/packaging/windows/build-windows.sh`
- Modify: `jobfoundry/packaging/macos/build-macos.sh`
- Create: `jobfoundry/server/web/src/features/resume/themeCatalog.ts`
- Test: `jobfoundry/server/tailor/tests/test_config.py`
- Test: `jobfoundry/server/web/src/features/resume/__tests__/themeCatalog.test.ts`

**Interfaces:**
- Consumes: Existing config system (`resume_ops_api.core.config.Settings`).
- Produces: `THEME_CATALOG` array with theme metadata (slug, name, category, description, badges).

- [ ] **Step 1: Write the failing tests for config and theme catalog**

In `jobfoundry/server/tailor/tests/test_config.py`:
```python
def test_default_allowed_themes_contains_all_14_themes():
    settings = Settings()
    expected_themes = [
        "jsonresume-theme-folio",
        "jsonresume-theme-stackoverflow",
        "jsonresume-theme-pro",
        "jsonresume-theme-harvard-classic",
        "jsonresume-theme-jake-technical",
        "jsonresume-theme-awesome-professional",
        "jsonresume-theme-compact-developer",
        "jsonresume-theme-charter-serif",
        "jsonresume-theme-diplomat-cv",
        "jsonresume-theme-ledger-professional",
        "jsonresume-theme-stewardship-cv",
        "jsonresume-theme-europass-inspired",
        "jsonresume-theme-first-role",
        "jsonresume-theme-academic-classic",
    ]
    assert "jsonresume-theme-folio-concise" not in settings.allowed_themes
    for theme in expected_themes:
        assert theme in settings.allowed_themes
```

In `jobfoundry/server/web/src/features/resume/__tests__/themeCatalog.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { THEME_CATALOG, findThemeMetadata } from '../themeCatalog';

describe('themeCatalog', () => {
  it('contains 14 curated themes', () => {
    expect(THEME_CATALOG).toHaveLength(14);
  });

  it('does not contain folio-concise', () => {
    expect(findThemeMetadata('jsonresume-theme-folio-concise')).toBeUndefined();
  });

  it('resolves metadata for folio and jake-technical', () => {
    const folio = findThemeMetadata('jsonresume-theme-folio');
    expect(folio?.name).toBe('Folio');
    expect(folio?.engine).toBe('folio');

    const jake = findThemeMetadata('jsonresume-theme-jake-technical');
    expect(jake?.name).toBe('Jake Technical');
    expect(jake?.badges).toContain('ATS-Safe');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd jobfoundry/server/tailor && uv run pytest tests/test_config.py::test_default_allowed_themes_contains_all_14_themes`
Expected: FAIL (only 3 themes currently in default).

- [ ] **Step 3: Update config and create themeCatalog.ts**

Update `jobfoundry/server/tailor/src/resume_ops_api/core/config.py`:
Set default `allowed_themes` to the 14 curated themes (omitting `folio-concise`).

Create `jobfoundry/server/web/src/features/resume/themeCatalog.ts` exporting:
```typescript
export interface ThemeMetadata {
  slug: string;
  name: string;
  category: string;
  description: string;
  badges: string[];
  engine: 'folio' | 'resumed';
}

export const THEME_CATALOG: ThemeMetadata[] = [
  {
    slug: 'jsonresume-theme-folio',
    name: 'Folio',
    category: 'Engineering & Tech',
    description: 'Compact, print-optimized single-page PDF with unified contact bar.',
    badges: ['Single Page', 'ATS-Optimized'],
    engine: 'folio',
  },
  {
    slug: 'jsonresume-theme-stackoverflow',
    name: 'StackOverflow',
    category: 'Engineering & Tech',
    description: 'Developer standard layout modeled after StackOverflow profiles.',
    badges: ['Developer Classic', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-pro',
    name: 'Pro',
    category: 'Corporate & Executive',
    description: 'Typeset single-column serif résumé with clean section hierarchy.',
    badges: ['Executive', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-harvard-classic',
    name: 'Harvard Classic',
    category: 'Academic & Classic',
    description: 'Traditional academic and corporate standard with center masthead.',
    badges: ['Classic', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-jake-technical',
    name: 'Jake Technical',
    category: 'Engineering & Tech',
    description: 'The ubiquitous CS and developer single-page resume format.',
    badges: ['Engineering', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-awesome-professional',
    name: 'Awesome Professional',
    category: 'Modern',
    description: 'Clean modern typography with balanced margins and high readability.',
    badges: ['Modern', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-compact-developer',
    name: 'Compact Developer',
    category: 'Engineering & Tech',
    description: 'Dense, information-rich format suited for seasoned engineers.',
    badges: ['High Density', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-charter-serif',
    name: 'Charter Serif',
    category: 'Editorial',
    description: 'Warm, editorial styling built on Bitstream Charter typography.',
    badges: ['Editorial', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-diplomat-cv',
    name: 'Diplomat CV',
    category: 'Government & Policy',
    description: 'Refined, authoritative CV layout for diplomacy and public policy.',
    badges: ['Formal', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-ledger-professional',
    name: 'Ledger Professional',
    category: 'Finance & Operations',
    description: 'Structured, columnar layout ideal for accounting and finance.',
    badges: ['Structured', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-stewardship-cv',
    name: 'Stewardship',
    category: 'Leadership & Non-Profit',
    description: 'Clean, trust-inspiring format for mission-driven leadership.',
    badges: ['Leadership', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-europass-inspired',
    name: 'Europass Inspired',
    category: 'International',
    description: 'Modern interpretation of the European standard CV structure.',
    badges: ['European Standard', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-first-role',
    name: 'First Role',
    category: 'Early Career',
    description: 'Emphasis on education and projects for graduates and career-switchers.',
    badges: ['Early Career', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-academic-classic',
    name: 'Academic Classic',
    category: 'Academic & Classic',
    description: 'Comprehensive layout designed for publications, grants, and research.',
    badges: ['Academic', 'ATS-Safe'],
    engine: 'resumed',
  },
];

export function findThemeMetadata(slug: string): ThemeMetadata | undefined {
  return THEME_CATALOG.find((t) => t.slug === slug);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd jobfoundry/server/tailor && uv run pytest tests/test_config.py` and `npm --workspace=server/web test`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add jobfoundry/server/tailor/src/resume_ops_api/core/config.py jobfoundry/server/tailor/.env.example jobfoundry/compose.yaml jobfoundry/Dockerfile jobfoundry/server/web/src/features/resume/themeCatalog.ts jobfoundry/server/tailor/tests/test_config.py jobfoundry/server/web/src/features/resume/__tests__/themeCatalog.test.ts
git commit -m "feat(themes): configure 14 curated themes and catalog metadata"
```

---

### Task 2: Master Resume Preview PDF Endpoint with Content-Hash Caching

**Files:**
- Modify: `jobfoundry/server/tailor/src/resume_ops_api/api/routes.py`
- Modify: `jobfoundry/server/tailor/src/resume_ops_api/services/renderer.py`
- Test: `jobfoundry/server/tailor/tests/test_routes.py`
- Test: `jobfoundry/server/tailor/tests/test_services.py`

**Interfaces:**
- Consumes: `container.theme_service.resolve(theme)` and `container.resume_renderer.render()`.
- Produces: `GET /api/v1/master-resume/preview-pdf?theme={theme}` returning `FileResponse` (`application/pdf`).

- [ ] **Step 1: Write failing tests for preview endpoint and caching**

In `jobfoundry/server/tailor/tests/test_routes.py`:
```python
@pytest.mark.asyncio
async def test_master_resume_preview_pdf_returns_pdf(client, sample_resume, tmp_path):
    # Set master resume in container
    response = await client.get("/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-folio")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")

@pytest.mark.asyncio
async def test_master_resume_preview_pdf_caches_result(client, sample_resume, monkeypatch):
    # Second call should serve cached file without calling renderer again
    pass

@pytest.mark.asyncio
async def test_master_resume_preview_pdf_invalid_theme_returns_400(client):
    response = await client.get("/api/v1/master-resume/preview-pdf?theme=invalid-theme")
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd jobfoundry/server/tailor && uv run pytest tests/test_routes.py -k test_master_resume_preview_pdf`
Expected: FAIL (404 route not found).

- [ ] **Step 3: Implement route and caching logic**

In `jobfoundry/server/tailor/src/resume_ops_api/api/routes.py`:
```python
import hashlib
from fastapi.responses import FileResponse

def _compute_resume_hash(resume: dict) -> str:
    serialized = json.dumps(resume, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

@router.get("/api/v1/master-resume/preview-pdf")
async def get_master_resume_preview_pdf(
    theme: str | None = None,
    container: ServiceContainer = Depends(get_container),
) -> FileResponse:
    if not container.master_resume:
        raise AppError("No master resume configured or master resume is empty.", code="resume_missing", status_code=400)
    resolved_theme = container.theme_service.resolve(theme)
    resume_hash = _compute_resume_hash(container.master_resume)

    preview_dir = container.settings.artifacts_dir / "master-previews" / resume_hash
    pdf_path = preview_dir / f"{resolved_theme}.pdf"

    if pdf_path.is_file() and pdf_path.stat().st_size > 0:
        return FileResponse(pdf_path, media_type="application/pdf", filename=f"{resolved_theme}.pdf")

    # Render and store in cache
    rendered_path = await container.resume_renderer.render(
        resume=container.master_resume,
        theme=resolved_theme,
        output_dir=preview_dir,
    )
    # Ensure standard filename
    if rendered_path != pdf_path:
        shutil.move(str(rendered_path), str(pdf_path))

    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{resolved_theme}.pdf")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd jobfoundry/server/tailor && uv run pytest tests/test_routes.py -k test_master_resume_preview_pdf`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add jobfoundry/server/tailor/src/resume_ops_api/api/routes.py jobfoundry/server/tailor/tests/test_routes.py
git commit -m "feat(api): add master resume preview-pdf endpoint with sha256 caching"
```

---

### Task 3: Theme Preview & Selector Component in Web Frontend

**Files:**
- Create: `jobfoundry/server/web/src/features/resume/ThemePreviewGallery.tsx`
- Modify: `jobfoundry/server/web/src/features/resume/ResumeManager.tsx`
- Modify: `jobfoundry/server/web/src/api/client.ts`
- Test: `jobfoundry/server/web/src/features/resume/__tests__/ThemePreviewGallery.test.tsx`
- Test: `jobfoundry/server/web/src/features/resume/__tests__/ResumeManager.test.tsx`

**Interfaces:**
- Consumes: `THEME_CATALOG`, `api.getMasterResumePreviewPdfUrl(theme)`, `api.updateSettings()`.
- Produces: Visual theme switcher and embedded PDF preview in `ResumeManager`.

- [ ] **Step 1: Write failing tests for ThemePreviewGallery**

In `jobfoundry/server/web/src/features/resume/__tests__/ThemePreviewGallery.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemePreviewGallery } from '../ThemePreviewGallery';

describe('ThemePreviewGallery', () => {
  it('renders theme cards with active theme highlighted', () => {
    const onSelectTheme = vi.fn();
    const onSetDefaultTheme = vi.fn();

    render(
      <ThemePreviewGallery
        activeTheme="jsonresume-theme-folio"
        selectedTheme="jsonresume-theme-folio"
        onSelectTheme={onSelectTheme}
        onSetDefaultTheme={onSetDefaultTheme}
        previewPdfUrl="/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-folio"
      />
    );

    expect(screen.getByText('Folio')).toBeInTheDocument();
    expect(screen.getByText('Active Theme')).toBeInTheDocument();
  });

  it('calls onSelectTheme when clicking another theme', () => {
    const onSelectTheme = vi.fn();
    render(
      <ThemePreviewGallery
        activeTheme="jsonresume-theme-folio"
        selectedTheme="jsonresume-theme-folio"
        onSelectTheme={onSelectTheme}
        onSetDefaultTheme={vi.fn()}
        previewPdfUrl="/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-folio"
      />
    );

    fireEvent.click(screen.getByText('Jake Technical'));
    expect(onSelectTheme).toHaveBeenCalledWith('jsonresume-theme-jake-technical');
  });
});
```

- [ ] **Step 2: Run frontend test to verify failure**

Run: `npm --workspace=server/web test ThemePreviewGallery`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement api helper, ThemePreviewGallery, and integrate into ResumeManager**

1. In `jobfoundry/server/web/src/api/client.ts`:
Add:
```typescript
getMasterResumePreviewPdfUrl(theme: string): string {
  const base = `${this.baseUrl}/api/v1/master-resume/preview-pdf?theme=${encodeURIComponent(theme)}`;
  return this.apiKey ? `${base}&api_key=${encodeURIComponent(this.apiKey)}` : base;
}
```

2. Create `ThemePreviewGallery.tsx`:
- Carousel or responsive sidebar/grid of theme cards.
- Each card shows Name, Badges, and "Active Default" pill if `theme.slug === activeTheme`.
- When selected theme is not default, show a prominent `"Set as Default Theme"` button that triggers `onSetDefaultTheme`.
- Embedded `<iframe src={previewPdfUrl} title="Resume Theme Preview" className="w-full h-full min-h-[700px] rounded border" />`.
- "Download PDF" button to download sample PDF directly.

3. Update `ResumeManager.tsx`:
- Add `'preview'` to `editorMode`: `'form' | 'json' | 'preview'`.
- Add tab button: `Theme Preview` (disabled or showing alert if JSON schema validation fails).
- Hook up `activeTheme` from user settings (`tailor_theme`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --workspace=server/web test ThemePreviewGallery` and `npm --workspace=server/web test ResumeManager`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add jobfoundry/server/web/src/features/resume/ThemePreviewGallery.tsx jobfoundry/server/web/src/features/resume/ResumeManager.tsx jobfoundry/server/web/src/api/client.ts jobfoundry/server/web/src/features/resume/__tests__/ThemePreviewGallery.test.tsx
git commit -m "feat(ui): add theme preview gallery and selector to ResumeManager"
```

---

### Task 4: Settings Page Sync & End-to-End Verification

**Files:**
- Modify: `jobfoundry/server/web/src/features/settings/SettingsPage.tsx`
- Test: `jobfoundry/server/web/src/features/settings/__tests__/SettingsPage.test.tsx`
- Test: `jobfoundry/test/*.test.mjs`

- [ ] **Step 1: Write test for SettingsPage listing all 14 themes**

In `jobfoundry/server/web/src/features/settings/__tests__/SettingsPage.test.tsx`:
```typescript
it('displays all 14 curated themes in the default theme dropdown', async () => {
  // Test that dropdown options count is 14 and includes newly curated themes
});
```

- [ ] **Step 2: Update SettingsPage to render from THEME_CATALOG**

In `jobfoundry/server/web/src/features/settings/SettingsPage.tsx`:
Replace hardcoded options:
```tsx
<select
  value={formSettings.tailor_theme}
  onChange={(e) => handleFieldChange('tailor_theme', e.target.value)}
  className="input-text"
>
  {THEME_CATALOG.map((theme) => (
    <option key={theme.slug} value={theme.slug}>
      {theme.name} ({theme.badges.join(', ')})
    </option>
  ))}
</select>
```

- [ ] **Step 3: Run full workspace test suites**

Run:
```bash
npm run test
cd jobfoundry/server/tailor && uv run pytest
```
Expected: All tests PASS with zero regressions.

- [ ] **Step 4: Commit changes**

```bash
git add jobfoundry/server/web/src/features/settings/SettingsPage.tsx jobfoundry/server/web/src/features/settings/__tests__/SettingsPage.test.tsx
git commit -m "feat(settings): populate all 14 themes in settings dropdown and verify tests"
```
