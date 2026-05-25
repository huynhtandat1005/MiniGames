const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === "/" ? "client.html" : req.url);
  const ext = path.extname(filePath);
  const contentType = ext === ".html" ? "text/html" : "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const io = new Server(server, {
  cors: { origin: "*" }
});

// ─── State ───────────────────────────────────────────────────────────────────
const rooms = {}; // roomId → { players: [{ id, name, choice }], status }
const players = {}; // socketId → { name, roomId }

function log(msg) {
  const time = new Date().toLocaleTimeString("vi-VN");
  console.log(`\x1b[36m[${time}]\x1b[0m ${msg}`);
}

function roomInfo(roomId) {
  const r = rooms[roomId];
  if (!r) return "—";
  const names = r.players.map((p) => p.name).join(" vs ");
  return `Phòng \x1b[33m${roomId}\x1b[0m [${r.players.length}/2] ${names}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getResult(a, b) {
  // a, b: 'rock'|'paper'|'scissors'
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "rock")
  )
    return "win";
  return "lose";
}

const EMOJI = { rock: "✊", paper: "✋", scissors: "✌️" };
const VI = { rock: "Búa", paper: "Bao", scissors: "Kéo" };

// ─── Socket events ────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  log(`\x1b[32m+\x1b[0m Kết nối mới: \x1b[35m${socket.id}\x1b[0m`);

  // ── join / create room ──────────────────────────────────────────────────────
  socket.on("joinRoom", ({ name, roomId }) => {
    name = (name || "Ẩn danh").trim().slice(0, 20);
    roomId = (roomId || "").trim().toUpperCase().slice(0, 8);

    if (!roomId) {
      // Generate a random room ID
      roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
    }

    // Validate player count
    if (rooms[roomId] && rooms[roomId].players.length >= 2) {
      socket.emit("error", "Phòng đã đầy (2/2)!");
      log(`✗ ${name} cố vào phòng đầy: ${roomId}`);
      return;
    }

    // Register player
    players[socket.id] = { name, roomId };
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], status: "waiting", round: 0, scores: {} };
    }

    const room = rooms[roomId];
    room.players.push({ id: socket.id, name, choice: null });
    room.scores[socket.id] = 0;

    socket.emit("joinedRoom", { roomId, name });

    if (room.players.length === 1) {
      socket.emit("waiting", "Đang chờ đối thủ vào phòng…");
      log(`\x1b[34mTạo\x1b[0m  ${roomInfo(roomId)} — chủ phòng: ${name}`);
    } else {
      room.status = "playing";
      room.round = 1;
      const names = room.players.map((p) => p.name);
      io.to(roomId).emit("gameStart", {
        players: names,
        round: room.round,
      });
      log(`\x1b[32mBắt đầu\x1b[0m ${roomInfo(roomId)}`);
    }
  });

  // ── player choice ───────────────────────────────────────────────────────────
  socket.on("choose", (choice) => {
    const pInfo = players[socket.id];
    if (!pInfo) return;

    const { roomId } = pInfo;
    const room = rooms[roomId];
    if (!room || room.status !== "playing") return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.choice) return; // already chose

    player.choice = choice;
    log(
      `\x1b[33m${pInfo.name}\x1b[0m chọn \x1b[35m${EMOJI[choice]} ${VI[choice]}\x1b[0m — phòng ${roomId}`
    );

    // Notify the other player that this player has chosen (but not what)
    socket.to(roomId).emit("opponentChose");

    // Check if both chose
    const [p1, p2] = room.players;
    if (p1.choice && p2.choice) {
      const r1 = getResult(p1.choice, p2.choice);
      const r2 = r1 === "draw" ? "draw" : r1 === "win" ? "lose" : "win";

      if (r1 === "win") room.scores[p1.id] = (room.scores[p1.id] || 0) + 1;
      else if (r2 === "win") room.scores[p2.id] = (room.scores[p2.id] || 0) + 1;

      const roundResult = {
        round: room.round,
        choices: { [p1.id]: p1.choice, [p2.id]: p2.choice },
        results: { [p1.id]: r1, [p2.id]: r2 },
        scores: { [p1.id]: room.scores[p1.id], [p2.id]: room.scores[p2.id] },
        players: [
          { id: p1.id, name: p1.name },
          { id: p2.id, name: p2.name },
        ],
      };

      io.to(roomId).emit("roundResult", roundResult);

      log(
        `  Kết quả: ${p1.name}(${EMOJI[p1.choice]}) ${r1 === "win" ? ">" : r1 === "lose" ? "<" : "="} ${p2.name}(${EMOJI[p2.choice]}) | Tỉ số ${room.scores[p1.id]}-${room.scores[p2.id]}`
      );

      // Reset choices, increment round
      p1.choice = null;
      p2.choice = null;
      room.round += 1;
    }
  });

  // ── rematch ─────────────────────────────────────────────────────────────────
  socket.on("rematch", () => {
    const pInfo = players[socket.id];
    if (!pInfo) return;
    const { roomId } = pInfo;
    const room = rooms[roomId];
    if (!room) return;

    if (!room.rematchVotes) room.rematchVotes = new Set();
    room.rematchVotes.add(socket.id);
    log(`🔄 ${pInfo.name} muốn chơi lại — phòng ${roomId}`);

    if (room.rematchVotes.size >= 2) {
      room.rematchVotes.clear();
      room.scores = {};
      room.players.forEach((p) => {
        p.choice = null;
        room.scores[p.id] = 0;
      });
      room.round = 1;
      room.status = "playing";
      io.to(roomId).emit("gameStart", {
        players: room.players.map((p) => p.name),
        round: room.round,
        isRematch: true,
      });
      log(`🔄 Chơi lại — ${roomInfo(roomId)}`);
    } else {
      socket.to(roomId).emit("rematchRequest", pInfo.name);
    }
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const pInfo = players[socket.id];
    if (pInfo) {
      const { name, roomId } = pInfo;
      log(`\x1b[31m-\x1b[0m Ngắt kết nối: \x1b[35m${name}\x1b[0m (${socket.id})`);

      const room = rooms[roomId];
      if (room) {
        room.players = room.players.filter((p) => p.id !== socket.id);
        delete room.scores[socket.id];

        if (room.players.length === 0) {
          delete rooms[roomId];
          log(`🗑  Phòng ${roomId} đã xóa (trống)`);
        } else {
          room.status = "waiting";
          io.to(roomId).emit("playerLeft", name);
          log(`  ${roomInfo(roomId)} — ${name} rời phòng`);
        }
      }
      delete players[socket.id];
    } else {
      log(`\x1b[31m-\x1b[0m Ngắt kết nối: \x1b[35m${socket.id}\x1b[0m (chưa đặt tên)`);
    }
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n\x1b[1m\x1b[32m✔ Server Kéo Búa Bao đang chạy\x1b[0m`);
  console.log(`  \x1b[34m➜  http://localhost:${PORT}\x1b[0m\n`);
  console.log(`\x1b[90m${"─".repeat(50)}\x1b[0m`);
});
