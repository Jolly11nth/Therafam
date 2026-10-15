"""Free supplemental health-topic search backed by the MedlinePlus Web Service.

MedlinePlus requires no API key. Its service returns public health-topic metadata in
XML; this module returns only titles, short summaries, and links to the source pages.
"""
from __future__ import annotations

import asyncio
import html
import re
import threading
import time
import xml.etree.ElementTree as ET
from collections import OrderedDict
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query

from .auth import current_user

router = APIRouter()
MEDLINEPLUS_ENDPOINT = "https://wsearch.nlm.nih.gov/ws/query"
CACHE_TTL_SECONDS = 12 * 60 * 60
MAX_CACHE_ENTRIES = 256
_TIMEOUT_SECONDS = 8
_cache: OrderedDict[tuple[str, str], tuple[float, list[dict[str, str]]]] = OrderedDict()
_cache_lock = threading.Lock()


def _plain_text(value: str) -> str:
    """Collapse provider markup into plain text before sending it to the UI."""
    value = html.unescape(re.sub(r"<[^>]*>", " ", value))
    return re.sub(r"\s+", " ", value).strip()


def _fetch_medlineplus(query: str, language: Literal["en", "es"]) -> list[dict[str, str]]:
    params = urlencode(
        {
            "db": "healthTopicsSpanish" if language == "es" else "healthTopics",
            "term": query,
            "retmax": "10",
            "rettype": "brief",
            "tool": "therafam",
        }
    )
    request = Request(
        f"{MEDLINEPLUS_ENDPOINT}?{params}",
        headers={"Accept": "application/xml", "User-Agent": "Therafam/2.0 (health education resource search)"},
    )
    with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
        payload = response.read(2_000_000)
        if response.status != 200:
            raise OSError(f"MedlinePlus returned HTTP {response.status}")

    root = ET.fromstring(payload)
    results: list[dict[str, str]] = []
    for document in root.findall(".//document"):
        url = (document.attrib.get("url") or "").strip()
        # Only expose links to the intended official source.
        if not url.startswith("https://medlineplus.gov/"):
            continue

        fields: dict[str, str] = {}
        for node in document.findall("content"):
            name = (node.attrib.get("name") or "").lower()
            text = "".join(node.itertext()).strip()
            if name and text:
                fields[name] = text

        title = _plain_text(fields.get("title", ""))
        if not title:
            continue
        summary = _plain_text(fields.get("snippet") or fields.get("fullsummary") or "")
        if len(summary) > 420:
            summary = summary[:417].rsplit(" ", 1)[0] + "…"
        results.append(
            {
                "title": title,
                "summary": summary,
                "url": url,
                "source": "MedlinePlus.gov",
            }
        )
    return results


def _get_cached(key: tuple[str, str]) -> list[dict[str, str]] | None:
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if cached is None:
            return None
        inserted_at, results = cached
        if now - inserted_at >= CACHE_TTL_SECONDS:
            del _cache[key]
            return None
        _cache.move_to_end(key)
        return [dict(item) for item in results]


def _save_cache(key: tuple[str, str], results: list[dict[str, str]]) -> None:
    with _cache_lock:
        _cache[key] = (time.monotonic(), [dict(item) for item in results])
        _cache.move_to_end(key)
        while len(_cache) > MAX_CACHE_ENTRIES:
            _cache.popitem(last=False)


@router.get("/api/external/self-help-resources")
async def search_self_help_resources(
    q: str = Query(min_length=2, max_length=120, description="Health topic or wellbeing keyword"),
    language: Literal["en", "es"] = "en",
    user=Depends(current_user),
):
    """Search MedlinePlus for additional educational reading without an API key."""
    del user  # Authentication protects the public upstream service from anonymous abuse.
    query = " ".join(q.split())
    if len(query) < 2:
        raise HTTPException(status_code=422, detail="Enter at least two characters to search.")

    key = (query.casefold(), language)
    results = _get_cached(key)
    if results is None:
        try:
            results = await asyncio.to_thread(_fetch_medlineplus, query, language)
        except (HTTPError, URLError, TimeoutError, OSError, ET.ParseError) as exc:
            raise HTTPException(
                status_code=502,
                detail="MedlinePlus resources are temporarily unavailable. Please try again shortly.",
            ) from exc
        _save_cache(key, results)

    return {
        "query": query,
        "language": language,
        "source": "MedlinePlus.gov",
        "attribution": "Health information and links are from MedlinePlus.gov. MedlinePlus does not endorse Therafam.",
        "results": results,
    }
