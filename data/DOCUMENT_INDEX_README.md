# Document index

- `data/document-index.json` — full local index (includes absolutePath); gitignored.
- `public/data/document-index.json` — app-friendly copy (relative path, type, series, optional `quarantined[]`).
- `public/data/tech-sheet-sync.json` — Tech mirror replace/add map for `npm run sync:tech-sheets`.
- Types from filename / sync map: `PL`, `ED`, `SM`, `EDPL` (combined), `other`.
- HD28 sheets are class-tagged (`VCM2837WC` vs `VCM2837FFC`) so WC/FF never soft-collide.
- Binary PDFs remain only under local `data-sheets/` (e.g. `C:\Temp\rinnai-spare-parts\data-sheets\`) — not for git.
- Source zip: local `zip/Rinnai Data Sheets.zip`. Tech refresh: Project store `media/rinnai-tech-latest/`.

## Serving PDFs in the app

- Config: `public/data/config.json` → `documents.rootUrl` (`/data-sheets`), `documents.localFolder` (`data-sheets`).
- Vite (`vite.config.js`) maps `/data-sheets/*` → `./data-sheets/*` for `npm run dev` and `npm run preview`.
- Index `path` values look like `data-sheets/Rinnai Data Sheets/….pdf`; the app strips the `data-sheets/` prefix and opens `{rootUrl}/Rinnai Data Sheets/….pdf`.
- No static copy under `public/` — keeps ~283MB binaries out of git and the build.
