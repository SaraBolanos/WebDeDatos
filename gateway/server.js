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

app.listen(PORT, () => console.log(`gateway listening on ${PORT}`));
