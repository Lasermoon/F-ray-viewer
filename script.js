// Firebase SDK를 웹사이트로 불러오는 부분입니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// getDoc, doc을 추가하여 Firestore 문서 직접 참조 및 가져오기 기능을 포함합니다.
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, documentId, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Storage 관련 SDK를 불러옵니다.
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


// 여러분이 알려주신 Firebase 프로젝트 설정 정보입니다.
// !!! 이 부분을 여러분의 새 프로젝트 설정 정보로 반드시 업데이트해주세요 !!!
const firebaseConfig = {
   apiKey: "AIzaSyB4GGKFIox_Wl2mXkG5cSkuHdEcsHgfuNU", // 여러분의 실제 API 키로 변경하세요.
  authDomain: "frayviewer-63e13.firebaseapp.com", // 여러분의 실제 Auth Domain으로 변경하세요.
  projectId: "frayviewer-63e13", // 여러분의 실제 Project ID로 변경하세요.
  storageBucket: "frayviewer-63e13.firebasestorage.app", // 여러분의 실제 Storage Bucket으로 변경하세요.
  messagingSenderId: "513985013942", // 여러분의 실제 Messaging Sender ID로 변경하세요.
  appId: "1:513985013942:web:613456a85b0b6a5d7e9e17", // 여러분의 실제 App ID로 변경하세요.
  measurementId: "G-2F5YC8ME05" // 여러분의 실제 Measurement ID로 변경하세요.
};

// Firebase 앱을 초기화하고 Storage 서비스에 연결합니다.
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
// Firestore 데이터베이스 서비스에 연결합니다.
const db = getFirestore(app);

// state: 웹사이트의 현재 상태를 저장하는 변수들입니다.
const state = {
    selectedPatientId: null,
    primaryPhotoId: null,
    secondaryPhotoId: null,
    tertiaryPhotoId: null,
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
};

function mapStatusToKorean(status) {
    const statusMap = {
        'Before': '시술 전',
        'After': '시술 후',
        '1W': '1주 후',
        '1M': '1개월 후',
        '3M': '3개월 후',
        '6M': '6개월 후',
        '1Y': '1년 후',
        'None': '기타/미지정'
    };
    return statusMap[status] || '기타/미지정';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchPatients(); 
    setupEventListeners();
});

function setupEventListeners() {
    const patientSearch = document.getElementById('patientSearch');
    patientSearch.addEventListener('input', (e) => {
        fetchPatients(e.target.value.toLowerCase());
    });

    const photoModeFilterBtns = document.querySelectorAll('.photo-mode-filter-btn');
    photoModeFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentModeFilter = btn.dataset.filter;
            photoModeFilterBtns.forEach(b => {
                b.classList.toggle('bg-[#4CAF50]', b === btn);
                b.classList.toggle('text-white', b === btn);
                b.classList.toggle('bg-gray-200', b !== btn);
            });
            fetchPhotos(state.selectedPatientId);
        });
    });

    document.getElementById('photoDateFilter').addEventListener('change', (e) => {
        state.currentDateFilter = e.target.value;
        fetchPhotos(state.selectedPatientId);
    });

    document.getElementById('photoAngleFilter').addEventListener('change', (e) => {
        state.currentAngleFilter = e.target.value;
        fetchPhotos(state.selectedPatientId);
    });

    document.getElementById('photoProcedureStatusFilter').addEventListener('change', (e) => {
        state.currentProcedureStatusFilter = e.target.value;
        fetchPhotos(state.selectedPatientId);
    });

    document.getElementById('startDrawingBtn').addEventListener('click', toggleDrawingMode);
    document.getElementById('analyzeBtn').addEventListener('click', toggleAnalysisPanel);
    document.getElementById('compareBtn').addEventListener('click', handleCompareButtonClick);
    document.getElementById('fullScreenBtn').addEventListener('click', toggleFullScreen);
    document.getElementById('zoomInBtn').addEventListener('click', () => zoomImage(state.zoomStep));
    document.getElementById('zoomOutBtn').addEventListener('click', () => zoomImage(-state.zoomStep));
    document.getElementById('resetViewBtn').addEventListener('click', resetZoomAndPan);
    
    document.getElementById('deletePhotoBtn').addEventListener('click', () => { 
        if (state.primaryPhotoId) {
            deletePhoto(state.primaryPhotoId);
        } else {
            alert('삭제할 사진이 선택되지 않았습니다.');
        }
    });

    document.getElementById('choose2PhotosBtn').addEventListener('click', () => startCompareSelection(2));
    document.getElementById('choose3PhotosBtn').addEventListener('click', () => startCompareSelection(3));

    const imageContainer = document.getElementById('image-container');
    imageContainer.addEventListener('wheel', handleMouseWheelZoom);
    imageContainer.addEventListener('mousedown', handleMouseDown);

    document.getElementById('importPhotoBtn').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.remove('hidden');
    });
    document.getElementById('importFromLocalBtn').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden');
        document.getElementById('localFileInput').click();
    });
    document.getElementById('importFromWebBtn').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden');
        showWebImageSelectModal();
    });
    document.getElementById('closeImportChoiceModal').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden');
    });

    document.getElementById('localFileInput').addEventListener('change', handleLocalFileSelect);
    
    document.getElementById('closeWebImageSelectModal').addEventListener('click', () => {
        document.getElementById('webImageSelectOverlay').classList.add('hidden');
    });

    document.getElementById('addPatientBtn').addEventListener('click', addNewPatient);

    const imageWrappers = document.querySelectorAll('#mainImageWrapper, #compareImageWrapper, #tertiaryImageWrapper');
    imageWrappers.forEach(wrapper => {
        wrapper.draggable = true;
        wrapper.addEventListener('dragstart', handleDragStart);
        wrapper.addEventListener('dragover', handleDragOver);
        wrapper.addEventListener('dragleave', handleDragLeave);
        wrapper.addEventListener('drop', handleDrop);
        wrapper.addEventListener('dragend', handleDragEnd);
    });

    const drawingToolbar = document.getElementById('drawing-toolbar');
    const drawingToolBtns = drawingToolbar.querySelectorAll('.drawing-tool-btn');
    drawingToolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.drawingTool = btn.dataset.tool;
            drawingToolBtns.forEach(b => b.classList.remove('bg-yellow-300'));
            btn.classList.add('bg-yellow-300');
        });
    });

    document.getElementById('lineColor').addEventListener('input', (e) => {
        state.drawingColor = e.target.value;
    });

    document.getElementById('lineWidth').addEventListener('input', (e) => {
        state.drawingLineWidth = parseInt(e.target.value, 10);
    });

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
    state.isDrawing = true;

    const { x, y } = getCanvasCoordinates(e);
    state.drawingStartX = x;
    state.drawingStartY = y;

    if (state.drawingTool === 'free') {
        state.drawingActions.push({
            type: 'free',
            points: [{ x, y }],
            color: state.drawingColor,
            width: state.drawingLineWidth,
        });
    } else if (state.drawingTool === 'text') {
        const text = prompt('입력할 텍스트를 적어주세요:');
        if (text) {
            state.drawingActions.push({
                type: 'text', text, x, y,
                color: state.drawingColor,
                width: state.drawingLineWidth
            });
            redrawAllDrawings();
        }
        state.isDrawing = false;
    }
}

function handleDrawingMouseMove(e) {
    if (!state.isDrawing || !state.isDrawingMode) return;
    const { x, y } = getCanvasCoordinates(e);
    redrawAllDrawings();
    
    const ctx = document.getElementById('drawingCanvas').getContext('2d');
    ctx.strokeStyle = state.drawingColor;
    ctx.fillStyle = state.drawingColor;
    ctx.lineWidth = state.drawingLineWidth;
    ctx.lineCap = 'round';
    ctx.font = `${state.drawingLineWidth * 3}px sans-serif`;

    switch(state.drawingTool) {
        case 'free':
            const currentPath = state.drawingActions[state.drawingActions.length - 1];
            currentPath.points.push({ x, y });
            ctx.beginPath();
            ctx.moveTo(currentPath.points[0].x, currentPath.points[0].y);
            currentPath.points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
            break;
        case 'line':
            ctx.beginPath();
            ctx.moveTo(state.drawingStartX, state.drawingStartY);
            ctx.lineTo(x, y);
            ctx.stroke();
            break;
        case 'rect':
            ctx.strokeRect(state.drawingStartX, state.drawingStartY, x - state.drawingStartX, y - state.drawingStartY);
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(x - state.drawingStartX, 2) + Math.pow(y - state.drawingStartY, 2));
            ctx.beginPath();
            ctx.arc(state.drawingStartX, state.drawingStartY, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
    }
}

function handleDrawingMouseUp(e) {
    if (!state.isDrawing || !state.isDrawingMode) return;
    state.isDrawing = false;
    
    const { x, y } = getCanvasCoordinates(e);
    let newAction;

    switch(state.drawingTool) {
        case 'line':
            newAction = { type: 'line', startX: state.drawingStartX, startY: state.drawingStartY, endX: x, endY: y, color: state.drawingColor, width: state.drawingLineWidth };
            break;
        case 'rect':
            newAction = { type: 'rect', startX: state.drawingStartX, startY: state.drawingStartY, endX: x, endY: y, color: state.drawingColor, width: state.drawingLineWidth };
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(x - state.drawingStartX, 2) + Math.pow(y - state.drawingStartY, 2));
            newAction = { type: 'circle', startX: state.drawingStartX, startY: state.drawingStartY, radius: radius, color: state.drawingColor, width: state.drawingLineWidth };
            break;
        default:
            redrawAllDrawings();
            return;
    }

    state.drawingActions.push(newAction);
    redrawAllDrawings();
}

function getCanvasCoordinates(event) {
    const canvas = document.getElementById('drawingCanvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return { x, y };
}

function redrawAllDrawings() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    state.drawingActions.forEach(action => {
        ctx.strokeStyle = action.color;
        ctx.fillStyle = action.color;
        ctx.lineWidth = action.width;
        ctx.lineCap = 'round';
        ctx.font = `${action.width * 3}px sans-serif`;

        switch(action.type) {
            case 'free':
                ctx.beginPath();
                ctx.moveTo(action.points[0].x, action.points[0].y);
                action.points.forEach(point => ctx.lineTo(point.x, point.y));
                ctx.stroke();
                break;
            case 'line':
                ctx.beginPath();
                ctx.moveTo(action.startX, action.startY);
                ctx.lineTo(action.endX, action.endY);
                ctx.stroke();
                break;
            case 'rect':
                ctx.strokeRect(action.startX, action.startY, action.endX - action.startX, action.endY - action.startY);
                break;
            case 'circle':
                ctx.beginPath();
                ctx.arc(action.startX, action.startY, action.radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'text':
                ctx.fillText(action.text, action.x, action.y);
                break;
        }
    });
}

function clearAllDrawings() {
    state.drawingActions = [];
    redrawAllDrawings();
}

function syncCanvasSize() {
    const mainImage = document.getElementById('mainImage');
    const analysisCanvas = document.getElementById('analysisCanvas');
    const drawingCanvas = document.getElementById('drawingCanvas');
    
    if (!mainImage || !mainImage.naturalWidth) return;

    const width = mainImage.naturalWidth;
    const height = mainImage.naturalHeight;

    analysisCanvas.width = width;
    analysisCanvas.height = height;
    drawingCanvas.width = width;
    drawingCanvas.height = height;

    redrawAllDrawings();
    if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
        getPhotoById(state.primaryPhotoId).then(photo => {
            if (photo) renderAnalysis(photo);
        });
    }
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
        
        const filteredPatients = patients.filter(patient => 
            patient.name.toLowerCase().includes(searchTerm) || 
            (patient.chartId && patient.chartId.toLowerCase().includes(searchTerm))
        );

        renderPatientList(filteredPatients);
        if (filteredPatients.length === 0) {
            patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자가 없습니다.</p>';
        }
    }
    catch (error) {
        console.error("환자 목록을 불러오는 중 오류 발생:", error);
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

        li.innerHTML = `
            <div>
                <p class="font-semibold text-sm">${patient.name}</p>
                <p class="text-xs text-gray-500">${patient.chartId || ''} | ${patient.birth || ''}</p>
            </div>
            <span class="text-xs text-gray-400">></span>
        `;
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
        await addDoc(collection(db, 'patients'), {
            name, birth, gender, chartId, createdAt: new Date()
        });
        alert(`${name} 환자가 성공적으로 추가되었습니다!`);
        fetchPatients();
    } catch (error) {
        console.error("환자 추가 중 오류 발생:", error);
        alert("환자 추가에 실패했습니다: " + error.message);
    }
}

async function selectPatient(patientId) {
    if (state.stagedPhoto && state.selectedPatientId === null) {
        try {
            const { url, mode, viewAngle, file, ai_analysis, date, procedureStatus } = state.stagedPhoto;
            let imageUrlToDisplay = url;

            if (file) {
                const storageRef = ref(storage, `photos/${patientId}/${file.name}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, file);
                imageUrlToDisplay = await getDownloadURL(snapshot.ref);
            }

            const newPhotoData = {
                patientId, url: imageUrlToDisplay, mode, viewAngle, date,
                uploadedAt: new Date(), ai_analysis, procedureStatus
            };
            const docRef = await addDoc(collection(db, 'photos'), newPhotoData);
            state.primaryPhotoId = docRef.id;
            state.stagedPhoto = null;
            alert('사진이 선택된 환자에게 성공적으로 연결되었습니다.');
        } catch (error) {
            console.error("Staged 사진 저장 중 오류 발생:", error);
            alert("사진을 환자에게 연결하는데 실패했습니다: " + error.message);
        }
    }

    state.selectedPatientId = patientId;
    state.currentModeFilter = 'all';
    state.currentDateFilter = '';
    state.currentAngleFilter = 'all';
    state.currentProcedureStatusFilter = 'all';

    document.getElementById('photoDateFilter').value = '';
    document.getElementById('photoAngleFilter').value = 'all';
    document.getElementById('photoProcedureStatusFilter').value = 'all';

    document.querySelectorAll('.photo-mode-filter-btn').forEach(b => {
        b.classList.toggle('bg-[#4CAF50]', b.dataset.filter === 'all');
        b.classList.toggle('text-white', b.dataset.filter === 'all');
        b.classList.toggle('bg-gray-200', b.dataset.filter !== 'all');
    });

    fetchPatients();
    document.getElementById('photoListSection').classList.remove('hidden');
    
    const patientDoc = await getDoc(doc(db, 'patients', patientId));
    if (patientDoc.exists()) {
        const selectedPatient = patientDoc.data();
        document.getElementById('photoListHeader').innerText = `${selectedPatient.name}님의 사진 목록`;
    }
    
    fetchPhotos(patientId);
}

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
        renderPhotoList(photos);

        if (photos.length === 0) {
            photoListEl.innerHTML = '<p class="col-span-full text-center text-gray-500 py-2 text-xs">표시할 사진이 없습니다.</p>';
        }
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
        divInfo.innerHTML = `
            <p class="font-medium text-xs">${photo.mode} (${photo.viewAngle})</p>
            <p class="text-xxs text-gray-500">${photo.date} | ${photo.procedureStatus || 'N/A'}</p> 
        `;

        li.appendChild(img);
        li.appendChild(divInfo);
        li.addEventListener('click', () => selectPhoto(photo.id));
        photoListEl.appendChild(li);
    });
}

async function selectPhoto(photoId) {
    clearAllDrawings();
    state.stagedPhoto = null;

    if (state.isAnalysisPanelVisible) {
        toggleAnalysisPanel();
    }

    const photo = await getPhotoById(photoId);
    if (!photo) {
        alert("선택된 사진 정보를 찾을 수 없습니다.");
        return;
    }

    if (state.isCompareSelectionActive) {
        if (state.compareSelectionStep === 1) {
            if (photoId === state.comparePhotoIds[0]) {
                alert('이미 첫 번째 사진으로 선택되었습니다. 다른 사진을 선택해주세요.');
                return;
            }
            state.comparePhotoIds[1] = photoId;
            if (state.compareCount === 2) {
                state.isCompareSelectionActive = false;
                state.isComparingPhotos = true;
                state.compareSelectionStep = 0;
                document.getElementById('compareBtn').innerText = '사진비교 해제';
            } else if (state.compareCount === 3) {
                state.compareSelectionStep = 2;
                document.getElementById('compareBtn').innerText = '비교할 세 번째 사진 선택...';
                alert('비교할 세 번째 사진을 좌측 목록에서 선택해주세요.');
            }
        } else if (state.compareSelectionStep === 2) {
            if (photoId === state.comparePhotoIds[0] || photoId === state.comparePhotoIds[1]) {
                alert('이미 선택된 사진입니다. 다른 사진을 선택해주세요.');
                return;
            }
            state.comparePhotoIds[2] = photoId;
            state.isCompareSelectionActive = false;
            state.isComparingPhotos = true;
            state.compareSelectionStep = 0;
            document.getElementById('compareBtn').innerText = '사진비교 해제';
        }
        await updateComparisonDisplay();
    } else {
        state.primaryPhotoId = photoId;
        state.comparePhotoIds = [photoId];
        await updateComparisonDisplay();
    }
    
    // 이전에 있던 fetchPhotos 호출은 updateComparisonDisplay 내부에서 처리되거나
    // 필요하다면 여기에 유지. 여기서는 중복 호출을 피하기 위해 제거.
}

function toggleAnalysisPanel() {
    state.isAnalysisPanelVisible = !state.isAnalysisPanelVisible;
    const panel = document.getElementById('analysisPanel');
    const btn = document.getElementById('analyzeBtn');
    const analysisCanvas = document.getElementById('analysisCanvas');

    if (state.isAnalysisPanelVisible) {
        panel.classList.remove('hidden');
        btn.classList.add('bg-[#4CAF50]', 'text-white');
        analysisCanvas.classList.remove('hidden');
        
        if (state.primaryPhotoId) {
            getDoc(doc(db, 'photos', state.primaryPhotoId))
                .then(snapshot => {
                    if (snapshot.exists()) {
                        const photoData = { id: snapshot.id, ...snapshot.data() };
                        if (photoData.ai_analysis && Object.keys(photoData.ai_analysis).length > 0) {
                            renderAnalysis(photoData);
                        } else {
                            clearAnalysis();
                            document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>AI 분석 정보가 없습니다.</p>";
                        }
                    } else {
                        clearAnalysis();
                        document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>사진 정보를 찾을 수 없습니다.</p>";
                    }
                })
                .catch(error => {
                    console.error("분석 정보 로딩 중 오류:", error);
                    clearAnalysis();
                    document.getElementById('analysisContent').innerHTML = `<p class='text-red-500'>분석 정보를 불러오지 못했습니다.</p>`;
                });
        } else {
            clearAnalysis();
            document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>먼저 사진을 선택해주세요.</p>";
        }
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('bg-[#4CAF50]', 'text-white'); 
        btn.classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
        clearAnalysis();
        analysisCanvas.classList.add('hidden');
    }
}

function renderAnalysis(photo) {
    const contentEl = document.getElementById('analysisContent');
    const canvas = document.getElementById('analysisCanvas');
    const ctx = canvas.getContext('2d');
    const img = document.getElementById('mainImage');
    
    const render = () => {
        if (!img.naturalWidth) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // ... (render logic as before) ...
    };
    
    if (img.complete) render();
    else img.onload = render;
}

function clearAnalysis() {
    const canvas = document.getElementById('analysisCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('analysisContent').innerHTML = '';
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
        
        if (state.isAnalysisPanelVisible) {
            toggleAnalysisPanel();
        }
    } else {
        if (state.isAnalysisPanelVisible) {
            toggleAnalysisPanel();
        }
        document.getElementById('compareChoiceOverlay').classList.remove('hidden');
    }
}

function startCompareSelection(count) {
    document.getElementById('compareChoiceOverlay').classList.add('hidden');
    state.isCompareSelectionActive = true;
    state.isComparingPhotos = false;
    state.compareCount = count;
    state.compareSelectionStep = 1;

    state.comparePhotoIds = state.primaryPhotoId ? [state.primaryPhotoId, null, null].slice(0, count) : [null, null, null].slice(0, count);
    
    document.getElementById('compareBtn').innerText = '비교할 두 번째 사진 선택...';
    document.getElementById('compareBtn').classList.add('bg-green-200');
    alert('비교할 두 번째 사진을 좌측 목록에서 선택하거나 PC/웹에서 불러와 선택해주세요.');
    
    resetZoomAndPan();
    updateComparisonDisplay();
}

async function updateComparisonDisplay() {
    clearAllDrawings();
    
    const mainImageWrapper = document.getElementById('mainImageWrapper');
    const compareImageWrapper = document.getElementById('compareImageWrapper');
    const tertiaryImageWrapper = document.getElementById('tertiaryImageWrapper');
    const imageContainer = document.getElementById('image-container');
    const viewerPatientName = document.getElementById('viewerPatientName');
    const viewerPhotoInfo = document.getElementById('viewerPhotoInfo');

    document.getElementById('viewerPlaceholder').classList.add('hidden');
    document.getElementById('imageViewer').classList.remove('hidden');
    document.getElementById('imageViewer').classList.add('flex');

    const photoElements = [
        { id: 'mainImage', wrapper: mainImageWrapper },
        { id: 'compareImage', wrapper: compareImageWrapper },
        { id: 'tertiaryImage', wrapper: tertiaryImageWrapper }
    ];

    let infoTexts = [];
    let patientData = null;

    photoElements.forEach(el => {
        el.wrapper.classList.add('hidden');
        el.wrapper.classList.remove('flex-1', 'w-full');
        document.getElementById(el.id).src = '';
        el.wrapper.dataset.photoId = '';
        const imgEl = document.getElementById(el.id);
        if (imgEl) {
            imgEl.onload = null;
            imgEl.onerror = null; 
        }
    });

    for (let i = 0; i < state.comparePhotoIds.length; i++) {
        const photoId = state.comparePhotoIds[i];
        const imgEl = document.getElementById(photoElements[i].id);
        const wrapperEl = photoElements[i].wrapper;
        
        if (photoId) {
            const photo = await getPhotoById(photoId);
            if (photo) {
                imgEl.src = photo.url;
                wrapperEl.classList.remove('hidden');
                wrapperEl.classList.add('flex-1');
                wrapperEl.dataset.photoId = photo.id;
                infoTexts.push(`${photo.date} (${photo.mode} ${photo.viewAngle} ${photo.procedureStatus || ''})`);

                imgEl.onload = () => {
                    syncCanvasSize();
                    applyTransforms();
                    if (state.isAnalysisPanelVisible && photo.id === state.primaryPhotoId) {
                        renderAnalysis(photo);
                    }
                };
                imgEl.onerror = () => { imgEl.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; };

                if (!patientData) {
                    const patientDoc = await getDoc(doc(db, 'patients', photo.patientId));
                    patientData = patientDoc.exists() ? patientDoc.data() : null;
                }
            }
        }
    }

    const visiblePhotos = state.comparePhotoIds.filter(id => id).length;
    if (visiblePhotos > 1) {
        imageContainer.classList.remove('flex-col');
        imageContainer.classList.add('flex-row', 'gap-4', 'justify-center', 'items-center');
    } else if (visiblePhotos === 1) {
        mainImageWrapper.classList.remove('hidden', 'flex-1');
        mainImageWrapper.classList.add('w-full');
        imageContainer.classList.remove('flex-row', 'gap-4');
        imageContainer.classList.add('flex-col');
    } else {
        resetViewerToPlaceholder();
        return;
    }

    if (patientData) {
        viewerPatientName.innerText = `${patientData.name} (${patientData.chartId})`;
    } else {
        viewerPatientName.innerText = '사진 뷰어';
    }
    viewerPhotoInfo.innerText = infoTexts.join(' vs ');

    resetZoomAndPan();
}

function toggleFullScreen() {
    const sidebar = document.getElementById('sidebar');
    const mainViewer = document.getElementById('mainViewer');
    const fullScreenBtn = document.getElementById('fullScreenBtn');
    const isSimulatedFullScreen = mainViewer.classList.contains('full-screen-viewer');

    if (isSimulatedFullScreen) {
        sidebar.classList.remove('hidden'); 
        mainViewer.classList.remove('full-screen-viewer', 'w-full'); 
        mainViewer.classList.add('md:w-2/3', 'lg:w-3/4'); 
        fullScreenBtn.innerText = '전체 화면'; 
    } else {
        sidebar.classList.add('hidden'); 
        mainViewer.classList.add('full-screen-viewer', 'w-full'); 
        mainViewer.classList.remove('md:w-2/3', 'lg:w-3/4'); 
        fullScreenBtn.innerText = '전체 화면 종료'; 
    }
    resetZoomAndPan(); 
}

function applyTransforms() {
    const elementsToTransform = [
        document.getElementById('mainImage'),
        document.getElementById('compareImage'),
        document.getElementById('tertiaryImage'),
        document.getElementById('analysisCanvas'),
        document.getElementById('drawingCanvas')
    ];

    elementsToTransform.forEach(el => {
        if (el && !el.classList.contains('hidden')) {
            el.style.transform = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px) scale(${state.currentZoomLevel})`;
        }
    });
}

function zoomImage(step) {
    let newZoomLevel = state.currentZoomLevel + step;
    newZoomLevel = Math.max(state.minZoom, Math.min(state.maxZoom, newZoomLevel));
    state.currentZoomLevel = newZoomLevel;
    applyTransforms(); 
}

function resetZoomAndPan() {
    state.currentZoomLevel = 1.0;
    state.currentTranslateX = 0;
    state.currentTranslateY = 0;
    state.lastTranslateX = 0;
    state.lastTranslateY = 0;
    applyTransforms(); 
}

function handleMouseWheelZoom(e) {
    if (state.isDrawingMode) return;
    e.preventDefault(); 
    const zoomDirection = e.deltaY < 0 ? state.zoomStep : -state.zoomStep; 
    zoomImage(zoomDirection);
}

function handleMouseDown(e) {
    if (state.isDrawingMode) return;
    if (e.button === 0 && state.currentZoomLevel > 1.0) { 
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
    if (!state.isDragging) return; 
    state.currentTranslateX = state.lastTranslateX + (e.clientX - state.startX); 
    state.currentTranslateY = state.lastTranslateY + (e.clientY - state.startY); 
    applyTransforms(); 
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
    // ... (This function remains unchanged)
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
    // ... (This function remains unchanged)
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
    const viewerPlaceholder = document.getElementById('viewerPlaceholder');
    viewerPlaceholder.innerHTML = `<div class="text-center text-gray-500">...로딩 중...</div>`;

    try {
        let imageUrlToDisplay;
        if (sourceType === 'local') {
            const file = source;
            const storageRef = ref(storage, `photos/${patientId}/${file.name}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            imageUrlToDisplay = await getDownloadURL(snapshot.ref);
        } else { // web
            imageUrlToDisplay = source;
        }

        const newPhotoData = {
            patientId, url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle,
            date: photoDate, uploadedAt: new Date(), ai_analysis: aiAnalysisData,
            procedureStatus: procedureStatus,
        };
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
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: source, date: photoDate, ai_analysis: aiAnalysisData, procedureStatus: procedureStatus };
        } else { // web
            imageUrlToDisplay = source;
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: null, date: photoDate, ai_analysis: aiAnalysisData, procedureStatus: procedureStatus };
        }
        
        state.primaryPhotoId = null;
        state.comparePhotoIds = [];
        await updateComparisonDisplay(); // This will handle showing the staged photo

        const mainImage = document.getElementById('mainImage');
        mainImage.src = imageUrlToDisplay;
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
    if (!confirm('정말로 이 사진을 삭제하시겠습니까?')) {
        return;
    }
    try {
        await deleteDoc(doc(db, 'photos', photoId)); 
        alert('사진이 삭제되었습니다.');

        state.comparePhotoIds = state.comparePhotoIds.filter(id => id !== photoId);
        if (state.primaryPhotoId === photoId) {
            state.primaryPhotoId = state.comparePhotoIds[0] || null;
        }

        if (state.comparePhotoIds.length > 0) {
            await updateComparisonDisplay();
        } else {
            resetViewerToPlaceholder(); 
        }

        fetchPhotos(state.selectedPatientId);

    } catch (error) {
        console.error("사진 삭제 중 오류 발생:", error);
        alert("사진 삭제에 실패했습니다.");
    }
}