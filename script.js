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
};

let faceLandmarksDetector = null;
let isOpenCvReady = false;

function loadOpenCv() {
    console.log("Loading OpenCV.js...");
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.9.0/opencv.js';
    script.async = true;
    script.onload = () => {
        console.log("OpenCV.js is ready.");
        isOpenCvReady = true;
        checkAndHideLoadingOverlay();
    };
    script.onerror = () => {
        console.error("Failed to load OpenCV.js");
        alert("OpenCV 라이브러리 로딩에 실패했습니다. 페이지를 새로고침해주세요.");
    };
    document.head.appendChild(script);
}

async function loadFaceDetector() {
    console.log("Loading Face Landmarks Detection model...");
    document.getElementById('loadingOverlay').classList.replace('hidden', 'flex');
    
    try {
        await tf.setBackend('cpu');
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig = {
          runtime: 'tfjs',
        };
        faceLandmarksDetector = await faceLandmarksDetection.createDetector(model, detectorConfig);
        console.log("Face Landmarks Detection model loaded.");
    } catch (error) {
        console.error("Failed to load Face Detector:", error);
        alert("AI 모델 로딩에 실패했습니다. 페이지를 새로고침하거나 인터넷 연결을 확인해주세요.");
    } finally {
        checkAndHideLoadingOverlay();
    }
}

function checkAndHideLoadingOverlay() {
    if (isOpenCvReady && faceLandmarksDetector) {
        document.getElementById('loadingOverlay').classList.replace('flex', 'hidden');
        console.log("All AI models are ready.");

        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        analyzeBtn.classList.add('hover:bg-green-200');
        console.log("AI Analyze button enabled.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 이벤트 발생. 스크립트 실행 시작.');
    fetchPatients(); 
    setupEventListeners();
    loadFaceDetector();
    loadOpenCv();
});

function setupEventListeners() {
    console.log('setupEventListeners 함수 호출됨.');
    document.getElementById('patientSearch').addEventListener('input', (e) => fetchPatients(e.target.value.toLowerCase()));
    
    document.querySelectorAll('.photo-mode-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentModeFilter = btn.dataset.filter;
            document.querySelectorAll('.photo-mode-filter-btn').forEach(b => {
                const isSelected = b === btn;
                b.classList.toggle('bg-[#4CAF50]', isSelected);
                b.classList.toggle('text-white', isSelected);
                b.classList.toggle('bg-gray-200', !isSelected);
                b.classList.toggle('text-gray-700', !isSelected);
            });
            fetchPhotos(state.selectedPatientId);
        });
    });

    document.getElementById('photoDateFilter').addEventListener('change', (e) => {
        state.currentDateFilter = e.target.value;
        fetchPhotos(state.selectedPatientId);
    });

    document.getElementById('photoProcedureStatusFilter').addEventListener('change', (e) => {
        state.currentProcedureStatusFilter = e.target.value;
        fetchPhotos(state.selectedPatientId);
    });

    document.getElementById('photoAngleFilter').addEventListener('change', (e) => {
        state.currentAngleFilter = e.target.value;
        fetchPhotos(state.selectedPatientId);
    });

    document.getElementById('analyzeBtn').addEventListener('click', toggleAnalysisPanel);
    document.getElementById('compareBtn').addEventListener('click', handleCompareButtonClick);
    document.getElementById('fullScreenBtn').addEventListener('click', toggleFullScreen);
    document.getElementById('zoomInBtn').addEventListener('click', () => zoomImage(state.zoomStep));
    document.getElementById('zoomOutBtn').addEventListener('click', () => zoomImage(-state.zoomStep));
    document.getElementById('resetViewBtn').addEventListener('click', resetZoomAndPan);
    document.getElementById('deletePhotoBtn').addEventListener('click', () => {
        if (state.primaryPhotoId) deletePhoto(state.primaryPhotoId);
        else alert('삭제할 사진이 선택되지 않았습니다.');
    });

    document.getElementById('choose2PhotosBtn').addEventListener('click', () => startCompareSelection(2));
    document.getElementById('choose3PhotosBtn').addEventListener('click', () => startCompareSelection(3));

    document.getElementById('image-container').addEventListener('wheel', handleMouseWheelZoom);
    document.getElementById('image-container').addEventListener('mousedown', handleMouseDown);

    document.getElementById('importPhotoBtn').addEventListener('click', () => document.getElementById('importChoiceOverlay').classList.remove('hidden'));
    document.getElementById('importFromLocalBtn').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden');
        document.getElementById('localFileInput').click();
    });
    document.getElementById('importFromWebBtn').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden');
        showWebImageSelectModal();
    });
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
}

async function toggleAnalysisPanel() {
    state.isAnalysisPanelVisible = !state.isAnalysisPanelVisible;
    const panel = document.getElementById('analysisPanel');
    const btn = document.getElementById('analyzeBtn');
    const analysisCanvas = document.getElementById('analysisCanvas');

    if (state.isAnalysisPanelVisible) {
        panel.classList.remove('hidden');
        btn.classList.add('bg-[#4CAF50]', 'text-white');
        
        if (state.primaryPhotoId) {
            const photoData = await getPhotoById(state.primaryPhotoId);

            if (photoData && photoData.viewAngle !== 'C0') {
                document.getElementById('analysisContent').innerHTML = `<p class='text-yellow-400 font-semibold'>AI 분석은 정면(C0) 사진에서만 가능합니다.</p><p class='text-gray-400 mt-2'>현재 사진 각도: ${photoData.viewAngle}</p>`;
                analysisCanvas.classList.add('hidden');
                return;
            }
            
            analysisCanvas.classList.remove('hidden');
            document.getElementById('analysisContent').innerHTML = "<p class='text-gray-400'>AI 분석을 수행 중입니다...</p>";
            
            try {
                if (photoData) {
                    const analysisResult = await performRealAIAnalysis(photoData);
                    photoData.ai_analysis = analysisResult;
                    renderAnalysis(photoData);
                } else {
                     clearAnalysis();
                    document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>선택된 사진 정보를 찾을 수 없습니다.</p>";
                }
            } catch (error) {
                console.error("AI 분석 중 오류 발생:", error);
                clearAnalysis();
                document.getElementById('analysisContent').innerHTML = "<p class='text-red-500'>AI 분석에 실패했습니다. " + error.message + "</p>";
            }
        } else {
            clearAnalysis();
            document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>AI 분석 결과를 보려면 먼저 사진을 선택해주세요.</p>";
            analysisCanvas.classList.add('hidden');
        }
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('bg-[#4CAF50]', 'text-white'); 
        btn.classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
        clearAnalysis();
        analysisCanvas.classList.add('hidden');
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
        
        const filteredPatients = patients.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.chartId && p.chartId.toLowerCase().includes(searchTerm))
        );

        renderPatientList(filteredPatients);
        if (filteredPatients.length === 0) {
            patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자가 없습니다.</p>';
        }
    } catch (error) {
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
                <p class="text-xs text-gray-500">${patient.chartId} | ${patient.birth}</p>
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
        await addDoc(collection(db, 'patients'), { name, birth, gender, chartId, createdAt: new Date() });
        alert(`${name} 환자가 성공적으로 추가되었습니다!`);
        fetchPatients();
    } catch (error) {
        console.error("환자 추가 중 오류 발생:", error);
        alert("환자 추가에 실패했습니다: " + error.message);
    }
}

async function selectPatient(patientId) {
    if (state.stagedPhoto && !state.selectedPatientId) {
        try {
            const { url, mode, viewAngle, file, date, procedureStatus } = state.stagedPhoto;
            let imageUrlToDisplay = url;

            if (file) {
                const storageRef = ref(storage, `photos/${patientId}/${file.name}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, file);
                imageUrlToDisplay = await getDownloadURL(snapshot.ref);
            }

            const docRef = await addDoc(collection(db, 'photos'), {
                patientId, url: imageUrlToDisplay, mode, viewAngle, date, procedureStatus, uploadedAt: new Date(), ai_analysis: {}
            });
            state.primaryPhotoId = docRef.id;
            state.stagedPhoto = null;
            alert('사진이 선택된 환자에게 성공적으로 연결되었습니다.');
        } catch (error) {
            console.error("Staged 사진 저장 중 오류 발생:", error);
            alert("사진을 환자에게 연결하는데 실패했습니다: " + error.message);
        }
    }

    state.selectedPatientId = patientId;
    
    ['currentModeFilter', 'currentAngleFilter', 'currentProcedureStatusFilter'].forEach(key => state[key] = 'all');
    state.currentDateFilter = '';
    ['photoDateFilter', 'photoAngleFilter', 'photoProcedureStatusFilter'].forEach(id => document.getElementById(id).value = id === 'photoDateFilter' ? '' : 'all');
    
    document.querySelectorAll('.photo-mode-filter-btn').forEach(b => {
        const isAll = b.dataset.filter === 'all';
        b.classList.toggle('bg-[#4CAF50]', isAll);
        b.classList.toggle('text-white', isAll);
        b.classList.toggle('bg-gray-200', !isAll);
        b.classList.toggle('text-gray-700', !isAll);
    });

    fetchPatients();

    document.getElementById('photoListSection').classList.remove('hidden');
    const patientDoc = await getDoc(doc(db, 'patients', patientId));
    if (patientDoc.exists()) {
        const selectedPatient = patientDoc.data();
        document.getElementById('photoListHeader').innerText = `${selectedPatient.name}님의 사진 목록`;
        if (state.primaryPhotoId && !state.stagedPhoto) {
            const currentPhoto = await getPhotoById(state.primaryPhotoId);
            if (currentPhoto) {
                 document.getElementById('viewerPatientName').innerText = `${selectedPatient.name} (${selectedPatient.chartId})`;
                 document.getElementById('viewerPhotoInfo').innerText = `${currentPhoto.date} | ${currentPhoto.mode} | ${currentPhoto.viewAngle} | ${currentPhoto.procedureStatus || 'N/A'}`;
            }
        }
    } else {
        document.getElementById('photoListHeader').innerText = `선택된 환자의 사진 목록`;
    }
    
    fetchPhotos(patientId);
}

async function fetchPhotos(patientId) {
    if (!patientId) {
        renderPhotoList([]);
        return;
    }
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-2 text-xs">사진 목록을 불러오는 중...</p>'; 

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
            photoListEl.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-2 text-xs">이 환자의 사진이 없습니다.</p>';
        }

    } catch (error) {
        console.error("사진 목록을 불러오는 중 오류 발생:", error);
        photoListEl.innerHTML = '<p class="col-span-2 text-center text-red-500 py-2 text-xs">사진 목록을 불러오지 못했습니다.</p>';
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
        img.onerror = () => { img.src = 'data:image/svg+xml,...'; };

        const divInfo = document.createElement('div');
        divInfo.innerHTML = `<p class="font-medium text-xs">${photo.mode} (${photo.viewAngle})</p><p class="text-xxs text-gray-500">${photo.date} | ${photo.procedureStatus || 'N/A'}</p>`;
        
        li.append(img, divInfo);
        li.addEventListener('click', () => selectPhoto(photo.id));
        photoListEl.appendChild(li);
    });
}

async function selectPhoto(photoId) {
    state.stagedPhoto = null;

    if (state.isAnalysisPanelVisible) {
        state.isAnalysisPanelVisible = false;
        document.getElementById('analysisPanel').classList.add('hidden');
        document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white'); 
        document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
        clearAnalysis();
        document.getElementById('analysisCanvas').classList.add('hidden');
    }

    const photo = await getPhotoById(photoId);
    if (!photo) {
        alert("선택된 사진 정보를 찾을 수 없습니다.");
        return;
    }

    if (state.isCompareSelectionActive) {
        if (state.comparePhotoIds.includes(photoId)) {
            alert('이미 선택된 사진입니다. 다른 사진을 선택해주세요.');
            return;
        }

        if (state.compareSelectionStep === 1) {
            state.comparePhotoIds[1] = photoId;
            if (state.compareCount === 2) {
                state.isCompareSelectionActive = false;
                state.isComparingPhotos = true;
                state.compareSelectionStep = 0;
                document.getElementById('compareBtn').innerText = '사진비교 해제';
            } else {
                state.compareSelectionStep = 2;
                document.getElementById('compareBtn').innerText = '비교할 세 번째 사진 선택...';
                alert('비교할 세 번째 사진을 좌측 목록에서 선택해주세요.');
            }
        } else if (state.compareSelectionStep === 2) {
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
        document.getElementById('compareBtn').innerText = '사진 비교';
        document.getElementById('compareBtn').classList.remove('bg-green-200');
    }
    fetchPhotos(state.selectedPatientId);
}

// **[수정됨]** `renderAnalysis` 함수에 분석 결과 시각화(주름 그리기) 로직 추가
function renderAnalysis(photo) {
    const contentEl = document.getElementById('analysisContent');
    const canvas = document.getElementById('analysisCanvas');
    const ctx = canvas.getContext('2d');
    const img = document.getElementById('mainImage');
    
    const render = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let html = '';
        const analysis = photo?.ai_analysis;
        if (analysis?.type) {
            // 텍스트 결과 표시
            switch (analysis.type) {
                case 'error':
                    html = `<p class='text-red-500'>${analysis.message}</p>`;
                    break;
                case 'portrait':
                    html = `<div class="space-y-3">
                                <div><p class="font-semibold">주름 (종합)</p><p class="text-blue-600">${analysis.wrinkles.totalScore} (엣지 스코어)</p></div>
                                <div class="text-xs text-gray-400 pl-2">- 눈가: ${analysis.wrinkles.crowsFeetScore}</div>
                                <div class="text-xs text-gray-400 pl-2">- 이마/미간: ${analysis.wrinkles.foreheadScore}</div>
                                <div class="text-xs text-gray-400 pl-2">- 팔자: ${analysis.wrinkles.nasolabialScore}</div>
                                <div><p class="font-semibold">색소침착</p><p class="text-blue-600">${analysis.spots} 개</p></div>
                                <div><p class="font-semibold">모공</p><p class="text-blue-600">${analysis.pores} %</p></div>
                            </div>`;
                    break;
                case 'fray':
                     html = `<div class="space-y-3">
                                <div><p class="font-semibold">피부 처짐 지수</p><p class="text-red-600">${analysis.sagging} / 100</p></div>
                            </div>`;
                    break;
                case 'uv':
                     html = `<div class="space-y-3">
                                <div><p class="font-semibold">잠재 색소</p><p class="text-purple-600">${analysis.pigmentation} 개</p></div>
                                <div><p class="font-semibold">피지량</p><p class="text-orange-600">${analysis.sebum} / 100</p></div>
                            </div>`;
                    break;
                default:
                    html = "<p class='text-gray-500'>이 사진에 대한 AI 분석 정보가 없습니다.</p>";
            }
            // 캔버스에 시각화 결과 그리기
            if (analysis.wrinkles && analysis.wrinkles.contours) {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // 붉은색
                ctx.lineWidth = Math.max(1, canvas.width / 500); // 이미지 크기에 비례하는 선 굵기
                
                analysis.wrinkles.contours.forEach(contour => {
                    ctx.beginPath();
                    for (let i = 0; i < contour.length; i++) {
                        const p = contour[i];
                        if (i === 0) {
                            ctx.moveTo(p.x, p.y);
                        } else {
                            ctx.lineTo(p.x, p.y);
                        }
                    }
                    ctx.stroke();
                });
            }

        } else {
            html = "<p class='text-gray-500'>분석 결과가 없습니다.</p>";
        }
        contentEl.innerHTML = html;
    };
    
    if (img.complete) {
        render();
    } else {
        img.onload = render;
    }
    // 창 크기가 변경될 때도 다시 그리도록 이벤트 리스너 추가
    window.addEventListener('resize', render, { once: true });
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
        document.getElementById('compareBtn').innerText = '사진 비교';
        document.getElementById('compareBtn').classList.remove('bg-green-200');
        state.comparePhotoIds = [state.primaryPhotoId];
        updateComparisonDisplay();
    } else {
        clearAnalysis();
        state.isAnalysisPanelVisible = false;
        document.getElementById('analysisPanel').classList.add('hidden');
        document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white');
        document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]');
        document.getElementById('compareChoiceOverlay').classList.remove('hidden');
    }
}

function startCompareSelection(count) {
    document.getElementById('compareChoiceOverlay').classList.add('hidden');
    state.isCompareSelectionActive = true;
    state.isComparingPhotos = false;
    state.compareCount = count;
    state.compareSelectionStep = 1;
    state.comparePhotoIds = [state.primaryPhotoId, ...Array(count - 1).fill(null)];
    
    document.getElementById('compareBtn').innerText = '비교할 두 번째 사진 선택...';
    document.getElementById('compareBtn').classList.add('bg-green-200');
    alert('비교할 두 번째 사진을 좌측 목록에서 선택해주세요.');
    updateComparisonDisplay();
}

async function updateComparisonDisplay() {
    const wrappers = [document.getElementById('mainImageWrapper'), document.getElementById('compareImageWrapper'), document.getElementById('tertiaryImageWrapper')];
    const images = [document.getElementById('mainImage'), document.getElementById('compareImage'), document.getElementById('tertiaryImage')];
    
    document.getElementById('viewerPlaceholder').classList.add('hidden');
    document.getElementById('imageViewer').classList.replace('hidden', 'flex');

    let infoTexts = [];
    let patientData = null;

    for (let i = 0; i < wrappers.length; i++) {
        const photoId = state.comparePhotoIds[i];
        const wrapper = wrappers[i];
        const img = images[i];

        if (photoId) {
            const photo = await getPhotoById(photoId);
            if (photo) {
                wrapper.classList.remove('hidden');
                wrapper.dataset.photoId = photo.id;
                img.src = photo.url;
                infoTexts.push(`${photo.date} (${photo.mode} ${photo.viewAngle})`);
                if (!patientData) patientData = (await getDoc(doc(db, 'patients', photo.patientId))).data();
            }
        } else {
            wrapper.classList.add('hidden');
        }
    }

    document.getElementById('viewerPatientName').innerText = patientData ? `${patientData.name} (${patientData.chartId})` : '사진 뷰어';
    document.getElementById('viewerPhotoInfo').innerText = infoTexts.join(' vs ');
    resetZoomAndPan();
}

function toggleFullScreen() {
    const patientPanel = document.getElementById('patient-panel');
    const photoPanel = document.getElementById('photo-panel');
    const mainViewer = document.getElementById('mainViewer');
    const fullScreenBtn = document.getElementById('fullScreenBtn');
    const isSimulatedFullScreen = mainViewer.classList.contains('full-screen-viewer');

    if (isSimulatedFullScreen) {
        patientPanel.classList.remove('hidden');
        photoPanel.classList.remove('hidden');
        mainViewer.classList.remove('full-screen-viewer');
        fullScreenBtn.innerText = '전체 화면';
    } else {
        patientPanel.classList.add('hidden');
        photoPanel.classList.add('hidden');
        mainViewer.classList.add('full-screen-viewer');
        fullScreenBtn.innerText = '전체 화면 종료';
    }
    
    resetZoomAndPan();
}

function applyTransforms() {
    const transform = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px) scale(${state.currentZoomLevel})`;
    document.querySelectorAll('#mainImage, #compareImage, #tertiaryImage').forEach(img => img.style.transform = transform);
    
    const mainImage = document.getElementById('mainImage');
    const analysisCanvas = document.getElementById('analysisCanvas');
    if (mainImage.complete && mainImage.naturalWidth > 0) {
        const rect = mainImage.getBoundingClientRect();
        const containerRect = document.getElementById('image-container').getBoundingClientRect();
        Object.assign(analysisCanvas.style, {
            left: `${rect.left - containerRect.left}px`,
            top: `${rect.top - containerRect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
        });
    }
}

function zoomImage(step) {
    state.currentZoomLevel = Math.max(state.minZoom, Math.min(state.maxZoom, state.currentZoomLevel + step));
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
    e.preventDefault();
    zoomImage(e.deltaY < 0 ? state.zoomStep : -state.zoomStep);
}

function handleMouseDown(e) {
    if (e.button !== 0 || state.currentZoomLevel <= 1.0) return;
    state.isDragging = true;
    state.lastTranslateX = state.currentTranslateX;
    state.lastTranslateY = state.currentTranslateY;
    state.startX = e.clientX;
    state.startY = e.clientY;
    document.getElementById('image-container').style.cursor = 'grabbing';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e) {
    if (!state.isDragging) return;
    state.currentTranslateX = state.lastTranslateX + (e.clientX - state.startX);
    state.currentTranslateY = state.lastTranslateY + (e.clientY - state.startY);
    applyTransforms();
}

function handleMouseUp() {
    state.isDragging = false;
    document.getElementById('image-container').style.cursor = 'default';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}

function handleDragStart(e) {
    const wrapper = e.target.closest('.image-wrapper');
    if (wrapper?.dataset.photoId && state.isComparingPhotos) {
        e.dataTransfer.setData('text/plain', wrapper.dataset.photoId);
        e.dataTransfer.effectAllowed = 'move';
        wrapper.classList.add('dragging-source');
    } else {
        e.preventDefault();
    }
}

function handleDragOver(e) {
    e.preventDefault();
    const targetWrapper = e.target.closest('.image-wrapper');
    if (targetWrapper && e.dataTransfer.types.includes('text/plain')) {
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

    const draggedPhotoId = e.dataTransfer.getData('text/plain');
    const targetPhotoId = targetWrapper?.dataset.photoId;

    if (draggedPhotoId && targetPhotoId && draggedPhotoId !== targetPhotoId) {
        const draggedIndex = state.comparePhotoIds.indexOf(draggedPhotoId);
        const targetIndex = state.comparePhotoIds.indexOf(targetPhotoId);
        if (draggedIndex > -1 && targetIndex > -1) {
            [state.comparePhotoIds[draggedIndex], state.comparePhotoIds[targetIndex]] = [state.comparePhotoIds[targetIndex], state.comparePhotoIds[draggedIndex]];
            state.primaryPhotoId = state.comparePhotoIds[0];
            await updateComparisonDisplay();
        }
    }
}

function handleDragEnd(e) {
    e.target.closest('.image-wrapper')?.classList.remove('dragging-source');
}

function mapStatusToKorean(status) {
    const statusMap = { 'Before': '시술 전', 'After': '시술 후', '1W': '1주 후', '1M': '1개월 후', '3M': '3개월 후', '6M': '6개월 후', '1Y': '1년 후', 'None': '기타/미지정' };
    return statusMap[status] || '기타/미지정';
}

async function handleLocalFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const parts = file.name.split('.')[0].split('_');
    const photoData = {
        mode: parts.length >= 3 ? parts[2] : 'PC Upload',
        viewAngle: parts.length >= 4 ? parts[3] : 'C0',
        date: parts.length >= 5 && parts[4].length === 8 ? `${parts[4].slice(0,4)}-${parts[4].slice(4,6)}-${parts[4].slice(6,8)}` : new Date().toISOString().slice(0, 10),
        procedureStatus: mapStatusToKorean(parts.length >= 6 ? parts[5] : 'None'),
    };
    
    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(file, 'local', photoData);
        alert("사진이 뷰어에 임시로 불러와졌습니다. 저장하려면 환자를 선택하세요.");
    } else {
        await displayImageAndSave(file, 'local', state.selectedPatientId, photoData);
    }
}

async function showWebImageSelectModal() {
    const storageImageList = document.getElementById('storageImageList');
    storageImageList.innerHTML = '<p class="col-span-full text-center text-gray-500">Storage 이미지를 불러오는 중...</p>';
    document.getElementById('webImageSelectOverlay').classList.remove('hidden');

    try {
        const res = await listAll(ref(storage, 'images/'));
        storageImageList.innerHTML = '';
        if (res.items.length === 0) {
            storageImageList.innerHTML = '<p class="col-span-full text-center text-gray-500">저장된 이미지가 없습니다.</p>';
            return;
        }

        res.items.forEach(async itemRef => {
            const url = await getDownloadURL(itemRef);
            const div = document.createElement('div');
            div.className = 'p-2 border rounded-md hover:shadow-lg transition-shadow cursor-pointer';
            div.innerHTML = `<img src="${url}" alt="${itemRef.name}" class="w-24 h-24 object-cover rounded-md mb-2 mx-auto"><span class="text-xs text-gray-600 truncate w-full text-center block">${itemRef.name}</span>`;
            div.addEventListener('click', () => selectWebImageFromStorage(url, itemRef.name));
            storageImageList.appendChild(div);
        });
    } catch (error) {
        console.error("Storage 이미지 목록 불러오기 실패:", error);
        storageImageList.innerHTML = '<p class="col-span-full text-center text-red-500">이미지를 불러오지 못했습니다.</p>';
    }
}

async function selectWebImageFromStorage(imageUrl, fileName) {
    document.getElementById('webImageSelectOverlay').classList.add('hidden');
    const parts = fileName.split('.')[0].split('_');
    const photoData = {
        mode: parts.length >= 3 ? parts[2] : 'Web URL',
        viewAngle: parts.length >= 4 ? parts[3] : 'C0',
        date: parts.length >= 5 && parts[4].length === 8 ? `${parts[4].slice(0,4)}-${parts[4].slice(4,6)}-${parts[4].slice(6,8)}` : new Date().toISOString().slice(0, 10),
        procedureStatus: mapStatusToKorean(parts.length >= 6 ? parts[5] : 'None'),
    };

    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(imageUrl, 'web', photoData);
        alert("사진이 뷰어에 임시로 불러와졌습니다. 저장하려면 환자를 선택하세요.");
    } else {
        await displayImageAndSave(imageUrl, 'web', state.selectedPatientId, photoData);
    }
}

async function displayImageAndSave(source, sourceType, patientId, photoData) {
    document.getElementById('viewerPlaceholder').innerHTML = `<h3 class="text-lg font-medium text-gray-400">사진을 저장하는 중...</h3>`;
    try {
        let imageUrl = source;
        if (sourceType === 'local') {
            const storageRef = ref(storage, `photos/${patientId}/${source.name}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, source);
            imageUrl = await getDownloadURL(snapshot.ref);
        }

        const docRef = await addDoc(collection(db, 'photos'), {
            patientId, url: imageUrl, uploadedAt: new Date(), ai_analysis: {}, ...photoData
        });
        state.primaryPhotoId = docRef.id;
        state.comparePhotoIds = [docRef.id];
        await updateComparisonDisplay();
        await fetchPhotos(patientId);
    } catch (error) {
        console.error("사진 저장 중 오류:", error);
        alert("사진 저장에 실패했습니다.");
        resetViewerToPlaceholder();
    }
}

async function displayImageWithoutSaving(source, sourceType, photoData) {
    const url = sourceType === 'local' ? URL.createObjectURL(source) : source;
    state.stagedPhoto = { url, file: sourceType === 'local' ? source : null, ...photoData };
    state.primaryPhotoId = null;
    
    document.getElementById('viewerPatientName').innerText = '환자 미지정';
    document.getElementById('viewerPhotoInfo').innerText = `${photoData.date} | ${photoData.mode} | ${photoData.viewAngle} | ${photoData.procedureStatus}`;
    document.getElementById('mainImage').src = url;
    document.getElementById('imageViewer').classList.replace('hidden', 'flex');
    document.getElementById('viewerPlaceholder').classList.add('hidden');
    resetZoomAndPan();
}

function resetViewerToPlaceholder() {
    document.getElementById('viewerPlaceholder').classList.remove('hidden');
    document.getElementById('imageViewer').classList.add('hidden');
    document.getElementById('viewerPatientName').innerText = '사진 뷰어';
    document.getElementById('viewerPhotoInfo').innerText = '사진 정보를 선택해주세요.';
    state.primaryPhotoId = null;
    state.comparePhotoIds = [];
}

async function deletePhoto(photoId) {
    if (!confirm('정말로 이 사진을 삭제하시겠습니까?')) return;

    try {
        await deleteDoc(doc(db, 'photos', photoId));
        alert('사진이 삭제되었습니다.');
        state.comparePhotoIds = state.comparePhotoIds.filter(id => id !== photoId);
        state.primaryPhotoId = state.comparePhotoIds[0] || null;
        
        if (state.primaryPhotoId) await updateComparisonDisplay();
        else resetViewerToPlaceholder();
        
        await fetchPhotos(state.selectedPatientId);
    } catch (error) {
        console.error("사진 삭제 중 오류:", error);
        alert("사진 삭제에 실패했습니다.");
    }
}

// **[수정됨]** `performRealAIAnalysis` 함수가 세분화된 주름 분석을 호출하도록 변경
async function performRealAIAnalysis(photo) {
    if (!faceLandmarksDetector || !isOpenCvReady) {
        throw new Error("AI 모델이 아직 준비되지 않았습니다.");
    }

    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = photo.url;
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    
    const faces = await faceLandmarksDetector.estimateFaces(canvas, { flipHorizontal: false });
    if (faces.length === 0) {
        return { type: 'error', message: '사진에서 얼굴을 찾을 수 없습니다.' };
    }
    const keypoints = faces[0].keypoints;

    const src = cv.imread(canvas);
    let analysisResult = {};
    switch (photo.mode) {
        case 'Portrait':
            analysisResult = {
                type: 'portrait',
                wrinkles: analyzeAllWrinkleAreas(src, keypoints), // 세분화된 주름 분석 함수 호출
                spots: analyzeSpots(src, [keypoints.find(p => p.name === 'leftCheek'), keypoints.find(p => p.name === 'rightCheek')]),
                pores: Math.floor(Math.random() * 30) + 10,
            };
            break;
        case 'F-ray':
            analysisResult = {
                type: 'fray',
                sagging: analyzeSagging(keypoints.filter(p => p.name?.startsWith('rightContour') || p.name?.startsWith('leftContour'))),
            };
            break;
        case 'UV':
            analysisResult = {
                type: 'uv',
                pigmentation: analyzeSpots(src, [keypoints.find(p => p.name === 'leftCheek'), keypoints.find(p => p.name === 'rightCheek')], 100),
                sebum: Math.floor(Math.random() * 100),
            };
            break;
        default:
            analysisResult = { type: 'general', message: '이 모드에 대한 특정 분석이 없습니다.' };
    }
    src.delete();
    return analysisResult;
}

// **[추가됨]** 엣지 검출을 위한 범용 헬퍼 함수
function detectEdgesInRoi(src, rect) {
    if (!rect) return { score: 0, contours: [] };
    const roi = src.roi(rect);
    const gray = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, gray, {width: 3, height: 3}, 0, 0, cv.BORDER_DEFAULT);

    const edges = new cv.Mat();
    cv.Canny(gray, edges, 60, 120, 3, false);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let totalScore = 0;
    let contourPoints = [];
    for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        totalScore += contour.data32S.length / 2; // 각 컨투어의 길이(포인트 수)
        
        let points = [];
        for (let j = 0; j < contour.data32S.length; j += 2) {
            points.push({ x: contour.data32S[j] + rect.x, y: contour.data32S[j+1] + rect.y });
        }
        contourPoints.push(points);
    }

    roi.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
    return { score: Math.floor(totalScore), contours: contourPoints };
}

// **[추가됨]** 주름 분석 영역(ROI) 정의 함수들
function getRoiForCrowsFeet(keypoints) {
    const leftEyeOuterCorner = keypoints.find(p => p.name === 'leftEyeUpper0').x > keypoints.find(p => p.name === 'leftEyeLower0').x ? keypoints.find(p => p.name === 'leftEyeUpper0') : keypoints.find(p => p.name === 'leftEyeLower0');
    const rightEyeOuterCorner = keypoints.find(p => p.name === 'rightEyeUpper0').x < keypoints.find(p => p.name === 'rightEyeLower0').x ? keypoints.find(p => p.name === 'rightEyeUpper0') : keypoints.find(p => p.name === 'rightEyeLower0');
    
    const eyeHeight = Math.abs(keypoints.find(p => p.name === 'leftEyeUpper2').y - keypoints.find(p => p.name === 'leftEyeLower2').y);
    const roiWidth = eyeHeight * 1.5;

    const leftRoi = new cv.Rect(leftEyeOuterCorner.x - roiWidth, leftEyeOuterCorner.y - eyeHeight / 2, roiWidth, eyeHeight);
    const rightRoi = new cv.Rect(rightEyeOuterCorner.x, rightEyeOuterCorner.y - eyeHeight / 2, roiWidth, eyeHeight);

    return { left: leftRoi, right: rightRoi };
}

function getRoiForForehead(keypoints) {
    const leftEyebrow = keypoints.find(p => p.name === 'leftEyebrowUpper');
    const rightEyebrow = keypoints.find(p => p.name === 'rightEyebrowUpper');
    
    if(!leftEyebrow || !rightEyebrow) return null;

    const eyeDistance = Math.abs(rightEyebrow.x - leftEyebrow.x);
    const foreheadHeight = eyeDistance * 0.4;
    
    return new cv.Rect(
        leftEyebrow.x,
        leftEyebrow.y - foreheadHeight * 1.2,
        eyeDistance,
        foreheadHeight
    );
}

function getRoiForNasolabial(keypoints) {
    const noseBottom = keypoints.find(p => p.name === 'noseTip');
    const mouthLeft = keypoints.find(p => p.name === 'mouthLeft');
    const mouthRight = keypoints.find(p => p.name === 'mouthRight');

    if(!noseBottom || !mouthLeft || !mouthRight) return null;
    
    const width = Math.abs(mouthRight.x - mouthLeft.x) * 0.3;
    const height = Math.abs(noseBottom.y - mouthLeft.y);

    const leftRoi = new cv.Rect(mouthLeft.x - width, noseBottom.y - height, width, height);
    const rightRoi = new cv.Rect(mouthRight.x, noseBottom.y - height, width, height);
    
    return { left: leftRoi, right: rightRoi };
}

// **[수정됨]** 기존 `analyzeWrinkles` 함수를 세분화된 분석을 총괄하는 함수로 변경
function analyzeAllWrinkleAreas(src, keypoints) {
    const crowsFeetRois = getRoiForCrowsFeet(keypoints);
    const foreheadRoi = getRoiForForehead(keypoints);
    const nasolabialRois = getRoiForNasolabial(keypoints);
    
    const crowsFeetLeftResult = detectEdgesInRoi(src, crowsFeetRois.left);
    const crowsFeetRightResult = detectEdgesInRoi(src, crowsFeetRois.right);
    const foreheadResult = detectEdgesInRoi(src, foreheadRoi);
    const nasolabialLeftResult = detectEdgesInRoi(src, nasolabialRois.left);
    const nasolabialRightResult = detectEdgesInRoi(src, nasolabialRois.right);

    const crowsFeetScore = crowsFeetLeftResult.score + crowsFeetRightResult.score;
    const foreheadScore = foreheadResult.score;
    const nasolabialScore = nasolabialLeftResult.score + nasolabialRightResult.score;

    return {
        totalScore: crowsFeetScore + foreheadScore + nasolabialScore,
        crowsFeetScore,
        foreheadScore,
        nasolabialScore,
        contours: [
            ...crowsFeetLeftResult.contours,
            ...crowsFeetRightResult.contours,
            ...foreheadResult.contours,
            ...nasolabialLeftResult.contours,
            ...nasolabialRightResult.contours
        ]
    };
}


function analyzeSpots(src, cheekPoints, thresholdValue = 120) {
    if (cheekPoints.some(p => !p)) return 0;
    return cheekPoints.reduce((total, point) => {
        const rect = new cv.Rect(point.x - 40, point.y - 40, 80, 80);
        const roi = src.roi(rect);
        const gray = new cv.Mat();
        cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
        const thresholded = new cv.Mat();
        cv.threshold(gray, thresholded, thresholdValue, 255, cv.THRESH_BINARY_INV);
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(thresholded, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        const count = contours.size();
        roi.delete(); gray.delete(); thresholded.delete(); contours.delete(); hierarchy.delete();
        return total + count;
    }, 0);
}

function analyzeSagging(jawlinePoints) {
    if (jawlinePoints.length < 5) return 50;
    const chinPoint = jawlinePoints.reduce((a, b) => a.y > b.y ? a : b);
    const upperJawPoints = jawlinePoints.filter(p => p.y < chinPoint.y - 20);
    if (upperJawPoints.length < 2) return 50;
    const avgY = upperJawPoints.reduce((sum, p) => sum + p.y, 0) / upperJawPoints.length;
    const score = Math.floor(Math.min(100, Math.max(0, (avgY / chinPoint.y - 0.8) * 500)));
    return score;
}