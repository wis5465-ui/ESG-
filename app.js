// ===== 상태 =====
let currentPlantId = null;
let currentPlantName = null;
let cameraStream = null;
let capturedBlob = null;
let isRecording = false;
let aiDetectedHeightCm = null;

// ===== Supabase 헬퍼 =====
async function fetchPlants() {
  const { data, error } = await supabaseClient
    .from('plants')
    .select('*, records(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  // records를 날짜순 정렬
  data.forEach(p => p.records.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)));
  return data;
}

async function uploadPhoto(blob) {
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabaseClient.storage
    .from('plant-photos')
    .upload(fileName, blob, { contentType: 'image/jpeg' });
  if (error) { console.error(error); return null; }
  const { data: urlData } = supabaseClient.storage.from('plant-photos').getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ===== 뷰 전환 =====
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo(0, 0);
}

async function goBack() {
  stopCamera();
  resetRegisterForm();
  showView('view-main');
  await renderPlants();
}

// ===== 식물 목록 렌더링 =====
async function renderPlants() {
  const plants = await fetchPlants();
  const container = document.getElementById('plants-container');
  const addBtn = document.getElementById('add-plant-btn');

  container.querySelectorAll('.plant-card.existing').forEach(el => el.remove());

  plants.forEach(plant => {
    if (plant.records.length === 0) return;
    const card = document.createElement('button');
    card.className = 'plant-card existing';
    card.onclick = () => handleExistingPlant(plant.id, plant.name);

    const lastRecord = plant.records[plant.records.length - 1];

    card.innerHTML = `
      <img class="plant-thumb" src="${lastRecord.photo_url}" alt="${plant.name}">
      <div class="plant-info">
        <span class="plant-name">${plant.name}</span>
        <span class="plant-date">${formatDate(lastRecord.recorded_at)}</span>
      </div>
    `;

    container.insertBefore(card, addBtn);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ===== 신규 식물 추가 =====
function handleAddPlant() {
  currentPlantId = null;
  currentPlantName = null;
  isRecording = false;
  capturedBlob = null;
  showView('view-register');
  startCamera();
}

// ===== 기존 식물 클릭 =====
function handleExistingPlant(plantId, plantName) {
  currentPlantId = plantId;
  currentPlantName = plantName;
  document.getElementById('popup-plant-name').textContent = plantName;
  document.getElementById('popup-overlay').classList.add('active');
}

function closePopup() {
  document.getElementById('popup-overlay').classList.remove('active');
}

function viewRecord() {
  closePopup();
  showRecordView(currentPlantId);
}

function addRecord() {
  closePopup();
  isRecording = true;
  capturedBlob = null;

  showView('view-register');
  document.querySelector('#view-register .nav-bar h2').textContent = '추가 기록';
  document.getElementById('plant-name-input').value = currentPlantName;
  document.getElementById('plant-name-input').disabled = true;
  startCamera();
}

// ===== 카메라 =====
async function startCamera() {
  const video = document.getElementById('camera-video');
  const placeholder = document.getElementById('camera-placeholder');
  const capturedImg = document.getElementById('captured-image');

  capturedImg.style.display = 'none';
  video.style.display = 'block';
  placeholder.style.display = 'flex';

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    video.srcObject = cameraStream;
    placeholder.style.display = 'none';
    document.getElementById('capture-hint').textContent = '촬영 버튼을 눌러 식물을 촬영하세요';
  } catch (err) {
    placeholder.querySelector('p').textContent = '카메라에 접근할 수 없습니다.\n파일에서 사진을 선택해주세요.';
    showFileUploadFallback();
  }
}

function showFileUploadFallback() {
  const captureBtn = document.getElementById('capture-btn');
  captureBtn.style.display = 'none';

  let fileInput = document.getElementById('file-upload');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-upload';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'save-button';
  uploadBtn.textContent = '사진 선택하기';
  uploadBtn.style.marginTop = '16px';
  uploadBtn.id = 'upload-fallback-btn';
  uploadBtn.onclick = () => fileInput.click();

  const existing = document.getElementById('upload-fallback-btn');
  if (existing) existing.remove();

  document.querySelector('.button-group').appendChild(uploadBtn);

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    capturedBlob = file;
    const reader = new FileReader();
    reader.onload = (ev) => showCapturedImage(ev.target.result);
    reader.readAsDataURL(file);
  };
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function handleCapture() {
  const video = document.getElementById('camera-video');
  if (!cameraStream) return;

  // 플래시 효과
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:white;z-index:999;opacity:0.8;transition:opacity 0.3s';
  document.body.appendChild(flash);
  setTimeout(() => { flash.style.opacity = '0'; }, 50);
  setTimeout(() => { flash.remove(); }, 350);

  const canvas = document.getElementById('camera-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    capturedBlob = blob;
    showCapturedImage(URL.createObjectURL(blob));
    identifyPlant(blob);
  }, 'image/jpeg', 0.8);
}

function showCapturedImage(src) {
  const video = document.getElementById('camera-video');
  const capturedImg = document.getElementById('captured-image');

  video.style.display = 'none';
  capturedImg.src = src;
  capturedImg.style.display = 'block';

  document.getElementById('capture-hint').textContent = '촬영 완료!';
  document.getElementById('save-btn').style.display = 'block';
  document.getElementById('save-btn').textContent = isRecording ? '기록 추가' : '등록 완료';
}

// ===== 파일 업로드 =====
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  capturedBlob = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    showCapturedImage(ev.target.result);
    identifyPlant(file);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ===== AI 식물 인식 =====
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

async function identifyPlant(blob) {
  const heightBox = document.getElementById('ai-height-box');
  const heightValue = document.getElementById('ai-height-value');
  if (!heightBox || !heightValue) return;

  heightBox.style.display = 'flex';
  heightValue.textContent = '측정 중...';

  try {
    const base64 = await blobToBase64(blob);
    const res = await fetch('/api/identify-plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 })
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.detail?.error?.message || data?.error || JSON.stringify(data);
      heightValue.textContent = errMsg;
      return;
    }
    const heightText = data.height || '측정 불가';
    heightValue.textContent = heightText;
    const match = heightText.match(/[\d.]+/);
    aiDetectedHeightCm = match ? parseFloat(match[0]) : null;
  } catch (e) {
    console.error('identifyPlant error:', e);
    heightValue.textContent = '측정 실패';
  }
}

// ===== 저장 (Supabase) =====
async function savePlant() {
  const name = document.getElementById('plant-name-input').value.trim();
  if (!name) { shakeElement(document.getElementById('plant-name-input')); return; }
  if (!capturedBlob) { shakeElement(document.querySelector('.camera-display')); return; }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중...';

  // 사진 업로드
  const photoUrl = await uploadPhoto(capturedBlob);
  if (!photoUrl) {
    saveBtn.disabled = false;
    saveBtn.textContent = '다시 시도';
    alert('사진 업로드에 실패했습니다.');
    return;
  }

  const recordData = { photo_url: photoUrl };
  if (aiDetectedHeightCm !== null) recordData.height_cm = aiDetectedHeightCm;

  if (isRecording && currentPlantId) {
    // 기존 식물에 기록 추가
    const { error } = await supabaseClient
      .from('records')
      .insert({ plant_id: currentPlantId, ...recordData });
    if (error) { console.error(error); alert('저장 실패'); saveBtn.disabled = false; return; }
  } else {
    // 신규 식물 등록
    const { data: newPlant, error: plantErr } = await supabaseClient
      .from('plants')
      .insert({ name })
      .select()
      .single();
    if (plantErr) { console.error(plantErr); alert('저장 실패'); saveBtn.disabled = false; return; }

    const { error: recErr } = await supabaseClient
      .from('records')
      .insert({ plant_id: newPlant.id, ...recordData });
    if (recErr) console.error(recErr);

    currentPlantId = newPlant.id;
  }

  stopCamera();
  resetRegisterForm();
  showView('view-main');
  await renderPlants();
}

function resetRegisterForm() {
  document.getElementById('plant-name-input').value = '';
  document.getElementById('plant-name-input').disabled = false;
  const saveBtn = document.getElementById('save-btn');
  saveBtn.style.display = 'none';
  saveBtn.disabled = false;
  document.getElementById('captured-image').style.display = 'none';
  document.getElementById('camera-video').style.display = 'block';
  document.getElementById('capture-hint').textContent = '촬영 버튼을 눌러 식물을 촬영하세요';
  document.querySelector('#view-register .nav-bar h2').textContent = '새 식물 등록';
  document.getElementById('capture-btn').style.display = '';
  capturedBlob = null;
  isRecording = false;

  const heightBox = document.getElementById('ai-height-box');
  if (heightBox) heightBox.style.display = 'none';
  aiDetectedHeightCm = null;

  const fallback = document.getElementById('upload-fallback-btn');
  if (fallback) fallback.remove();
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => { el.style.animation = 'none'; }, 400);
}

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

// ===== 기록 보기 뷰 =====
async function showRecordView(plantId) {
  const { data: plant, error } = await supabaseClient
    .from('plants')
    .select('*, records(*)')
    .eq('id', plantId)
    .single();

  if (error || !plant) { console.error(error); return; }
  plant.records.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

  document.getElementById('record-title').textContent = plant.name + ' 성장 기록';

  // 타임라인
  const timeline = document.getElementById('growth-timeline');
  timeline.innerHTML = '';

  plant.records.forEach((record, i) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const heightStr = record.height_cm ? `<div class="timeline-height">📏 ${record.height_cm}cm</div>` : '';
    item.innerHTML = `
      <div class="timeline-dot"></div>
      <img class="timeline-thumb" src="${record.photo_url}" alt="기록 ${i + 1}">
      <div class="timeline-info">
        <div class="timeline-date">${new Date(record.recorded_at).toLocaleDateString('ko-KR')}</div>
        <div class="timeline-label">${i === 0 ? '첫 번째 기록' : `${i + 1}번째 기록`}</div>
        ${heightStr}
      </div>
    `;
    timeline.appendChild(item);
  });

  // 탄소 감축 계산
  // A: 커피박 업사이클 고정값
  const A = 67.6;
  // B: 기록들 중 height_cm 있는 것만 순서대로 추출해 누적 흡수량 계산
  const heightRecords = plant.records.filter(r => r.height_cm != null);
  let B = 0;
  for (let i = 1; i < heightRecords.length; i++) {
    const hCurr = heightRecords[i].height_cm;
    const hPrev = heightRecords[i - 1].height_cm;
    const weekly = 0.0033 * (hCurr * hCurr - hPrev * hPrev);
    if (weekly > 0) B += weekly;
  }
  const totalG = A + B;

  document.getElementById('carbon-value').textContent = totalG.toFixed(1);
  // 유추: 커피 한 잔 생산 약 200g CO₂, 스마트폰 1시간 충전 약 5g CO₂
  document.getElementById('analogy-car').textContent = `커피 한 잔 생산(약 200g)의 ${Math.round(totalG / 200 * 100)}%를 상쇄했어요`;
  document.getElementById('analogy-tree').textContent = `스마트폰 ${Math.round(totalG / 5)}시간 충전에 해당하는 탄소를 줄였어요`;

  // 각 기록별 누적 탄소 감축량 계산
  const carbonByRecord = [];
  let cumB = 0;
  const heightRecs = plant.records.filter(r => r.height_cm != null);
  plant.records.forEach((record) => {
    const idx = heightRecs.indexOf(record);
    if (idx > 0) {
      const weekly = 0.0033 * (heightRecs[idx].height_cm ** 2 - heightRecs[idx - 1].height_cm ** 2);
      if (weekly > 0) cumB += weekly;
    }
    carbonByRecord.push(parseFloat((A + cumB).toFixed(1)));
  });
  showView('view-record');
  requestAnimationFrame(() => drawChart(plant.records, carbonByRecord));
}

function drawChart(records, carbonByRecord) {
  const canvas = document.getElementById('growth-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const A = 67.6;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = 260 * dpr;
  canvas.style.height = '260px';
  ctx.scale(dpr, dpr);

  const w = canvas.offsetWidth;
  const h = 260;

  ctx.clearRect(0, 0, w, h);

  if (records.length < 1) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('기록이 없습니다', w / 2, h / 2);
    return;
  }

  const padding = { top: 30, right: 16, bottom: 44, left: 16 };
  const chartBottomY = padding.top + (h - padding.top - padding.bottom);
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const values = carbonByRecord || records.map(() => A);
  const maxV = Math.max(...values, A + 1);

  const n = records.length;
  const barW = Math.min(48, (chartW / n) * 0.6);
  const gap = chartW / n;

  records.forEach((r, i) => {
    const total = values[i];
    const bPart = Math.max(0, total - A);
    const x = padding.left + gap * i + gap / 2;
    const date = new Date(r.recorded_at);

    // A 부분 (진한 초록)
    const aBarH = (A / maxV) * chartH;
    const aY = padding.top + chartH - aBarH;
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(x - barW / 2, aY, barW, aBarH);

    // B 부분 (연한 초록) — A 위에 쌓기
    if (bPart > 0) {
      const bBarH = (bPart / maxV) * chartH;
      const bY = aY - bBarH;
      ctx.fillStyle = '#86efac';
      ctx.fillRect(x - barW / 2, bY, barW, bBarH);

      // B 숫자
      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${bPart.toFixed(1)}g`, x, bY - 4);
    }

    // 합계 숫자
    const totalBarH = (total / maxV) * chartH;
    const totalY = padding.top + chartH - totalBarH;
    ctx.fillStyle = '#14532d';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${total.toFixed(1)}g`, x, totalY - (bPart > 0 ? 18 : 4));

    // 날짜
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText(`${date.getMonth() + 1}/${date.getDate()}`, x, chartBottomY + 16);

    // 기록 순서
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText(`${i + 1}번째`, x, chartBottomY + 28);
  });

  // 범례
  const legendY = h - 4;
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(w / 2 - 70, legendY - 8, 10, 8);
  ctx.fillStyle = '#6b7280';
  ctx.font = '9px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('커피박 67.6g', w / 2 - 57, legendY - 1);

  ctx.fillStyle = '#86efac';
  ctx.fillRect(w / 2 + 10, legendY - 8, 10, 8);
  ctx.fillStyle = '#6b7280';
  ctx.fillText('바질 누적 흡수량', w / 2 + 23, legendY - 1);
}

// ===== 환경 교육 팝업 =====
const CHAPTER_URLS = {
  1: null, // TODO: 실제 영상 URL로 교체
  2: null,
  3: null,
  4: null,
};

const CHAPTERS = [
  { num: 1, title: '커피박이란 무엇인가요?', desc: '커피 찌꺼기의 재탄생 이야기', badgeClass: '' },
  { num: 2, title: '식물이 탄소를 흡수하는 방법', desc: '광합성과 탄소 순환의 비밀', badgeClass: 'ch2' },
  { num: 3, title: '우리가 만드는 탄소 제로', desc: '작은 실천이 만드는 큰 변화', badgeClass: 'ch3' },
  { num: 4, title: '지속가능한 미래를 위해', desc: 'ESG와 나의 역할', badgeClass: 'ch4' },
];

const LOCK_REASONS = {
  2: 'Ch.1 시청 후, 2번째 기록 시 열려요',
  3: 'Ch.2 시청 후, 3번째 기록 시 열려요',
  4: 'Ch.3 시청 후, 4번째 기록 시 열려요',
};

async function getTotalRecordCount() {
  const { count, error } = await supabaseClient
    .from('records')
    .select('*', { count: 'exact', head: true });
  return error ? 0 : (count || 0);
}

function getSeenChapters() {
  return JSON.parse(localStorage.getItem('esg_seen_chapters') || '[]');
}

function computeUnlocked(recordCount, seenChapters) {
  if (recordCount >= 4) return [1, 2, 3, 4];
  const unlocked = [1];
  if (recordCount >= 2 && seenChapters.includes(1)) unlocked.push(2);
  if (recordCount >= 3 && seenChapters.includes(2)) unlocked.push(3);
  return unlocked;
}

function renderEduChapters(unlockedChapters) {
  const container = document.getElementById('edu-chapters-list');
  container.innerHTML = '';

  CHAPTERS.forEach(ch => {
    const isUnlocked = unlockedChapters.includes(ch.num);
    const btn = document.createElement('button');
    btn.className = 'edu-chapter-item' + (isUnlocked ? '' : ' locked');
    btn.onclick = () => { if (isUnlocked) openChapter(ch.num); };
    btn.innerHTML = `
      <div class="chapter-badge ${ch.badgeClass}">Ch ${ch.num}</div>
      <div class="chapter-info">
        <span class="chapter-title">${ch.title}</span>
        <span class="chapter-desc">${isUnlocked ? ch.desc : LOCK_REASONS[ch.num]}</span>
      </div>
      ${isUnlocked ? '<span class="popup-arrow">›</span>' : '<span class="chapter-lock-icon">🔒</span>'}
    `;
    container.appendChild(btn);
  });
}

async function openEduPopup() {
  document.getElementById('edu-popup-overlay').classList.add('active');
  const [recordCount, seenChapters] = await Promise.all([
    getTotalRecordCount(),
    Promise.resolve(getSeenChapters()),
  ]);
  renderEduChapters(computeUnlocked(recordCount, seenChapters));
}

function closeEduPopup() {
  document.getElementById('edu-popup-overlay').classList.remove('active');
}

function openChapter(num) {
  // 시청 기록 저장
  const seen = getSeenChapters();
  if (!seen.includes(num)) {
    seen.push(num);
    localStorage.setItem('esg_seen_chapters', JSON.stringify(seen));
  }
  const url = CHAPTER_URLS[num];
  if (!url) return;
  closeEduPopup();
  window.open(url, '_blank');
}

// ===== 새 챕터 배너 =====
async function checkNewChapterBanner() {
  const recordCount = await getTotalRecordCount();
  const seenChapters = getSeenChapters();
  const unlocked = computeUnlocked(recordCount, seenChapters);
  const notified = JSON.parse(localStorage.getItem('esg_notified_chapters') || '[]');
  const hasNew = unlocked.some(ch => !notified.includes(ch));
  if (hasNew) {
    document.getElementById('new-chapter-banner').style.display = 'block';
    document.getElementById('view-main').classList.add('banner-visible');
  }
}

function hideBanner() {
  document.getElementById('new-chapter-banner').style.display = 'none';
  document.getElementById('view-main').classList.remove('banner-visible');
}

async function markBannerNotified() {
  const recordCount = await getTotalRecordCount();
  const unlocked = computeUnlocked(recordCount, getSeenChapters());
  const notified = JSON.parse(localStorage.getItem('esg_notified_chapters') || '[]');
  unlocked.forEach(ch => { if (!notified.includes(ch)) notified.push(ch); });
  localStorage.setItem('esg_notified_chapters', JSON.stringify(notified));
}

function bannerOpenEdu() {
  markBannerNotified();
  hideBanner();
  openEduPopup();
}

function bannerDismiss() {
  markBannerNotified();
  hideBanner();
}

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', () => {
  renderPlants();
  checkNewChapterBanner();
});
