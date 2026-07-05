// ══════════════════════════════════════════
//  2026 우리의 순간들 — 자동재생 여정 애니메이션
// ══════════════════════════════════════════

const $ = (id) => document.getElementById(id);

function setPauseBtn(isPaused) {
  const b = $('pauseBtn');
  b.querySelector('.cIcon').textContent = isPaused ? '▶' : '⏸';
  b.querySelector('.cLbl').textContent = isPaused ? '이어보기' : '일시정지';
}

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
  setPauseBtn(paused);
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
  setPauseBtn(false);
  $('ending').classList.add('hide');
  $('ending').style.opacity = '0';
  $('ending').style.pointerEvents = 'none';
  map.fitBounds(bounds, { padding: [60, 60] });
  setTimeout(() => { started = true; $('map').style.filter='saturate(.62) brightness(.66) contrast(1.05)'; setTimeout(runSequence, 600); }, 300);
});

// ══════════════════════════════════════════
//  배경 음악 — bgm.mp3 (같은 폴더에 위치)
//  출처: "Christmas Night [Piano]" by Clavier-Music (Pixabay)
//  라이선스: Pixabay Content License (크레딧 불필요하나 예의상 엔딩에 표기)
//  ⚠️ Content ID 등록된 곡 — 유튜브 업로드 시 클레임 가능성 있음
// ══════════════════════════════════════════
const Music = (() => {
  const el = new Audio('bgm.mp3');
  el.loop = true;
  el.volume = 0.55;
  let muted = false;
  function start() {
    const pr = el.play();
    if (pr && pr.catch) pr.catch(() => {}); // autoplay 차단 무시
  }
  function stop() { el.pause(); }
  function toggleMute() {
    muted = !muted;
    el.muted = muted;
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
muteBtn.innerHTML = '<span class="cIcon">🔊</span><span class="cLbl">음악</span>';
muteBtn.addEventListener('click', () => {
  const m = Music.toggleMute();
  muteBtn.querySelector('.cIcon').textContent = m ? '🔇' : '🔊';
});
$('controls').appendChild(muteBtn);

// ══════════════════════════════════════════
//  인트로 영상 (산타가 루돌프 타고 선물 주는)
//  열어보기 → 영상 재생 → 끝나면 오프닝으로 전환
// ══════════════════════════════════════════
const introVideo = $('introVideo');
let introDone = false;

// 받는 그룹 이름으로 인트로 문구 채우기
(function setHint() {
  const name = (typeof RECIPIENT !== 'undefined' && RECIPIENT) ? RECIPIENT : '우리 가족';
  $('introHint').textContent = `🎁 ${name}에게 선물이 도착했어요`;
})();

function goToOpening() {
  if (introDone) return;
  introDone = true;
  try { introVideo.pause(); } catch {}
  $('videoIntro').classList.add('hide');
  setTimeout(() => {
    $('opening').style.opacity = '1';
    $('opening').style.pointerEvents = 'auto';
  }, 500);
}

$('introPlayBtn').addEventListener('click', () => {
  $('introOverlay').classList.add('playing');   // 문구/버튼 숨김
  $('introSkip').classList.add('show');         // 건너뛰기 노출
  introVideo.currentTime = 0;
  introVideo.muted = false;
  const pr = introVideo.play();
  if (pr && pr.catch) pr.catch(() => {           // 소리 재생 막히면 음소거로라도 재생
    introVideo.muted = true;
    introVideo.play().catch(() => goToOpening());
  });
});

// 영상 끝나면 자동으로 오프닝
introVideo.addEventListener('ended', goToOpening);
// 건너뛰기
$('introSkip').addEventListener('click', goToOpening);
// 혹시 로드 실패하면 바로 오프닝으로
introVideo.addEventListener('error', goToOpening);

// 지도 리사이즈 보정
setTimeout(() => map.invalidateSize(), 300);
window.addEventListener('resize', () => map.invalidateSize());
