#!/usr/bin/env python3
"""Fantrax matchup stat aggregation for a full regular season."""

from __future__ import annotations

import csv
import io
import json
import math
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List

import re
import pandas as pd
import requests


PROJECT_ROOT = Path(__file__).resolve().parent
DRAFT_RESULTS_CSV = PROJECT_ROOT / "DraftResults.csv"
CALDER_CANDIDATES_CSV = PROJECT_ROOT / "CalderCandidates.csv"
FANTALYTICS_FRENZY_CSV = PROJECT_ROOT / "FantalyticsFrenzy.csv"
TROPHY_DATA_JSON = PROJECT_ROOT / "trophy-data.json"
TROPHY_DATA_JS = PROJECT_ROOT / "trophy-data.js"
MATCHUP_DATA_JSON = PROJECT_ROOT / "matchup-data.json"
MATCHUP_DATA_JS = PROJECT_ROOT / "matchup-data.js"

DEFAULT_LEAGUE_ID = "aer4wi7rmtgxmer0"
FANTRAX_PLAYER_STATS_URL = "https://www.fantrax.com/fxpa/downloadPlayerStats"
FANTRAX_STANDINGS_URL = "https://www.fantrax.com/fxpa/downloadStandings"
FANTRAX_MATCHUP_SCORES_URL = "https://www.fantrax.com/fxea/general/getMatchupScores"
REQUIRED_COOKIE_KEYS = ("__cf_bm", "cf_clearance", "FX_RM", "JSESSIONID")

_PLAYER_STATS_DF_CACHE: pd.DataFrame | None = None
_PLAYER_STATS_BY_ID_CACHE: Dict[str, Dict[str, Any]] | None = None
_STANDINGS_TABLES_CACHE: Dict[str, pd.DataFrame] | None = None
_SCHEDULE_TABLES_CACHE: Dict[str, pd.DataFrame] | None = None
DEFAULT_ENV_PATH = Path(r"C:\Users\sweabe\Dropbox\Desktop\GHL\env.txt")

STAT_CATEGORIES = [
    "Goals",
    "Assists",
    "Points",
    "Plus/Minus",
    "Penalty Minutes",
    "Shots on Goal",
    "Power Play Goals",
    "Short-Handed Goals",
    "Game-winning Goals",
    "Hits",
    "Power Play Assists",
    "Short-Handed Assists",
    "Blocks",
    "Wins (Goalies only)",
    "Shutouts",
    "Goals Against",
    "Saves",
    "Overtime Losses + Shootout Losses",
]


def normalize_fantrax_text(value: Any) -> Any:
    """Fix common Fantrax mojibake patterns for accented characters."""
    if not isinstance(value, str):
        return value

    normalized = value.replace("\ufeff", "")

    replacements = [
        ("Ã–", "Ö"),
        ("Ã¶", "ö"),
        ("Ã„", "Ä"),
        ("Ã¤", "ä"),
        ("Ã…", "Å"),
        ("Ã©", "é"),
        ("Ã¡", "á"),
        ("Ã¼", "ü"),
        ("Ã", "Ö"),
        ("Â", ""),
    ]

    for broken, fixed in replacements:
        normalized = normalized.replace(broken, fixed)

    normalized = "".join(ch for ch in normalized if ch.isprintable() or ch in "\n\r\t")
    normalized = normalized.replace("\x96", "").replace("\x97", "")

    if "Ã" in normalized or "Â" in normalized:
        try:
            normalized = normalized.encode("latin-1").decode("utf-8")
        except UnicodeDecodeError:
            pass

    return normalized.strip()


def get_weeks_in_season() -> int:
    """Read the league season-week count from the environment, defaulting to 22."""
    raw_value = os.getenv("WEEKS_IN_SEASON", "22").strip()
    try:
        return max(1, int(float(raw_value)))
    except (TypeError, ValueError):
        return 22


def normalize_team_name(value: Any) -> str:
    """Normalize Fantrax team labels so they can be aligned across CSV tables."""
    if value is None:
        return ""
    return normalize_fantrax_text(str(value)).strip()


def _get_team_column_name(df: pd.DataFrame) -> str | None:
    """Return the team-name column in a standings frame, if present."""
    for column in df.columns:
        cleaned = normalize_fantrax_text(str(column)).strip().lower()
        if cleaned in {"team", "team name", "name"}:
            return str(column)
    return None


def _coerce_numeric(value: Any) -> float:
    """Convert CSV values to float while tolerating blanks and symbols."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).strip().replace(",", "")
    if cleaned in {"", "-", "--", "nan", "NaN"}:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def build_detailed_team_table(skater_df: pd.DataFrame, goalie_df: pd.DataFrame) -> pd.DataFrame:
    """Merge skater and goalie standings by team, summing overlapping numeric columns."""
    if skater_df.empty and goalie_df.empty:
        return pd.DataFrame()

    left_df = skater_df.copy()
    right_df = goalie_df.copy()

    for frame in (left_df, right_df):
        frame.columns = [normalize_fantrax_text(str(column)).strip() for column in frame.columns]

    left_team_col = _get_team_column_name(left_df)
    right_team_col = _get_team_column_name(right_df)
    if left_team_col is None or right_team_col is None:
        return pd.DataFrame()

    left_df = left_df.rename(columns={left_team_col: "Team"})
    right_df = right_df.rename(columns={right_team_col: "Team"})
    left_df["Team"] = left_df["Team"].map(normalize_team_name)
    right_df["Team"] = right_df["Team"].map(normalize_team_name)

    merged = left_df.merge(right_df, on="Team", how="outer", suffixes=("_skaters", "_goalies"))
    overlap_cols = sorted(set(left_df.columns) & set(right_df.columns) - {"Team"})
    for column_name in overlap_cols:
        if column_name == "Team":
            continue
        skater_series = pd.to_numeric(merged.get(f"{column_name}_skaters", 0), errors="coerce").fillna(0)
        goalie_series = pd.to_numeric(merged.get(f"{column_name}_goalies", 0), errors="coerce").fillna(0)
        merged[column_name] = skater_series + goalie_series
        merged = merged.drop(columns=[f"{column_name}_skaters", f"{column_name}_goalies"], errors="ignore")

    # Keep any non-overlapping columns from either side, but drop duplicate suffix-only entries.
    merged = merged.sort_values("Team", kind="mergesort").reset_index(drop=True)
    return merged


def download_standings_tables(
    league_id: str = DEFAULT_LEAGUE_ID,
    weeks_in_season: int | None = None,
    force_refresh: bool = False,
) -> Dict[str, pd.DataFrame]:
    """Download the standings CSV export and split it into Fantrax table frames."""
    global _STANDINGS_TABLES_CACHE

    if _STANDINGS_TABLES_CACHE is not None and not force_refresh:
        return _STANDINGS_TABLES_CACHE

    load_env_file()
    season_weeks = weeks_in_season if weeks_in_season is not None else get_weeks_in_season()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://www.fantrax.com/",
        "Accept": "text/csv,application/json,text/plain,*/*",
    }

    cookie_header = build_cookie_header()
    if cookie_header:
        headers["Cookie"] = cookie_header

    response = requests.get(
        FANTRAX_STANDINGS_URL,
        params={
            "leagueId": league_id,
            "hideGoBackDays": "true",
            "period": season_weeks,
            "timeStartType": "FROM_SEASON_START",
            "timeframeType": "BY_PERIOD",
            "view": "SEASON_STATS",
            "pageNumber": 1,
        },
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()

    csv_text = response.text or ""
    if not csv_text.strip():
        raise ValueError("Fantrax standings export returned an empty response.")

    tables = parse_fantrax_standings_csv(csv_text)
    if not tables:
        raise ValueError("Fantrax standings export did not include any parseable tables.")

    _STANDINGS_TABLES_CACHE = tables
    return _STANDINGS_TABLES_CACHE


def parse_fantrax_standings_csv(csv_text: str) -> Dict[str, pd.DataFrame]:
    """Split a two-dimensional CSV export into table-name keyed dataframes.

    Some Fantrax exports do not include a table title row, so if no named tables are found we
    fall back to a single dataframe keyed as "Schedule" or "Standings".
    """
    rows = list(csv.reader(io.StringIO(csv_text)))
    if not rows:
        return {}

    tables: Dict[str, pd.DataFrame] = {}
    current_table_name: str | None = None
    current_rows: List[List[str]] = []

    def flush_current_table() -> None:
        nonlocal current_table_name, current_rows
        if current_table_name is None or not current_rows:
            return

        table_io = io.StringIO()
        writer = csv.writer(table_io)
        writer.writerows(current_rows)
        table_io.seek(0)

        dataframe = pd.read_csv(table_io)
        if dataframe.empty:
            return

        dataframe.columns = [normalize_fantrax_text(str(column)).strip() for column in dataframe.columns]
        dataframe = dataframe.fillna("")
        tables[current_table_name] = dataframe

        current_table_name = None
        current_rows = []

    for row in rows:
        if not row or all(not str(cell).strip() for cell in row):
            flush_current_table()
            continue

        first_cell = normalize_fantrax_text(row[0]).strip()
        normalized_first = first_cell.lower()
        known_markers = [
            "standings",
            "standings - statistics - skaters",
            "standings - statistics - goalies",
            "standings - points - skaters",
            "standings - points - goalies",
            "schedule",
        ]
        if normalized_first.startswith("scoring period"):
            flush_current_table()
            current_table_name = first_cell
            current_rows = []
            continue

        if normalized_first in known_markers or "standings" in normalized_first or "schedule" in normalized_first:
            flush_current_table()
            current_table_name = first_cell
            current_rows = []
            continue

        if current_table_name is not None:
            current_rows.append(row)

    flush_current_table()

    if tables:
        return tables

    if "scoring period" in csv_text.lower() or ("away" in csv_text.lower() and "home" in csv_text.lower()):
        rows = [row for row in csv.reader(io.StringIO(csv_text)) if row and any(str(cell).strip() for cell in row)]
        data_rows = []
        for row in rows:
            if len(row) < 4:
                continue
            first_value = normalize_fantrax_text(row[0]).lower()
            if first_value.startswith("scoring period"):
                continue
            if first_value in {"away", "home", "team", "name"} and normalize_fantrax_text(row[1]).lower() == "fpts":
                continue
            data_rows.append(row)
        if not data_rows:
            return {}
        tables["Schedule"] = pd.DataFrame(data_rows).fillna("")
        return tables

    fallback_df = pd.read_csv(io.StringIO(csv_text))
    if fallback_df.empty:
        return {}

    fallback_name = "Schedule" if "schedule" in csv_text.lower() else "Standings"
    tables[fallback_name] = fallback_df.fillna("")
    return tables


def getMatchupScores(league_id: str, reg_season_periods: int = 22) -> Dict[str, Dict[str, Any]]:
    """Use the standings CSV export as the source of truth for team totals and season scores."""
    standings_tables = download_standings_tables(league_id=league_id, weeks_in_season=reg_season_periods)
    standings_df = standings_tables.get("Standings", pd.DataFrame())
    if standings_df.empty:
        return {}

    teams: Dict[str, Dict[str, Any]] = {}
    for _, row in standings_df.iterrows():
        team_name = normalize_team_name(row.get("Team") or row.get("team") or row.get("Name") or row.get("name"))
        if not team_name:
            continue

        def team_value(column: str, default: float = 0.0) -> float:
            return _coerce_numeric(row.get(column, default))

        team_entry = {
            "teamId": None,
            "score": team_value("FPts", 0.0),
            "gamesPlayed": int(team_value("GP", 0.0)),
            "NorrisPoints": team_value("Pt", 0.0) * 100.0,
            "Goals": team_value("G", 0.0),
            "Assists": team_value("A", 0.0),
            "Points": team_value("Pt", 0.0),
            "Plus/Minus": team_value("+/-", 0.0),
            "Penalty Minutes": team_value("PIM", 0.0),
            "Shots on Goal": team_value("SOG", 0.0),
            "Power Play Goals": team_value("PPG", 0.0),
            "Short-Handed Goals": team_value("SHG", 0.0),
            "Game-winning Goals": team_value("GWG", 0.0),
            "Hits": team_value("Hits", 0.0),
            "Power Play Assists": team_value("PPA", 0.0),
            "Short-Handed Assists": team_value("SHA", 0.0),
            "Blocks": team_value("Blk", 0.0),
            "Wins (Goalies only)": team_value("W", 0.0),
            "Shutouts": team_value("SO", 0.0),
            "Goals Against": team_value("GA", 0.0),
            "Saves": team_value("SV", 0.0),
            "Overtime Losses + Shootout Losses": team_value("OTL", 0.0) + team_value("SOL", 0.0),
        }
        teams[team_name] = team_entry

    return teams


def getTeamTopPeriodScore(league_id: str, reg_season_periods: int = 22) -> Dict[str, float]:
    """Return each team's single best score from any fetched period."""
    url = "https://www.fantrax.com/fxea/general/getMatchupScores"
    best_by_team: Dict[str, float] = {}

    for period in range(1, reg_season_periods + 1):
        response = requests.get(url, params={"leagueId": league_id, "period": period}, timeout=30)
        response.raise_for_status()
        data = response.json()

        matchups = data.get("matchups") if isinstance(data, dict) else None
        if not matchups:
            break

        for matchup in matchups:
            if not isinstance(matchup, dict):
                continue

            for side in ("away", "home"):
                team = matchup.get(side)
                if not isinstance(team, dict):
                    continue

                team_name = normalize_fantrax_text(team.get("teamName"))
                if not team_name:
                    continue

                team_score = float(team.get("score", 0.0))
                previous_best = best_by_team.get(team_name)
                if previous_best is None or team_score > previous_best:
                    best_by_team[team_name] = team_score

    return best_by_team


def _normalized_stat_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def _extract_numeric_stat(payload: Any, aliases: List[str]) -> float:
    normalized_aliases = {_normalized_stat_key(alias) for alias in aliases}
    stack: List[Any] = [payload]

    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            for key, value in node.items():
                if _normalized_stat_key(key) in normalized_aliases:
                    numeric = _coerce_numeric(value)
                    if numeric != 0.0:
                        return numeric
                if isinstance(value, (dict, list)):
                    stack.append(value)
        elif isinstance(node, list):
            stack.extend(node)

    return 0.0


def build_matchup_data_json(
    league_id: str = DEFAULT_LEAGUE_ID,
    weeks_in_season: int | None = None,
    season_key: str = "2026-2027",
) -> Dict[str, Any]:
    """Build matchup-by-matchup team metrics from the Fantrax getMatchupScores endpoint."""
    def ordinal_day(day: int) -> str:
        if 10 <= day % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix}"

    def format_matchup_lastupdated() -> str:
        dt = __import__("datetime").datetime.utcnow() + __import__("datetime").timedelta(hours=2)
        return dt.strftime(f"%B {ordinal_day(dt.day)} %Y, %H:%M")

    load_env_file()
    season_weeks = weeks_in_season if weeks_in_season is not None else get_weeks_in_season()

    cumulative: Dict[str, Dict[str, float]] = {}
    matchup_payload: Dict[str, List[Dict[str, Any]]] = {}

    for period in range(1, season_weeks + 1):
        response = requests.get(
            FANTRAX_MATCHUP_SCORES_URL,
            params={"leagueId": league_id, "period": period},
            timeout=30,
        )
        response.raise_for_status()
        period_data = response.json()

        matchups = period_data.get("matchups") if isinstance(period_data, dict) else None
        if not matchups:
            break

        period_has_meaningful_data = False

        matchup_rows: List[Dict[str, Any]] = []

        for matchup in matchups:
            if not isinstance(matchup, dict):
                continue

            away = matchup.get("away") if isinstance(matchup.get("away"), dict) else {}
            home = matchup.get("home") if isinstance(matchup.get("home"), dict) else {}
            if not away or not home:
                continue

            away_name = normalize_team_name(away.get("teamName"))
            home_name = normalize_team_name(home.get("teamName"))
            away_score = _coerce_numeric(away.get("score"))
            home_score = _coerce_numeric(home.get("score"))

            categories = matchup.get("categories") if isinstance(matchup.get("categories"), list) else []
            away_category_values: Dict[str, float] = {}
            home_category_values: Dict[str, float] = {}
            for category in categories:
                if not isinstance(category, dict):
                    continue
                short_name = normalize_fantrax_text(category.get("shortName") or "")
                short_name = str(short_name).strip().upper()
                if not short_name:
                    continue

                away_entry = category.get("away") if isinstance(category.get("away"), dict) else {}
                home_entry = category.get("home") if isinstance(category.get("home"), dict) else {}
                away_value = _coerce_numeric(away_entry.get("value"))
                home_value = _coerce_numeric(home_entry.get("value"))
                away_category_values[short_name] = away_value
                home_category_values[short_name] = home_value

                if away_value != 0.0 or home_value != 0.0:
                    period_has_meaningful_data = True

            if away_score != 0.0 or home_score != 0.0:
                period_has_meaningful_data = True

            for team_data, category_values, team_name, team_score, opponent_name, opponent_score in (
                (away, away_category_values, away_name, away_score, home_name, home_score),
                (home, home_category_values, home_name, home_score, away_name, away_score),
            ):
                if not team_name:
                    continue

                games_played = _coerce_numeric(team_data.get("gamesPlayed")) or 1.0
                sog = _coerce_numeric(category_values.get("SOG", 0.0))
                goals = _coerce_numeric(category_values.get("G", 0.0))
                saves = _coerce_numeric(category_values.get("SV", 0.0))
                goals_against = _coerce_numeric(category_values.get("GA", 0.0))

                team_cumulative = cumulative.setdefault(
                    team_name,
                    {"fpts": 0.0, "games": 0.0, "sog": 0.0, "goals": 0.0, "sv": 0.0, "ga": 0.0},
                )
                team_cumulative["fpts"] += team_score
                team_cumulative["games"] += games_played
                team_cumulative["sog"] += sog
                team_cumulative["goals"] += goals
                team_cumulative["sv"] += saves
                team_cumulative["ga"] += goals_against

                matchup_rows.append(
                    {
                        "Team": team_name,
                        "FP": round(team_score, 2),
                        "FP/G": round(team_score / games_played, 4) if games_played else 0.0,
                        "SSN FP/G": round(team_cumulative["fpts"] / team_cumulative["games"], 4) if team_cumulative["games"] else 0.0,
                        "SOG": round(sog, 4),
                        "SSN SOG": round(team_cumulative["sog"], 4),
                        "S%": round((goals / sog) * 100.0, 4) if sog else 0.0,
                        "SSN S%": round((team_cumulative["goals"] / team_cumulative["sog"]) * 100.0, 4) if team_cumulative["sog"] else 0.0,
                        "SV%": round(saves / (saves + goals_against), 4) if (saves + goals_against) else 0.0,
                        "SSN SV%": round(team_cumulative["sv"] / (team_cumulative["sv"] + team_cumulative["ga"]), 4)
                        if (team_cumulative["sv"] + team_cumulative["ga"])
                        else 0.0,
                        "Opponent": opponent_name,
                        "W/L": "W" if team_score > opponent_score else ("L" if team_score < opponent_score else "T"),
                    }
                )

        if not period_has_meaningful_data:
            break

        matchup_payload[f"Matchup {period}"] = sorted(matchup_rows, key=lambda item: str(item.get("Team", "")).lower())

    return {
        "season": {
            season_key: {
                "lastupdated": format_matchup_lastupdated(),
                "matchups": matchup_payload,
            }
        }
    }


def download_schedule_tables(
    league_id: str = DEFAULT_LEAGUE_ID,
    weeks_in_season: int | None = None,
    force_refresh: bool = False,
) -> Dict[str, pd.DataFrame]:
    """Download the SCHEDULE CSV export and split it into table frames."""
    global _SCHEDULE_TABLES_CACHE

    if _SCHEDULE_TABLES_CACHE is not None and not force_refresh:
        return _SCHEDULE_TABLES_CACHE

    load_env_file()
    season_weeks = weeks_in_season if weeks_in_season is not None else get_weeks_in_season()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://www.fantrax.com/",
        "Accept": "text/csv,application/json,text/plain,*/*",
    }

    cookie_header = build_cookie_header()
    if cookie_header:
        headers["Cookie"] = cookie_header

    response = requests.get(
        FANTRAX_STANDINGS_URL,
        params={
            "leagueId": league_id,
            "view": "SCHEDULE",
            "timeframeType": "YEAR_TO_DATE",
            "period": season_weeks,
            "timeStartType": "FROM_SEASON_START",
            "hideGoBackDays": "true",
            "pageNumber": 1,
        },
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()

    csv_text = response.text or ""
    if not csv_text.strip():
        raise ValueError("Fantrax schedule export returned an empty response.")

    tables = parse_fantrax_standings_csv(csv_text)
    if not tables:
        raise ValueError("Fantrax schedule export did not include any parseable tables.")

    _SCHEDULE_TABLES_CACHE = tables
    return _SCHEDULE_TABLES_CACHE


def get_vegas_baby_schedule_leaderboard(
    league_id: str = DEFAULT_LEAGUE_ID,
    weeks_in_season: int | None = None,
    force_refresh: bool = False,
) -> Dict[str, str]:
    """Return the top 12 weekly team scores from the Fantrax SCHEDULE CSV export.

    The schedule CSV is arranged as rows like:
      Away,FPts,Home,FPts
      TeamA,170.96,TeamB,135.79
    so each row is a pair of team/score entries. We flatten each row into team-score pairs,
    then sort the full list descending and keep the top 12.
    """
    tables = download_schedule_tables(league_id=league_id, weeks_in_season=weeks_in_season, force_refresh=force_refresh)
    weekly_scores: List[tuple[str, int | None, float]] = []

    scoring_period_pattern = re.compile(r"scoring period\s*(\d+)", re.IGNORECASE)

    def add_score(team_name: Any, score: Any, scoring_period: int | None) -> None:
        if team_name is None:
            return
        cleaned_team = normalize_team_name(team_name)
        if not cleaned_team:
            return
        try:
            numeric_score = float(score)
        except (TypeError, ValueError):
            return
        weekly_scores.append((cleaned_team, scoring_period, numeric_score))

    for table_name, frame in tables.items():
        if frame.empty:
            continue

        current_scoring_period: int | None = None
        table_match = scoring_period_pattern.search(table_name)
        if table_match:
            current_scoring_period = int(table_match.group(1))

        for row in frame.values.tolist():
            cleaned_row = [normalize_fantrax_text(str(cell)).strip() for cell in row if cell is not None]
            cleaned_row = [cell for cell in cleaned_row if cell]
            if not cleaned_row:
                continue

            first_value = cleaned_row[0].lower()
            if first_value.startswith("scoring period"):
                match = scoring_period_pattern.search(" ".join(cleaned_row))
                if match:
                    current_scoring_period = int(match.group(1))
                continue

            if len(cleaned_row) < 4:
                continue

            if first_value in {"away", "home", "team"}:
                continue

            for offset in (0, 2):
                if offset + 1 >= len(cleaned_row):
                    continue
                team_value = cleaned_row[offset]
                score_value = cleaned_row[offset + 1]
                if team_value.lower() in {"away", "home", "team", "name"}:
                    continue
                try:
                    float(score_value)
                except ValueError:
                    continue
                add_score(team_value, score_value, current_scoring_period)

    if not weekly_scores:
        return {}

    ranked = sorted(weekly_scores, key=lambda item: float(item[2]), reverse=True)[:12]

    def format_score(score: float) -> str:
        return str(int(score)) if float(score).is_integer() else f"{score:.2f}"

    leaderboard: Dict[str, str] = {}
    for team_name, scoring_period, score in ranked:
        prefix = f"Week {scoring_period}" if scoring_period is not None else "Week ?"
        leaderboard[team_name] = f"{prefix}: {format_score(score)}"

    return leaderboard


def normalize_player_id(value: Any) -> str:
    """Strip Fantrax ID formatting so IDs can be compared reliably."""
    if value is None:
        return ""
    text = str(value).strip().replace("*", "").strip().lower()
    return text


def load_csv_rows(path: Path) -> List[Dict[str, Any]]:
    """Read rows from a CSV file into dicts."""
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def build_cookie_header() -> str:
    """Build the Fantrax cookie header from known env cookie keys."""
    cookie_parts: List[str] = []
    for key in REQUIRED_COOKIE_KEYS:
        value = os.getenv(key, "").strip().strip('"\'')
        if value:
            cookie_parts.append(f"{key}={value}")
    return "; ".join(cookie_parts)


def download_player_stats_df(league_id: str = DEFAULT_LEAGUE_ID, transaction_period: int = 22) -> pd.DataFrame:
    """Download the protected Fantrax player stats export and parse it into a dataframe."""
    load_env_file()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://www.fantrax.com/",
        "Accept": "text/csv,application/json,text/plain,*/*",
    }

    cookie_header = build_cookie_header()
    if cookie_header:
        headers["Cookie"] = cookie_header

    response = requests.get(
        FANTRAX_PLAYER_STATS_URL,
        params={
            "leagueId": league_id,
            "pageNumber": 1,
            "statusOrTeamFilter": "ALL",
            "seasonOrProjection": "SEASON_31n_BY_PERIOD",
            "timeframeTypeCode": "BY_PERIOD",
            "transactionPeriod": transaction_period,
            "timeStartType": "FROM_SEASON_START",
            "view": "STATS",
            "positionOrGroup": "ALL",
        },
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()

    csv_text = response.text or ""
    if not csv_text.strip():
        raise ValueError("Fantrax player stats export returned an empty response.")

    df = pd.read_csv(io.StringIO(csv_text))
    if df.empty:
        raise ValueError("Fantrax player stats export returned no rows.")

    # Normalize column names and text fields once for downstream joins.
    df.columns = [str(column).lstrip("\ufeff").strip() for column in df.columns]
    df = df.fillna("")
    return df


def get_player_stats_df(
    league_id: str = DEFAULT_LEAGUE_ID,
    transaction_period: int = 22,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """Return cached player stats dataframe; download only once unless refresh is requested."""
    global _PLAYER_STATS_DF_CACHE

    if _PLAYER_STATS_DF_CACHE is not None and not force_refresh:
        return _PLAYER_STATS_DF_CACHE

    _PLAYER_STATS_DF_CACHE = download_player_stats_df(league_id=league_id, transaction_period=transaction_period)
    return _PLAYER_STATS_DF_CACHE


def get_player_stats_by_id(
    league_id: str = DEFAULT_LEAGUE_ID,
    transaction_period: int = 22,
    force_refresh: bool = False,
) -> Dict[str, Dict[str, Any]]:
    """Build and cache player stats by normalized Fantrax ID for fast lookups."""
    global _PLAYER_STATS_BY_ID_CACHE

    if _PLAYER_STATS_BY_ID_CACHE is not None and not force_refresh:
        return _PLAYER_STATS_BY_ID_CACHE

    df = get_player_stats_df(
        league_id=league_id,
        transaction_period=transaction_period,
        force_refresh=force_refresh,
    )
    rows = df.to_dict(orient="records")

    by_id: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        player_id = normalize_player_id(row.get("ID"))
        if player_id:
            by_id[player_id] = row

    _PLAYER_STATS_BY_ID_CACHE = by_id
    return _PLAYER_STATS_BY_ID_CACHE


def load_calder_candidate_rows(path: Path) -> List[Dict[str, Any]]:
    """Read CalderCandidates.csv, which is exported without a header row."""
    if not path.exists():
        return []

    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for raw_row in reader:
            if not raw_row or all(not str(cell).strip() for cell in raw_row):
                continue
            if str(raw_row[0]).strip().lower() == "player id":
                continue

            rows.append(
                {
                    "Player ID": raw_row[0].strip() if len(raw_row) > 0 else "",
                    "Round": raw_row[1].strip() if len(raw_row) > 1 else "",
                    "Pick": raw_row[2].strip() if len(raw_row) > 2 else "",
                    "Ov Pick": raw_row[3].strip() if len(raw_row) > 3 else "",
                    "Pos": raw_row[4].strip() if len(raw_row) > 4 else "",
                    "Player": raw_row[5].strip() if len(raw_row) > 5 else "",
                    "Team": raw_row[6].strip() if len(raw_row) > 6 else "",
                    "Fantasy Team": raw_row[7].strip() if len(raw_row) > 7 else "",
                    "Time (CEST)": raw_row[8].strip() if len(raw_row) > 8 else "",
                }
            )

    return rows


def get_appended_draft_rows() -> List[Dict[str, Any]]:
    """Start from draft results and append Calder candidates before any trophy calculations."""
    draft_rows = load_csv_rows(DRAFT_RESULTS_CSV)
    calder_rows = load_csv_rows(CALDER_CANDIDATES_CSV)
    return draft_rows + calder_rows


def get_hart_leaderboard(player_stats_by_id: Dict[str, Dict[str, Any]] | None = None) -> List[Dict[str, Any]]:
    """Build the Hart trophy leaderboard from the appended draft frame plus FantraxPlayerStats."""
    draft_rows = get_appended_draft_rows()

    if not draft_rows:
        return []

    stats_by_id = player_stats_by_id or get_player_stats_by_id()

    hart_rows: List[Dict[str, Any]] = []
    for row in draft_rows:
        draft_id = normalize_player_id(row.get("Player ID"))
        stats = stats_by_id.get(draft_id, {})

        try:
            fpts = float(stats.get("FPts", 0.0)) if stats else 0.0
        except (TypeError, ValueError):
            fpts = 0.0

        hart_rows.append(
            {
                "Team": row.get("Fantasy Team", ""),
                "Player": row.get("Player", ""),
                "Fpts": fpts,
            }
        )

    top_players = sorted(hart_rows, key=lambda item: float(item.get("Fpts", 0.0)), reverse=True)[:12]
    return [
        {"Team": item.get("Team", ""), "Player": item.get("Player", ""), "Fpts": float(item.get("Fpts", 0.0))}
        for item in top_players
    ]


def get_position_bucket(position: Any) -> str:
    """Map a DraftResults position value to D, G, or F."""
    raw = str(position or "").strip().upper()
    if raw == "D":
        return "D"
    if raw == "G":
        return "G"
    return "F"


def get_scouts_honor_leaderboard(player_stats_by_id: Dict[str, Dict[str, Any]] | None = None) -> Dict[str, float]:
    """Summarize each fantasy team's best 4D, 2G, and 12F by Fpts from the appended draft frame."""
    draft_rows = get_appended_draft_rows()

    if not draft_rows:
        return {}

    stats_by_id = player_stats_by_id or get_player_stats_by_id()

    team_players: Dict[str, Dict[str, List[Dict[str, float]]]] = {}
    for row in draft_rows:
        team_name = row.get("Fantasy Team", "").strip()
        if not team_name:
            continue

        player_id = normalize_player_id(row.get("Player ID"))
        stats = stats_by_id.get(player_id, {})
        try:
            fpts = float(stats.get("FPts", 0.0)) if stats else 0.0
        except (TypeError, ValueError):
            fpts = 0.0

        bucket = get_position_bucket(row.get("Pos"))
        team_players.setdefault(team_name, {"D": [], "G": [], "F": []})
        team_players[team_name][bucket].append({"Player": row.get("Player", ""), "Fpts": fpts})

    totals: Dict[str, float] = {}
    for team_name, buckets in team_players.items():
        selected: List[Dict[str, float]] = []
        selected.extend(sorted(buckets["D"], key=lambda item: float(item["Fpts"]), reverse=True)[:4])
        selected.extend(sorted(buckets["G"], key=lambda item: float(item["Fpts"]), reverse=True)[:2])
        selected.extend(sorted(buckets["F"], key=lambda item: float(item["Fpts"]), reverse=True)[:12])
        totals[team_name] = sum(float(item["Fpts"]) for item in selected)

    return {
        team_name: round(float(total), 2)
        for team_name, total in sorted(totals.items(), key=lambda item: float(item[1]), reverse=True)
    }


def get_calder_leaderboard(player_stats_by_id: Dict[str, Dict[str, Any]] | None = None) -> List[Dict[str, Any]]:
    """Return the Calder top candidates sorted by Fpts using CalderCandidates.csv as the base list."""
    candidate_rows = load_calder_candidate_rows(CALDER_CANDIDATES_CSV)

    if not candidate_rows:
        return []

    stats_by_id = player_stats_by_id or get_player_stats_by_id()

    leaderboard: List[Dict[str, Any]] = []
    for row in candidate_rows:
        player_id = normalize_player_id(row.get("Player ID"))
        stats = stats_by_id.get(player_id, {})

        try:
            fpts = float(stats.get("FPts", 0.0)) if stats else 0.0
        except (TypeError, ValueError):
            fpts = 0.0

        leaderboard.append(
            {
                "Team": row.get("Fantasy Team", ""),
                "Player Name": row.get("Player", ""),
                "Fpts": fpts,
            }
        )

    return sorted(
        leaderboard,
        key=lambda item: float(item.get("Fpts", 0.0)),
        reverse=True,
    )


def get_art_ross_leaderboard(teams: Dict[str, Dict[str, Any]]) -> List[str]:
    """Return the Art Ross ordering as team names from 1st to last."""
    return [
        team_name
        for team_name, _ in sorted(teams.items(), key=lambda item: float(item[1].get("score", 0.0)), reverse=True)
    ]


def get_jack_adams_leaderboard(
    teams: Dict[str, Dict[str, Any]],
    scout_honor_scores: Dict[str, float] | None = None,
) -> Dict[str, float]:
    """Return the Jack Adams delta leaderboard: Art Ross score minus Scout's Honor score, highest first."""
    scout_scores = scout_honor_scores or get_scouts_honor_leaderboard()
    deltas: Dict[str, float] = {}

    for team_name, team_stats in teams.items():
        art_ross_score = float(team_stats.get("score", 0.0))
        scout_score = float(scout_scores.get(team_name, 0.0))
        deltas[team_name] = art_ross_score - scout_score

    return {
        team_name: round(float(score), 2)
        for team_name, score in sorted(deltas.items(), key=lambda item: float(item[1]), reverse=True)
    }


def load_fantalytics_frenzy_rows(path: Path) -> List[Dict[str, Any]]:
    """Read the Frenzy prediction matrix with semicolon-separated columns."""
    if not path.exists():
        return []

    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row in reader:
            cleaned_row: Dict[str, Any] = {}
            for key, value in row.items():
                cleaned_key = str(key or "").lstrip("\ufeff").strip()
                cleaned_row[cleaned_key] = value
            rows.append(cleaned_row)
    return rows


def kendall_tau(actual_vector: List[int], guessed_vector: List[int]) -> float:
    n = len(actual_vector)
    if n < 2:
        return 0.0

    score = 0.0

    for i in range(n):
        for j in range(i + 1, n):
            product = (
                (actual_vector[i] - actual_vector[j])
                * (guessed_vector[i] - guessed_vector[j])
            )

            if product > 0:
                score += 1
            elif product < 0:
                score -= 1

    return score / (n * (n - 1) / 2)


def get_fantalytics_frenzy_leaderboard(teams: Dict[str, Dict[str, Any]]) -> Dict[str, float]:
    """Compare each guessing team's column to the Art Ross rank series after joining on Team name."""
    actual_order = [normalize_fantrax_text(team_name).strip() for team_name in get_art_ross_leaderboard(teams)]
    
    if not actual_order:
        return {}

    actual_rank_map = {team_name: rank for rank, team_name in enumerate(actual_order, start=1)}

    rows = load_fantalytics_frenzy_rows(FANTALYTICS_FRENZY_CSV)
    if not rows:
        return {}

    guesser_scores: Dict[str, float] = {}
    for column_name in rows[0].keys():
        if column_name == "Team":
            continue

        guessed_ranks: Dict[str, int] = {}
        for row in rows:
            team_name = normalize_fantrax_text(str(row.get("Team", "")).strip())
            if not team_name:
                continue
            raw_rank = row.get(column_name, "")
            try:
                guessed_ranks[team_name] = int(float(str(raw_rank).strip()))
            except (TypeError, ValueError):
                continue

        if not guessed_ranks:
            continue

        aligned_teams = [team for team in sorted(set(actual_rank_map) & set(guessed_ranks))]
        if len(aligned_teams) < 2:
            continue

        art_ross_vector = [actual_rank_map[team] for team in aligned_teams]
        guess_vector = [guessed_ranks[team] for team in aligned_teams]
        guesser_scores[column_name] = kendall_tau(art_ross_vector, guess_vector)

    return {
        guesser_name: round(float(score), 2)
        for guesser_name, score in sorted(guesser_scores.items(), key=lambda item: float(item[1]), reverse=True)
    }


def get_backs_backe_back_to_back_leaderboard(
    league_id: str = DEFAULT_LEAGUE_ID,
    weeks_in_season: int | None = None,
) -> Dict[str, str]:
    """Return the midpoint combined standings as team -> W-L-T mapping."""
    load_env_file()
    season_weeks = weeks_in_season if weeks_in_season is not None else get_weeks_in_season()
    period = max(1, math.ceil(float(season_weeks) / 2.0))

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://www.fantrax.com/",
        "Accept": "text/csv,application/json,text/plain,*/*",
    }

    cookie_header = build_cookie_header()
    if cookie_header:
        headers["Cookie"] = cookie_header

    response = requests.get(
        FANTRAX_STANDINGS_URL,
        params={
            "leagueId": league_id,
            "view": "COMBINED",
            "timeframeType": "BY_PERIOD",
            "period": period,
            "timeStartType": "FROM_SEASON_START",
            "hideGoBackDays": "true",
            "pageNumber": 1,
        },
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()

    csv_text = response.text or ""
    if not csv_text.strip():
        return {}

    tables = parse_fantrax_standings_csv(csv_text)
    standings_df = tables.get("Standings", pd.DataFrame())
    if standings_df.empty:
        return {}

    normalized_columns = {
        normalize_fantrax_text(str(column)).strip().lower(): str(column)
        for column in standings_df.columns
    }

    team_key = normalized_columns.get("team") or normalized_columns.get("team name") or normalized_columns.get("name")
    w_key = normalized_columns.get("w")
    l_key = normalized_columns.get("l")
    t_key = normalized_columns.get("t")

    if team_key is None or not all(key for key in (w_key, l_key, t_key)):
        return {}

    results: Dict[str, str] = {}
    for _, row in standings_df.iterrows():
        team_name = normalize_team_name(row.get(team_key, ""))
        if not team_name:
            continue

        w_value = _coerce_numeric(row.get(w_key, 0))
        l_value = _coerce_numeric(row.get(l_key, 0))
        t_value = _coerce_numeric(row.get(t_key, 0))
        results[team_name] = f"{int(w_value)}-{int(l_value)}-{int(t_value)}"

    return results


def buildSeasonTrophyJson(
    teams: Dict[str, Dict[str, Any]],
    period_leaderboard: Dict[str, float] | None = None,
    league_id: str = DEFAULT_LEAGUE_ID,
    standings_tables: Dict[str, pd.DataFrame] | None = None,
) -> Dict[str, Dict[str, Dict[str, float]]]:
    """Create the final season/trophy JSON with standings CSV-based overrides and legacy fallbacks."""

    def ordinal_day(day: int) -> str:
        if 10 <= day % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix}"

    def format_lastupdated() -> str:
        dt = __import__("datetime").datetime.utcnow() + __import__("datetime").timedelta(hours=2)
        return dt.strftime(f"%B {ordinal_day(dt.day)} %Y, %H:%M")

    def find_team_column(frame: pd.DataFrame) -> str | None:
        for column in frame.columns:
            normalized = normalize_fantrax_text(str(column)).strip().lower()
            if normalized in {"team", "team name", "name"}:
                return str(column)
        return None

    def team_name_from_frame(frame: pd.DataFrame, row: pd.Series) -> str:
        team_column = find_team_column(frame)
        if team_column is None:
            return ""
        return normalize_team_name(row.get(team_column, ""))

    def leaderboard_from_frame(
        frame: pd.DataFrame,
        metric: str,
        descending: bool = True,
        value_transform: Any | None = None,
        fallback_metric: str | None = None,
    ) -> Dict[str, float]:
        if frame.empty:
            return {}

        metric_key = metric if metric in frame.columns else (fallback_metric if fallback_metric and fallback_metric in frame.columns else None)
        if metric_key is None:
            return {}

        dataset: List[Dict[str, Any]] = []
        for _, row in frame.iterrows():
            team_name = team_name_from_frame(frame, row)
            if not team_name:
                continue
            raw_value = row.get(metric_key, 0)
            value = _coerce_numeric(raw_value)
            if value_transform is not None:
                value = value_transform(value)
            dataset.append({"Team": team_name, "Value": value})

        if not dataset:
            return {}

        ordered = sorted(dataset, key=lambda item: float(item["Value"]), reverse=descending)
        return {item["Team"]: round(float(item["Value"]), 2) for item in ordered}

    custom_tables = standings_tables or download_standings_tables(league_id=league_id)
    standings_df = custom_tables.get("Standings", pd.DataFrame())
    stats_df = custom_tables.get("Standings - Statistics - Skaters", pd.DataFrame())
    goals_df = custom_tables.get("Standings - Statistics - Goalies", pd.DataFrame())
    points_skater_df = custom_tables.get("Standings - Points - Skaters", pd.DataFrame())
    points_goalie_df = custom_tables.get("Standings - Points - Goalies", pd.DataFrame())

    detailed_statistics = build_detailed_team_table(stats_df, goals_df)
    detailed_points = build_detailed_team_table(points_skater_df, points_goalie_df)
    custom_tables["Detailed Statistics Stats"] = detailed_statistics
    custom_tables["Detailed Points Stats"] = detailed_points

    trophy_map = {
        "Art Ross": ("score", True),
        "Rocket Richard": ("Goals", True),
        "Norris": ("NorrisPoints", True),
        "Selke": ("Plus/Minus", True),
        "Lady Byng": ("Penalty Minutes", False),
        "Jim Gregory": ("gamesPlayed", True),
        "Vezina": ("Goal", True),
    }
    integer_trophies = {"Rocket Richard", "Norris", "Selke", "Lady Byng", "Jim Gregory"}

    def format_trophy_value(trophy_name: str, raw_value: Any) -> float | int:
        numeric = float(raw_value or 0.0)
        if trophy_name in integer_trophies:
            return int(round(numeric))
        return numeric

    custom_trophies = {
        "Art Ross": leaderboard_from_frame(standings_df, "FPts", descending=True),
        "Rocket Richard": leaderboard_from_frame(detailed_statistics, "G", descending=True),
        "Norris": leaderboard_from_frame(detailed_points, "Pt", descending=True, value_transform=lambda value: float(value) * 100.0),
        "Selke": leaderboard_from_frame(detailed_statistics, "+/-", descending=True),
        "Lady Byng": leaderboard_from_frame(detailed_statistics, "PIM", descending=False),
        "Jim Gregory": leaderboard_from_frame(standings_df, "GP", descending=True),
        "Vezina": leaderboard_from_frame(standings_df, "Goal", descending=True, fallback_metric="G"),
    }

    def build_trophy_bucket() -> Dict[str, Dict[str, float]]:
        trophies: Dict[str, Dict[str, float]] = {}
        for trophy_name, (metric, descending) in trophy_map.items():
            override_values = custom_trophies.get(trophy_name)
            if override_values:
                trophies[trophy_name] = {team_name: round(float(value), 2) for team_name, value in override_values.items()}
                continue

            ordered = sorted(
                teams.items(),
                key=lambda item: float(format_trophy_value(trophy_name, item[1].get(metric, 0.0))),
                reverse=descending,
            )
            trophies[trophy_name] = {
                team_name: format_trophy_value(trophy_name, stats.get(metric, 0.0))
                for team_name, stats in ordered
            }
        return trophies

    def placeholder_entry(value: str = "Winner/Leader TBD") -> Dict[str, int]:
        return {value: 99}

    vegas_baby_leaderboard = get_vegas_baby_schedule_leaderboard(
        league_id=league_id,
        weeks_in_season=get_weeks_in_season(),
    )
    if not vegas_baby_leaderboard:
        vegas_baby_leaderboard = {
            team_name: f"Week ?: {score:.2f}" if isinstance(score, (int, float)) else f"Week ?: {score}"
            for team_name, score in sorted((period_leaderboard or {}).items(), key=lambda item: float(item[1]), reverse=True)
        }

    season_data: Dict[str, Any] = {}
    season_key = "2026-2027"

    player_stats_by_id = get_player_stats_by_id(league_id=league_id, transaction_period=get_weeks_in_season())
    scout_honor_scores = get_scouts_honor_leaderboard(player_stats_by_id=player_stats_by_id)

    season_data[season_key] = {
        "lastupdated": format_lastupdated(),
        "regseason": {
            "trophies": {
                "Hart": get_hart_leaderboard(player_stats_by_id=player_stats_by_id),
                **build_trophy_bucket(),
                "Calder": get_calder_leaderboard(player_stats_by_id=player_stats_by_id),
                "Jack Adams": get_jack_adams_leaderboard(teams, scout_honor_scores),
            },
            "awards": {
                "Scout's honor": scout_honor_scores,
                "Fantalytic's Frenzy": get_fantalytics_frenzy_leaderboard(teams),
            },
            "bounties": {
                "It's Vegas Baby!": vegas_baby_leaderboard,
                "Back's Backe Back-2-Back": get_backs_backe_back_to_back_leaderboard(
                    league_id=league_id,
                    weeks_in_season=get_weeks_in_season(),
                ),
            },
        },
        "postseason": {
            "winners": {
                "Stanley Cup": placeholder_entry(),
                "President's Trophy": placeholder_entry(),
            },
            "awards": {
                "Conn Smythe": placeholder_entry(),
            },
            "bounties": {
                "The King is Dead!": placeholder_entry(),
                "Chasing the Cup!": placeholder_entry(),
                "Bitter Looser or Righteous Winner!": placeholder_entry(),
            },
            "achievements": {
                "Clarence S. Campbell": placeholder_entry(),
                "Prince of Wales": placeholder_entry(),
                "Orange Lantern": placeholder_entry(),
            },
        },
    }

    return {"season": season_data}


def write_local_trophy_data(payload: Dict[str, Any]) -> None:
    json_text = json.dumps(payload, ensure_ascii=False, indent=2)
    TROPHY_DATA_JSON.write_text(json_text + "\n", encoding="utf-8")
    TROPHY_DATA_JS.write_text(
        "window.__GHL_TROPHY_DATA__ = " + json_text + ";\n",
        encoding="utf-8",
    )


def write_local_matchup_data(payload: Dict[str, Any]) -> None:
    json_text = json.dumps(payload, ensure_ascii=False, indent=2)
    MATCHUP_DATA_JSON.write_text(json_text + "\n", encoding="utf-8")
    MATCHUP_DATA_JS.write_text(
        "window.__GHL_MATCHUP_DATA__ = " + json_text + ";\n",
        encoding="utf-8",
    )


def sync_local_tracker_data_to_git() -> None:
    """Stage, commit, and push generated snapshot files if they changed."""
    git_add = subprocess.run(
        [
            "git",
            "add",
            str(TROPHY_DATA_JSON),
            str(TROPHY_DATA_JS),
            str(MATCHUP_DATA_JSON),
            str(MATCHUP_DATA_JS),
        ],
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if git_add.returncode != 0:
        raise RuntimeError((git_add.stderr or git_add.stdout or "git add failed").strip())

    diff_check = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=PROJECT_ROOT,
        check=False,
    )
    if diff_check.returncode == 0:
        return
    if diff_check.returncode not in (0, 1):
        raise RuntimeError("git diff --cached --quiet failed")

    git_name = subprocess.run(
        ["git", "config", "user.name"],
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    git_email = subprocess.run(
        ["git", "config", "user.email"],
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if not git_name.stdout.strip():
        subprocess.run(
            ["git", "config", "user.name", os.getenv("TROPHY_TRACKER_GIT_USER_NAME", "github-actions[bot]")],
            cwd=PROJECT_ROOT,
            check=False,
        )
    if not git_email.stdout.strip():
        subprocess.run(
            ["git", "config", "user.email", os.getenv("TROPHY_TRACKER_GIT_USER_EMAIL", "github-actions[bot]@users.noreply.github.com")],
            cwd=PROJECT_ROOT,
            check=False,
        )

    commit_message = os.getenv("TROPHY_TRACKER_GIT_COMMIT_MESSAGE", "Update trophy and matchup snapshots")
    git_commit = subprocess.run(
        ["git", "commit", "-m", commit_message],
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if git_commit.returncode != 0:
        output = (git_commit.stderr or git_commit.stdout or "git commit failed").strip()
        if "nothing to commit" in output.lower():
            return
        raise RuntimeError(output)

    git_push = subprocess.run(
        ["git", "push"],
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if git_push.returncode != 0:
        raise RuntimeError((git_push.stderr or git_push.stdout or "git push failed").strip())


def load_env_file(path: str | None = None) -> Dict[str, str]:
    """Load key=value pairs from a local env file into the current process environment.

    Resolution order:
    1) explicit function argument
    2) ENV_FILE environment variable
    3) default local path (for local runs only)
    """
    values: Dict[str, str] = {}

    is_github_actions = os.getenv("GITHUB_ACTIONS", "").lower() == "true"
    candidate_path = path or os.getenv("ENV_FILE")
    if not candidate_path and not is_github_actions:
        candidate_path = str(DEFAULT_ENV_PATH)

    if not candidate_path or not os.path.exists(candidate_path):
        return values

    with open(candidate_path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key_value = line.replace("export ", "", 1)
            key, value = [part.strip() for part in key_value.split("=", 1)]
            key = key.strip().strip('"\'')
            value = value.strip().strip('"\'')
            values[key] = value
            os.environ.setdefault(key, value)

    return values


def patch_jsonbin_trophies(payload: Dict[str, Any], env_path: str | None = None) -> Dict[str, Any]:
    """Patch the configured JSONBin record using the env values or environment variables."""
    load_env_file(env_path)

    def get_value(key: str) -> str:
        value = os.getenv(key, "")
        return str(value).strip().strip('"\'')

    bin_id = get_value("GHLTROPHYTRACKER_BIN_ID")
    master_key = get_value("JSONBINIO_X_MASTER_KEY")
    access_key = get_value("JSONBINIO_X_ACCESS_KEY")

    if not bin_id:
        raise ValueError("Missing GHLTROPHYTRACKER_BIN_ID in env values or environment.")

    auth_key = master_key or access_key
    if not auth_key:
        raise ValueError("Missing JSONBINIO_X_MASTER_KEY or JSONBINIO_X_ACCESS_KEY in env values or environment.")

    url = f"https://api.jsonbin.io/v3/b/{bin_id}"
    headers = {
        "Content-Type": "application/json",
    }
    if master_key:
        headers["X-Master-Key"] = master_key
    if access_key:
        headers["X-Access-Key"] = access_key

    response = requests.put(url, headers=headers, json=payload, timeout=30)
    if response.status_code in (401, 403, 404):
        raise PermissionError(
            f"JSONBin rejected the request for bin '{bin_id}'. Check that the bin id, X-Master-Key, or X-Access-Key are valid and that the bin is private."
        )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    load_env_file()
    league_id = os.getenv("FANTRAX_LEAGUE_ID", DEFAULT_LEAGUE_ID)
    season_weeks = get_weeks_in_season()
    standings_tables = download_standings_tables(league_id=league_id, weeks_in_season=season_weeks)
    results = getMatchupScores(league_id=league_id, reg_season_periods=season_weeks)
    vegas_baby_board = get_vegas_baby_schedule_leaderboard(league_id=league_id, weeks_in_season=season_weeks)
    final_json = buildSeasonTrophyJson(
        results,
        period_leaderboard=vegas_baby_board,
        league_id=league_id,
        standings_tables=standings_tables,
    )
    matchup_json = build_matchup_data_json(league_id=league_id, weeks_in_season=season_weeks, season_key="2026-2027")
    write_local_trophy_data(final_json)
    write_local_matchup_data(matchup_json)
    if os.getenv("TROPHY_TRACKER_SYNC_GIT", "1").strip().lower() in {"1", "true", "yes", "on"}:
        sync_local_tracker_data_to_git()
#    print(json.dumps(final_json, ensure_ascii=False, indent=2))

#    should_publish = os.getenv("PUBLISH_TO_JSONBIN", "0").strip().lower() in {"1", "true", "yes", "on"}
#    should_publish = "true"
    # if should_publish:
    #     try:
    #         patch_result = patch_jsonbin_trophies(final_json)
    #         print(json.dumps({"jsonbin": patch_result}, ensure_ascii=False, indent=2))
    #     except Exception as exc:
    #         raise RuntimeError(f"JSONBin publish failed: {exc}") from exc
