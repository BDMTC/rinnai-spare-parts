# Source workbooks (local)

Drop Rinnai Excel workbooks here before running ingest.

Expected files (filenames may change — update `public/data/config.json`):

- `REU-Model-History.xlsx` → models
- `Price-List-Spare-Parts-Effective-01-04-26.xlsx` → prices (all sheets)

`.xlsx` files are gitignored. Generated JSON under `public/data/` is what the app loads.

```bash
npm run ingest
```

Override paths without editing config:

```bash
npm run ingest -- --price-list /path/to/new-price-list.xlsx
npm run ingest -- --models /path/to/REU-Model-History.xlsx
```
