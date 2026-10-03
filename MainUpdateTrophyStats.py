#!/usr/bin/env python3
"""Fantrax matchup stat aggregation for a full regular season."""

from __future__ import annotations

import csv
import io
import json
import math
import os
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import requests


PROJECT_ROOT = Path(__file__).resolve().parent
DRAFT_RESULTS_CSV = PROJECT_ROOT / "DraftResults.csv"
CALDER_CANDIDATES_CSV = PROJECT_ROOT / "CalderCandidates.csv"
FANTALYTICS_FRENZY_CSV = PROJECT_ROOT / "FantalyticsFrenzy.csv"

DEFAULT_LEAGUE_ID = "aer4wi7rmtgxmer0"
FANTRAX_PLAYER_STATS_URL = "https://www.fantrax.com/fxpa/downloadPlayerStats"
REQUIRED_COOKIE_KEYS = ("__cf_bm", "cf_clearance", "FX_RM", "JSESSIONID")

_PLAYER_STATS_DF_CACHE: pd.DataFrame | None = None
_PLAYER_STATS_BY_ID_CACHE: Dict[str, Dict[str, Any]] | None = None
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


def getMatchupScores(league_id: str, reg_season_periods: int = 22) -> Dict[str, Dict[str, Any]]:
    """Loop through every regular-season period and aggregate category totals per team.

    Returns a dictionary keyed by team name. Each team entry includes the team id, score,
    games played, and cumulative totals for every stat category. If a period returns empty
    data, the loop breaks early.
    """
    url = "https://www.fantrax.com/fxea/general/getMatchupScores"
    value_based_stats = {"Goals", "Plus/Minus", "Penalty Minutes"}
    teams: Dict[str, Dict[str, Any]] = {}

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
                team_id = team.get("teamId")
                if not team_name:
                    continue

                if team_name not in teams:
                    teams[team_name] = {
                        "teamId": team_id,
                        "score": 0.0,
                        "gamesPlayed": 0,
                        "NorrisPoints": 0.0,
                        **{category: 0.0 for category in STAT_CATEGORIES},
                    }
                elif team_id and teams[team_name]["teamId"] is None:
                    teams[team_name]["teamId"] = team_id

                teams[team_name]["score"] = float(teams[team_name].get("score", 0.0)) + float(team.get("score", 0.0))
                teams[team_name]["gamesPlayed"] = int(teams[team_name].get("gamesPlayed", 0)) + int(team.get("gamesPlayed", 0))

                for category in matchup.get("categories", []):
                    if not isinstance(category, dict):
                        continue

                    stat_name = category.get("name")
                    if stat_name not in STAT_CATEGORIES:
                        continue

                    stat_values = category.get(side)
                    if not isinstance(stat_values, dict):
                        continue

                    if stat_name == "Points":
                        norris_points = float(stat_values.get("points", 0.0)) * 100.0
                        teams[team_name]["NorrisPoints"] = float(teams[team_name].get("NorrisPoints", 0.0)) + norris_points

                    stat_metric = "value" if stat_name in value_based_stats else "points"
                    stat_amount = stat_values.get(stat_metric, 0.0)
                    teams[team_name][stat_name] = float(teams[team_name].get(stat_name, 0.0)) + float(stat_amount)

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


def buildSeasonTrophyJson(
    teams: Dict[str, Dict[str, Any]],
    period_leaderboard: Dict[str, float] | None = None,
    league_id: str = DEFAULT_LEAGUE_ID,
) -> Dict[str, Dict[str, Dict[str, float]]]:
    """Create the final season/trophy JSON with descending/ascending ordering based on the stat metric."""

    def ordinal_day(day: int) -> str:
        if 10 <= day % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix}"

    def format_lastupdated() -> str:
        dt = __import__("datetime").datetime.utcnow() + __import__("datetime").timedelta(hours=2)
        return dt.strftime(f"%B {ordinal_day(dt.day)} %Y, %H:%M")

    trophy_map = {
        "Art Ross": ("score", True),
        "Rocket Richard": ("Goals", True),
        "Norris": ("NorrisPoints", True),
        "Selke": ("Plus/Minus", True),
        "Lady Byng": ("Penalty Minutes", False),
        "Jim Gregory": ("gamesPlayed", True),
    }
    integer_trophies = {"Rocket Richard", "Norris", "Selke", "Lady Byng", "Jim Gregory"}

    def format_trophy_value(trophy_name: str, raw_value: Any) -> float | int:
        numeric = float(raw_value or 0.0)
        if trophy_name in integer_trophies:
            return int(round(numeric))
        return numeric

    def build_trophy_bucket() -> Dict[str, Dict[str, float]]:
        trophies: Dict[str, Dict[str, float]] = {}
        for trophy_name, (metric, descending) in trophy_map.items():
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

    vegas_baby_leaderboard = {
        team_name: float(score)
        for team_name, score in sorted((period_leaderboard or {}).items(), key=lambda item: float(item[1]), reverse=True)
    }

    season_data: Dict[str, Any] = {}
    season_key = "2026-2027"

    player_stats_by_id = get_player_stats_by_id(league_id=league_id, transaction_period=22)
    scout_honor_scores = get_scouts_honor_leaderboard(player_stats_by_id=player_stats_by_id)

    season_data[season_key] = {
        "lastupdated": format_lastupdated(),
        "regseason": {
            "trophies": {
                "Hart": get_hart_leaderboard(player_stats_by_id=player_stats_by_id),
                **build_trophy_bucket(),
                "Vezina": placeholder_entry(),
                "Calder": get_calder_leaderboard(player_stats_by_id=player_stats_by_id),
                "Jack Adams": get_jack_adams_leaderboard(teams, scout_honor_scores),
            },
            "awards": {
                "Scout's honor": scout_honor_scores,
                "Fantalytic's Frenzy": get_fantalytics_frenzy_leaderboard(teams),
            },
            "bounties": {
                "It's Vegas Baby!": vegas_baby_leaderboard,
                "Back's Backe Back-2-Back": placeholder_entry(),
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
    results = getMatchupScores(league_id=league_id, reg_season_periods=22)
    vegas_baby_board = getTeamTopPeriodScore(league_id=league_id, reg_season_periods=22)
    final_json = buildSeasonTrophyJson(results, period_leaderboard=vegas_baby_board, league_id=league_id)
#    print(json.dumps(final_json, ensure_ascii=False, indent=2))

    should_publish = os.getenv("PUBLISH_TO_JSONBIN", "0").strip().lower() in {"1", "true", "yes", "on"}
    if should_publish:
        try:
            patch_result = patch_jsonbin_trophies(final_json)
            print(json.dumps({"jsonbin": patch_result}, ensure_ascii=False, indent=2))
        except Exception as exc:
            raise RuntimeError(f"JSONBin publish failed: {exc}") from exc
