import express from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

// ---------- Helpers ----------
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return res.status(401).json({ error: "Missing token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function validateEmail(email) {
  return typeof email === "string" && email.includes("@") && email.length <= 254;
}

function validatePassword(pw) {
  return typeof pw === "string" && pw.length >= 6 && pw.length <= 128;
}

// ---------- Health ----------
app.get("/health", (_, res) => res.json({ ok: true }));

// ---------- Auth ----------
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ error: "Name too short" });
  }
  if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email" });
  if (!validatePassword(password)) return res.status(400).json({ error: "Password must be 6-128 chars" });

  const normalizedEmail = email.trim().toLowerCase();
  const password_hash = await bcrypt.hash(password, 10);

  try {
    const result = await query(
      `INSERT INTO users(name, email, password_hash)
       VALUES($1,$2,$3)
       RETURNING id, name, email`,
      [name.trim(), normalizedEmail, password_hash]
    );

    const user = result.rows[0];
    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (e) {
    // unique violation
    if (String(e.code) === "23505") {
      return res.status(409).json({ error: "Email already exists" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email" });
  if (typeof password !== "string") return res.status(400).json({ error: "Invalid password" });

  const normalizedEmail = email.trim().toLowerCase();

  const result = await query(
    `SELECT id, name, email, password_hash FROM users WHERE email=$1`,
    [normalizedEmail]
  );

  const row = result.rows[0];
  if (!row) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const user = { id: row.id, name: row.name, email: row.email };
  const token = signToken(user);
  return res.json({ user, token });
});

app.get("/me", auth, async (req, res) => {
  const userId = Number(req.user.sub);
  const result = await query(`SELECT id, name, email, created_at FROM users WHERE id=$1`, [userId]);
  const user = result.rows[0];
  return res.json({ user });
});

// ---------- Favorites ----------
app.get("/favorites", auth, async (req, res) => {
  const userId = Number(req.user.sub);
  const result = await query(
    `SELECT book_id, book_snapshot, created_at
     FROM favorites
     WHERE user_id=$1
     ORDER BY created_at DESC`,
    [userId]
  );

  const favorites = result.rows.map(r => ({
    bookId: r.book_id,
    book: r.book_snapshot,
    createdAt: r.created_at
  }));

  return res.json({ favorites });
});

app.post("/favorites", auth, async (req, res) => {
  const userId = Number(req.user.sub);
  const { bookId, book } = req.body || {};

  if (typeof bookId !== "string" || bookId.trim().length < 2) {
    return res.status(400).json({ error: "Invalid bookId" });
  }
  if (typeof book !== "object" || !book) {
    return res.status(400).json({ error: "Invalid book" });
  }

  try {
    await query(
      `INSERT INTO favorites(user_id, book_id, book_snapshot)
       VALUES($1,$2,$3)
       ON CONFLICT(user_id, book_id) DO UPDATE SET book_snapshot=EXCLUDED.book_snapshot`,
      [userId, bookId.trim(), book]
    );
    return res.status(201).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/favorites/:bookId", auth, async (req, res) => {
  const userId = Number(req.user.sub);
  const bookId = String(req.params.bookId || "").trim();
  if (!bookId) return res.status(400).json({ error: "Invalid bookId" });

  await query(
    `DELETE FROM favorites WHERE user_id=$1 AND book_id=$2`,
    [userId, bookId]
  );

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`users-service listening on ${PORT}`);
});
