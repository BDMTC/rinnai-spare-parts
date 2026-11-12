# Document index

- `data/document-index.json` — full local index (includes absolutePath); gitignored.
- `public/data/document-index.json` — app-friendly copy (relative path, type, series).
- Types from filename: `PL`, `ED`, `SM`, `EDPL` (combined), `other`.
- Series tags for HD28: `REU-VCM2837`, `VCM2837`, `HD28` on the VCM2837 parts-list PDFs.
- Binary PDFs remain only under local `data-sheets/` (e.g. `C:\Temp\rinnai-spare-parts\data-sheets\`) — not for git.
- Source zip: local `zip/Rinnai Data Sheets.zip`.

## Serving PDFs in the app

- Config: `public/data/config.json` → `documents.rootUrl` (`/data-sheets`), `documents.localFolder` (`data-sheets`).
- Vite (`vite.config.js`) maps `/data-sheets/*` → `./data-sheets/*` for `npm run dev` and `npm run preview`.
- Index `path` values look like `data-sheets/Rinnai Data Sheets/….pdf`; the app strips the `data-sheets/` prefix and opens `{rootUrl}/Rinnai Data Sheets/….pdf`.
- No static copy under `public/` — keeps ~283MB binaries out of git and the build.
