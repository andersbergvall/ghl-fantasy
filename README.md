# ghl-fantasy

The tracker publishes live data to KV and the frontend reads from hosted JSON endpoints.

## Live data source

The app defaults to loading live JSON from these endpoints:

- `/trophy-data` (reads key `trophy-data`)
- `/matchup-data` (reads key `matchup-data`)
- `/rosters` (reads roster payload from the rosters KV namespace)
- `/rosters-history` (optional; leave unset if historical rosters are not published)

## Backfill runner

Use [RunBackfillSeasons.py](RunBackfillSeasons.py) to run one or more archived seasons from [config/config.csv](config/config.csv).

1. Edit `BACKFILL_SEASONS` in `RunBackfillSeasons.py`.
2. Make sure each season exists in `config/config.csv` with env-style columns such as `SEASON_KEY`, `FANTRAX_LEAGUE_ID`, `WEEKS_IN_SEASON`, `FIRST_WEEK`, and `WRITE_ARCHIVED_JSONS`.
3. Run `python RunBackfillSeasons.py`.

The runner loads the local env file, applies the CSV row values as per-run env vars, clears blank config values to avoid leaking settings from a previous season, and then executes `MainUpdateTrophyStats.py` once per selected season.

## Run locally (frontend)

This project is static-host compatible. To run it locally:

1. From the project root, start a local web server:
	- `python -m http.server 8000`
2. Open `http://localhost:8000` in your browser.

Notes:

- `index.html` now loads `tradeEngine.js` before `app.js` so trade generation stays deterministic and fully client-side.
- API endpoint globals in `index.html` can still point at hosted JSON sources.

## Trade engine tests

The deterministic trade engine has a standalone Node test script:

- `node tests/tradeEngine.test.js`

The test file covers acquisition parsing (`DraftPick` semantics), constraints/filters, deterministic output, mode behavior (`fair`/`fleece`), multi-size proposals, dedupe, and a synthetic performance check.

## Assumptions and limitations

- Proposal quality is bounded by the available roster and free-agent data in the loaded season payload.
- Historical seasons with incomplete or inconsistent fields (for example missing `FP/G`, `Age`, or malformed `DraftPick`) are handled defensively, but may reduce recommendation quality.
- Team-fit and replacement-level calculations are model-based heuristics and are not guaranteed to match every league's custom roster/waiver rules.