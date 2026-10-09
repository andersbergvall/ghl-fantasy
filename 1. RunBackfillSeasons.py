import csv
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List

from MainUpdateTrophyStats import load_env_file


PROJECT_ROOT = Path(__file__).resolve().parent
CONFIG_PATH = PROJECT_ROOT / "archived_years" / "config.csv"
MAIN_SCRIPT_PATH = PROJECT_ROOT / "MainUpdateTrophyStats.py"

# Hard-code the seasons you want to backfill here.
# 100% manually assigned seasons
BACKFILL_SEASONS = ["2013-2014", "2014-2015", "2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021", "2021-2022"]
# Mix of derived & manually assigned seasons
BACKFILL_SEASONS = ["2022-2023", "2023-2024", "2024-2025", "2025-2026"]


def read_config_rows(config_path: Path) -> tuple[List[str], Dict[str, Dict[str, str]]]:
    if not config_path.exists():
        raise FileNotFoundError(f"Missing config file: {config_path}")

    with config_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        fieldnames = [str(name or "").strip() for name in (reader.fieldnames or []) if str(name or "").strip()]
        if not fieldnames:
            raise ValueError(f"Config file has no header row: {config_path}")
        if "SEASON_KEY" not in fieldnames:
            raise ValueError("Config file must include a SEASON_KEY column.")

        rows_by_season: Dict[str, Dict[str, str]] = {}
        for row in reader:
            if not row:
                continue
            normalized_row = {str(key or "").strip(): str(value or "").strip() for key, value in row.items()}
            season_key = normalized_row.get("SEASON_KEY", "")
            if season_key:
                rows_by_season[season_key] = normalized_row

    return fieldnames, rows_by_season


def build_child_env(base_env: Dict[str, str], config_columns: List[str], row: Dict[str, str]) -> Dict[str, str]:
    child_env = dict(base_env)
    for column_name in config_columns:
        value = row.get(column_name, "").strip()
        if value:
            child_env[column_name] = value
        else:
            child_env.pop(column_name, None)
    return child_env


def run_backfill_seasons(backfill_seasons: List[str]) -> int:
    load_env_file()
    config_columns, rows_by_season = read_config_rows(CONFIG_PATH)
    base_env = dict(os.environ)

    failures: List[str] = []
    for season_key in backfill_seasons:
        row = rows_by_season.get(season_key)
        if row is None:
            failures.append(f"{season_key}: missing config row")
            continue

        child_env = build_child_env(base_env, config_columns, row)
        print(f"\n=== Running season {season_key} ===")
        print(
            "Using env: "
            f"FANTRAX_LEAGUE_ID={child_env.get('FANTRAX_LEAGUE_ID', '')}, "
            f"WEEKS_IN_SEASON={child_env.get('WEEKS_IN_SEASON', '')}, "
            f"FANTRAX_PLAYER_STATS_SEASON_OR_PROJECTION={child_env.get('FANTRAX_PLAYER_STATS_SEASON_OR_PROJECTION', '')}, "
            f"FIRST_WEEK={child_env.get('FIRST_WEEK', '')}, "
            f"VEGAS_EXCLUDE_WEEK={child_env.get('VEGAS_EXCLUDE_WEEK', '')}, "
            f"WRITE_ARCHIVED_JSONS={child_env.get('WRITE_ARCHIVED_JSONS', '')}, "
            f"PUBLISH_TO_CLOUDFLARE_KV={child_env.get('PUBLISH_TO_CLOUDFLARE_KV', '')}"
        )

        completed = subprocess.run(
            [sys.executable, str(MAIN_SCRIPT_PATH)],
            cwd=str(PROJECT_ROOT),
            env=child_env,
            check=False,
        )
        if completed.returncode != 0:
            failures.append(f"{season_key}: exit code {completed.returncode}")

    if failures:
        print("\nBackfill finished with failures:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("\nBackfill finished successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(run_backfill_seasons(BACKFILL_SEASONS))