// ══════════════════════════════════════════
//  2026 우리의 순간들 — 자동재생 여정 애니메이션
// ══════════════════════════════════════════

const $ = (id) => document.getElementById(id);

// ── 지도 초기화 (다크 톤 타일) ──
const map = L.map('map', {
  zoomControl: false, attributionControl: false,
  dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
  touchZoom: false, keyboard: false, boxZoom: false, tap: false,
});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19, subdomains: 'abcd',
}).addTo(map);

// 전체 여정이 담기는 초기 뷰
const allLatLng = MOMENTS.map(m => m.ll);
const bounds = L.latLngBounds(allLatLng);
map.fitBounds(bounds, { padding: [60, 60] });

// ── 눈 내리기 ──
(function snow() {
  const layer = $('snow');
  const N = 46;
  for (let i = 0; i < N; i++) {
    const f = document.createElement('div');
    f.className = 'flake';
    const size = 2 + Math.random() * 5;
    f.style.width = size + 'px';
    f.style.height = size + 'px';
    f.style.borderRadius = '50%';
    f.style.background = '#fff';
    f.style.left = (Math.random() * 100) + 'vw';
    const dur = 6 + Math.random() * 9;
    const delay = -Math.random() * dur;
    const drift = (Math.random() * 40 - 20);
    f.animate([
      { transform: 'translate(0, -5vh)', opacity: 0 },
      { opacity: .8, offset: .1 },
      { opacity: .8, offset: .9 },
      { transform: `translate(${drift}px, 105vh)`, opacity: 0 },
    ], { duration: dur * 1000, delay: delay * 1000, iterations: Infinity, easing: 'linear' });
    layer.appendChild(f);
  }
})();

// ── 마커 생성 헬퍼 ──
function makePin(m) {
  const el = document.createElement('div');
  el.className = 'momentpin';
  el.innerHTML = `
    <div class="pulse"></div>
    <div class="dot"><span>${m.emoji || '📷'}</span></div>`;
  const icon = L.divIcon({ className: '', html: el, iconSize: [44, 44], iconAnchor: [22, 40] });
  const marker = L.marker(m.ll, { icon, interactive: false });
  return { marker, el };
}

// ── 상태 ──
let idx = 0;
let paused = false;
let timers = [];
let started = false;
const pins = [];      // 이미 찍힌 핀들
const trail = [];     // 이동 경로 폴리라인 좌표

function clearTimers() { timers.forEach(t => clearTimeout(t)); timers = []; }
function wait(ms) { return new Promise(res => { const t = setTimeout(res, ms); timers.push(t); }); }

function fmtDate(iso) {
  const [y, mo, d] = iso.split('-');
  return `${y}. ${mo}. ${d}`;
}

// 경로 폴리라인 (핀 사이 여정선)
let trailLine = null;
function drawTrail() {
  if (trailLine) trailLine.remove();
  if (trail.length < 2) return;
  trailLine = L.polyline(trail, {
    color: '#ffd98a', weight: 2.5, opacity: .5, dashArray: '2 8', lineCap: 'round',
  }).addTo(map);
}

// ── 한 모먼 재생 ──
async function playMoment(m) {
  // 카메라 이동
  map.flyTo(m.ll, 14, { duration: 1.9, easeLinearity: .25 });
  await wait(1500);
  if (paused) return;

  // 핀 등장
  const { marker, el } = makePin(m);
  marker.addTo(map);
  pins.push(marker);
  requestAnimationFrame(() => {
    const inner = el.querySelector('.momentpin') || el;
    el.classList.add('show');
  });
  trail.push(m.ll);
  drawTrail();

  // HUD 갱신
  $('dateChip').textContent = fmtDate(m.date);
  $('counter').textContent = `${idx + 1} / ${MOMENTS.length}`;
  $('barFill').style.width = ((idx + 1) / MOMENTS.length * 100) + '%';

  await wait(450);
  if (paused) return;

  // 사진 팝업
  const mem = MEMBERS[m.by] || { name: '가족', color: '#888' };
  $('photoInner').style.background = m.bg;
  $('photoInner').textContent = m.emoji || '📷';
  $('capWho').innerHTML = `<span class="avatarSm" style="background:${mem.color}">${mem.name[0]}</span> ${mem.name}`;
  $('capWhere').textContent = '📍 ' + m.place;
  $('capWhen').textContent = m.cap ? `“${m.cap}”` : '';
  $('photoCard').classList.add('show');

  await wait(2600);
  if (paused) return;

  // 사진 내리기
  $('photoCard').classList.remove('show');
  await wait(600);
}

// ── 시퀀스 ──
async function runSequence() {
  $('hud').style.opacity = '1';
  $('controls').classList.add('show');
  for (; idx < MOMENTS.length; idx++) {
    if (paused) { return; }
    await playMoment(MOMENTS[idx]);
    if (paused) return;
  }
  showEnding();
}

// ── 엔딩 ──
function showEnding() {
  clearTimers();
  // 전체 여정 다시 보여주기
  map.flyToBounds(bounds, { padding: [70, 70], duration: 2.2 });
  $('map').style.filter = 'saturate(.7) brightness(.7) contrast(1.05)';
  $('hud').style.opacity = '0';
  $('controls').classList.remove('show');
  $('photoCard').classList.remove('show');

  // 통계 계산
  const count = MOMENTS.length;
  const places = new Set(MOMENTS.map(m => m.place.split('·')[0].trim())).size;
  const people = new Set(MOMENTS.map(m => m.by)).size;
  $('endStats').innerHTML = `
    <div class="stat"><div class="n">${count}</div><div class="l">함께한 순간</div></div>
    <div class="stat"><div class="n">${places}</div><div class="l">다녀온 동네</div></div>
    <div class="stat"><div class="n">${people}</div><div class="l">우리 가족</div></div>`;

  setTimeout(() => {
    $('ending').style.opacity = '1';
    $('ending').style.pointerEvents = 'auto';
    $('ending').classList.remove('hide');
  }, 1400);
}

// ── 시작 / 일시정지 / 스킵 / 리플레이 ──
function start() {
  if (started) return;
  started = true;
  $('opening').classList.add('hide');
  $('map').style.filter = 'saturate(.62) brightness(.66) contrast(1.05)';
  setTimeout(runSequence, 850);
}

$('playBtn').addEventListener('click', start);

$('pauseBtn').addEventListener('click', () => {
  paused = !paused;
  $('pauseBtn').textContent = paused ? '▶ 이어보기' : '⏸ 일시정지';
  if (!paused) runSequence();   // 재개
});

$('skipBtn').addEventListener('click', () => {
  clearTimers();
  paused = false;
  // 남은 핀 전부 즉시 표시
  for (; idx < MOMENTS.length; idx++) {
    const m = MOMENTS[idx];
    const { marker, el } = makePin(m);
    marker.addTo(map); pins.push(marker);
    el.classList.add('show');
    trail.push(m.ll);
  }
  drawTrail();
  showEnding();
});

$('replayBtn').addEventListener('click', () => {
  // 초기화
  clearTimers();
  pins.forEach(p => p.remove()); pins.length = 0;
  trail.length = 0; if (trailLine) { trailLine.remove(); trailLine = null; }
  idx = 0; paused = false; started = false;
  $('barFill').style.width = '0%';
  $('pauseBtn').textContent = '⏸ 일시정지';
  $('ending').classList.add('hide');
  $('ending').style.opacity = '0';
  $('ending').style.pointerEvents = 'none';
  map.fitBounds(bounds, { padding: [60, 60] });
  setTimeout(() => { started = true; $('map').style.filter='saturate(.62) brightness(.66) contrast(1.05)'; setTimeout(runSequence, 600); }, 300);
});

// ══════════════════════════════════════════
//  배경 음악 — "고요한 밤"(퍼블릭 도메인) 을 Web Audio로 잔잔하게 연주
//  ※ 나중에 실제 mp3를 쓰려면 이 블록을 <audio> 방식으로 교체하면 됨
// ══════════════════════════════════════════
const Music = (() => {
  let ctx = null, master = null, timer = null, playing = false, muted = false;

  // 음표 주파수 (평균율, A4=440)
  const F = { G3:196.00, A3:220.00, B3:246.94, C4:261.63, D4:293.66, E4:329.63,
              F4:349.23, G4:392.00, A4:440.00, B4:493.88, C5:523.25, D5:587.33 };

  // 고요한 밤 멜로디 — [음, 박자(비트)]. 6/8 느낌으로 잔잔하게
  const MELODY = [
    ['G4',1.5],['A4',.5],['G4',1],['E4',3],
    ['G4',1.5],['A4',.5],['G4',1],['E4',3],
    ['D5',2],['D5',1],['B4',3],
    ['C5',2],['C5',1],['G4',3],
    ['A4',2],['A4',1],['C5',1.5],['B4',.5],['A4',1],
    ['G4',1.5],['A4',.5],['G4',1],['E4',3],
    ['A4',2],['A4',1],['C5',1.5],['B4',.5],['A4',1],
    ['G4',1.5],['A4',.5],['G4',1],['E4',3],
    ['D5',2],['D5',1],['F4',1.5],['D5',.5],['B4',1],
    ['C5',3],['E5',3],
    ['C5',2],['G4',1],['E4',1.5],['G4',.5],['D4',1],
    ['C4',6],
  ];
  const BEAT = 0.5; // 1비트 = 0.5초 (느리게)

  function tone(freq, start, dur) {
    // 부드러운 피아노풍: 사인+삼각 배음, 완만한 감쇠
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.type = 'sine'; o1.frequency.value = freq;
    o2.type = 'triangle'; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = .18;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(master);
    const t = start, peak = .22, rel = Math.min(dur, 2.2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0008, t + rel);
    o1.start(t); o2.start(t);
    o1.stop(t + rel + .05); o2.stop(t + rel + .05);
  }

  function scheduleLoop() {
    const now = ctx.currentTime + 0.1;
    let t = now;
    MELODY.forEach(([n, b]) => {
      if (F[n]) tone(F[n], t, b * BEAT * 0.95);
      t += b * BEAT;
    });
    const loopLen = (t - now) * 1000;
    timer = setTimeout(scheduleLoop, loopLen - 100); // 끊김 없이 반복
  }

  function start() {
    if (playing) return;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    playing = true;
    scheduleLoop();
  }
  function stop() { playing = false; if (timer) clearTimeout(timer); }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    return muted;
  }
  return { start, stop, toggleMute, isMuted: () => muted };
})();

// 시작/리플레이 때 음악 켜기
$('playBtn').addEventListener('click', () => Music.start());
$('replayBtn').addEventListener('click', () => Music.start());

// 음소거 버튼 (컨트롤 바에 추가)
const muteBtn = document.createElement('button');
muteBtn.id = 'muteBtn';
muteBtn.textContent = '🔊 음악';
muteBtn.addEventListener('click', () => {
  const m = Music.toggleMute();
  muteBtn.textContent = m ? '🔇 음악' : '🔊 음악';
});
$('controls').appendChild(muteBtn);

// 지도 리사이즈 보정
setTimeout(() => map.invalidateSize(), 300);
window.addEventListener('resize', () => map.invalidateSize());
