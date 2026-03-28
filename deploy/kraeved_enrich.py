#!/usr/bin/env python3
"""
Kraeved Place Enrichment Pipeline
- Wikipedia: historical figures, facts
- SearxNG: additional sources
- Ollama: NLP summarization
- Images: download from Wikipedia
"""

import json
import os
import sys
import time
import re
import urllib.request
import urllib.parse
import urllib.error
import ssl

# Config
DB_HOST = "127.0.0.1"
DB_NAME = "kraeved_development"
DB_USER = "dev"
OLLAMA_URL = "http://192.168.1.71:11434"
OLLAMA_MODEL = "gemma3:4b"
SEARXNG_URL = "http://localhost:3201"
WIKIPEDIA_API = "https://ru.wikipedia.org/w/api.php"
IMAGES_DIR = "/srv/projects/apps/kraeved/public/enriched"
BATCH_SIZE = 10  # places per run
SLEEP_BETWEEN = 1  # seconds between API calls

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def fetch_json(url, timeout=15):
    """Fetch JSON from URL"""
    req = urllib.request.Request(url, headers={"User-Agent": "KraevedBot/1.0"})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)
        return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [WARN] fetch {url[:80]}: {e}")
        return None


def fetch_text(url, timeout=15):
    """Fetch raw text from URL"""
    req = urllib.request.Request(url, headers={"User-Agent": "KraevedBot/1.0"})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)
        return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [WARN] fetch text {url[:80]}: {e}")
        return None


def wikipedia_search(query, limit=3):
    """Search Wikipedia for articles"""
    params = urllib.parse.urlencode({
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srlimit": limit,
        "format": "json",
        "utf8": 1,
    })
    data = fetch_json(f"{WIKIPEDIA_API}?{params}")
    if not data:
        return []
    return [
        {"title": r["title"], "pageid": r["pageid"], "snippet": re.sub(r"<[^>]+>", "", r.get("snippet", ""))}
        for r in data.get("query", {}).get("search", [])
    ]


def wikipedia_extract(title):
    """Get Wikipedia article extract + images"""
    params = urllib.parse.urlencode({
        "action": "query",
        "titles": title,
        "prop": "extracts|pageimages|categories",
        "exintro": 1,
        "explaintext": 1,
        "piprop": "original",
        "format": "json",
        "utf8": 1,
    })
    data = fetch_json(f"{WIKIPEDIA_API}?{params}")
    if not data:
        return None

    pages = data.get("query", {}).get("pages", {})
    for pid, page in pages.items():
        if pid == "-1":
            return None
        img_url = None
        if "original" in page:
            img_url = page["original"].get("source")
        categories = [c["title"].replace("Категория:", "") for c in page.get("categories", [])]
        return {
            "title": page.get("title", ""),
            "extract": page.get("extract", ""),
            "image_url": img_url,
            "categories": categories,
        }
    return None


def wikipedia_historical_figures(place_name, region="Краснодарский край"):
    """Find historical figures connected to a place"""
    queries = [
        f"{place_name} {region} исторические личности",
        f"{place_name} история знаменитые люди",
        f"{place_name} {region}",
    ]
    results = []
    seen = set()
    for q in queries:
        articles = wikipedia_search(q, limit=3)
        for a in articles:
            if a["title"] not in seen:
                seen.add(a["title"])
                extract = wikipedia_extract(a["title"])
                if extract and len(extract["extract"]) > 100:
                    results.append(extract)
        time.sleep(SLEEP_BETWEEN)
    return results


def searxng_search(query, limit=5):
    """Search via SearxNG for additional sources"""
    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "engines": "google,duckduckgo",
        "language": "ru",
    })
    data = fetch_json(f"{SEARXNG_URL}/search?{params}")
    if not data:
        return []
    return [
        {"title": r.get("title", ""), "url": r.get("url", ""), "content": r.get("content", "")}
        for r in data.get("results", [])[:limit]
    ]


def ollama_summarize(place_name, wiki_texts, search_results):
    """Use Ollama to create a rich summary"""
    context_parts = []
    for w in wiki_texts[:3]:
        context_parts.append(f"Wikipedia: {w['title']}\n{w['extract'][:1500]}")
    for s in search_results[:3]:
        if s.get("content"):
            context_parts.append(f"Web: {s['title']}\n{s['content'][:500]}")

    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""Ты — краевед-историк Краснодарского края. На основе собранных данных напиши информативное описание места "{place_name}".

Структура ответа (JSON):
{{
  "description": "Подробное описание места (2-3 абзаца)",
  "historical_figures": ["Имя — кто и когда был связан с этим местом"],
  "fun_facts": ["Интересные факты"],
  "best_season": "Лучшее время для посещения",
  "tags": ["теги для поиска"]
}}

Контекст:
{context}

Ответ строго в JSON:"""

    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 1024},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        data = json.loads(resp.read().decode("utf-8"))
        text = data.get("response", "")
        # Try to parse JSON from response
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            return json.loads(json_match.group())
        return {"description": text, "historical_figures": [], "fun_facts": [], "tags": []}
    except Exception as e:
        print(f"  [WARN] Ollama error: {e}")
        return None


def download_image(url, place_id):
    """Download image to local storage"""
    if not url:
        return None
    os.makedirs(IMAGES_DIR, exist_ok=True)
    ext = url.split(".")[-1].split("?")[0][:4]
    if ext not in ("jpg", "jpeg", "png", "webp", "svg"):
        ext = "jpg"
    filename = f"place_{place_id}.{ext}"
    filepath = os.path.join(IMAGES_DIR, filename)

    if os.path.exists(filepath):
        return filename

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "KraevedBot/1.0"})
        resp = urllib.request.urlopen(req, timeout=15, context=ssl_ctx)
        with open(filepath, "wb") as f:
            f.write(resp.read())
        print(f"  [IMG] Downloaded {filename}")
        return filename
    except Exception as e:
        print(f"  [WARN] Image download failed: {e}")
        return None


def get_places_to_enrich(cursor, limit):
    """Get places that haven't been enriched yet"""
    cursor.execute("""
        SELECT p.id, p.title, p.description, p.address,
               COALESCE(g.name, '') as region_name
        FROM places p
        LEFT JOIN geo_regions g ON g.id = p.geo_region_id
        WHERE p.id NOT IN (
            SELECT DISTINCT place_id FROM place_enrichments
        )
        ORDER BY p.id
        LIMIT %s
    """, (limit,))
    return cursor.fetchall()


def ensure_enrichment_table(cursor):
    """Create enrichment table if not exists"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS place_enrichments (
            id SERIAL PRIMARY KEY,
            place_id INTEGER NOT NULL REFERENCES places(id),
            ai_description TEXT,
            historical_figures JSONB DEFAULT '[]',
            fun_facts JSONB DEFAULT '[]',
            best_season VARCHAR(255),
            tags JSONB DEFAULT '[]',
            wiki_sources JSONB DEFAULT '[]',
            web_sources JSONB DEFAULT '[]',
            enriched_image VARCHAR(255),
            processed_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(place_id)
        );
        CREATE INDEX IF NOT EXISTS idx_enrichments_place ON place_enrichments(place_id);
    """)


def save_enrichment(cursor, place_id, ai_data, wiki_sources, web_sources, image_file):
    """Save enrichment data to DB"""
    cursor.execute("""
        INSERT INTO place_enrichments (
            place_id, ai_description, historical_figures, fun_facts,
            best_season, tags, wiki_sources, web_sources, enriched_image
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (place_id) DO UPDATE SET
            ai_description = EXCLUDED.ai_description,
            historical_figures = EXCLUDED.historical_figures,
            fun_facts = EXCLUDED.fun_facts,
            best_season = EXCLUDED.best_season,
            tags = EXCLUDED.tags,
            wiki_sources = EXCLUDED.wiki_sources,
            web_sources = EXCLUDED.web_sources,
            enriched_image = EXCLUDED.enriched_image,
            processed_at = NOW()
    """, (
        place_id,
        ai_data.get("description", ""),
        json.dumps(ai_data.get("historical_figures", []), ensure_ascii=False),
        json.dumps(ai_data.get("fun_facts", []), ensure_ascii=False),
        ai_data.get("best_season", ""),
        json.dumps(ai_data.get("tags", []), ensure_ascii=False),
        json.dumps([{"title": w["title"], "extract": w["extract"][:300]} for w in wiki_sources], ensure_ascii=False),
        json.dumps([{"title": s["title"], "url": s["url"]} for s in web_sources], ensure_ascii=False),
        image_file,
    ))


def main():
    import psycopg2

    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else BATCH_SIZE

    conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER)
    conn.autocommit = True
    cur = conn.cursor()

    # Ensure table exists
    ensure_enrichment_table(cur)

    # Get unprocessed places
    places = get_places_to_enrich(cur, batch_size)
    print(f"Found {len(places)} places to enrich")

    for place_id, title, description, address, region in places:
        place_name = title or address or f"Place {place_id}"
        print(f"\n[{place_id}] {place_name}")

        # 1. Wikipedia
        print("  Wikipedia...")
        wiki_data = wikipedia_historical_figures(place_name, region or "Краснодарский край")
        print(f"  Found {len(wiki_data)} wiki articles")

        # 2. SearxNG
        print("  SearxNG...")
        search_data = searxng_search(f"{place_name} Краснодарский край достопримечательность")
        print(f"  Found {len(search_data)} web results")

        # 3. Download best image from Wikipedia
        image_file = None
        for w in wiki_data:
            if w.get("image_url"):
                image_file = download_image(w["image_url"], place_id)
                if image_file:
                    break

        # 4. Ollama NLP
        print("  Ollama NLP...")
        ai_data = ollama_summarize(place_name, wiki_data, search_data)
        if not ai_data:
            print("  [SKIP] Ollama failed")
            ai_data = {
                "description": " ".join([w["extract"][:500] for w in wiki_data[:2]]),
                "historical_figures": [],
                "fun_facts": [],
                "tags": [],
            }

        # 5. Save to DB
        save_enrichment(cur, place_id, ai_data, wiki_data, search_data, image_file)
        print(f"  [OK] Saved enrichment for {place_name}")

        time.sleep(SLEEP_BETWEEN)

    # Stats
    cur.execute("SELECT COUNT(*) FROM place_enrichments")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM places")
    all_places = cur.fetchone()[0]
    print(f"\n=== Done: {total}/{all_places} places enriched ===")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
