const http = require("http");
const fs   = require("fs");
const path = require("path");
const { Server } = require("socket.io");

// ─── Log system ───────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, "SERVER_LOG.txt");

// Xoá ANSI color codes để log file sạch
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

// Ghi cả ra console (có màu) lẫn file (không màu)
function log(msg) {
  const t  = new Date().toLocaleTimeString("vi-VN");
  const dt = new Date().toLocaleString("vi-VN");
  const consoleLine = `\x1b[36m[${t}]\x1b[0m ${msg}`;
  const fileLine    = `[${dt}] ${stripAnsi(msg)}`;
  console.log(consoleLine);
  fs.appendFile(LOG_FILE, fileLine + "\n", () => {});
}

// Log có cấu trúc cho các sự kiện trong phòng
// Cú pháp: [roomId] [action] [detail]
function logRoom(roomId, action, detail) {
  const t  = new Date().toLocaleTimeString("vi-VN");
  const dt = new Date().toLocaleString("vi-VN");
  const structured = `[${roomId}] [${action}] [${detail}]`;
  const consoleLine = `\x1b[36m[${t}]\x1b[0m ${structured}`;
  const fileLine    = `[${dt}] ${structured}`;
  console.log(consoleLine);
  fs.appendFile(LOG_FILE, fileLine + "\n", () => {});
}

// Ghi dòng phân cách khi server khởi động
function logSeparator(msg) {
  const line = "─".repeat(60);
  const dt   = new Date().toLocaleString("vi-VN");
  fs.appendFile(LOG_FILE, `\n${line}\n[${dt}] ${msg}\n${line}\n`, () => {});
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
  let filePath  = path.join(__dirname, urlPath === "/" ? "client.html" : urlPath);
  const ext     = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
    ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  };
  const contentType = mimeTypes[ext] || "text/plain";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Không tìm thấy file");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const io = new Server(server, { cors: { origin: "*" } });

// ─── Config ───────────────────────────────────────────────────────────────────
const CHOICE_TIME = 10;

// ─── State ────────────────────────────────────────────────────────────────────
const rooms   = {};
const players = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function roomInfo(roomId) {
  const r = rooms[roomId];
  if (!r) return "—";
  const names = r.players.map(p => p.name).join(" vs ");
  return `Phòng \x1b[33m${roomId}\x1b[0m [${r.players.length}/2] ${names}`;
}

function getResult(a, b) {
  if (a === b) return "draw";
  if ((a==="rock"&&b==="scissors")||(a==="scissors"&&b==="paper")||(a==="paper"&&b==="rock")) return "win";
  return "lose";
}

const EMOJI = { rock: "✊", paper: "✋", scissors: "✌️" };
const VI    = { rock: "Búa", paper: "Bao", scissors: "Kéo" };
const EN    = { rock: "ROCK", paper: "PAPER", scissors: "SCISSORS", timeout: "TIMEOUT" };

const CHARS = [
  { id: "ninja",  name: "Ninja"  },
  { id: "mage",   name: "Mage"   },
  { id: "knight", name: "Knight" },
  { id: "robot",  name: "Robot"  },
];
function charName(idx) { return CHARS[idx]?.name ?? `Char${idx}`; }

// Helper: "dat (Ninja)"
function playerLabel(p) {
  return `${p.name} (${charName(p.charIdx ?? 0)})`;
}

// ─── Timer helpers ─────────────────────────────────────────────────────────────
function clearRoomTimers(room) {
  if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
  if (room.timeoutTimer)      { clearTimeout(room.timeoutTimer);       room.timeoutTimer = null; }
}

function startChoiceTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  clearRoomTimers(room);

  let remaining = CHOICE_TIME;
  io.to(roomId).emit("timerStart", { seconds: CHOICE_TIME });

  room.countdownInterval = setInterval(() => {
    remaining--;
    io.to(roomId).emit("timerTick", { remaining });
    if (remaining <= 0) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
  }, 1000);

  room.timeoutTimer = setTimeout(() => {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
    if (!room || room.status !== "playing") return;

    if (room.bothChose) {
      room.bothChose = false;
      resolveRound(roomId);
      return;
    }

    room.players.forEach(p => {
      if (!p.choice) {
        p.timedOut = true;
        p.choice   = "timeout";
        io.to(p.id).emit("timedOut");
        logRoom(roomId, "timeout", playerLabel(p));
      }
    });

    resolveRound(roomId);
  }, CHOICE_TIME * 1000);
}

// ─── Game logic ────────────────────────────────────────────────────────────────
function resolveRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const [p1, p2] = room.players;
  if (!p1.choice || !p2.choice) return;

  let finalR1, finalR2;
  if (p1.timedOut && p2.timedOut) {
    finalR1 = "draw"; finalR2 = "draw";
  } else if (p1.timedOut) {
    finalR1 = "lose"; finalR2 = "win";
  } else if (p2.timedOut) {
    finalR1 = "win";  finalR2 = "lose";
  } else {
    const r = getResult(p1.choice, p2.choice);
    finalR1 = r; finalR2 = r === "draw" ? "draw" : r === "win" ? "lose" : "win";
  }

  if (finalR1 === "win")      room.scores[p1.id] = (room.scores[p1.id]||0) + 1;
  else if (finalR2 === "win") room.scores[p2.id] = (room.scores[p2.id]||0) + 1;

  const roundResult = {
    round:    room.round,
    choices:  { [p1.id]: p1.choice,      [p2.id]: p2.choice      },
    results:  { [p1.id]: finalR1,         [p2.id]: finalR2         },
    timedOut: { [p1.id]: !!p1.timedOut,   [p2.id]: !!p2.timedOut  },
    scores:   { [p1.id]: room.scores[p1.id]||0, [p2.id]: room.scores[p2.id]||0 },
    players:  [{ id: p1.id, name: p1.name }, { id: p2.id, name: p2.name }],
  };

  io.to(roomId).emit("roundResult", roundResult);

  // Structured result log
  const sym    = finalR1 === "win" ? ">" : finalR1 === "lose" ? "<" : "=";
  const c1     = EN[p1.choice] ?? p1.choice.toUpperCase();
  const c2     = EN[p2.choice] ?? p2.choice.toUpperCase();
  const label1 = playerLabel(p1);
  const label2 = playerLabel(p2);
  logRoom(roomId, "result",
    `${label1}(${c1}) ${sym} ${label2}(${c2})`
  );

  p1.choice = null; p1.timedOut = false;
  p2.choice = null; p2.timedOut = false;
  room.timerStarted = false;
  room.round++;
}

// ─── Socket events ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  log(`\x1b[32m+\x1b[0m Connected: \x1b[35m${socket.id}\x1b[0m`);

  socket.on("joinRoom", ({ name, roomId, charIdx }) => {
    name    = (name   || "Ẩn danh").trim().slice(0, 20);
    roomId  = (roomId || "").trim().toUpperCase().slice(0, 8);
    charIdx = charIdx ?? 0;

    const isCreating = !roomId;

    if (!isCreating) {
      if (!rooms[roomId]) {
        socket.emit("error", "Phòng không tồn tại!");
        log(`X ${name} enter wrong room ID: ${roomId}`);
        return;
      }
      if (rooms[roomId].status !== "waiting") {
        socket.emit("error", "Phòng đã bắt đầu!");
        log(`X ${name} tried to enter a room that is already in progress: ${roomId}`);
        return;
      }
      if (rooms[roomId].players.length >= 2) {
        socket.emit("error", "Phòng đã đầy (2/2)!");
        log(`X ${name} tried to enter a full room: ${roomId}`);
        return;
      }
    }

    if (isCreating) {
      roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
      rooms[roomId] = {
        players: [], status: "waiting", round: 1,
        scores: {}, rematchVotes: null, timerStarted: false,
      };
    }

    // Kiểm tra trùng tên
    players[socket.id] = { name, roomId };
    const duplicated = Object.entries(players).some(
      ([id, p]) => id !== socket.id &&
        p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicated) {
      socket.emit("error", "Tên người chơi này đang được sử dụng!");
      delete players[socket.id];
      return;
    }

    socket.join(roomId);
    const room = rooms[roomId];
    room.players.push({ id: socket.id, name, choice: null, timedOut: false, charIdx });
    room.scores[socket.id] = 0;
    socket.emit("joinedRoom", { roomId, name });

    if (room.players.length === 1) {
      socket.emit("waiting", "Đang chờ đối thủ vào phòng…");
      logRoom(roomId, "create", playerLabel({ name, charIdx }));
    } else {
      room.status = "playing";
      room.round  = 1;
      const names      = room.players.map(p => p.name);
      const chars      = room.players.map(p => p.charIdx);
      const charLabels = room.players.map(p => charName(p.charIdx));
      logRoom(roomId, "join", playerLabel({ name, charIdx }));
      log(`[START]\x1b[0m [${roomId}] ${names[0]} (${charLabels[0]}) VS ${names[1]} (${charLabels[1]})`);
      io.to(roomId).emit("gameStart", { players: names, round: room.round, chars });

      setTimeout(() => {
        if (rooms[roomId] && rooms[roomId].status === "playing") {
          io.to(roomId).emit("roundBegin", { round: room.round });
        }
      }, 3500);
    }
  });

  socket.on("startTimer", () => {
    const pInfo = players[socket.id];
    if (!pInfo) return;
    const { roomId } = pInfo;
    const room = rooms[roomId];
    if (!room || room.status !== "playing") return;
    if (room.timerStarted) return;
    room.timerStarted = true;
    startChoiceTimer(roomId);
  });

  socket.on("choose", (choice) => {
    const pInfo = players[socket.id];
    if (!pInfo) return;
    const { roomId } = pInfo;
    const room = rooms[roomId];
    if (!room || room.status !== "playing") return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.choice) return;

    player.choice = choice;
    const choiceLabel = EN[choice] ?? choice.toUpperCase();
    logRoom(roomId, `chosen (${choiceLabel})`, playerLabel(player));
    socket.to(roomId).emit("opponentChose");

    if (room.players.every(p => p.choice)) {
      room.bothChose = true;
    }
  });

  socket.on("nextRound", () => {
    const pInfo = players[socket.id];
    if (!pInfo) return;
    const { roomId } = pInfo;
    const room = rooms[roomId];
    if (!room) return;
    if (!room.nextRoundVotes) room.nextRoundVotes = new Set();
    room.nextRoundVotes.add(socket.id);
    if (room.nextRoundVotes.size >= room.players.length) {
      room.nextRoundVotes.clear();
      room.timerStarted = false;
      room.bothChose    = false;
      io.to(roomId).emit("roundBegin", { round: room.round });
    }
  });

  socket.on("rematch", () => {
    const pInfo = players[socket.id];
    if (!pInfo) return;
    const { roomId } = pInfo;
    const room = rooms[roomId];
    if (!room) return;
    if (!room.rematchVotes) room.rematchVotes = new Set();
    room.rematchVotes.add(socket.id);
    log(`🔄 ${pInfo.name} wants to rematch — room ${roomId}`);

    if (room.rematchVotes.size >= 2) {
      room.rematchVotes.clear();
      clearRoomTimers(room);
      room.scores = {};
      room.players.forEach(p => { p.choice = null; p.timedOut = false; room.scores[p.id] = 0; });
      room.round       = 1;
      room.status      = "playing";
      room.bothChose   = false;
      room.timerStarted = false;
      const rematchChars = room.players.map(p => p.charIdx);
      logRoom(roomId, "rematch",
        room.players.map(p => playerLabel(p)).join(" vs ")
      );
      io.to(roomId).emit("gameStart", {
        players: room.players.map(p => p.name), round: 1, isRematch: true, chars: rematchChars,
      });
      setTimeout(() => {
        if (rooms[roomId]) io.to(roomId).emit("roundBegin", { round: 1 });
      }, 3500);
      log(`🔄 Chơi lại — ${roomInfo(roomId)}`);
    } else {
      socket.to(roomId).emit("rematchRequest", pInfo.name);
    }
  });

  socket.on("disconnect", () => {
    const pInfo = players[socket.id];
    if (pInfo) {
      const { name, roomId } = pInfo;
      log(`\x1b[31m-\x1b[0m Disconnected: \x1b[35m${name}\x1b[0m`);
      const room = rooms[roomId];
      if (room) {
        const p = room.players.find(p => p.id === socket.id);
        clearRoomTimers(room);
        room.players = room.players.filter(p => p.id !== socket.id);
        delete room.scores[socket.id];
        if (room.players.length === 0) {
          delete rooms[roomId];
          logRoom(roomId, "closed", `${name} disconnected, room closed`);
        } else {
          room.status = "waiting";
          io.to(roomId).emit("playerLeft", name);
          logRoom(roomId, "leave", p ? playerLabel(p) : name);
        }
      }
      delete players[socket.id];
    } else {
      log(`\x1b[31m-\x1b[0m Disconnected: \x1b[35m${socket.id}`);
    }
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n\x1b[1m\x1b[32m✔ Server Kéo Búa Bao đang chạy\x1b[0m`);
  console.log(`  \x1b[34m➜  http://localhost:${PORT}\x1b[0m`);
  console.log(`  \x1b[90mLog file: SERVER_LOG.txt\x1b[0m\n`);
  console.log(`\x1b[90m${"─".repeat(50)}\x1b[0m`);
  logSeparator(`SERVER STARTED — http://localhost:${PORT}`);
});