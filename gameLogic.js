// Khởi tạo thực thể truyền tải mạng Socket.IO
const socket = io();

let myId = null, myName = '', myRoomId = '', oppId = null, oppName = '';
let opponentHasChosen = false;
let myChar = 0, oppChar = 0;
let scores = {}, currentRound = 1, hasChosen = false, timerTotal = 10;

socket.on('connect', () => { myId = socket.id; });

// ── Quản lý hiển thị màn hình ──────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function notify(msg, type = 'info', duration = 3000) {
  const el = document.getElementById('notif');
  el.textContent = msg; 
  el.className = `notif ${type} show`;
  clearTimeout(el._t); 
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Popup Xử lý phòng ────────────────────────────────────────────────────────
function openJoinPopup() {
  if (typeof SFX !== 'undefined') SFX.popupOpen();
  document.getElementById('popup-room-input').value = '';
  clearPopupErr();
  document.getElementById('join-popup-overlay').classList.add('visible');
  setTimeout(() => document.getElementById('popup-room-input').focus(), 350);
}

function closeJoinPopup(e) {
  if (e && e.target !== document.getElementById('join-popup-overlay')) return;
  if (typeof SFX !== 'undefined') SFX.popupClose();
  document.getElementById('join-popup-overlay').classList.remove('visible');
}

function clearPopupErr() { 
  document.getElementById('popup-err').textContent = ''; 
}

function showPopupErr(msg) {
  if (typeof SFX !== 'undefined') SFX.error();
  document.getElementById('popup-err').textContent = msg;
  const inp = document.getElementById('popup-room-input');
  inp.classList.remove('shake'); 
  void inp.offsetWidth; 
  inp.classList.add('shake');
}

function confirmJoinRoom() {
  const roomId = document.getElementById('popup-room-input').value.trim().toUpperCase();
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { showPopupErr('Hãy nhập tên trước!'); return; }
  if (!roomId) { showPopupErr('Nhập mã phòng!'); return; }
  myName = name; 
  myChar = myCharIdx;
  socket.emit('joinRoom', { name, roomId, charIdx: myChar });
}

// ── Sảnh đợi Lobby ────────────────────────────────────────────────────────────
function createRoom() {
  if (typeof SFX !== 'undefined') SFX.click();
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { document.getElementById('inp-name').focus(); return; }
  myName = name; 
  myChar = myCharIdx;
  socket.emit('joinRoom', { name, roomId: '', charIdx: myChar });
}

socket.on('joinedRoom', ({ roomId, name }) => {
  myRoomId = roomId; 
  myName = name;
  document.getElementById('display-room-id').textContent = roomId;
  if (typeof SFX !== 'undefined') SFX.join();
});

socket.on('waiting', () => showScreen('screen-wait'));

socket.on('error', (msg) => {
  const ov = document.getElementById('join-popup-overlay');
  if (ov.classList.contains('visible')) showPopupErr(msg);
  else notify(msg, 'error');
});

// ── Màn hình Giới thiệu Trận đấu (Intro Overlay) ──────────────────────────────
function showStartOverlay(p1Name, p2Name, roundNum, p1Char, p2Char) {
  const ov = document.getElementById('start-overlay');
  document.getElementById('start-round-label').textContent = roundNum > 1 ? `VÒNG ${roundNum}` : 'TRẬN ĐẤU BẮT ĐẦU!';
  document.getElementById('start-p1').textContent = p1Name;
  document.getElementById('start-p2').textContent = p2Name;

  if (typeof CHARS !== 'undefined') {
    document.getElementById('start-char-p1').innerHTML = `<svg viewBox="0 0 80 100"><use href="${CHARS[p1Char].symbol}"/></svg>`;
    document.getElementById('start-char-p2').innerHTML = `<svg viewBox="0 0 80 100"><use href="${CHARS[p2Char].symbol}"/></svg>`;
  }

  ['start-p1', 'start-p2'].forEach(id => {
    const el = document.getElementById(id);
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  });
  ['start-fighter-p1', 'start-fighter-p2'].forEach(id => {
    const el = document.getElementById(id);
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  });

  ov.classList.add('visible');
  if (typeof SFX !== 'undefined') SFX.fanfare();
  setTimeout(() => ov.classList.remove('visible'), 3200);
}

// ── Bộ Đếm ngược Vào Trận 3-2-1 ───────────────────────────────────────────────
const CD_STEP = 950;
function runCountdown(callback) {
  const ov = document.getElementById('countdown-overlay');
  const numEl = document.getElementById('countdown-number');
  const ringEl = document.getElementById('countdown-ring');
  
  const seq = [
    { text: '3', cls: 'cd-3', sfx: (typeof SFX !== 'undefined') ? SFX.countdown3 : null },
    { text: '2', cls: 'cd-2', sfx: (typeof SFX !== 'undefined') ? SFX.countdown2 : null },
    { text: '1', cls: 'cd-1', sfx: (typeof SFX !== 'undefined') ? SFX.countdown1 : null },
    { text: '⚔️', cls: 'cd-go', sfx: (typeof SFX !== 'undefined') ? SFX.go : null },
  ];
  
  if (window._cdT) { clearTimeout(window._cdT); window._cdT = null; }
  ov.classList.add('visible');
  
  function step(i) {
    if (i >= seq.length) {
      ov.classList.remove('visible');
      numEl.className = ''; numEl.textContent = ''; ringEl.className = '';
      if (callback) callback(); 
      return;
    }
    const { text, cls, sfx } = seq[i];
    numEl.className = ''; numEl.textContent = ''; ringEl.className = '';
    void numEl.offsetWidth;
    numEl.textContent = text; 
    numEl.className = `cd-anim ${cls}`;
    
    const colors = { 'cd-3': '#22d3a5', 'cd-2': '#fbbf24', 'cd-1': '#f43f5e', 'cd-go': '#a855f7' };
    ringEl.style.borderColor = colors[cls]; 
    void ringEl.offsetWidth; 
    ringEl.className = 'ring-anim';
    
    if (sfx) sfx();
    window._cdT = setTimeout(() => step(i + 1), CD_STEP);
  }
  step(0);
}

// ── Trình lắng nghe Trạng thái Game Khởi chạy từ Server ──────────────────────────
socket.on('gameStart', ({ players, round, isRematch, chars }) => {
  document.getElementById('join-popup-overlay').classList.remove('visible');
  const [p1name, p2name] = players;
  const isP1 = p1name === myName;
  oppName = isP1 ? p2name : p1name;

  const myCharServer  = chars ? (isP1 ? chars[0] : chars[1]) : myChar;
  const oppCharServer = chars ? (isP1 ? chars[1] : chars[0]) : 0;
  myChar  = myCharServer;
  oppChar = oppCharServer;

  currentRound = round; 
  scores = {}; 
  hasChosen = false;
  
  document.getElementById('me-name').textContent  = myName;
  document.getElementById('opp-name').textContent = oppName;
  document.getElementById('me-score').textContent  = '0';
  document.getElementById('opp-score').textContent = '0';
  document.getElementById('round-label').textContent = `Vòng ${round}`;
  document.getElementById('status-hint').textContent = '';
  document.getElementById('status-hint').className = 'status-hint';

  if (typeof setAvatarSVG !== 'undefined') {
    setAvatarSVG('me-avatar',  myChar);
    setAvatarSVG('opp-avatar', oppChar);
  }

  resetChoiceBtns(); 
  hideResult(); 
  hideTimer();
  showScreen('screen-game');
  
  if (isRematch) notify('🔄 Ván mới bắt đầu!', 'success');
  else          notify(`⚔️ ${oppName} đã vào phòng!`, 'success');

  showStartOverlay(myName, oppName, round, myChar, oppChar);
});

socket.on('roundBegin', ({ round }) => {
  opponentHasChosen = false;
  currentRound = round; 
  hasChosen = false;
  resetChoiceBtns(); 
  hideResult();
  document.getElementById('round-label').textContent = `Vòng ${round}`;
  document.getElementById('status-hint').textContent = '';
  document.getElementById('status-hint').className = 'status-hint';
  runCountdown(() => {
    document.getElementById('status-hint').textContent =
      'Hãy chọn một lựa chọn!';

    setChoiceBtnsEnabled(true);

    // báo server bắt đầu đếm CHOICE_TIME
    socket.emit('startTimer');
  });
});

// ── Đồng bộ hóa thanh thời gian (Timer) ──────────────────────────────────────────
socket.on('timerStart', ({ seconds }) => { timerTotal = seconds; showTimer(seconds); });
socket.on('timerTick', ({ remaining }) => {
  updateTimer(remaining);
  if (typeof SFX !== 'undefined') {
    if (remaining <= 5) SFX.suspense(remaining); 
    else SFX.tick();
  }
});

function showTimer(s) {
  const w = document.getElementById('timer-wrap'), b = document.getElementById('timer-bar'), l = document.getElementById('timer-label');
  w.style.display = 'block'; b.style.transition = 'none'; b.style.width = '100%';
  b.className = 'timer-bar-fill'; l.className = 'timer-label'; l.textContent = `🕗 ${s}s`;
}

function updateTimer(r) {
  const b = document.getElementById('timer-bar'), l = document.getElementById('timer-label'), w = document.getElementById('timer-wrap');
  b.style.transition = 'width 1s linear'; b.style.width = (r / timerTotal * 100) + '%'; l.textContent = `🕗 ${r}s`;
  const sp = r <= 5, ug = r <= 2;
  b.className = 'timer-bar-fill' + (ug ? ' urgent' : sp ? ' suspense' : '');
  l.className = 'timer-label'   + (ug ? ' urgent' : sp ? ' suspense' : '');
  if (sp) { w.classList.remove('timer-pulse'); void w.offsetWidth; w.classList.add('timer-pulse'); }
}

function hideTimer() { 
  document.getElementById('timer-wrap').style.display = 'none'; 
}

// ── Vòng lặp Gameplay chính ────────────────────────────────────────────────────
const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
const VI    = { rock: 'Búa', paper: 'Bao', scissors: 'Kéo' };

function choose(val) {
  if (hasChosen) return;

  hasChosen = true;

  if (typeof SFX !== 'undefined') SFX.choose();

  socket.emit('choose', val);

  setChoiceBtnsEnabled(false);

  document.querySelectorAll('.choice-btn').forEach(btn => {
    if (btn.dataset.val === val)
      btn.classList.add('mine');
    else
      btn.classList.add('selected');
  });

  const hint = document.getElementById('status-hint');

  if (opponentHasChosen) {
    hint.textContent = '✓ Cả hai đã chọn xong !';
    hint.className = 'status-hint success';
  } else {
    hint.textContent =
      `Bạn chọn ${EMOJI[val]} ${VI[val]} — chờ đối thủ…`;
    hint.className = 'status-hint waiting-opp';
  }
}

socket.on('opponentChose', () => {
  opponentHasChosen = true;

  if (typeof SFX !== 'undefined') SFX.oppChose();

  const hint = document.getElementById('status-hint');
  const sb = document.querySelector('.scoreboard');

  sb.classList.add('opp-chose-pulse');
  sb.addEventListener(
    'animationend',
    () => sb.classList.remove('opp-chose-pulse'),
    { once: true }
  );

  if (hasChosen) {
    hint.textContent = '✓ Cả hai đã chọn xong !';
    hint.className = 'status-hint success';
  } else {
    hint.textContent = `${oppName} đã chọn — nhanh lên!`;
    hint.className = 'status-hint waiting-opp';
  }
});

socket.on('timedOut', () => {
  if (typeof SFX !== 'undefined') SFX.timeout();
  hasChosen = true; 
  setChoiceBtnsEnabled(false);
  const g = document.querySelector('.choices');
  g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
  document.getElementById('status-hint').textContent = '⏰ Hết giờ! Bạn không kịp chọn...';
  document.getElementById('status-hint').className = 'status-hint timed-out';
  notify('⏰ Hết giờ — tự động thua vòng này!', 'error', 4000);
});

socket.on('roundResult', (data) => {
  const { round, choices, results, timedOut, scores: s, players } = data;
  players.forEach(p => { if (p.name === myName) myId = p.id; else oppId = p.id; });
  scores = s; 
  currentRound = round + 1;
  const myChoice = choices[myId], oppChoice = choices[oppId];
  const myResult = results[myId], myTO = timedOut && timedOut[myId];
  document.getElementById('me-score').textContent = s[myId] || 0;
  document.getElementById('opp-score').textContent = s[oppId] || 0;
  hideTimer();
  
  if (typeof SFX !== 'undefined') {
    if (myResult === 'win') SFX.win(); 
    else if (myResult === 'lose') SFX.lose(); 
    else SFX.draw();
  }
  setTimeout(() => showResult(myResult, myChoice, oppChoice, s[myId] || 0, s[oppId] || 0, round, myTO), 300);
});

function showResult(result, myChoice, oppChoice, meScore, oppScore, round, timedOutFlag) {
  const title = document.getElementById('res-title'), emoji = document.getElementById('res-emoji');
  const tBadge = document.getElementById('res-timeout-badge');
  const myText =
    myChoice === 'timeout'
      ? '⏰ Bạn không chọn'
      : `${EMOJI[myChoice]} ${VI[myChoice]}`;

  const oppText =
    oppChoice === 'timeout'
      ? '⏰ Đối thủ không chọn'
      : `${EMOJI[oppChoice]} ${VI[oppChoice]}`;

  document.getElementById('res-me').textContent = myText;
  document.getElementById('res-opp').textContent = oppText;
  document.getElementById('res-score').innerHTML = `<strong>${myName}</strong> ${meScore} – ${oppScore} <strong>${oppName}</strong>`;
  document.getElementById('round-label').textContent = `Vòng ${round}`;
  tBadge.style.display = timedOutFlag ? 'inline-block' : 'none';
  if (result === 'win') { title.textContent = '🎉 Bạn thắng!'; title.className = 'result-title win'; emoji.textContent = '🏆'; }
  else if (result === 'lose') { title.textContent = timedOutFlag ? '⏰ Hết giờ — Thua!' : '💀 Bạn thua!'; title.className = 'result-title lose'; emoji.textContent = timedOutFlag ? '⏰' : '😢'; }
  else { title.textContent = '🤝 Hòa!'; title.className = 'result-title draw'; emoji.textContent = '😅'; }
  document.getElementById('result-overlay').classList.add('show');
}

function hideResult() { 
  document.getElementById('result-overlay').classList.remove('show'); 
}

function nextRound() {
  if (typeof SFX !== 'undefined') SFX.click();
  hideResult(); 
  hasChosen = false;
  resetChoiceBtns(); 
  setChoiceBtnsEnabled(false);
  document.getElementById('round-label').textContent = `Vòng ${currentRound}`;
  document.getElementById('status-hint').textContent = 'Đang chờ cả hai sẵn sàng…';
  socket.emit('nextRound');
}

function resetChoiceBtns() { 
  document.querySelectorAll('.choice-btn').forEach(b => { b.disabled = false; b.className = 'choice-btn'; }); 
}

function setChoiceBtnsEnabled(v) { 
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = !v); 
}

function requestRematch() { 
  if (typeof SFX !== 'undefined') SFX.click();
  socket.emit('rematch'); 
  notify('🔄 Đã gửi yêu cầu chơi lại…', 'info'); 
  hideResult(); 
}

socket.on('rematchRequest', (name) => notify(`🔄 ${name} muốn chơi lại!`, 'info', 5000));

socket.on('playerLeft', (name) => { 
  notify(`😢 ${name} đã rời phòng`, 'error', 4000); 
  setTimeout(() => leaveRoom(true), 2500); 
});

function leaveRoom(silent = false) {
  if (typeof SFX !== 'undefined') SFX.click();
  if (!silent) notify('Đã thoát phòng', 'info');
  hideResult(); 
  hideTimer();
  showScreen('screen-lobby');
  myRoomId = ''; oppId = null; oppName = ''; scores = {}; hasChosen = false;
  socket.disconnect().connect();
}

// ── Ràng buộc Sự kiện Bàn phím ────────────────────────────────────────────────────
document.getElementById('inp-name').addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(); });
document.getElementById('popup-room-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmJoinRoom();
  if (e.key === 'Escape') closeJoinPopup();
});

// ── Cơ chế Chặn Zoom trên thiết bị di động ───────────────────────────────────────
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let _lt = 0;
document.addEventListener('touchend', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const now = Date.now(); if (now - _lt < 300) e.preventDefault(); _lt = now;
}, { passive: false });
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); }, { passive: false });
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {});