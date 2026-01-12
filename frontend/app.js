// =====================
// CONFIG
// =====================
// Backend (Gateway)
const API = "http://localhost:8080";

// Books endpoints (según tu gateway + books-service actual):
//  - GET  /api/books/search?q=...
//  - GET  /api/books/detail?id=...
const BOOKS_SEARCH_PATH = "/api/books/search";
const BOOKS_DETAIL_PATH = "/api/books/detail"; // + ?id=...

// =====================
// Utils
// =====================
function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function cleanText(str) {
  return String(str || "")
    .replace(/\uFFFD/g, "")                 // �
    .replace(/[\u0000-\u001F\u007F]/g, "")  // control chars
    .trim();
}
function safeJsonParse(text) {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =====================
// Token + API client
// =====================
function getToken() { return localStorage.getItem("token"); }
function setToken(t) { localStorage.setItem("token", t); }
function clearToken() { localStorage.removeItem("token"); }

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!headers["Content-Type"] && options.body) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });

  const text = await res.text();
  const data = safeJsonParse(text) ?? text;

  if (res.status === 401) {
    // token inválido/expirado
    clearToken();
    state.currentUser = null;
    state.favoritesMap = {};
  }

  if (!res.ok) {
    const msg = (data && typeof data === "object" && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// =====================
// Backend: Auth + Favorites (users-service via gateway)
// =====================
async function apiLogin(email, password) {
  const data = await apiFetch("/api/users/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  return data.user;
}

async function apiRegister(name, email, password) {
  const data = await apiFetch("/api/users/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
  setToken(data.token);
  return data.user;
}

async function apiMe() {
  const data = await apiFetch("/api/users/me");
  return data.user;
}

async function apiListFavorites() {
  const data = await apiFetch("/api/users/favorites");
  return data.favorites || []; // [{ bookId, book, createdAt }]
}

async function apiAddFavorite(book) {
  await apiFetch("/api/users/favorites", {
    method: "POST",
    body: JSON.stringify({ bookId: book.id, book })
  });
}

async function apiRemoveFavorite(bookId) {
  await apiFetch(`/api/users/favorites/${encodeURIComponent(bookId)}`, {
    method: "DELETE"
  });
}

// =====================
// Books-service via Gateway (search + detail)
// =====================
async function searchBooks(query) {
  const q = (query || "").trim();
  if (!q) return [];

  // books-service returns: { results: [...] }
  const data = await apiFetch(`${BOOKS_SEARCH_PATH}?q=${encodeURIComponent(q)}`, {
    method: "GET"
  });

  // Normalizamos por si el backend devuelve campos con nombres exactos ya buenos
  const results = Array.isArray(data?.results) ? data.results : [];

  return results.map(item => ({
    id: item.id,
    title: cleanText(item.title) || "Sin título",
    author: cleanText(item.author) || "Autor desconocido",
    year: cleanText(item.year) || "",
    cover: cleanText(item.cover) || "https://via.placeholder.com/1200x800?text=No+Cover",
    desc: cleanText(item.desc) || "",
    tags: Array.isArray(item.tags) ? item.tags.map(cleanText).filter(Boolean) : []
  }));
}

async function fetchBookDetail(bookId) {
  const id = (bookId || "").trim();
  if (!id) throw new Error("Missing book id");

  // Usar el endpoint con query param
  const data = await apiFetch(`${BOOKS_DETAIL_PATH}?id=${encodeURIComponent(id)}`, { method: "GET" });

  // el endpoint devuelve directamente el objeto del libro
  return {
    id: id,
    title: cleanText(data?.title) || "Sin título",
    author: cleanText(data?.author) || "Autor desconocido",
    year: cleanText(data?.year) || "",
    cover: cleanText(data?.cover) || "https://via.placeholder.com/1200x800?text=No+Cover",
    desc: cleanText(data?.desc) || "Sin descripción disponible.",
    tags: Array.isArray(data?.tags) ? data.tags.map(cleanText).filter(Boolean) : []
  };
}


// =====================
// App state
// =====================
const state = {
  lastQuery: "",
  results: [],
  cacheById: {},         // id -> book
  currentUser: null,     // {id,name,email}
  favoritesMap: {}       // bookId -> book
};

function cacheBooks(list) {
  for (const b of list) state.cacheById[b.id] = b;
}

function isLoggedIn() {
  return Boolean(getToken());
}

function isFav(bookId) {
  return Boolean(state.favoritesMap[bookId]);
}

async function syncSessionAndFavorites() {
  if (!isLoggedIn()) {
    state.currentUser = null;
    state.favoritesMap = {};
    return;
  }

  try {
    state.currentUser = await apiMe();
    const favs = await apiListFavorites();
    const map = {};
    for (const f of favs) {
      map[f.bookId] = f.book;
      if (f.book && f.book.id) state.cacheById[f.book.id] = f.book;
    }
    state.favoritesMap = map;
  } catch {
    // si token es inválido, apiFetch lo limpia con 401
  }
}

// =====================
// Navbar
// =====================
function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  if (!isLoggedIn() || !state.currentUser) {
    nav.innerHTML = `
      <a href="#/favorites">Favoritos</a>
      <a class="btn btn-ghost" href="#/login">Login</a>
    `;
    return;
  }

  nav.innerHTML = `
    <a href="#/favorites">Favoritos</a>
    <span class="muted">Hola, ${escapeHTML(state.currentUser.name || "usuario")}</span>
    <button class="btn btn-ghost" id="logoutBtn" type="button">Salir</button>
  `;

  nav.querySelector("#logoutBtn").addEventListener("click", () => {
    clearToken();
    state.currentUser = null;
    state.favoritesMap = {};
    location.hash = "#/home";
    render();
  });
}

// =====================
// Router
// =====================
function parseRoute() {
  const hash = location.hash || "#/home";
  const parts = hash.replace(/^#\//, "").split("/");
  const route = parts[0] || "home";
  const param = parts.slice(1).join("/") || "";
  return { route, param: decodeURIComponent(param) };
}

function protect(route) {
  if (route === "favorites" && !isLoggedIn()) {
    location.hash = "#/login";
    return false;
  }
  return true;
}

// =====================
// Views
// =====================
function viewHome() {
  return `
    <section class="hero">
      <div class="hero-card">
        <h1>Ink & Quills</h1>
        <p>Tus reseñas literarias en un solo lugar</p>

        <div class="search">
          <input id="q" type="search" placeholder="Buscar por título, autor, tema..." value="${escapeHTML(state.lastQuery)}" />
          <button id="searchBtn" class="btn">Buscar</button>
        </div>

        <div class="chips">
          <button class="chip" data-query="fiction">Ficción</button>
          <button class="chip" data-query="philosophy">Filosofía</button>
          <button class="chip" data-query="self-help">Crecimiento</button>
          <button class="chip" data-query="society">Sociedad</button>
        </div>

        <p class="muted tiny">Fuente: books-service (Python + Mongo) vía Gateway. Favoritos en Postgres por usuario.</p>
      </div>
    </section>

    <section class="container">
      <div class="section-head">
        <h2>Resultados</h2>
        <span class="muted" id="resultMeta">${state.lastQuery ? `${state.results.length} resultado(s)` : "Escribe una búsqueda para empezar"}</span>
      </div>

      <div id="grid" class="grid">
        ${state.lastQuery ? renderGridHTML(state.results) : ""}
      </div>
    </section>
  `;
}

function viewLogin() {
  if (isLoggedIn() && state.currentUser) {
    return `
      <section class="container">
        <div class="empty">
          <h2>Sesión activa</h2>
          <p class="muted">Has iniciado sesión como <b>${escapeHTML(state.currentUser.email || "")}</b>.</p>
          <div style="display:flex; gap:12px; margin-top:12px;">
            <a class="btn btn-ghost" href="#/home">Ir al inicio</a>
            <a class="btn" href="#/favorites">Ver favoritos</a>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="container">
      <div class="auth">
        <div class="auth-card">
          <h2>Iniciar sesión</h2>
          <p class="muted">Usa tu backend real vía Gateway.</p>

          <form id="loginForm" class="form">
            <label>
              Email
              <input name="email" type="email" required placeholder="tucorreo@ejemplo.com" />
            </label>
            <label>
              Contraseña
              <input name="password" type="password" required placeholder="••••••••" />
            </label>
            <button class="btn" type="submit">Entrar</button>
            <p class="muted tiny" id="loginMsg"></p>
          </form>
        </div>

        <div class="auth-card">
          <h2>Registro</h2>
          <p class="muted">Crea un usuario en Postgres.</p>

          <form id="registerForm" class="form">
            <label>
              Nombre
              <input name="name" type="text" required placeholder="Tu nombre" />
            </label>
            <label>
              Email
              <input name="email" type="email" required placeholder="tucorreo@ejemplo.com" />
            </label>
            <label>
              Contraseña
              <input name="password" type="password" required placeholder="mínimo 6 caracteres" />
            </label>
            <button class="btn btn-ghost" type="submit">Crear cuenta</button>
            <p class="muted tiny" id="registerMsg"></p>
          </form>
        </div>
      </div>
    </section>
  `;
}

function viewFavorites() {
  const list = Object.values(state.favoritesMap);

  return `
    <section class="container">
      <div class="section-head">
        <h2>Favoritos</h2>
        <span class="muted">${list.length} libro(s) guardado(s)</span>
      </div>

      ${list.length === 0 ? `
        <div class="empty">
          <h3>No tienes favoritos todavía</h3>
          <p class="muted">Guarda libros desde la búsqueda y aparecerán aquí.</p>
          <a class="btn" href="#/home">Ir a buscar</a>
        </div>
      ` : `
        <div id="grid" class="grid">${renderGridHTML(list)}</div>
      `}
    </section>
  `;
}

function viewBook(id) {
  const book =
    state.favoritesMap[id] ||
    state.cacheById[id] ||
    { id, title: "Cargando…", author: "Autor desconocido", year: "", cover: "https://via.placeholder.com/1200x800?text=No+Cover", desc: "", tags: [] };

  return `
    <section class="container">
      <a class="back" href="#/home">← Volver</a>

      <div class="detail-card">
        <img class="detail-cover" src="${book.cover}" alt="Portada ${escapeHTML(book.title)}">
        <div class="detail-content">
          <h1>${escapeHTML(book.title)}</h1>
          <p class="muted">por ${escapeHTML(book.author)}${book.year ? ` · ${escapeHTML(book.year)}` : ""}</p>

          <div class="tags" style="margin:10px 0 14px;">
            ${(book.tags || []).slice(0, 10).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join("")}
          </div>

          <p class="detail-desc">${escapeHTML(book.desc || "Cargando descripción…")}</p>

          <div class="detail-actions">
            <a class="btn btn-ghost" href="#/favorites">Favoritos</a>
            <button class="btn" id="favToggle" type="button">
              ${isFav(book.id) ? "★ Quitar de favoritos" : "☆ Guardar en favoritos"}
            </button>
          </div>

          ${!isLoggedIn() ? `<p class="muted tiny" style="margin-top:10px;">Inicia sesión para guardar favoritos.</p>` : ``}
        </div>
      </div>
    </section>
  `;
}

// =====================
// Components
// =====================
function renderGridHTML(list) {
  return list.map(b => {
    const favText = isFav(b.id) ? "★ Guardado" : "☆ Guardar";
    return `
      <article class="card">
        <img src="${b.cover}" alt="Portada ${escapeHTML(b.title)}" loading="lazy">
        <div class="pad">
          <div>
            <h3>${escapeHTML(b.title)}</h3>
            <div class="meta">${escapeHTML(b.author)}${b.year ? ` · ${escapeHTML(b.year)}` : ""}</div>
          </div>

          <div class="tags">
            ${(b.tags || []).slice(0, 4).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join("")}
          </div>

          <div class="actions">
            <a href="#/book/${encodeURIComponent(b.id)}">Ver detalle</a>
            <button class="favBtn" data-id="${escapeHTML(b.id)}">${favText}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

// =====================
// Render + events
// =====================
function render() {
  const app = document.getElementById("app");
  if (!app) return;

  const { route, param } = parseRoute();
  if (!protect(route)) return;

  renderNav();

  if (route === "home") app.innerHTML = viewHome();
  else if (route === "login") app.innerHTML = viewLogin();
  else if (route === "favorites") app.innerHTML = viewFavorites();
  else if (route === "book") app.innerHTML = viewBook(param);
  else app.innerHTML = `<section class="container"><div class="empty"><h2>404</h2><p class="muted">Ruta no encontrada</p><a class="btn" href="#/home">Ir al inicio</a></div></section>`;

  wire(route, param);
}

function wire(route, param) {
  if (route === "home") wireHome();
  if (route === "login") wireLogin();
  if (route === "favorites") wireGridFromFavorites();
  if (route === "book") wireBook(param);
}

// ---- Home
function wireHome() {
  const q = document.getElementById("q");
  const searchBtn = document.getElementById("searchBtn");
  const grid = document.getElementById("grid");
  const meta = document.getElementById("resultMeta");

  async function runSearch(query) {
    const text = (query ?? q.value).trim();
    state.lastQuery = text;

    if (!text) {
      state.results = [];
      if (meta) meta.textContent = "Escribe una búsqueda para empezar";
      if (grid) grid.innerHTML = "";
      return;
    }

    if (meta) meta.textContent = "Buscando…";
    if (grid) grid.innerHTML = `<div class="empty"><p class="muted">Buscando en books-service…</p></div>`;

    try {
      const results = await searchBooks(text);
      state.results = results;
      cacheBooks(results);

      if (meta) meta.textContent = `${results.length} resultado(s) para “${text}”`;
      if (grid) grid.innerHTML = renderGridHTML(results);
      wireGridButtons(grid, results);
    } catch (err) {
      if (meta) meta.textContent = "Error";
      if (grid) grid.innerHTML = `<div class="empty"><h3>Error</h3><p class="muted">${escapeHTML(err.message)}</p></div>`;
    }
  }

  // si ya hay resultados, engancha botones
  if (grid && state.results.length) wireGridButtons(grid, state.results);

  if (searchBtn && q) {
    searchBtn.addEventListener("click", () => runSearch(q.value));
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(q.value); });
  }

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const quick = chip.dataset.query || "";
      q.value = quick;
      runSearch(quick);
    });
  });
}

function wireGridButtons(grid, list) {
  if (!grid) return;
  grid.querySelectorAll(".favBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const book = list.find(x => x.id === id);
      if (!book) return;

      if (!isLoggedIn()) {
        location.hash = "#/login";
        return;
      }

      try {
        if (isFav(id)) {
          await apiRemoveFavorite(id);
          delete state.favoritesMap[id];
          btn.textContent = "☆ Guardar";
        } else {
          await apiAddFavorite(book);
          state.favoritesMap[id] = book;
          btn.textContent = "★ Guardado";
        }
      } catch (e) {
        alert(`Error favoritos: ${e.message}`);
      }
    });
  });
}

// ---- Favorites page
function wireGridFromFavorites() {
  const grid = document.getElementById("grid");
  const list = Object.values(state.favoritesMap);
  if (grid && list.length) wireGridButtons(grid, list);
}

// ---- Login page
function wireLogin() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginMsg = document.getElementById("loginMsg");
  const registerMsg = document.getElementById("registerMsg");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginMsg) loginMsg.textContent = "Entrando…";

      const fd = new FormData(loginForm);
      const email = cleanText(fd.get("email"));
      const password = String(fd.get("password") || "");

      try {
        state.currentUser = await apiLogin(email, password);
        await syncSessionAndFavorites();
        renderNav();
        location.hash = "#/favorites";
      } catch (err) {
        if (loginMsg) loginMsg.textContent = `Error: ${err.message}`;
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (registerMsg) registerMsg.textContent = "Creando cuenta…";

      const fd = new FormData(registerForm);
      const name = cleanText(fd.get("name"));
      const email = cleanText(fd.get("email"));
      const password = String(fd.get("password") || "");

      try {
        state.currentUser = await apiRegister(name, email, password);
        await syncSessionAndFavorites();
        renderNav();
        location.hash = "#/favorites";
      } catch (err) {
        if (registerMsg) registerMsg.textContent = `Error: ${err.message}`;
      }
    });
  }
}

// ---- Book detail
async function wireBook(id) {
  const favBtn = document.getElementById("favToggle");

  async function updateFavButton() {
    if (!favBtn) return;
    favBtn.textContent = isFav(id) ? "★ Quitar de favoritos" : "☆ Guardar en favoritos";
  }

  if (favBtn) {
    favBtn.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        location.hash = "#/login";
        return;
      }

      const book = state.favoritesMap[id] || state.cacheById[id] || { id, title: "Libro", author: "Autor", year: "", cover: "https://via.placeholder.com/1200x800?text=No+Cover", desc: "", tags: [] };

      try {
        if (isFav(id)) {
          await apiRemoveFavorite(id);
          delete state.favoritesMap[id];
        } else {
          await apiAddFavorite(book);
          state.favoritesMap[id] = book;
        }
        await updateFavButton();
      } catch (e) {
        alert(`Error favoritos: ${e.message}`);
      }
    });
  }

  // Cargar detalle real desde books-service
  try {
    // Para no machacar: si ya tenemos una desc buena, no hace falta.
    const cached = state.cacheById[id];
    const needsDetail = !cached || !cached.desc || cached.desc === "Cargando descripción…";

    if (needsDetail) {
      const detail = await fetchBookDetail(id);

      // Mantén si en cache tenías author/year de búsqueda
      const base = state.favoritesMap[id] || state.cacheById[id] || detail;
      const merged = {
      ...base,                 // lo del search (título/autor/año/cover)
      ...detail,               // lo del detail (desc/tags)
      title: cleanText(detail.title) || base.title,
      cover: cleanText(detail.cover) || base.cover,
      desc: cleanText(detail.desc) || base.desc || "Sin descripción disponible.",
      tags: (detail.tags && detail.tags.length) ? detail.tags : (base.tags || []),
      author: cleanText(base.author) || cleanText(detail.author) || "Autor desconocido",
      year: cleanText(base.year) || cleanText(detail.year) || ""
};


      state.cacheById[id] = merged;

      // si está en favoritos, refresca snapshot en backend
      if (isFav(id)) {
        await apiAddFavorite(merged);
        state.favoritesMap[id] = merged;
      }

      // re-render si sigues en el mismo libro
      const { route, param } = parseRoute();
      if (route === "book" && param === id) {
        render();
      }
    }
  } catch {
    // si falla el detalle, dejamos lo básico
  }

  await updateFavButton();
}

// =====================
// Boot
// =====================
window.addEventListener("hashchange", () => render());

document.addEventListener("DOMContentLoaded", async () => {
  if (!location.hash) location.hash = "#/home";

  await syncSessionAndFavorites();
  render();
});
