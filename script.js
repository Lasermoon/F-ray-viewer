// Firebase SDK를 웹사이트로 불러오는 부분입니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
    comparePhotoIds: [],
    currentPhotos: [], // 현재 로드된 사진 목록 전체를 저장
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
        applyPhotoFilters();
    }));

    document.getElementById('photoDateFilter').addEventListener('change', (e) => { state.currentDateFilter = e.target.value; applyPhotoFilters(); });
    document.getElementById('photoAngleFilter').addEventListener('change', (e) => { state.currentAngleFilter = e.target.value; applyPhotoFilters(); });
    document.getElementById('photoProcedureStatusFilter').addEventListener('change', (e) => { state.currentProcedureStatusFilter = e.target.value; applyPhotoFilters(); });

    document.getElementById('importPhotoBtn').addEventListener('click', () => document.getElementById('importChoiceOverlay').classList.remove('hidden'));
    document.getElementById('startDrawingBtn').addEventListener('click', toggleDrawingMode);
    document.getElementById('analyzeBtn').addEventListener('click', toggleAnalysisPanel);
    document.getElementById('compareBtn').addEventListener('click', handleCompareButtonClick);
    document.getElementById('deletePhotoBtn').addEventListener('click', () => { if (state.primaryPhotoId) deletePhoto(state.primaryPhotoId); else alert('삭제할 사진이 선택되지 않았습니다.'); });
    
    document.getElementById('brightness').addEventListener('input', (e) => { state.imageBrightness = e.target.value; applyImageFiltersAndTransforms(); });
    document.getElementById('contrast').addEventListener('input', (e) => { state.imageContrast = e.target.value; applyImageFiltersAndTransforms(); });
    document.getElementById('grayscaleBtn').addEventListener('click', () => { 
        state.imageGrayscale = state.imageGrayscale === 100 ? 0 : 100;
        document.getElementById('grayscaleBtn').classList.toggle('bg-blue-500', state.imageGrayscale === 100);
        document.getElementById('grayscaleBtn').classList.toggle('text-white', state.imageGrayscale === 100);
        applyImageFiltersAndTransforms(); 
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
            document.querySelectorAll('.drawing-tool-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
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
        document.querySelector('.drawing-tool-btn[data-tool="free"]').classList.add('active');
    } else {
        drawingToolbar.classList.add('hidden');
        drawingCanvas.style.pointerEvents = 'none';
        imageContainer.classList.remove('cursor-crosshair');
        imageContainer.classList.add('cursor-grab');
        document.querySelectorAll('.drawing-tool-btn').forEach(b => b.classList.remove('active'));
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
    if (!canvas) return;
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
    if (!mainImage || !mainImage.naturalWidth || mainImage.naturalWidth === 0) return;
    
    const { naturalWidth: width, naturalHeight: height } = mainImage;
    if (analysisCanvas.width !== width || analysisCanvas.height !== height) {
        analysisCanvas.width = width; 
        analysisCanvas.height = height;
    }
    if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
        drawingCanvas.width = width; 
        drawingCanvas.height = height;
        redrawAllDrawings();
    }
    
    if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
        getPhotoById(state.primaryPhotoId).then(photo => { if (photo) renderAnalysis(photo); });
    }
}

function applyImageFiltersAndTransforms() {
    const filterValue = `brightness(${state.imageBrightness}%) contrast(${state.imageContrast}%) grayscale(${state.imageGrayscale}%)`;
    const transformValue = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px) scale(${state.currentZoomLevel})`;
    
    document.querySelectorAll('#mainImage, #compareImage, #tertiaryImage').forEach(img => {
        if(img) {
            img.style.filter = filterValue;
            img.style.transform = transformValue;
        }
    });

    document.querySelectorAll('#analysisCanvas, #drawingCanvas').forEach(canvas => {
        if (canvas) canvas.style.transform = transformValue;
    });
}

function resetAllAdjustments() {
    state.currentZoomLevel = 1.0;
    state.currentTranslateX = 0;
    state.currentTranslateY = 0;
    state.lastTranslateX = 0;
    state.lastTranslateY = 0;
    state.imageBrightness = 100; 
    state.imageContrast = 100; 
    state.imageGrayscale = 0;
    document.getElementById('brightness').value = 100;
    document.getElementById('contrast').value = 100;
    document.getElementById('grayscaleBtn').classList.remove('bg-blue-500', 'text-white');
    applyImageFiltersAndTransforms(); 
}

async function getPhotoById(photoId) {
    if (!photoId) return null;
    const photoDocRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoDocRef);
    return photoDoc.exists() ? { id: photoDoc.id, ...photoDoc.data() } : null;
}

async function fetchPatients(searchTerm = '') {
    const patientListEl = document.getElementById('patientList');
    patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자 목록을 불러오는 중...</p>';
    try {
        const patientsCol = collection(db, 'patients');
        const patientSnapshot = await getDocs(patientsCol);
        const patients = patientSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const filteredPatients = patients.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.chartId && p.chartId.toLowerCase().includes(searchTerm))
        );

        renderPatientList(filteredPatients);
        if (filteredPatients.length === 0) {
            patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자가 없습니다.</p>';
        }
    } catch (error) {
        console.error("환자 목록 불러오는 중 오류:", error);
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
    state.selectedPatientId = patientId;
    
    // Reset filters
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
    
    const patientDoc = await getDoc(doc(db, 'patients', patientId));
    if (patientDoc.exists()) {
        const selectedPatient = patientDoc.data();
        document.getElementById('photoListHeader').innerText = `${selectedPatient.name}님의 사진 목록`;
    }
    
    await fetchPhotos(patientId);
}

async function fetchPhotos(patientId) {
    if (!patientId) {
        renderPhotoList([]);
        return;
    }
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-2 text-xs">사진 목록을 불러오는 중...</p>'; 

    try {
        const q = query(collection(db, 'photos'), where('patientId', '==', patientId));
        const photoSnapshot = await getDocs(q);
        state.currentPhotos = photoSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.currentPhotos.sort((a, b) => (b.uploadedAt?.toDate() || 0) - (a.uploadedAt?.toDate() || 0));
        
        applyPhotoFilters();

        if (state.currentPhotos.length > 0) {
            const isPrimaryPhotoVisible = document.getElementById('mainImage').src !== '';
            if (!isPrimaryPhotoVisible) {
                const visiblePhotos = getVisiblePhotos();
                if(visiblePhotos.length > 0){
                    await selectPhoto(visiblePhotos[0].id);
                }
            }
        } else {
           resetViewerToPlaceholder();
        }

    } catch (error) {
        console.error("사진 목록 불러오는 중 오류:", error);
        photoListEl.innerHTML = '<p class="col-span-2 text-center text-red-500 py-2 text-xs">사진을 불러오지 못했습니다.</p>';
    }
}

function getVisiblePhotos() {
    return state.currentPhotos.filter(photo => {
        const modeMatch = state.currentModeFilter === 'all' || photo.mode === state.currentModeFilter;
        const dateMatch = !state.currentDateFilter || photo.date === state.currentDateFilter;
        const angleMatch = state.currentAngleFilter === 'all' || photo.viewAngle === state.currentAngleFilter;
        const procedureMatch = state.currentProcedureStatusFilter === 'all' || photo.procedureStatus === state.currentProcedureStatusFilter;
        return modeMatch && dateMatch && angleMatch && procedureMatch;
    });
}

function applyPhotoFilters() {
    const visiblePhotos = getVisiblePhotos();
    renderPhotoList(visiblePhotos);
}

function renderPhotoList(photos) {
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = '';
    
    if (photos.length === 0) {
        photoListEl.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-2 text-xs">표시할 사진이 없습니다.</p>';
        return;
    }
    
    photos.forEach(photo => {
        const li = document.createElement('li');
        li.className = 'photo-list-item p-1 cursor-pointer rounded-md flex items-center space-x-2';
        if(state.comparePhotoIds.includes(photo.id)) li.classList.add('selected');

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.mode;
        img.className = 'w-16 h-16 object-cover rounded-md';
        img.onerror = () => { img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; };

        const divInfo = document.createElement('div');
        divInfo.innerHTML = `
            <p class="font-medium text-xs">${photo.mode} (${photo.viewAngle})</p>
            <p class="text-xxs text-gray-500">${photo.date}</p>
            <p class="text-xxs text-gray-500">${photo.procedureStatus || 'N/A'}</p> 
        `;

        li.appendChild(img);
        li.appendChild(divInfo);
        li.addEventListener('click', () => selectPhoto(photo.id));
        photoListEl.appendChild(li);
    });
}

async function selectPhoto(photoId) {
    if (state.isDrawingMode) toggleDrawingMode();
    if (state.isAnalysisPanelVisible) toggleAnalysisPanel();
    
    const photo = await getPhotoById(photoId);
    if (!photo) return alert("선택된 사진 정보를 찾을 수 없습니다.");

    if (state.isCompareSelectionActive) {
        if (state.compareSelectionStep === 1) {
            if (photoId === state.comparePhotoIds[0]) return alert('이미 선택된 사진입니다.');
            state.comparePhotoIds[1] = photoId;
            if (state.compareCount === 2) {
                state.isCompareSelectionActive = false;
                state.isComparingPhotos = true;
                document.getElementById('compareBtn').innerText = '비교 해제';
            } else {
                state.compareSelectionStep = 2;
                document.getElementById('compareBtn').innerText = '세 번째 사진 선택...';
            }
        } else if (state.compareSelectionStep === 2) {
            if (state.comparePhotoIds.includes(photoId)) return alert('이미 선택된 사진입니다.');
            state.comparePhotoIds[2] = photoId;
            state.isCompareSelectionActive = false;
            state.isComparingPhotos = true;
            document.getElementById('compareBtn').innerText = '비교 해제';
        }
    } else {
        state.primaryPhotoId = photoId;
        state.comparePhotoIds = [photoId];
    }
    await updateComparisonDisplay();
    applyPhotoFilters();
}

function toggleAnalysisPanel() {
    state.isAnalysisPanelVisible = !state.isAnalysisPanelVisible;
    const panel = document.getElementById('analysisPanel');
    const btn = document.getElementById('analyzeBtn');

    if (state.isAnalysisPanelVisible) {
        if(state.isDrawingMode) toggleDrawingMode();
        panel.classList.remove('hidden');
        btn.classList.add('bg-green-200');
        if (state.primaryPhotoId) {
            getPhotoById(state.primaryPhotoId).then(photo => {
                if (photo && photo.ai_analysis) renderAnalysis(photo);
                else document.getElementById('analysisContent').innerHTML = "<p>분석 데이터가 없습니다.</p>";
            });
        } else {
            document.getElementById('analysisContent').innerHTML = "<p>사진을 먼저 선택해주세요.</p>";
        }
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('bg-green-200');
    }
}

function renderAnalysis(photo) {
    const contentEl = document.getElementById('analysisContent');
    contentEl.innerHTML = `<pre class="text-xs">${JSON.stringify(photo.ai_analysis, null, 2)}</pre>`;
}

async function updateComparisonDisplay() {
    clearAllDrawings();
    const imageViewer = document.getElementById('imageViewer');
    const placeholder = document.getElementById('viewerPlaceholder');
    const wrappers = [document.getElementById('mainImageWrapper'), document.getElementById('compareImageWrapper'), document.getElementById('tertiaryImageWrapper')];
    
    const validPhotoIds = state.comparePhotoIds.filter(id => id);
    if (validPhotoIds.length === 0) {
        resetViewerToPlaceholder();
        return;
    }
    
    placeholder.classList.add('hidden');
    imageViewer.classList.remove('hidden');
    
    imageViewer.className = validPhotoIds.length > 1 
        ? 'absolute inset-0 flex flex-row justify-center items-center p-4 space-x-4' 
        : 'absolute inset-0 flex justify-center items-center p-4';

    let patientData = null;
    const infoTexts = [];

    for (let i = 0; i < wrappers.length; i++) {
        const photoId = state.comparePhotoIds[i];
        const wrapper = wrappers[i];
        const img = wrapper.querySelector('img');
        if (photoId) {
            const photo = await getPhotoById(photoId);
            if (photo) {
                if (!patientData) patientData = (await getDoc(doc(db, 'patients', photo.patientId))).data();
                infoTexts.push(`${photo.date} ${photo.mode}`);
                img.src = photo.url;
                img.onload = () => { syncCanvasSize(); };
                wrapper.classList.remove('hidden');
                wrapper.dataset.photoId = photoId;
            }
        } else {
            wrapper.classList.add('hidden');
        }
    }
    
    document.getElementById('viewerPatientName').innerText = patientData ? `${patientData.name} (${patientData.chartId})` : '사진 뷰어';
    document.getElementById('viewerPhotoInfo').innerText = infoTexts.join(' vs ');
    
    resetAllAdjustments();
}

function resetViewerToPlaceholder() {
    document.getElementById('viewerPlaceholder').classList.remove('hidden');
    document.getElementById('imageViewer').classList.add('hidden');
    document.getElementById('viewerPatientName').innerText = '사진 뷰어';
    document.getElementById('viewerPhotoInfo').innerText = '사진 정보를 선택해주세요.';
    state.primaryPhotoId = null;
    state.comparePhotoIds = [];
}

function handleCompareButtonClick() {
    if (!state.primaryPhotoId) return alert('먼저 비교할 사진을 선택해주세요.');
    if (state.isComparingPhotos || state.isCompareSelectionActive) {
        state.isComparingPhotos = false;
        state.isCompareSelectionActive = false;
        document.getElementById('compareBtn').innerText = '사진 비교';
        state.comparePhotoIds = [state.primaryPhotoId];
        updateComparisonDisplay();
    } else {
        document.getElementById('compareChoiceOverlay').classList.remove('hidden');
    }
}

function startCompareSelection(count) {
    document.getElementById('compareChoiceOverlay').classList.add('hidden');
    state.isCompareSelectionActive = true;
    state.compareCount = count;
    state.compareSelectionStep = 1;
    state.comparePhotoIds = [state.primaryPhotoId, ...Array(count - 1).fill(null)];
    document.getElementById('compareBtn').innerText = '두 번째 사진 선택...';
}

function toggleFullScreen() {
    document.getElementById('mainViewer').classList.toggle('full-screen-viewer');
    document.querySelector('aside#patient-panel').classList.toggle('hidden');
    document.querySelector('aside#photo-panel').classList.toggle('hidden');
}

function zoomImage(step) {
    let newZoomLevel = state.currentZoomLevel + step;
    state.currentZoomLevel = Math.max(state.minZoom, Math.min(state.maxZoom, newZoomLevel));
    applyImageFiltersAndTransforms();
}

function handleMouseWheelZoom(e) {
    if (state.isDrawingMode) return;
    e.preventDefault();
    zoomImage(e.deltaY < 0 ? state.zoomStep : -state.zoomStep);
}

function handleMouseDown(e) {
    if (state.isDrawingMode || e.button !== 0) return;
    state.isDragging = true;
    state.startX = e.clientX - state.lastTranslateX;
    state.startY = e.clientY - state.lastTranslateY;
    document.getElementById('image-container').classList.add('cursor-grabbing');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e) {
    if (state.isDragging) {
        state.currentTranslateX = e.clientX - state.startX;
        state.currentTranslateY = e.clientY - state.startY;
        applyImageFiltersAndTransforms();
    }
}

function handleMouseUp() {
    state.isDragging = false;
    state.lastTranslateX = state.currentTranslateX;
    state.lastTranslateY = state.currentTranslateY;
    document.getElementById('image-container').classList.remove('cursor-grabbing');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}

function handleDragStart(e) { /* Stub */ }
function handleDragOver(e) { e.preventDefault(); }
function handleDragLeave(e) { /* Stub */ }
async function handleDrop(e) { /* Stub */ }
function handleDragEnd(e) { /* Stub */ }

function generateSampleAIAnalysis(mode) { return {}; }

async function handleLocalFileSelect(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    if (!state.selectedPatientId) return alert('먼저 환자를 선택해주세요.');

    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    const parts = baseName.split('_');
    const photoMode = parts[2] || 'PC Upload';
    const viewAngle = parts[3] || 'C0';
    const datePart = parts[4] || new Date().toISOString().slice(0,10).replace(/-/g,'');
    const photoDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
    const procedureStatusInEnglish = parts[5] || 'None';
    const procedureStatusInKorean = mapStatusToKorean(procedureStatusInEnglish);
    const aiAnalysisData = generateSampleAIAnalysis(photoMode);
    await displayImageAndSave(file, 'local', state.selectedPatientId, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean);
}

async function showWebImageSelectModal() { /* Stub */ }
async function selectWebImageFromStorage(imageUrl, fileName) { /* Stub */ }

async function displayImageAndSave(source, sourceType, patientId, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatus) {
    try {
        let url;
        if (sourceType === 'local') {
            const snapshot = await uploadBytes(ref(storage, `photos/${patientId}/${source.name}_${Date.now()}`), source);
            url = await getDownloadURL(snapshot.ref);
        } else {
            url = source;
        }
        const docRef = await addDoc(collection(db, 'photos'), { patientId, url, mode: photoMode, viewAngle, date: photoDate, uploadedAt: new Date(), ai_analysis: aiAnalysisData, procedureStatus });
        await selectPhoto(docRef.id);
    } catch (e) {
        alert('사진 저장 실패: ' + e.message);
    }
}

async function displayImageWithoutSaving(source, sourceType, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatus) {
    const url = sourceType === 'local' ? URL.createObjectURL(source) : source;
    state.stagedPhoto = { url, mode: photoMode, viewAngle, file: sourceType === 'local' ? source : null, date: photoDate, ai_analysis: aiAnalysisData, procedureStatus };
    state.primaryPhotoId = null;
    await updateComparisonDisplay(); // This is incorrect, needs to be handled better
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
        alert("사진 삭제에 실패했습니다.");
    }
}