// Firebase SDK를 웹사이트로 불러오는 부분입니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
   apiKey: "AIzaSyB4GGKFIox_Wl2mXkG5cSkuHdEcsHgfuNU", 
  authDomain: "frayviewer-63e13.firebaseapp.com",
  projectId: "frayviewer-63e13",
  storageBucket: "frayviewer-63e13.firebasestorage.app",
  messagingSenderId: "513985013942",
  appId: "1:513985013942:web:613456a85b0b6a5d7e9e17",
  measurementId: "G-2F5YC8ME05"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

const state = {
    selectedPatientId: null,
    primaryPhotoId: null,
    secondaryPhotoId: null, // For comparison state, not directly used for rendering anymore
    tertiaryPhotoId: null,  // For comparison state, not directly used for rendering anymore
    comparePhotoIds: [],
    currentModeFilter: 'all',
    currentDateFilter: '',
    currentAngleFilter: 'all',
    currentProcedureStatusFilter: 'all',
    isAnalysisPanelVisible: false,
    isCompareSelectionActive: false,
    isComparingPhotos: false,
    compareSelectionStep: 0,
    compareCount: 0,
    currentZoomLevel: 1.0,
    zoomStep: 0.2,
    maxZoom: 3.0,
    minZoom: 0.5,
    isDragging: false,
    startX: 0,
    startY: 0,
    currentTranslateX: 0,
    currentTranslateY: 0,
    lastTranslateX: 0,
    lastTranslateY: 0,
    stagedPhoto: null,
    isDrawingMode: false,
    drawingTool: 'free',
    isDrawing: false,
    drawingStartX: 0,
    drawingStartY: 0,
    drawingColor: '#FFFF00',
    drawingLineWidth: 5,
    drawingActions: [],
    measurementPoints: [],
    imageBrightness: 100,
    imageContrast: 100,
    imageGrayscale: 0,
};

function mapStatusToKorean(status) {
    const statusMap = {
        'Before': '시술 전', 'After': '시술 후', '1W': '1주 후', '1M': '1개월 후',
        '3M': '3개월 후', '6M': '6개월 후', '1Y': '1년 후', 'None': '기타/미지정'
    };
    return statusMap[status] || '기타/미지정';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchPatients(); 
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('patientSearch').addEventListener('input', (e) => fetchPatients(e.target.value.toLowerCase()));
    
    document.querySelectorAll('.photo-mode-filter-btn').forEach(btn => btn.addEventListener('click', (e) => {
        state.currentModeFilter = e.currentTarget.dataset.filter;
        document.querySelectorAll('.photo-mode-filter-btn').forEach(b => {
            b.classList.toggle('bg-[#4CAF50]', b === e.currentTarget);
            b.classList.toggle('text-white', b === e.currentTarget);
            b.classList.toggle('bg-gray-200', b !== e.currentTarget);
        });
        fetchPhotos(state.selectedPatientId);
    }));

    document.getElementById('photoDateFilter').addEventListener('change', (e) => { state.currentDateFilter = e.target.value; fetchPhotos(state.selectedPatientId); });
    document.getElementById('photoAngleFilter').addEventListener('change', (e) => { state.currentAngleFilter = e.target.value; fetchPhotos(state.selectedPatientId); });
    document.getElementById('photoProcedureStatusFilter').addEventListener('change', (e) => { state.currentProcedureStatusFilter = e.target.value; fetchPhotos(state.selectedPatientId); });

    document.getElementById('importPhotoBtn').addEventListener('click', () => document.getElementById('importChoiceOverlay').classList.remove('hidden'));
    document.getElementById('startDrawingBtn').addEventListener('click', toggleDrawingMode);
    document.getElementById('analyzeBtn').addEventListener('click', toggleAnalysisPanel);
    document.getElementById('compareBtn').addEventListener('click', handleCompareButtonClick);
    document.getElementById('deletePhotoBtn').addEventListener('click', () => { if (state.primaryPhotoId) deletePhoto(state.primaryPhotoId); else alert('삭제할 사진이 선택되지 않았습니다.'); });
    
    document.getElementById('brightness').addEventListener('input', (e) => { state.imageBrightness = e.target.value; applyImageFilters(); });
    document.getElementById('contrast').addEventListener('input', (e) => { state.imageContrast = e.target.value; applyImageFilters(); });
    document.getElementById('grayscaleBtn').addEventListener('click', () => { 
        state.imageGrayscale = state.imageGrayscale === 100 ? 0 : 100;
        applyImageFilters(); 
    });
    
    document.getElementById('zoomInBtn').addEventListener('click', () => zoomImage(state.zoomStep));
    document.getElementById('zoomOutBtn').addEventListener('click', () => zoomImage(-state.zoomStep));
    document.getElementById('resetViewBtn').addEventListener('click', resetAllAdjustments);
    document.getElementById('fullScreenBtn').addEventListener('click', toggleFullScreen);
    
    document.getElementById('choose2PhotosBtn').addEventListener('click', () => startCompareSelection(2));
    document.getElementById('choose3PhotosBtn').addEventListener('click', () => startCompareSelection(3));

    document.getElementById('image-container').addEventListener('wheel', handleMouseWheelZoom);
    document.getElementById('image-container').addEventListener('mousedown', handleMouseDown);

    document.getElementById('importFromLocalBtn').addEventListener('click', () => { document.getElementById('importChoiceOverlay').classList.add('hidden'); document.getElementById('localFileInput').click(); });
    document.getElementById('importFromWebBtn').addEventListener('click', () => { document.getElementById('importChoiceOverlay').classList.add('hidden'); showWebImageSelectModal(); });
    document.getElementById('closeImportChoiceModal').addEventListener('click', () => document.getElementById('importChoiceOverlay').classList.add('hidden'));
    document.getElementById('localFileInput').addEventListener('change', handleLocalFileSelect);
    document.getElementById('closeWebImageSelectModal').addEventListener('click', () => document.getElementById('webImageSelectOverlay').classList.add('hidden'));
    document.getElementById('addPatientBtn').addEventListener('click', addNewPatient);

    document.querySelectorAll('#mainImageWrapper, #compareImageWrapper, #tertiaryImageWrapper').forEach(wrapper => {
        wrapper.draggable = true;
        wrapper.addEventListener('dragstart', handleDragStart);
        wrapper.addEventListener('dragover', handleDragOver);
        wrapper.addEventListener('dragleave', handleDragLeave);
        wrapper.addEventListener('drop', handleDrop);
        wrapper.addEventListener('dragend', handleDragEnd);
    });

    document.querySelectorAll('.drawing-tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.drawingTool = e.currentTarget.dataset.tool;
            state.measurementPoints = [];
            document.querySelectorAll('.drawing-tool-btn').forEach(b => b.classList.remove('bg-yellow-300'));
            e.currentTarget.classList.add('bg-yellow-300');
        });
    });

    document.getElementById('lineColor').addEventListener('input', (e) => { state.drawingColor = e.target.value; });
    document.getElementById('lineWidth').addEventListener('input', (e) => { state.drawingLineWidth = parseInt(e.target.value, 10); });
    document.getElementById('clearDrawingBtn').addEventListener('click', clearAllDrawings);
    document.getElementById('toggleDrawingBtn').addEventListener('click', toggleDrawingMode);

    const drawingCanvas = document.getElementById('drawingCanvas');
    drawingCanvas.addEventListener('mousedown', handleDrawingMouseDown);
    drawingCanvas.addEventListener('mousemove', handleDrawingMouseMove);
    drawingCanvas.addEventListener('mouseup', handleDrawingMouseUp);
    drawingCanvas.addEventListener('mouseleave', handleDrawingMouseUp);
}

function toggleDrawingMode() {
    state.isDrawingMode = !state.isDrawingMode;
    const drawingToolbar = document.getElementById('drawing-toolbar');
    const drawingCanvas = document.getElementById('drawingCanvas');
    const imageContainer = document.getElementById('image-container');

    if (state.isDrawingMode) {
        if(state.isAnalysisPanelVisible) toggleAnalysisPanel();
        drawingToolbar.classList.remove('hidden');
        drawingCanvas.style.pointerEvents = 'auto';
        imageContainer.classList.remove('cursor-grab');
        imageContainer.classList.add('cursor-crosshair');
        document.querySelector('.drawing-tool-btn[data-tool="free"]').classList.add('bg-yellow-300');
    } else {
        drawingToolbar.classList.add('hidden');
        drawingCanvas.style.pointerEvents = 'none';
        imageContainer.classList.remove('cursor-crosshair');
        imageContainer.classList.add('cursor-grab');
        document.querySelectorAll('.drawing-tool-btn').forEach(b => b.classList.remove('bg-yellow-300'));
    }
}

function handleDrawingMouseDown(e) {
    if (!state.isDrawingMode) return;
    const { x, y } = getCanvasCoordinates(e);
    
    const tool = state.drawingTool;
    if (tool === 'ruler' || tool === 'angle') {
        state.measurementPoints.push({ x, y });
        handleMeasurement(tool);
    } else {
        state.isDrawing = true;
        state.drawingStartX = x;
        state.drawingStartY = y;
        if (tool === 'free') {
            state.drawingActions.push({ type: 'free', points: [{ x, y }], color: state.drawingColor, width: state.drawingLineWidth });
        } else if (tool === 'text') {
            const text = prompt('입력할 텍스트:');
            if (text) {
                state.drawingActions.push({ type: 'text', text, x, y, color: state.drawingColor, width: state.drawingLineWidth });
                redrawAllDrawings();
            }
            state.isDrawing = false;
        }
    }
}

function handleMeasurement(tool) {
    if (tool === 'ruler' && state.measurementPoints.length === 2) {
        const [p1, p2] = state.measurementPoints;
        const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const text = `${distance.toFixed(1)}px`;
        state.drawingActions.push({ type: 'line', startX: p1.x, startY: p1.y, endX: p2.x, endY: p2.y, color: state.drawingColor, width: state.drawingLineWidth });
        state.drawingActions.push({ type: 'text', text, x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 - 10, color: state.drawingColor, width: state.drawingLineWidth });
        state.measurementPoints = [];
    } else if (tool === 'angle' && state.measurementPoints.length === 3) {
        const [p1, p2, p3] = state.measurementPoints;
        state.drawingActions.push({ type: 'line', startX: p1.x, startY: p1.y, endX: p2.x, endY: p2.y, color: state.drawingColor, width: state.drawingLineWidth });
        state.drawingActions.push({ type: 'line', startX: p3.x, startY: p3.y, endX: p2.x, endY: p2.y, color: state.drawingColor, width: state.drawingLineWidth });
        const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
        let angleDeg = angle * 180 / Math.PI;
        if (angleDeg < 0) angleDeg += 360;
        if (angleDeg > 180) angleDeg = 360 - angleDeg;
        const text = `${angleDeg.toFixed(1)}°`;
        state.drawingActions.push({ type: 'text', text, x: p2.x + 10, y: p2.y - 10, color: state.drawingColor, width: state.drawingLineWidth });
        state.measurementPoints = [];
    }
    redrawAllDrawings();
}

function handleDrawingMouseMove(e) {
    if (!state.isDrawing || !state.isDrawingMode) return;
    const { x, y } = getCanvasCoordinates(e);
    redrawAllDrawings(); 
    const ctx = document.getElementById('drawingCanvas').getContext('2d');
    setupContext(ctx);

    switch(state.drawingTool) {
        case 'free':
            const currentPath = state.drawingActions[state.drawingActions.length - 1];
            currentPath.points.push({ x, y });
            drawAction(ctx, currentPath);
            break;
        case 'line':
            drawAction(ctx, { type: 'line', startX: state.drawingStartX, startY: state.drawingStartY, endX: x, endY: y });
            break;
        case 'rect':
            drawAction(ctx, { type: 'rect', startX: state.drawingStartX, startY: state.drawingStartY, endX: x, endY: y });
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(x - state.drawingStartX, 2) + Math.pow(y - state.drawingStartY, 2));
            drawAction(ctx, { type: 'circle', startX: state.drawingStartX, startY: state.drawingStartY, radius });
            break;
    }
}

function handleDrawingMouseUp(e) {
    if (!state.isDrawing || !state.isDrawingMode) return;
    state.isDrawing = false;
    const { x, y } = getCanvasCoordinates(e);
    let newAction;

    switch(state.drawingTool) {
        case 'line': newAction = { type: 'line', startX: state.drawingStartX, startY: state.drawingStartY, endX: x, endY: y, color: state.drawingColor, width: state.drawingLineWidth }; break;
        case 'rect': newAction = { type: 'rect', startX: state.drawingStartX, startY: state.drawingStartY, endX: x, endY: y, color: state.drawingColor, width: state.drawingLineWidth }; break;
        case 'circle': const r = Math.sqrt(Math.pow(x - state.drawingStartX, 2) + Math.pow(y - state.drawingStartY, 2)); newAction = { type: 'circle', startX: state.drawingStartX, startY: state.drawingStartY, radius: r, color: state.drawingColor, width: state.drawingLineWidth }; break;
        default: redrawAllDrawings(); return;
    }
    state.drawingActions.push(newAction);
    redrawAllDrawings();
}

function getCanvasCoordinates(event) {
    const canvas = document.getElementById('drawingCanvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

function setupContext(ctx, action = {}) {
    ctx.strokeStyle = action.color || state.drawingColor;
    ctx.fillStyle = action.color || state.drawingColor;
    ctx.lineWidth = action.width || state.drawingLineWidth;
    ctx.lineCap = 'round';
    ctx.font = `${(action.width || state.drawingLineWidth) * 3}px sans-serif`;
}

function drawAction(ctx, action) {
    switch(action.type) {
        case 'free': ctx.beginPath(); ctx.moveTo(action.points[0].x, action.points[0].y); action.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); break;
        case 'line': ctx.beginPath(); ctx.moveTo(action.startX, action.startY); ctx.lineTo(action.endX, action.endY); ctx.stroke(); break;
        case 'rect': ctx.strokeRect(action.startX, action.startY, action.endX - action.startX, action.endY - action.startY); break;
        case 'circle': ctx.beginPath(); ctx.arc(action.startX, action.startY, action.radius, 0, Math.PI * 2); ctx.stroke(); break;
        case 'text': ctx.fillText(action.text, action.x, action.y); break;
    }
}

function redrawAllDrawings() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.drawingActions.forEach(action => {
        setupContext(ctx, action);
        drawAction(ctx, action);
    });
}

function clearAllDrawings() {
    state.drawingActions = [];
    state.measurementPoints = [];
    redrawAllDrawings();
}

function syncCanvasSize() {
    const mainImage = document.getElementById('mainImage');
    const analysisCanvas = document.getElementById('analysisCanvas');
    const drawingCanvas = document.getElementById('drawingCanvas');
    if (!mainImage || !mainImage.naturalWidth) return;
    const { naturalWidth: width, naturalHeight: height } = mainImage;
    analysisCanvas.width = width; analysisCanvas.height = height;
    drawingCanvas.width = width; drawingCanvas.height = height;
    redrawAllDrawings();
    if (state.isAnalysisPanelVisible && state.primaryPhotoId) getPhotoById(state.primaryPhotoId).then(photo => { if (photo) renderAnalysis(photo); });
}

function applyImageFilters() {
    const filterValue = `brightness(${state.imageBrightness}%) contrast(${state.imageContrast}%) grayscale(${state.imageGrayscale}%)`;
    document.querySelectorAll('#mainImage, #compareImage, #tertiaryImage').forEach(img => {
        if(img) img.style.filter = filterValue;
    });
}

function resetAllAdjustments() {
    resetZoomAndPan();
    state.imageBrightness = 100; state.imageContrast = 100; state.imageGrayscale = 0;
    document.getElementById('brightness').value = 100;
    document.getElementById('contrast').value = 100;
    applyImageFilters();
}

async function getPhotoById(photoId) {
    if (!photoId) return null;
    const photoDoc = await getDoc(doc(db, 'photos', photoId));
    return photoDoc.exists() ? { id: photoDoc.id, ...photoDoc.data() } : null;
}

async function fetchPatients(searchTerm = '') {
    const patientListEl = document.getElementById('patientList');
    patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자 목록을 불러오는 중...</p>';
    try {
        const patientsCol = collection(db, 'patients');
        const patientSnapshot = await getDocs(patientsCol);
        const patients = patientSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.chartId && p.chartId.toLowerCase().includes(searchTerm)));
        renderPatientList(filteredPatients);
        if (filteredPatients.length === 0) patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자가 없습니다.</p>';
    }
    catch (error) {
        console.error("환자 목록 불러오는 중 오류 발생:", error);
        patientListEl.innerHTML = '<p class="text-center text-red-500 py-2 text-sm">환자 목록을 불러오지 못했습니다.</p>';
    }
}

function renderPatientList(patients) {
    const patientListEl = document.getElementById('patientList');
    patientListEl.innerHTML = '';
    patients.forEach(patient => {
        const li = document.createElement('li');
        li.className = 'patient-list-item py-1 px-2 cursor-pointer border-b border-gray-200 flex justify-between items-center text-sm';
        if(patient.id === state.selectedPatientId) li.classList.add('selected');
        li.innerHTML = `<div><p class="font-semibold text-sm">${patient.name}</p><p class="text-xs text-gray-500">${patient.chartId || ''} | ${patient.birth || ''}</p></div><span class="text-xs text-gray-400">></span>`;
        li.addEventListener('click', () => selectPatient(patient.id));
        patientListEl.appendChild(li);
    });
}

async function addNewPatient() {
    const name = prompt("새 환자의 이름을 입력해주세요:");
    if (!name) return;
    const birth = prompt("새 환자의 생년월일을 입력해주세요 (예: 1990-01-01):");
    if (!birth) return;
    const gender = prompt("새 환자의 성별을 입력해주세요 (예: 남/여):");
    if (!gender) return;
    const chartId = prompt("새 환자의 차트 ID를 입력해주세요 (예: C-20240001):");
    if (!chartId) return;
    try {
        await addDoc(collection(db, 'patients'), { name, birth, gender, chartId, createdAt: new Date() });
        alert(`${name} 환자가 성공적으로 추가되었습니다!`);
        fetchPatients();
    } catch (error) {
        console.error("환자 추가 중 오류 발생:", error);
        alert("환자 추가에 실패했습니다: " + error.message);
    }
}

async function selectPatient(patientId) {
    resetViewerToPlaceholder(); 
    clearAllDrawings();
    if(state.isDrawingMode) toggleDrawingMode();
    if(state.isAnalysisPanelVisible) toggleAnalysisPanel();
    
    state.selectedPatientId = patientId;
    state.currentModeFilter = 'all';
    state.currentDateFilter = '';
    state.currentAngleFilter = 'all';
    state.currentProcedureStatusFilter = 'all';

    document.getElementById('photoDateFilter').value = '';
    document.getElementById('photoAngleFilter').value = 'all';
    document.getElementById('photoProcedureStatusFilter').value = 'all';
    document.querySelectorAll('.photo-mode-filter-btn').forEach(b => {
        const isAll = b.dataset.filter === 'all';
        b.classList.toggle('bg-[#4CAF50]', isAll);
        b.classList.toggle('text-white', isAll);
        b.classList.toggle('bg-gray-200', !isAll);
    });

    fetchPatients();
    document.getElementById('photoListSection').classList.remove('hidden');
    const patientDoc = await getDoc(doc(db, 'patients', patientId));
    if (patientDoc.exists()) {
        document.getElementById('photoListHeader').innerText = `${patientDoc.data().name}님의 사진 목록`;
    }
    fetchPhotos(patientId);
}

// fetchPhotos: Firestore에서 특정 환자의 사진 목록을 불러와 화면에 그립니다.
async function fetchPhotos(patientId) {
    if (!patientId) {
        renderPhotoList([]);
        return;
    }
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = '<p class="col-span-full text-center text-gray-500 py-2 text-xs">사진 목록을 불러오는 중...</p>'; 

    try {
        let q = query(collection(db, 'photos'), where('patientId', '==', patientId));
        if (state.currentModeFilter !== 'all') q = query(q, where('mode', '==', state.currentModeFilter));
        if (state.currentDateFilter) q = query(q, where('date', '==', state.currentDateFilter));
        if (state.currentAngleFilter !== 'all') q = query(q, where('viewAngle', '==', state.currentAngleFilter));
        if (state.currentProcedureStatusFilter !== 'all') q = query(q, where('procedureStatus', '==', state.currentProcedureStatusFilter));

        const photoSnapshot = await getDocs(q);
        let photos = photoSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        photos.sort((a, b) => (b.uploadedAt?.toDate() || 0) - (a.uploadedAt?.toDate() || 0));
        
        // 썸네일 목록을 먼저 렌더링합니다.
        renderPhotoList(photos);

        // ======================= [수정된 로직 시작] =======================
        if (photos.length > 0) {
            // 현재 뷰어에 표시된 사진이 필터링된 목록에 여전히 존재하는지 확인합니다.
            const currentPhotoStillExists = state.primaryPhotoId && photos.some(p => p.id === state.primaryPhotoId);

            // 만약 현재 표시된 사진이 없거나, 필터링으로 인해 사라졌다면
            // 새로운 목록의 첫 번째 사진을 자동으로 선택하여 보여줍니다.
            if (!currentPhotoStillExists) {
                await selectPhoto(photos[0].id);
            }
        } else {
            // 필터링 결과 사진이 하나도 없으면 뷰어를 초기화합니다.
            resetViewerToPlaceholder();
        }
        // ======================= [수정된 로직 끝] =========================

    } catch (error) {
        console.error("사진 목록 불러오는 중 오류:", error);
        photoListEl.innerHTML = '<p class="col-span-full text-center text-red-500 py-2 text-xs">사진을 불러오지 못했습니다.</p>';
    }
}

function renderPhotoList(photos) {
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = '';
    photos.forEach(photo => {
        const li = document.createElement('li');
        li.className = 'photo-list-item px-1 py-0.5 cursor-pointer rounded-md flex items-center space-x-1 text-xs';
        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.mode;
        img.className = 'w-12 h-12 object-cover rounded-md mr-1';
        img.onerror = () => { img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; };
        const divInfo = document.createElement('div');
        divInfo.innerHTML = `<p class="font-medium text-xs">${photo.mode} (${photo.viewAngle})</p><p class="text-xxs text-gray-500">${photo.date} | ${photo.procedureStatus || 'N/A'}</p>`;
        li.appendChild(img);
        li.appendChild(divInfo);
        li.addEventListener('click', () => selectPhoto(photo.id));
        photoListEl.appendChild(li);
    });
}

async function selectPhoto(photoId) {
    clearAllDrawings();
    if(state.isDrawingMode) toggleDrawingMode();
    if(state.isAnalysisPanelVisible) toggleAnalysisPanel();
    
    state.primaryPhotoId = photoId;
    state.comparePhotoIds = [photoId];
    await updateComparisonDisplay();
}

function toggleAnalysisPanel() {
    state.isAnalysisPanelVisible = !state.isAnalysisPanelVisible;
    const panel = document.getElementById('analysisPanel');
    const btn = document.getElementById('analyzeBtn');

    if (state.isAnalysisPanelVisible) {
        if(state.isDrawingMode) toggleDrawingMode();
        panel.classList.remove('hidden');
        btn.classList.add('bg-[#4CAF50]', 'text-white');
        if (state.primaryPhotoId) {
            getPhotoById(state.primaryPhotoId).then(photo => {
                if(photo && photo.ai_analysis) {
                    renderAnalysis(photo);
                } else {
                    clearAnalysis();
                    document.getElementById('analysisContent').innerHTML = "<p class='text-sm text-gray-500'>이 사진에 대한 분석 데이터가 없습니다.</p>";
                }
            });
        } else {
            clearAnalysis();
            document.getElementById('analysisContent').innerHTML = "<p class='text-sm text-gray-500'>사진을 먼저 선택해주세요.</p>";
        }
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('bg-[#4CAF50]', 'text-white');
    }
}

function renderAnalysis(photo) {
    const contentEl = document.getElementById('analysisContent');
    if (!photo || !photo.ai_analysis) {
        contentEl.innerHTML = "<p class='text-sm text-gray-500'>분석 데이터가 없습니다.</p>";
        return;
    }
    contentEl.innerHTML = `<pre class="text-xs bg-gray-100 p-2 rounded-md">${JSON.stringify(photo.ai_analysis, null, 2)}</pre>`;
}

function clearAnalysis() { 
    document.getElementById('analysisContent').innerHTML = ''; 
    const canvas = document.getElementById('analysisCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function handleCompareButtonClick() {
    if (!state.primaryPhotoId) {
        alert('먼저 비교할 첫 번째 사진을 불러오거나 선택해주세요.');
        return;
    }
    if (state.isComparingPhotos || state.isCompareSelectionActive) {
        state.isComparingPhotos = false;
        state.isCompareSelectionActive = false;
        state.compareSelectionStep = 0;
        state.compareCount = 0;
        document.getElementById('compareBtn').innerText = '사진 비교';
        document.getElementById('compareBtn').classList.remove('bg-green-200');
        state.comparePhotoIds = [state.primaryPhotoId];
        updateComparisonDisplay();
    } else {
        if (state.isAnalysisPanelVisible) toggleAnalysisPanel();
        if (state.isDrawingMode) toggleDrawingMode();
        document.getElementById('compareChoiceOverlay').classList.remove('hidden');
    }
}

function startCompareSelection(count) {
    document.getElementById('compareChoiceOverlay').classList.add('hidden');
    state.isCompareSelectionActive = true;
    state.isComparingPhotos = false;
    state.compareCount = count;
    state.compareSelectionStep = 1;
    state.comparePhotoIds = state.primaryPhotoId ? [state.primaryPhotoId, ...Array(count - 1).fill(null)] : Array(count).fill(null);
    document.getElementById('compareBtn').innerText = '비교할 두 번째 사진 선택...';
    document.getElementById('compareBtn').classList.add('bg-green-200');
    alert('비교할 두 번째 사진을 좌측 목록에서 선택해주세요.');
    resetZoomAndPan();
    updateComparisonDisplay();
}

async function updateComparisonDisplay() {
    clearAllDrawings();
    const imageViewer = document.getElementById('imageViewer');
    const { comparePhotoIds } = state;
    const visiblePhotos = comparePhotoIds.filter(id => id).length;
    
    document.getElementById('viewerPlaceholder').classList.add('hidden');
    imageViewer.classList.remove('hidden');

    imageViewer.classList.toggle('flex-row', visiblePhotos > 1);
    imageViewer.classList.toggle('flex-col', visiblePhotos <= 1);

    const wrappers = [document.getElementById('mainImageWrapper'), document.getElementById('compareImageWrapper'), document.getElementById('tertiaryImageWrapper')];
    let infoTexts = [];
    let patientData = null;

    for (let i = 0; i < wrappers.length; i++) {
        const wrapper = wrappers[i];
        const photoId = comparePhotoIds[i];
        const img = wrapper.querySelector('img');

        if (photoId) {
            const photo = await getPhotoById(photoId);
            if(photo) {
                wrapper.classList.remove('hidden');
                wrapper.dataset.photoId = photoId;
                img.src = photo.url;
                img.onload = syncCanvasSize;
                infoTexts.push(`${photo.date} ${photo.mode}`);
                if (!patientData) {
                    patientData = (await getDoc(doc(db, 'patients', photo.patientId))).data();
                }
            }
        } else {
            wrapper.classList.add('hidden');
        }
    }
    
    document.getElementById('viewerPatientName').innerText = patientData ? `${patientData.name} (${patientData.chartId})` : '사진 뷰어';
    document.getElementById('viewerPhotoInfo').innerText = infoTexts.join(' vs ');
    resetAllAdjustments();
}

function toggleFullScreen() {
    const mainViewer = document.getElementById('mainViewer');
    mainViewer.classList.toggle('full-screen-viewer');
    document.getElementById('sidebar').classList.toggle('hidden');
}

function applyTransforms() {
    const transform = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px) scale(${state.currentZoomLevel})`;
    document.querySelectorAll('#mainImage, #compareImage, #tertiaryImage, #analysisCanvas, #drawingCanvas').forEach(el => {
        if (el) el.style.transform = transform;
    });
}

function zoomImage(step) {
    let newZoomLevel = state.currentZoomLevel + step;
    state.currentZoomLevel = Math.max(state.minZoom, Math.min(state.maxZoom, newZoomLevel));
    applyTransforms(); 
}

function handleMouseWheelZoom(e) { 
    if (!state.isDrawingMode) { 
        e.preventDefault(); 
        zoomImage(e.deltaY < 0 ? state.zoomStep : -state.zoomStep); 
    } 
}

function handleMouseDown(e) {
    if (state.isDrawingMode) return;
    if (e.button === 0) {
        state.isDragging = true;
        state.startX = e.clientX; 
        state.startY = e.clientY; 
        state.lastTranslateX = state.currentTranslateX; 
        state.lastTranslateY = state.currentTranslateY;
        document.getElementById('image-container').classList.add('cursor-grabbing');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseleave', handleMouseUp); 
    }
}

function handleMouseMove(e) {
    if (state.isDragging) {
        state.currentTranslateX = state.lastTranslateX + (e.clientX - state.startX); 
        state.currentTranslateY = state.lastTranslateY + (e.clientY - state.startY); 
        applyTransforms(); 
    }
}

function handleMouseUp() {
    state.isDragging = false; 
    document.getElementById('image-container').classList.remove('cursor-grabbing');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mouseleave', handleMouseUp);
}

function handleDragStart(e) {
    const draggedWrapper = e.target.closest('.image-wrapper');
    if (!draggedWrapper || !state.isComparingPhotos || state.comparePhotoIds.filter(id => id).length <= 1) {
        e.preventDefault();
        return;
    }
    if (draggedWrapper.dataset.photoId) {
        e.dataTransfer.setData('text/plain', draggedWrapper.dataset.photoId);
        e.dataTransfer.effectAllowed = 'move';
        draggedWrapper.classList.add('dragging-source');
    } else {
        e.preventDefault();
    }
}

function handleDragOver(e) {
    e.preventDefault();
    const targetWrapper = e.target.closest('.image-wrapper');
    if (e.dataTransfer.types.includes('text/plain') && targetWrapper && targetWrapper.dataset.photoId && targetWrapper !== e.target.closest('.dragging-source')) {
        e.dataTransfer.dropEffect = 'move';
        targetWrapper.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.target.closest('.image-wrapper')?.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    const targetWrapper = e.target.closest('.image-wrapper');
    targetWrapper?.classList.remove('drag-over');
    if (targetWrapper?.dataset.photoId) {
        const draggedPhotoId = e.dataTransfer.getData('text/plain');
        const targetPhotoId = targetWrapper.dataset.photoId;
        if (draggedPhotoId === targetPhotoId) return;
        const draggedIndex = state.comparePhotoIds.indexOf(draggedPhotoId);
        const targetIndex = state.comparePhotoIds.indexOf(targetPhotoId);
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const temp = state.comparePhotoIds[draggedIndex];
            state.comparePhotoIds[draggedIndex] = state.comparePhotoIds[targetIndex];
            state.comparePhotoIds[targetIndex] = temp;
            await updateComparisonDisplay();
        }
    }
}

function handleDragEnd(e) {
    e.target.closest('.image-wrapper')?.classList.remove('dragging-source');
}

function generateSampleAIAnalysis(mode) { 
    if (mode.includes('F-ray')) return { type: 'fray', sagging: Math.floor(Math.random() * 100) };
    if (mode.includes('Portrait')) return { type: 'portrait', wrinkles: Math.floor(Math.random() * 20) };
    if (mode.includes('UV')) return { type: 'uv', pigmentation: Math.floor(Math.random() * 100) };
    return {};
}

async function handleLocalFileSelect(event) {
    const file = event.target.files[0]; 
    if (!file) return;

    const fileName = file.name;
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const parts = baseName.split('_');

    let photoMode = 'PC Upload', viewAngle = 'C0', photoDate = new Date().toISOString().slice(0, 10), procedureStatusInEnglish = 'None';
    if (parts.length >= 6) {
        photoMode = parts[2];
        viewAngle = parts[3];
        const datePart = parts[4];
        if (datePart && datePart.length === 8 && !isNaN(datePart)) {
            photoDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
        }
        procedureStatusInEnglish = parts[5];
    }
    
    const aiAnalysisData = generateSampleAIAnalysis(photoMode);
    const procedureStatusInKorean = mapStatusToKorean(procedureStatusInEnglish);

    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(file, 'local', photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean);
        alert("사진을 저장하려면 좌측에서 환자를 선택하세요.");
    } else {
        await displayImageAndSave(file, 'local', state.selectedPatientId, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean); 
    }
}

async function showWebImageSelectModal() {
    const webImageSelectOverlay = document.getElementById('webImageSelectOverlay');
    const storageImageList = document.getElementById('storageImageList');
    webImageSelectOverlay.classList.remove('hidden');
    storageImageList.innerHTML = '<p class="col-span-full text-center text-gray-500">Storage에서 이미지를 불러오는 중...</p>';
    try {
        const listRef = ref(storage, 'images/');
        const res = await listAll(listRef);
        storageImageList.innerHTML = '';
        if (res.items.length === 0) {
            storageImageList.innerHTML = '<p>사진이 없습니다.</p>';
            return;
        }
        for (const itemRef of res.items) {
            const imageUrl = await getDownloadURL(itemRef);
            const fileName = itemRef.name;
            const imgDiv = document.createElement('div');
            imgDiv.className = 'relative flex flex-col items-center p-2 border rounded-md hover:shadow-lg';
            const imgEl = document.createElement('img');
            imgEl.src = imageUrl;
            imgEl.className = 'w-24 h-24 object-cover rounded-md mb-2';
            const spanFileName = document.createElement('span');
            spanFileName.className = 'text-xs truncate w-full text-center';
            spanFileName.innerText = fileName;
            imgDiv.appendChild(imgEl);
            imgDiv.appendChild(spanFileName);
            imgDiv.addEventListener('click', () => selectWebImageFromStorage(imageUrl, fileName));
            storageImageList.appendChild(imgDiv);
        }
    } catch (error) {
        console.error("Storage 이미지 목록 불러오기 실패:", error);
        storageImageList.innerHTML = '<p>이미지 목록을 불러오지 못했습니다.</p>';
    }
}

async function selectWebImageFromStorage(imageUrl, fileName) {
    document.getElementById('webImageSelectOverlay').classList.add('hidden');
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const parts = baseName.split('_');
    let photoMode = 'Web URL', viewAngle = 'C0', photoDate = new Date().toISOString().slice(0, 10), procedureStatusInEnglish = 'None';
    if (parts.length >= 6) {
        photoMode = parts[2];
        viewAngle = parts[3];
        const datePart = parts[4];
        if (datePart && datePart.length === 8 && !isNaN(datePart)) {
            photoDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
        }
        procedureStatusInEnglish = parts[5];
    }
    const aiAnalysisData = generateSampleAIAnalysis(photoMode);
    const procedureStatusInKorean = mapStatusToKorean(procedureStatusInEnglish);
    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(imageUrl, 'web', photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean);
        alert("사진을 저장하려면 좌측에서 환자를 선택하세요.");
    } else {
        await displayImageAndSave(imageUrl, 'web', state.selectedPatientId, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean);
    }
}

async function displayImageAndSave(source, sourceType, patientId, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatus) {
    document.getElementById('viewerPlaceholder').innerHTML = `<div class="text-center text-gray-500">...로딩 중...</div>`;
    try {
        let imageUrlToDisplay;
        if (sourceType === 'local') {
            const file = source;
            const storageRef = ref(storage, `photos/${patientId}/${file.name}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            imageUrlToDisplay = await getDownloadURL(snapshot.ref);
        } else {
            imageUrlToDisplay = source;
        }
        const newPhotoData = { patientId, url: imageUrlToDisplay, mode: photoMode, viewAngle, date: photoDate, uploadedAt: new Date(), ai_analysis: aiAnalysisData, procedureStatus };
        const docRef = await addDoc(collection(db, 'photos'), newPhotoData);
        await selectPhoto(docRef.id);
    } catch (error) {
        console.error("사진 저장 오류:", error);
        alert("사진 저장에 실패했습니다.");
        resetViewerToPlaceholder();
    }
}

async function displayImageWithoutSaving(source, sourceType, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatus) {
    try {
        let imageUrlToDisplay;
        if (sourceType === 'local') {
            imageUrlToDisplay = URL.createObjectURL(source);
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: source, date: photoDate, ai_analysis: aiAnalysisData, procedureStatus };
        } else {
            imageUrlToDisplay = source;
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: null, date: photoDate, ai_analysis: aiAnalysisData, procedureStatus };
        }
        state.primaryPhotoId = null;
        state.comparePhotoIds = [];
        resetViewerToPlaceholder();
        document.getElementById('viewerPlaceholder').classList.add('hidden');
        document.getElementById('imageViewer').classList.remove('hidden');
        const mainImage = document.getElementById('mainImage');
        mainImage.src = imageUrlToDisplay;
        document.getElementById('mainImageWrapper').classList.remove('hidden');
        document.getElementById('viewerPatientName').innerText = `환자 미지정 - 선택 필요`;
        document.getElementById('viewerPhotoInfo').innerText = `${photoDate} | ${photoMode} | ${viewAngle} | ${procedureStatus}`;
    } catch (error) {
        console.error("Staged 사진 불러오기 오류:", error);
        resetViewerToPlaceholder();
    }
}

function resetViewerToPlaceholder() {
    document.getElementById('viewerPlaceholder').classList.remove('hidden');
    document.getElementById('imageViewer').classList.add('hidden');
    state.primaryPhotoId = null;
    state.comparePhotoIds = [];
    state.isComparingPhotos = false;
    state.isCompareSelectionActive = false;
}

async function deletePhoto(photoId) {
    if (!confirm('정말로 이 사진을 삭제하시겠습니까?')) return;
    try {
        await deleteDoc(doc(db, 'photos', photoId)); 
        alert('사진이 삭제되었습니다.');
        state.comparePhotoIds = state.comparePhotoIds.filter(id => id !== photoId);
        if (state.primaryPhotoId === photoId) state.primaryPhotoId = state.comparePhotoIds[0] || null;
        if (state.comparePhotoIds.length > 0) await updateComparisonDisplay();
        else resetViewerToPlaceholder(); 
        fetchPhotos(state.selectedPatientId);
    } catch (error) {
        console.error("사진 삭제 중 오류 발생:", error);
        alert("사진 삭제에 실패했습니다.");
    }
}