# ghl-fantasy

The tracker publishes live data to KV and the frontend reads from hosted JSON endpoints.

## Live data source

The app defaults to loading live JSON from these endpoints:

- `/trophy-data` (reads key `trophy-data`)
- `/matchup-data` (reads key `matchup-data`)