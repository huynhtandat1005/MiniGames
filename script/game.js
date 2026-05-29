// ── game.js ───────────────────────────────────────────────────────────────────
// In-match gameplay: start overlay, countdown, choosing, result popup, rematch.
// Depends on: state.js, timer.js, lobby.js (_resetLobbyPanels, leaveRoom)

// ── SVG character sprites ─────────────────────────────────────────────────────
// Thêm 'char-dragon' và 'char-fox' vào mảng để kích hoạt các nhân vật đó
const CHARACTERS = ['char-ninja', 'char-mage', 'char-knight', 'char-robot'];

async function loadCharacterSprites() {
  const sprite = document.getElementById('char-svgs');
  await Promise.all(CHARACTERS.map(async (id) => {
    try {
      const res     = await fetch(`/svg/${id}.svg`);
      const svgText = await res.text();
      const doc     = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const svgEl   = doc.querySelector('svg');
      const symbol  = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
      symbol.setAttribute('id', id);
      symbol.setAttribute('viewBox', svgEl.getAttribute('viewBox') || '0 0 80 100');
      while (svgEl.firstChild) symbol.appendChild(svgEl.firstChild);
      sprite.appendChild(symbol);
    } catch (e) {
      console.warn(`Could not load ${id}.svg`, e);
    }
  }));
}

document.addEventListener('DOMContentLoaded', () => loadCharacterSprites());

// ── Choice labels ─────────────────────────────────────────────────────────────
const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
const VI    = { rock: 'Búa', paper: 'Bao', scissors: 'Kéo' };

// ── Start overlay ─────────────────────────────────────────────────────────────
function showStartOverlay(p1Name, p2Name, roundNum, p1Char, p2Char) {
  const ov = document.getElementById('start-overlay');
  document.getElementById('start-round-label').textContent = 'TRẬN ĐẤU BẮT ĐẦU!';
  document.getElementById('start-p1').textContent = p1Name;
  document.getElementById('start-p2').textContent = p2Name;
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

// ── 3-2-1 Countdown ───────────────────────────────────────────────────────────
const CD_STEP = 950;
function runCountdown(callback) {
  const ov     = document.getElementById('countdown-overlay');
  const numEl  = document.getElementById('countdown-number');
  const ringEl = document.getElementById('countdown-ring');

  const seq = [
    { text: '3',  cls: 'cd-3',  sfx: (typeof SFX !== 'undefined') ? SFX.countdown3 : null },
    { text: '2',  cls: 'cd-2',  sfx: (typeof SFX !== 'undefined') ? SFX.countdown2 : null },
    { text: '1',  cls: 'cd-1',  sfx: (typeof SFX !== 'undefined') ? SFX.countdown1 : null },
    { text: '⚔️', cls: 'cd-go', sfx: (typeof SFX !== 'undefined') ? SFX.go         : null },
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
    numEl.className   = `cd-anim ${cls}`;
    const colors = { 'cd-3': '#22d3a5', 'cd-2': '#fbbf24', 'cd-1': '#f43f5e', 'cd-go': '#a855f7' };
    ringEl.style.borderColor = colors[cls];
    void ringEl.offsetWidth;
    ringEl.className = 'ring-anim';
    if (sfx) sfx();
    window._cdT = setTimeout(() => step(i + 1), CD_STEP);
  }
  step(0);
}

// ── Socket: game lifecycle ────────────────────────────────────────────────────
socket.on('gameStart', ({ players, round, isRematch, chars }) => {
  _resetLobbyPanels();
  const [p1name, p2name] = players;
  const isP1 = p1name === myName;
  oppName = isP1 ? p2name : p1name;

  const myCharServer  = chars ? (isP1 ? chars[0] : chars[1]) : myChar;
  const oppCharServer = chars ? (isP1 ? chars[1] : chars[0]) : 0;
  myChar  = myCharServer;
  oppChar = oppCharServer;

  currentRound = round;
  scores       = {};
  hasChosen    = false;

  document.getElementById('me-name').textContent  = myName;
  document.getElementById('opp-name').textContent = oppName;
  document.getElementById('status-hint').textContent = '';
  document.getElementById('status-hint').className   = 'status-hint';

  if (typeof setAvatarSVG !== 'undefined') {
    setAvatarSVG('me-avatar',  myChar);
    setAvatarSVG('opp-avatar', oppChar);
  }

  resetChoiceBtns();
  hideResult();
  hideTimer();
  showScreen('screen-game');

  if (isRematch) notify('🔄 Ván mới bắt đầu!', 'success');
  else           notify(`⚔️ ${oppName} đã vào phòng!`, 'success');

  showStartOverlay(myName, oppName, round, myChar, oppChar);
});

// Khi server thông báo bắt đầu vòng mới
socket.on('roundBegin', ({ round }) => {
  opponentHasChosen = false;
  currentRound  = round;
  hasChosen     = false;
  timerDone     = false;
  pendingResult = null;
  resetChoiceBtns();
  hideResult();
  document.getElementById('status-hint').textContent = '';
  document.getElementById('status-hint').className   = 'status-hint';
  runCountdown(() => {
    document.getElementById('status-hint').textContent = 'Hãy chọn một lựa chọn!';
    setChoiceBtnsEnabled(true);
    socket.emit('startTimer');
  });
});

// ── Choosing ──────────────────────────────────────────────────────────────────
function choose(val) {
  if (hasChosen) return;
  hasChosen = true;
  if (typeof SFX !== 'undefined') SFX.choose();
  socket.emit('choose', val);
  setChoiceBtnsEnabled(false);
  document.querySelectorAll('.choice-btn').forEach(btn => {
    if (btn.dataset.val === val) btn.classList.add('mine');
    else                        btn.classList.add('selected');
  });
  const hint = document.getElementById('status-hint');
  if (opponentHasChosen) {
    hint.textContent = '✓ Cả hai đã chọn xong !';
    hint.className   = 'status-hint success';
  } else {
    hint.textContent = `Bạn chọn ${EMOJI[val]} ${VI[val]} — chờ đối thủ…`;
    hint.className   = 'status-hint waiting-opp';
  }
}

// Khi server thông báo đối thủ đã chọn xong
socket.on('opponentChose', () => {
  opponentHasChosen = true;
  if (typeof SFX !== 'undefined') SFX.oppChose();
  const hint = document.getElementById('status-hint');
  const sb   = document.querySelector('.scoreboard');
  sb.classList.add('opp-chose-pulse');
  sb.addEventListener('animationend', () => sb.classList.remove('opp-chose-pulse'), { once: true });
  if (hasChosen) {
    hint.textContent = '✓ Cả hai đã chọn xong !';
    hint.className   = 'status-hint success';
  } else {
    hint.textContent = 'Đối thủ đã chọn xong !';
    hint.className   = 'status-hint waiting-opp';
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
  document.getElementById('status-hint').className   = 'status-hint timed-out';
  notify('⏰ Hết giờ — tự động thua vòng này!', 'error', 4000);
});

// Khi server báo cả hai đã chọn xong (timer vẫn còn chạy)
socket.on('bothChosen', () => {
  const hint = document.getElementById('status-hint');
  hint.textContent = '✓ Cả hai đã chọn xong !';
  hint.className   = 'status-hint success';
});

// Khi server gửi kết quả vòng đấu
socket.on('roundResult', (data) => {
  const { players } = data;
  players.forEach(p => { if (p.name === myName) myId = p.id; else oppId = p.id; });
  if (timerDone) {
    _applyRoundResult(data);
  } else {
    // Timer đang chạy → giữ lại, sẽ hiện khi timerTick về 0
    pendingResult = data;
  }
});

function _applyRoundResult(data) {
  const { round, choices, results, timedOut, scores: s } = data;
  scores       = s;
  currentRound = round + 1;
  const myChoice = choices[myId], oppChoice = choices[oppId];
  const myResult = results[myId], myTO = timedOut && timedOut[myId];
  hideTimer();
  if (typeof SFX !== 'undefined') {
    if (myResult === 'win')       SFX.win();
    else if (myResult === 'lose') SFX.lose();
    else                          SFX.draw();
  }
  setTimeout(() => showResult(myResult, myChoice, oppChoice, s[myId] || 0, s[oppId] || 0, round, myTO), 300);
}

// ── Result popup ──────────────────────────────────────────────────────────────
function showResult(result, myChoice, oppChoice, meScore, oppScore, round, timedOutFlag) {
  const title  = document.getElementById('res-title');
  const emoji  = document.getElementById('res-emoji');
  const tBadge = document.getElementById('res-timeout-badge');

  const myText  = myChoice  === 'timeout' ? '⏰ Bạn không chọn'      : `${EMOJI[myChoice]}  ${VI[myChoice]}`;
  const oppText = oppChoice === 'timeout' ? '⏰ Đối thủ không chọn'  : `${EMOJI[oppChoice]} ${VI[oppChoice]}`;

  document.getElementById('res-me').textContent  = myText;
  document.getElementById('res-opp').textContent = oppText;
  tBadge.style.display = timedOutFlag ? 'inline-block' : 'none';

  if (result === 'win') {
    title.textContent = '🎉 Bạn thắng!'; title.className = 'result-title win';  emoji.textContent = '🏆';
  } else if (result === 'lose') {
    title.textContent = timedOutFlag ? '⏰ Hết giờ — Thua!' : '💀 Bạn thua!';
    title.className   = 'result-title lose';
    emoji.textContent = timedOutFlag ? '⏰' : '😢';
  } else {
    title.textContent = '🤝 Hòa!'; title.className = 'result-title draw'; emoji.textContent = '😅';
  }
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

// ── Choice button helpers ─────────────────────────────────────────────────────
function resetChoiceBtns() {
  document.querySelectorAll('.choice-btn').forEach(b => { b.disabled = false; b.className = 'choice-btn'; });
}

function setChoiceBtnsEnabled(v) {
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = !v);
}

// ── Rematch ───────────────────────────────────────────────────────────────────
function requestRematch() {
  if (typeof SFX !== 'undefined') SFX.click();
  socket.emit('rematch');
  notify('🔄 Đã gửi yêu cầu chơi lại…', 'info');
  hideResult();
}

// Khi server thông báo đối thủ muốn chơi lại
socket.on('rematchRequest', (name) => notify(`🔄 ${name} muốn chơi lại!`, 'info', 5000));

// Khi server thông báo đối thủ rời phòng
socket.on('playerLeft', (name) => {
  notify(`😢 ${name} đã rời phòng`, 'error', 4000);
  setTimeout(() => leaveRoom(true), 2500);
});
