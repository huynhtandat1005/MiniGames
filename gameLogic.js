// Khởi tạo thực thể truyền tải mạng Socket.IO
const socket = io();

let myId = null, myName = '', myRoomId = '', oppId = null, oppName = '';
let opponentHasChosen = false;
let myChar = 0, oppChar = 0;
let scores = {}, currentRound = 1, hasChosen = false, timerTotal = 10;
let timerDone = false;          // true khi timer đã về 0
let pendingResult = null;       // lưu roundResult nếu timer chưa xong

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
// Khi người dùng xác nhận tham gia phòng qua popup
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
// Khi server xác nhận đã vào phòng thành công
socket.on('joinedRoom', ({ roomId, name }) => {
  myRoomId = roomId; 
  myName = name;
  document.getElementById('display-room-id').textContent = roomId;
  if (typeof SFX !== 'undefined') SFX.join();
});
// Khi server thông báo đang chờ đối thủ
socket.on('waiting', () => showScreen('screen-wait'));
// Khi server gửi lỗi (ví dụ: phòng đầy, trùng tên, mã phòng không tồn tại...)
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
  // Nếu có biểu tượng nhân vật, hiển thị chúng
  if (typeof CHARS !== 'undefined') {
    document.getElementById('start-char-p1').innerHTML = `<svg viewBox="0 0 80 100"><use href="${CHARS[p1Char].symbol}"/></svg>`;
    document.getElementById('start-char-p2').innerHTML = `<svg viewBox="0 0 80 100"><use href="${CHARS[p2Char].symbol}"/></svg>`;
  }
  // Kích hoạt lại animation bằng cách reset lại lớp CSS (null-safe)
  ['start-p1', 'start-p2', 'start-fighter-p1', 'start-fighter-p2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
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
  // Hàm đệ quy để hiển thị từng bước của countdown
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
  // Cập nhật giao diện với thông tin người chơi và điểm số
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
  // Reset trạng thái nút chọn và ẩn kết quả, thanh thời gian
  resetChoiceBtns(); 
  hideResult(); 
  hideTimer();
  showScreen('screen-game');
  
  if (isRematch) notify('🔄 Ván mới bắt đầu!', 'success');
  else          notify(`⚔️ ${oppName} đã vào phòng!`, 'success');

  showStartOverlay(myName, oppName, round, myChar, oppChar);
});
// Khi server thông báo bắt đầu vòng mới
socket.on('roundBegin', ({ round }) => {
  opponentHasChosen = false;
  currentRound = round; 
  hasChosen = false;
  timerDone = false;
  pendingResult = null;
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
let _timerDoneTimeout = null;

function _onTimerDone() {
  if (timerDone) return;
  timerDone = true;
  if (pendingResult) {
    const r = pendingResult; pendingResult = null;
    _applyRoundResult(r);
  }
}

socket.on('timerStart', ({ seconds }) => {
  timerTotal = seconds;
  timerDone  = false;
  showTimer(seconds);
  // Fallback: client tu kich hoat sau (seconds+0.8)s phong tick cuoi bi miss
  if (_timerDoneTimeout) clearTimeout(_timerDoneTimeout);
  _timerDoneTimeout = setTimeout(_onTimerDone, (seconds + 0.8) * 1000);
});

socket.on('timerTick', ({ remaining }) => {
  updateTimer(remaining);
  if (typeof SFX !== 'undefined') {
    if (remaining <= 5) SFX.suspense(remaining);
    else SFX.tick();
  }
  if (remaining <= 0) _onTimerDone();
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
// Khi người chơi chọn một lựa chọn
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
// Khi server thông báo đối thủ đã chọn xong
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
    hint.textContent = 'Đối thủ đã chọn xong !';
    hint.className = 'status-hint waiting-opp';
  }
});
// Khi server thông báo người chơi hết giờ mà chưa chọn
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
// Khi server gửi kết quả vòng đấu
socket.on('roundResult', (data) => {
  // Cập nhật điểm ngay lập tức
  const { players } = data;
  players.forEach(p => { if (p.name === myName) myId = p.id; else oppId = p.id; });
  document.getElementById('me-score').textContent  = data.scores[myId]  || 0;
  document.getElementById('opp-score').textContent = data.scores[oppId] || 0;

  if (timerDone) {
    // Timer đã hết → hiện popup ngay
    _applyRoundResult(data);
  } else {
    // Timer đang chạy → giữ lại, sẽ hiện khi timerTick về 0
    pendingResult = data;
  }
});

// Khi server báo cả hai đã chọn xong (timer vẫn còn chạy)
socket.on('bothChosen', () => {
  const hint = document.getElementById('status-hint');
  hint.textContent = '✓ Cả hai đã chọn xong !';
  hint.className = 'status-hint success';
});

function _applyRoundResult(data) {
  const { round, choices, results, timedOut, scores: s } = data;
  scores = s;
  currentRound = round + 1;
  const myChoice = choices[myId], oppChoice = choices[oppId];
  const myResult = results[myId], myTO = timedOut && timedOut[myId];
  hideTimer();

  if (typeof SFX !== 'undefined') {
    if (myResult === 'win') SFX.win();
    else if (myResult === 'lose') SFX.lose();
    else SFX.draw();
  }
  setTimeout(() => showResult(myResult, myChoice, oppChoice, s[myId] || 0, s[oppId] || 0, round, myTO), 300);
}

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
  // Cập nhật nội dung kết quả và điểm số trên giao diện
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

function goHome() {
  if (typeof SFX !== 'undefined') SFX.click();
  hideResult();
  leaveRoom(false);
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
// Khi server thông báo đối thủ muốn chơi lại
socket.on('rematchRequest', (name) => notify(`🔄 ${name} muốn chơi lại!`, 'info', 5000));
// Khi server thông báo trận đấu kết thúc và ai đó rời phòng
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
  timerDone = false; pendingResult = null;
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
if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});