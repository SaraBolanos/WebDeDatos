from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import requests
import os
import time

app = Flask(__name__)
CORS(app)

MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongo:27017")
client = MongoClient(MONGO_URL)
db = client["ink"]
cache = db["cache_books"]  # cache por query/id

def cover_from_id(cover_id, size="L"):
    if cover_id:
        return f"https://covers.openlibrary.org/b/id/{cover_id}-{size}.jpg"
    return None  # Devolver None en lugar de placeholder

def clean_text(s: str) -> str:
    if not s:
        return ""
    # quita caracteres raros típicos y recorta
    return str(s).replace("\uFFFD", "").strip()

@app.get("/health")
def health():
    return jsonify(ok=True)

@app.get("/search")
def search():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify(results=[])

    # cache por query 5 min
    cached = cache.find_one({"type": "search", "q": q})
    if cached and (time.time() - cached["ts"] < 300):
        return jsonify(results=cached["results"])

    url = f"https://openlibrary.org/search.json?q={requests.utils.quote(q)}&limit=24"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    data = r.json()

    results = []
    for doc in data.get("docs", []):
        work_key = doc.get("key")  # /works/OL...W
        title = clean_text(doc.get("title")) or "Sin título"
        author = clean_text((doc.get("author_name") or ["Autor desconocido"])[0]) or "Autor desconocido"
        year = str(doc.get("first_publish_year") or "")
        cover_id = doc.get("cover_i")

        results.append({
            "id": work_key or f"id_{len(results)}",
            "title": title,
            "author": author,
            "year": year,
            "cover": cover_from_id(cover_id) or "",
            "tags": [year] if year else [],
            "desc": ""  # el detalle lo rellenamos en /books/<id>
        })

    cache.update_one(
        {"type": "search", "q": q},
        {"$set": {"ts": time.time(), "results": results}},
        upsert=True
    )
    return jsonify(results=results)

@app.get("/detail")
def book_detail_query():
    """Endpoint alternativo con query param: /detail?id="""
    book_id = request.args.get("id", "").strip()
    if not book_id:
        return jsonify(error="Missing id parameter"), 400
    return book_detail_impl(book_id)

@app.get("/<path:book_id>")
def book_detail(book_id):
    """Endpoint con path param: /works/OL123W"""
    return book_detail_impl(book_id)

def book_detail_impl(book_id):
    # Normaliza id: esperamos /works/OLxxxW
    if not book_id.startswith("/"):
        book_id = "/" + book_id

    if not book_id.startswith("/works/"):
        return jsonify(
            id=book_id,
            title="Libro",
            author="Autor desconocido",
            year="",
            cover="",
            tags=[],
            desc="Sin descripción disponible."
        )

    # cache detalle 1h
    cached = cache.find_one({"type": "detail", "id": book_id})
    if cached and (time.time() - cached["ts"] < 3600):
        return jsonify(cached["book"])

    # --- 1) Work JSON ---
    url = f"https://openlibrary.org{book_id}.json"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    data = r.json()

    # título
    title = clean_text(data.get("title")) or "Sin título"

    # descripción (a veces no existe)
    desc = ""
    if isinstance(data.get("description"), str):
        desc = data["description"]
    elif isinstance(data.get("description"), dict):
        desc = data["description"].get("value") or ""

    desc = clean_text(desc)

    # covers + subjects
    covers = data.get("covers") or []
    cover_id = covers[0] if covers else None
    subjects = (data.get("subjects") or [])[:8]
    subjects = [clean_text(s) for s in subjects if clean_text(s)]

    # --- 2) Fallback si NO hay description en el work ---
    # Muchas obras no tienen description; algunas ediciones sí.
    if not desc:
        try:
            ed_url = f"https://openlibrary.org{book_id}/editions.json?limit=5"
            ed = requests.get(ed_url, timeout=15).json()
            entries = ed.get("entries") or []

            for e0 in entries:
                # description puede venir como string o dict
                ed_desc = ""
                if isinstance(e0.get("description"), str):
                    ed_desc = e0["description"]
                elif isinstance(e0.get("description"), dict):
                    ed_desc = e0["description"].get("value") or ""

                ed_desc = clean_text(ed_desc)

                # fallback extra: notes / subtitle
                if not ed_desc:
                    ed_desc = clean_text(e0.get("notes") or "")
                if not ed_desc:
                    ed_desc = clean_text(e0.get("subtitle") or "")

                if ed_desc:
                    desc = ed_desc
                    break
        except Exception:
            pass

    book = {
        "id": book_id,
        "title": title,
        # OpenLibrary work no trae autor directo (esto lo mantienes del search en el frontend)
        "author": "Autor desconocido",
        "year": "",
        "cover": cover_from_id(cover_id) or "",
        "tags": subjects,
        "desc": desc or "Sin descripción disponible."
    }

    cache.update_one(
        {"type": "detail", "id": book_id},
        {"$set": {"ts": time.time(), "book": book}},
        upsert=True
    )

    return jsonify(book)

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT, debug=False)
