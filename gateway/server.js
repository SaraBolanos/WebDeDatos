import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const PORT = Number(process.env.PORT || 8080);
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || "http://users:3001";
const BOOKS_SERVICE_URL = process.env.BOOKS_SERVICE_URL || "http://books:5000";

// Swagger
const openapi = YAML.load("./openapi.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

// Proxy users service
app.use(
  "/api/users",
  createProxyMiddleware({
    target: USERS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/users": "" }
  })
);

// Proxy books service
app.use(
  "/api/books",
  createProxyMiddleware({
    target: BOOKS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/books": "" }
  })
);

app.get("/health", (_, res) => res.json({ ok: true }));

// Página de bienvenida
app.get("/", (_, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ink & Quills API Gateway</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; }
        .link-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .status { color: #22c55e; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>✒️ Ink & Quills API Gateway</h1>
      <p class="status">✓ Gateway funcionando correctamente</p>
      
      <div class="link-box">
        <h2>🔗 Enlaces útiles</h2>
        <ul>
          <li><a href="/docs">📚 Documentación API (Swagger)</a></li>
          <li><a href="/health">❤️ Health Check</a></li>
          <li><a href="http://localhost:3000">🎨 Frontend</a></li>
        </ul>
      </div>

      <div class="link-box">
        <h2>🛣️ Rutas disponibles</h2>
        <ul>
          <li><code>GET /api/users/me</code> - Obtener usuario actual</li>
          <li><code>POST /api/users/auth/login</code> - Iniciar sesión</li>
          <li><code>POST /api/users/auth/register</code> - Registrarse</li>
          <li><code>GET /api/users/favorites</code> - Listar favoritos</li>
          <li><code>GET /api/books/search?q=...</code> - Buscar libros</li>
          <li><code>GET /api/books/detail?id=...</code> - Detalle de libro</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`gateway listening on ${PORT}`));
