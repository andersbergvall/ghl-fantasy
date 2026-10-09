import csv
import json
import os
from pathlib import Path
from urllib.parse import quote

import requests

DEFAULT_ENV_PATH = Path(r"C:\Users\sweabe\Dropbox\Desktop\GHL\env.txt")
PROJECT_ROOT = Path(__file__).resolve().parent
ARCHIVED_YEARS_DIR = PROJECT_ROOT / "archived_years"
HISTORY_OUTPUT_DIR = ARCHIVED_YEARS_DIR

def normalize_season_name(value: str) -> str:
    return str(value or "").strip()


def load_env_file(path: str | None = None) -> None:
    candidate_path = path or str(DEFAULT_ENV_PATH)
    if not os.path.exists(candidate_path):
        return

    with open(candidate_path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key_value = line.replace("export ", "", 1)
            key, value = [part.strip() for part in key_value.split("=", 1)]
            key = key.strip().strip('"\'')
            value = value.strip().strip('"\'')
            os.environ.setdefault(key, value)


def patch_cloudflare_kv_value(namespace_id: str, key: str, payload: dict) -> dict:
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    api_token = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
    if not account_id:
        raise ValueError("Missing CLOUDFLARE_ACCOUNT_ID in the environment.")
    if not api_token:
        raise ValueError("Missing CLOUDFLARE_API_TOKEN in the environment.")
    if not namespace_id:
        raise ValueError("Cloudflare KV namespace id is empty.")

    safe_key = quote(str(key).strip(), safe="")
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{safe_key}"
    response = requests.put(
        url,
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload, ensure_ascii=False),
        timeout=30,
    )
    if response.status_code in (401, 403, 404):
        raise PermissionError("Cloudflare KV write failed. Check credentials and namespace id values.")
    response.raise_for_status()
    return {"namespace_id": namespace_id, "key": key, "status_code": response.status_code, "ok": response.ok}


def collect_archived_payloads(prefix: str) -> list[tuple[str, dict]]:
    payloads: list[tuple[str, dict]] = []
    if not ARCHIVED_YEARS_DIR.exists():
        return payloads

    for season_dir in sorted(ARCHIVED_YEARS_DIR.iterdir(), key=lambda item: item.name):
        if not season_dir.is_dir():
            continue
        archive_path = season_dir / f"{prefix}-{season_dir.name}.json"
        if not archive_path.exists():
            continue
        try:
            with archive_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            continue
        if isinstance(payload, dict):
            payloads.append((season_dir.name, payload))
    return sorted(payloads, key=lambda item: item[0])


def merge_history_payloads(prefix: str) -> dict:
    merged: dict = {"season": {}}
    for season_key, payload in collect_archived_payloads(prefix):
        season_map = payload.get("season") if isinstance(payload, dict) else {}
        if isinstance(season_map, dict):
            merged["season"][season_key] = season_map.get(season_key, season_map)
    return merged


def write_history_json(prefix: str, payload: dict) -> Path:
    output_path = HISTORY_OUTPUT_DIR / f"{prefix}-history.json"
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return output_path


def get_history_namespace_ids() -> dict:
    return {
        "trophy-data-history": os.getenv("CLOUDFLARE_KV_NAMESPACE_ID_TROPHY_DATA_HISTORY", "49119e4f36dc429ea9bfc0a5a8afc6a6").strip(),
        "matchup-data-history": os.getenv("CLOUDFLARE_KV_NAMESPACE_ID_MATCHUP_DATA_HISTORY", "3a32183729fd47c6ba7a8154f19ea9ea").strip(),
        "drafted-player-stats-history": os.getenv("CLOUDFLARE_KV_NAMESPACE_ID_DRAFTED_PLAYER_STATS_HISTORY", "c11adccda1a045b4bb75f3a6895fa698").strip(),
    }


def build_history_kvs() -> dict:
    namespace_ids = get_history_namespace_ids()
    output = {}
    for prefix, key_name in [
        ("trophy-data", "trophy-data-history"),
        ("matchup-data", "matchup-data-history"),
        ("drafted-player-stats", "drafted-player-stats-history"),
    ]:
        merged = merge_history_payloads(prefix)
        output[key_name] = merged
        local_path = write_history_json(key_name, merged)
        namespace_id = namespace_ids.get(key_name)
        if namespace_id:
            patch_cloudflare_kv_value(namespace_id, key_name, merged)
        output[f"{key_name}_path"] = str(local_path.resolve())
    return output


if __name__ == "__main__":
    load_env_file()
    result = build_history_kvs()
    print(json.dumps(result, ensure_ascii=False, indent=2))
