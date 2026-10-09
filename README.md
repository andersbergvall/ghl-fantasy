# ghl-fantasy

The tracker publishes live data to KV and the frontend reads from hosted JSON endpoints.

## Live data source

The app defaults to loading live JSON from these endpoints:

- `/trophy-data` (reads key `trophy-data`)
- `/matchup-data` (reads key `matchup-data`)

## Backfill runner

Use [RunBackfillSeasons.py](c:/Users/sweabe/Dropbox/Desktop/GHL/AI Projects/Trophy%20Tracker/RunBackfillSeasons.py) to run one or more archived seasons from [archived_years/config.csv](c:/Users/sweabe/Dropbox/Desktop/GHL/AI Projects/Trophy%20Tracker/archived_years/config.csv).

1. Edit `BACKFILL_SEASONS` in `RunBackfillSeasons.py`.
2. Make sure each season exists in `archived_years/config.csv` with env-style columns such as `SEASON_KEY`, `FANTRAX_LEAGUE_ID`, `WEEKS_IN_SEASON`, `FIRST_WEEK`, and `WRITE_ARCHIVED_JSONS`.
3. Run `python RunBackfillSeasons.py`.

The runner loads the local env file, applies the CSV row values as per-run env vars, clears blank config values to avoid leaking settings from a previous season, and then executes `MainUpdateTrophyStats.py` once per selected season.