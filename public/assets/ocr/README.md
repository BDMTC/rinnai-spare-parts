# OCR sidecar (lazy)

Built by `npm run ocr:vendor` (also hooked from `npm run build` / `build:file`).

Loaded **only** when an admin drops / picks a dataplate image. Not bundled into `app.js`.

Generated files (`ocr-*.js`, `tesseract*`, `eng.traineddata.gz`, `worker.min.js`) are local build artefacts — see repo `.gitignore`.
