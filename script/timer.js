// ── timer.js ──────────────────────────────────────────────────────────────────
// Choice timer: syncs the countdown bar with server ticks.
// Depends on: state.js (timerTotal, timerDone, pendingResult)
//             game.js  (_applyRoundResult — loaded after this file)

let _timerDoneTimeout = null;

// Called when the client-side timer reaches zero (or via fallback timeout)
function _onTimerDone() {
  if (timerDone) return;
  timerDone = true;
  if (pendingResult) {
    const r = pendingResult; pendingResult = null;
    _applyRoundResult(r);
  }
}

// ── Timer DOM helpers ─────────────────────────────────────────────────────────
function showTimer(s) {
  const w = document.getElementById('timer-wrap');
  const b = document.getElementById('timer-bar');
  const l = document.getElementById('timer-label');
  w.style.display = 'block';
  b.style.transition = 'none';
  b.style.width = '100%';
  b.className = 'timer-bar-fill';
  l.className = 'timer-label';
  l.textContent = `🕗 ${s}s`;
}

function updateTimer(r) {
  const b = document.getElementById('timer-bar');
  const l = document.getElementById('timer-label');
  const w = document.getElementById('timer-wrap');
  b.style.transition = 'width 1s linear';
  b.style.width = (r / timerTotal * 100) + '%';
  l.textContent = `🕗 ${r}s`;
  const sp = r <= 5, ug = r <= 2;
  b.className = 'timer-bar-fill' + (ug ? ' urgent' : sp ? ' suspense' : '');
  l.className = 'timer-label'   + (ug ? ' urgent' : sp ? ' suspense' : '');
  if (sp) { w.classList.remove('timer-pulse'); void w.offsetWidth; w.classList.add('timer-pulse'); }
}

function hideTimer() {
  document.getElementById('timer-wrap').style.display = 'none';
}

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('timerStart', ({ seconds }) => {
  timerTotal = seconds;
  timerDone  = false;
  showTimer(seconds);
  // Fallback: trigger _onTimerDone if the final tick is missed
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
