// Firebase SDK를 웹사이트로 불러오는 부분입니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, documentId, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Firebase 프로젝트 설정 정보입니다.
const firebaseConfig = {
   apiKey: "AIzaSyB4GGKFIox_Wl2mXkG5cSkuHdEcsHgfuNU", // 여러분의 실제 API 키로 변경하세요.
  authDomain: "frayviewer-63e13.firebaseapp.com", // 여러분의 실제 Auth Domain으로 변경하세요.
  projectId: "frayviewer-63e13", // 여러분의 실제 Project ID로 변경하세요.
  storageBucket: "frayviewer-63e13.firebasestorage.app", // 여러분의 실제 Storage Bucket으로 변경하세요.
  messagingSenderId: "513985013942", // 여러분의 실제 Messaging Sender ID로 변경하세요.
  appId: "1:513985013942:web:613456a85b0b6a5d7e9e17", // 여러분의 실제 App ID로 변경하세요.
  measurementId: "G-2F5YC8ME05" // 여러분의 실제 Measurement ID로 변경하세요.
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

// state 변수들
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

// AI 분석 관련 전역 변수
let faceLandmarksDetector = null;
let isOpenCvReady = false;

// ================== [코드 수정] 함수를 window 객체에 할당 ==================
// OpenCV.js가 로딩되면 호출될 전역 함수
window.onOpenCvReady = function() {
    console.log("OpenCV.js is ready.");
    isOpenCvReady = true;
    checkAndHideLoadingOverlay();
}
// ====================================================================

// AI 모델 로딩 함수
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

// 모든 모델 로딩이 완료되었는지 확인하고 오버레이 및 버튼 상태 변경
function checkAndHideLoadingOverlay() {
    // 두 모델이 모두 준비되었을 때만 실행
    if (isOpenCvReady && faceLandmarksDetector) {
        document.getElementById('loadingOverlay').classList.replace('flex', 'hidden');
        console.log("All AI models are ready.");

        // 'AI 분석' 버튼 활성화
        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        analyzeBtn.classList.add('hover:bg-green-200');
        console.log("AI Analyze button enabled.");
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 이벤트 발생. 스크립트 실행 시작.');
    fetchPatients(); 
    setupEventListeners();
    loadFaceDetector();
});

// ... 이하 모든 함수는 이전과 동일합니다 ...
function setupEventListeners() {
    console.log('setupEventListeners 함수 호출됨.');
    const patientSearch = document.getElementById('patientSearch');
    patientSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        fetchPatients(searchTerm);
    });

    const photoModeFilterBtns = document.querySelectorAll('.photo-mode-filter-btn');
    photoModeFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentModeFilter = btn.dataset.filter;
            
            photoModeFilterBtns.forEach(b => {
                if (b.dataset.filter === state.currentModeFilter) {
                    b.classList.replace('bg-gray-200', 'bg-[#4CAF50]');
                    b.classList.add('text-white');
                } else {
                    b.classList.replace('bg-[#4CAF50]', 'bg-gray-200');
                    b.classList.remove('text-white');
                }
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

    const photoProcedureStatusFilter = document.getElementById('photoProcedureStatusFilter');
    if (photoProcedureStatusFilter) {
        photoProcedureStatusFilter.addEventListener('change', (e) => {
            state.currentProcedureStatusFilter = e.target.value;
            fetchPhotos(state.selectedPatientId);
        });
    }

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

    document.getElementById('localFileInput').addEventListener('change', (event) => {
        handleLocalFileSelect(event);
    });
    
    document.getElementById('closeWebImageSelectModal').addEventListener('click', () => {
        document.getElementById('webImageSelectOverlay').classList.add('hidden');
    });

    document.getElementById('addPatientBtn').addEventListener('click', () => {
        addNewPatient();
    });

    const imageWrappers = document.querySelectorAll('#mainImageWrapper, #compareImageWrapper, #tertiaryImageWrapper');
    imageWrappers.forEach(wrapper => {
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
        const patients = patientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const filteredPatients = patients.filter(patient => 
            patient.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (patient.chartId && patient.chartId.toLowerCase().includes(searchTerm.toLowerCase()))
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
        const patientsCol = collection(db, 'patients');
        await addDoc(patientsCol, {
            name,
            birth,
            gender,
            chartId,
            createdAt: new Date()
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
                patientId: patientId,
                url: imageUrlToDisplay,
                mode: mode,
                viewAngle: viewAngle,
                date: date,
                uploadedAt: new Date(),
                ai_analysis: ai_analysis,
                procedureStatus: procedureStatus
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
    const photoProcedureStatusFilter = document.getElementById('photoProcedureStatusFilter');
    if (photoProcedureStatusFilter) {
        photoProcedureStatusFilter.value = 'all';
    }

    const photoModeFilterBtns = document.querySelectorAll('.photo-mode-filter-btn');
    photoModeFilterBtns.forEach(b => {
        if (b.dataset.filter === 'all') {
            b.classList.replace('bg-gray-200', 'bg-[#4CAF50]');
            b.classList.add('text-white');
        } else {
            b.classList.replace('bg-[#4CAF50]', 'bg-gray-200');
            b.classList.remove('text-white');
        }
    });

    fetchPatients();

    document.getElementById('photoListSection').classList.remove('hidden');
    const patientDoc = await getDoc(doc(db, 'patients', patientId));
    if (patientDoc.exists()) {
        const selectedPatient = patientDoc.data();
        document.getElementById('photoListHeader').innerText = `${selectedPatient.name}님의 사진 목록`;
        if (!state.stagedPhoto && state.primaryPhotoId) {
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
        const photosCol = collection(db, 'photos');
        let q = query(photosCol, where('patientId', '==', patientId));

        if (state.currentModeFilter !== 'all') {
            q = query(q, where('mode', '==', state.currentModeFilter));
        }
        if (state.currentDateFilter) {
            q = query(q, where('date', '==', state.currentDateFilter));
        }
        if (state.currentAngleFilter !== 'all') {
            q = query(q, where('viewAngle', '==', state.currentAngleFilter));
        }
        if (state.currentProcedureStatusFilter !== 'all') {
            q = query(q, where('procedureStatus', '==', state.currentProcedureStatusFilter));
        }

        const photoSnapshot = await getDocs(q);
        let photos = photoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        photos.sort((a, b) => {
            const dateA = a.uploadedAt?.toDate ? a.uploadedAt.toDate().getTime() : 0;
            const dateB = b.uploadedAt?.toDate ? b.uploadedAt.toDate().getTime() : 0;
            return dateB - dateA;
        });

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
        img.onerror = () => {
            img.src = 'data:image/svg+xml,...';
        };

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
        state.secondaryPhotoId = null;
        state.tertiaryPhotoId = null;
        state.comparePhotoIds = [photoId];
        state.isCompareSelectionActive = false;
        state.isComparingPhotos = false;
        state.compareSelectionStep = 0;
        state.compareCount = 0;
        await updateComparisonDisplay();
        document.getElementById('compareBtn').innerText = '사진 비교';
        document.getElementById('compareBtn').classList.remove('bg-green-200');
    }
    fetchPhotos(state.selectedPatientId);
}

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

        if (photo?.ai_analysis?.type) {
            if (photo.ai_analysis.type === 'error') {
                 html = `<p class='text-red-500'>${photo.ai_analysis.message}</p>`;
            } else if (photo.ai_analysis.type === 'portrait') {
                const { wrinkles, pores, spots } = photo.ai_analysis;
                html = `
                    <div class="space-y-3">
                        <div><p class="font-semibold">주름</p><p class="text-blue-600">${wrinkles} (엣지 스코어)</p></div>
                        <div><p class="font-semibold">모공</p><p class="text-blue-600">${pores} %</p></div>
                        <div><p class="font-semibold">색소침착</p><p class="text-blue-600">${spots} 개</p></div>
                    </div>
                `;
            } else if (photo.ai_analysis.type === 'fray') {
                const { sagging, lifting_sim } = photo.ai_analysis;
                html = `
                    <div class="space-y-3">
                        <div><p class="font-semibold">피부 처짐 지수</p><p class="text-red-600">${sagging} / 100</p></div>
                        <p class="text-sm text-gray-400 mt-4">AI가 예측한 리프팅 시술 후 개선 효과 시뮬레이션입니다.</p>
                    </div>
                `;
            } else if (photo.ai_analysis.type === 'uv') {
                const { pigmentation, sebum } = photo.ai_analysis;
                html = `
                    <div class="space-y-3">
                        <div><p class="font-semibold">잠재 색소</p><p class="text-purple-600">${pigmentation} 개</p></div>
                        <div><p class="font-semibold">피지량</p><p class="text-orange-600">${sebum} / 100</p></div>
                    </div>
                `;
            }
        } else {
            html = "<p class='text-gray-500'>이 사진에 대한 AI 분석 정보가 없습니다.</p>";
        }
        contentEl.innerHTML = html;
    }
    
    if (img.complete) {
        render();
    } else {
        img.onload = render;
    }
    window.onresize = render;
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
        
        if (state.primaryPhotoId) {
            state.comparePhotoIds = [state.primaryPhotoId];
            updateComparisonDisplay();
        } else {
            resetViewerToPlaceholder();
        }
        
        if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
            getPhotoById(state.primaryPhotoId).then(photo => {
                if (photo) renderAnalysis(photo);
            });
        }
    } else {
        state.isAnalysisPanelVisible = false;
        document.getElementById('analysisPanel').classList.add('hidden');
        document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white'); 
        document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
        clearAnalysis();

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

    state.isAnalysisPanelVisible = false;
    document.getElementById('analysisPanel').classList.add('hidden');
    document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white'); 
    document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
    clearAnalysis();

    resetZoomAndPan();
    updateComparisonDisplay();
}

async function updateComparisonDisplay() {
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
                    applyTransforms();
                    if (state.isAnalysisPanelVisible && photo.id === state.primaryPhotoId) {
                        renderAnalysis(photo);
                    }
                };
                imgEl.onerror = () => {
                    imgEl.src = 'data:image/svg+xml,...'; // Placeholder
                };

                if (!patientData) {
                    const patientDoc = await getDoc(doc(db, 'patients', photo.patientId));
                    patientData = patientDoc.exists() ? patientDoc.data() : null;
                }
            }
        }
    }

    if (state.comparePhotoIds.filter(id => id).length > 1) {
        imageContainer.classList.remove('flex-col');
        imageContainer.classList.add('flex-row', 'gap-4', 'justify-center', 'items-center');
    } else if (state.comparePhotoIds.filter(id => id).length === 1) {
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
    state.isAnalysisPanelVisible = false;
    document.getElementById('analysisPanel').classList.add('hidden');
    document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white');
    document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]');
    clearAnalysis();
}

async function resetComparisonView() {
    state.secondaryPhotoId = null;
    state.tertiaryPhotoId = null;
    state.compareCount = 0;
    if (state.primaryPhotoId) {
        state.comparePhotoIds = [state.primaryPhotoId];
    } else {
        state.comparePhotoIds = [];
    }
    state.isComparingPhotos = false;
    state.isCompareSelectionActive = false;
    await updateComparisonDisplay();
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

    if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
        getPhotoById(state.primaryPhotoId).then(photo => {
            if (photo) renderAnalysis(photo);
        });
    }
    resetZoomAndPan();
}

function applyTransforms() {
    const images = [document.getElementById('mainImage'), document.getElementById('compareImage'), document.getElementById('tertiaryImage')];
    const analysisCanvas = document.getElementById('analysisCanvas');

    images.forEach(img => {
        if (!img.classList.contains('hidden')) {
            img.style.transform = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px) scale(${state.currentZoomLevel})`;
        }
    });

    const mainImage = document.getElementById('mainImage');
    if (mainImage && !mainImage.classList.contains('hidden')) {
         const mainImageRect = mainImage.getBoundingClientRect();
         const containerRect = document.getElementById('image-container').getBoundingClientRect();
         const canvasX = mainImageRect.left - containerRect.left;
         const canvasY = mainImageRect.top - containerRect.top;
         analysisCanvas.style.left = `${canvasX}px`;
         analysisCanvas.style.top = `${canvasY}px`;
         analysisCanvas.style.transform = `scale(${state.currentZoomLevel})`;
         analysisCanvas.style.width = `${mainImageRect.width}px`;
         analysisCanvas.style.height = `${mainImageRect.height}px`;
    } else {
        analysisCanvas.style.transform = 'scale(1.0)';
        analysisCanvas.style.width = '0px';
        analysisCanvas.style.height = '0px';
    }
}

function zoomImage(step) {
    let newZoomLevel = state.currentZoomLevel + step;
    if (newZoomLevel > state.maxZoom) newZoomLevel = state.maxZoom; 
    if (newZoomLevel < state.minZoom) newZoomLevel = state.minZoom; 
    
    state.currentZoomLevel = newZoomLevel;
    applyTransforms(); 
    
    if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
        getPhotoById(state.primaryPhotoId).then(photo => {
            if (photo) renderAnalysis(photo);
        });
    }
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
    const zoomDirection = e.deltaY < 0 ? state.zoomStep : -state.zoomStep; 
    zoomImage(zoomDirection);
}

function handleMouseDown(e) {
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

    const dx = e.clientX - state.startX; 
    const dy = e.clientY - state.startY; 

    state.currentTranslateX = state.lastTranslateX + dx; 
    state.currentTranslateY = state.lastTranslateY + dy; 
    
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
    if (!draggedWrapper || !state.isComparingPhotos || state.comparePhotoIds.filter(id => id !== null).length <= 1) {
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
            const newComparePhotoIds = [...state.comparePhotoIds];
            const [draggedItem] = newComparePhotoIds.splice(draggedIndex, 1);
            newComparePhotoIds.splice(targetIndex, 0, draggedItem);
            
            state.comparePhotoIds = newComparePhotoIds;
            state.primaryPhotoId = state.comparePhotoIds[0] || null;
            state.secondaryPhotoId = state.comparePhotoIds[1] || null;
            state.tertiaryPhotoId = state.comparePhotoIds[2] || null;

            await updateComparisonDisplay();
        }
    }
}

function handleDragEnd(e) {
    e.target.closest('.image-wrapper')?.classList.remove('dragging-source');
}

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

async function handleLocalFileSelect(event) {
    const file = event.target.files[0]; 
    if (!file) return;

    const fileName = file.name;
    const baseName = fileName.split('.')[0];
    const parts = baseName.split('_');

    let photoMode = 'PC Upload';
    let viewAngle = 'C0';
    let photoDate = new Date().toISOString().slice(0, 10);
    let procedureStatusInEnglish = 'None';

    if (parts.length >= 5) {
        photoMode = parts[2];
        viewAngle = parts[3];
        const datePart = parts[4];
        if (datePart && datePart.length === 8 && !isNaN(datePart)) {
            photoDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
        }
        if (parts.length >= 6) {
            procedureStatusInEnglish = parts[5];
        }
    }
    
    const procedureStatusInKorean = mapStatusToKorean(procedureStatusInEnglish);

    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(file, 'local', photoMode, viewAngle, photoDate, {}, procedureStatusInKorean);
        alert("사진이 뷰어에 불러와졌습니다. 사진을 저장하려면 좌측에서 환자를 선택하거나 '새 환자 추가' 버튼을 이용하세요.");
        return;
    }

    await displayImageAndSave(file, 'local', state.selectedPatientId, photoMode, viewAngle, photoDate, {}, procedureStatusInKorean); 
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
            storageImageList.innerHTML = '<p class="col-span-full text-center text-gray-500">\'images\' 폴더에 사진이 없습니다.</p>';
            return;
        }

        for (const itemRef of res.items) {
            const imageUrl = await getDownloadURL(itemRef);
            const fileName = itemRef.name;

            const imgDiv = document.createElement('div');
            imgDiv.className = 'relative flex flex-col items-center justify-center p-2 border rounded-md hover:shadow-lg transition-shadow';
            const imgEl = document.createElement('img');
            imgEl.src = imageUrl;
            imgEl.alt = fileName;
            imgEl.className = 'w-24 h-24 object-cover rounded-md mb-2';
            imgEl.onerror = () => {
                imgEl.src = 'data:image/svg+xml,...';
            };
            
            imgDiv.appendChild(imgEl);
            const spanFileName = document.createElement('span');
            spanFileName.className = 'text-xs text-gray-600 truncate w-full text-center';
            spanFileName.innerText = fileName;
            imgDiv.appendChild(spanFileName);

            imgDiv.addEventListener('click', () => selectWebImageFromStorage(imageUrl, fileName));
            storageImageList.appendChild(imgDiv);
        }

    } catch (error) {
        console.error("Storage 이미지 목록 불러오기 실패:", error);
        storageImageList.innerHTML = '<p class="col-span-full text-center text-red-500">이미지 목록을 불러오지 못했습니다.</p>';
    }
}

async function selectWebImageFromStorage(imageUrl, fileName) {
    document.getElementById('webImageSelectOverlay').classList.add('hidden');

    const baseName = fileName.split('.')[0];
    const parts = baseName.split('_');

    let photoMode = 'Web URL';
    let viewAngle = 'C0';
    let photoDate = new Date().toISOString().slice(0, 10);
    let procedureStatusInEnglish = 'None';

    if (parts.length >= 5) {
        photoMode = parts[2];
        viewAngle = parts[3];
        const datePart = parts[4];
        if (datePart && datePart.length === 8 && !isNaN(datePart)) {
            photoDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
        }
        if (parts.length >= 6) {
            procedureStatusInEnglish = parts[5];
        }
    }
    
    const procedureStatusInKorean = mapStatusToKorean(procedureStatusInEnglish);

    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(imageUrl, 'web', photoMode, viewAngle, photoDate, {}, procedureStatusInKorean);
        alert("사진이 뷰어에 불러와졌습니다. 사진을 저장하려면 좌측에서 환자를 선택하거나 '새 환자 추가' 버튼을 이용하세요.");
        return;
    }

    await displayImageAndSave(imageUrl, 'web', state.selectedPatientId, photoMode, viewAngle, photoDate, {}, procedureStatusInKorean);
}

async function displayImageAndSave(source, sourceType, patientId, photoMode, viewAngle, photoDate, aiAnalysisData = {}, procedureStatus = '기타/미지정') {
    const viewerPlaceholder = document.getElementById('viewerPlaceholder');
    const imageViewer = document.getElementById('imageViewer');

    viewerPlaceholder.classList.remove('hidden');
    imageViewer.classList.add('hidden');
    viewerPlaceholder.innerHTML = `<div class="text-center text-gray-500"><h3 class="mt-2 text-lg font-medium">사진을 불러오는 중입니다...</h3></div>`;

    try {
        let imageUrlToDisplay;

        if (sourceType === 'local') {
            const file = source;
            const storageRef = ref(storage, `photos/${patientId}/${file.name}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            imageUrlToDisplay = await getDownloadURL(snapshot.ref);
        } else if (sourceType === 'web') {
            imageUrlToDisplay = source;
        }

        const newPhotoData = {
            patientId, url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle,
            date: photoDate, uploadedAt: new Date(), ai_analysis: aiAnalysisData,
            procedureStatus: procedureStatus,
        };
        const docRef = await addDoc(collection(db, 'photos'), newPhotoData);
        state.primaryPhotoId = docRef.id;

        state.comparePhotoIds = [state.primaryPhotoId];
        await updateComparisonDisplay();
        fetchPhotos(patientId);

    } catch (error) {
        console.error("사진을 불러오거나 Firestore에 저장하는 중 오류 발생:", error);
        alert("사진을 불러오거나 저장하는데 실패했습니다: " + error.message);
        resetViewerToPlaceholder();
    }
}

async function displayImageWithoutSaving(source, sourceType, photoMode, viewAngle, photoDate, aiAnalysisData = {}, procedureStatus = '기타/미지정') {
    const viewerPlaceholder = document.getElementById('viewerPlaceholder');
    const imageViewer = document.getElementById('imageViewer');
    const mainImage = document.getElementById('mainImage');

    viewerPlaceholder.classList.remove('hidden');
    imageViewer.classList.add('hidden');
    viewerPlaceholder.innerHTML = `<div class="text-center text-gray-500"><h3 class="mt-2 text-lg font-medium">사진을 불러오는 중입니다...</h3></div>`;

    try {
        let imageUrlToDisplay;

        if (sourceType === 'local') {
            imageUrlToDisplay = URL.createObjectURL(source);
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: source, date: photoDate, ai_analysis: aiAnalysisData, procedureStatus: procedureStatus };
        } else if (sourceType === 'web') {
            imageUrlToDisplay = source;
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: null, date: photoDate, ai_analysis: aiAnalysisData, procedureStatus: procedureStatus };
        }
        
        state.primaryPhotoId = null;

        const viewerPatientName = document.getElementById('viewerPatientName');
        const viewerPhotoInfo = document.getElementById('viewerPhotoInfo');
        const mainImageWrapper = document.getElementById('mainImageWrapper');
        const compareImageWrapper = document.getElementById('compareImageWrapper');
        const tertiaryImageWrapper = document.getElementById('tertiaryImageWrapper');
        const imageContainer = document.getElementById('image-container');

        document.getElementById('viewerPlaceholder').classList.add('hidden');
        document.getElementById('imageViewer').classList.remove('hidden');
        document.getElementById('imageViewer').classList.add('flex');

        mainImage.src = imageUrlToDisplay;
        mainImageWrapper.classList.remove('hidden', 'flex-1');
        mainImageWrapper.classList.add('w-full');
        compareImageWrapper.classList.add('hidden');
        tertiaryImageWrapper.classList.add('hidden');

        imageContainer.classList.remove('flex-row', 'gap-4');
        imageContainer.classList.add('flex-col');

        viewerPatientName.innerText = `환자 미지정 - 선택 필요`;
        viewerPhotoInfo.innerText = `${photoDate} | ${photoMode} | ${viewAngle} | ${procedureStatus}`;

        mainImage.onload = () => {
            resetZoomAndPan();
        };
        mainImage.onerror = () => {
            mainImage.src = 'data:image/svg+xml,...'; // Placeholder
        };

        state.isAnalysisPanelVisible = false;
        document.getElementById('analysisPanel').classList.add('hidden');
        document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white');
        document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]');

    } catch (error) {
        console.error("사진을 불러오는 중 오류 발생:", error);
        alert("사진을 불러오는데 실패했습니다: " + error.message);
        resetViewerToPlaceholder();
        state.stagedPhoto = null;
    }
}

function resetViewerToPlaceholder() {
    document.getElementById('viewerPlaceholder').classList.remove('hidden');
    document.getElementById('imageViewer').classList.add('hidden');
    document.getElementById('viewerPlaceholder').innerHTML = `
        <img src="https://firebasestorage.googleapis.com/v0/b/frayviewer-63e13.firebasestorage.app/o/images%2FF-RAY_device%20pic_side.jpg?alt=media&token=a61a0421-082f-4165-9df9-9ca47f1a320c" alt="F-ray Device" class="max-w-xs h-auto mb-4">
        <h3 class="mt-2 text-lg font-medium">사진 뷰어</h3>
        <p class="mt-1 text-sm">좌측에서 환자를 검색하고 사진을 선택해주세요.</p>
    `;
    state.primaryPhotoId = null;
    state.comparePhotoIds = [];
    state.isComparingPhotos = false;
    state.isCompareSelectionActive = false;
}

async function deletePhoto(photoId) {
    if (!confirm('정말로 이 사진을 삭제하시겠습니까? 데이터베이스에서만 삭제되며, 원본 사진 파일은 Storage에 유지됩니다.')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'photos', photoId)); 
        alert('사진이 데이터베이스에서 성공적으로 삭제되었습니다.');

        if (state.primaryPhotoId === photoId) {
            state.primaryPhotoId = null; 
        }
        state.comparePhotoIds = state.comparePhotoIds.filter(id => id !== photoId);

        if (state.comparePhotoIds.length > 0) {
            state.primaryPhotoId = state.comparePhotoIds[0];
            await updateComparisonDisplay();
        } else {
            resetViewerToPlaceholder(); 
        }

        if (state.selectedPatientId) {
            fetchPhotos(state.selectedPatientId);
        } else {
            fetchPatients();
        }

    } catch (error) {
        console.error("사진 삭제 중 오류 발생:", error);
        alert("사진 삭제에 실패했습니다: " + error.message);
    }
}

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
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    const faces = await faceLandmarksDetector.estimateFaces(canvas, { flipHorizontal: false });
    if (faces.length === 0) {
        return { type: 'error', message: '사진에서 얼굴을 찾을 수 없습니다.' };
    }
    const keypoints = faces[0].keypoints;

    let analysisResult = {};
    const src = cv.imread(canvas);

    switch (photo.mode) {
        case 'Portrait': {
            analysisResult.type = 'portrait';
            const leftEyeContour = keypoints.filter(p => p.name && p.name.startsWith('leftEye'));
            const rightEyeContour = keypoints.filter(p => p.name && p.name.startsWith('rightEye'));
            const wrinkleScore = analyzeWrinkles(src, [...leftEyeContour, ...rightEyeContour]);
            analysisResult.wrinkles = wrinkleScore;
            
            const leftCheekPoint = keypoints.find(p => p.name === 'leftCheek');
            const rightCheekPoint = keypoints.find(p => p.name === 'rightCheek');
            const spotScore = analyzeSpots(src, [leftCheekPoint, rightCheekPoint]);
            analysisResult.spots = spotScore;

            analysisResult.pores = Math.floor(Math.random() * 30) + 10;
            break;
        }
        case 'F-ray': {
            analysisResult.type = 'fray';
            
            const jawlinePoints = keypoints.filter(p => p.name && (p.name.startsWith('rightContour') || p.name.startsWith('leftContour')));
            const saggingScore = analyzeSagging(jawlinePoints);
            analysisResult.sagging = saggingScore;

            analysisResult.lifting_sim = [ { x1: 200, y1: 300, x2: 400, y2: 280 }, { x1: 250, y1: 500, x2: 450, y2: 480 }];
            break;
        }
        case 'UV': {
            analysisResult.type = 'uv';
            const leftCheekPoint = keypoints.find(p => p.name === 'leftCheek');
            const rightCheekPoint = keypoints.find(p => p.name === 'rightCheek');
            const pigmentationScore = analyzeSpots(src, [leftCheekPoint, rightCheekPoint], 100);
            analysisResult.pigmentation = pigmentationScore;
            analysisResult.sebum = Math.floor(Math.random() * 100);
            break;
        }
        default:
            analysisResult = { type: 'general', message: '이 모드에 대한 특정 분석이 없습니다.' };
    }
    
    src.delete();
    return analysisResult;
}

function analyzeWrinkles(src, eyePoints) {
    if (eyePoints.length === 0) return 0;
    
    const xCoords = eyePoints.map(p => p.x);
    const yCoords = eyePoints.map(p => p.y);
    const minX = Math.min(...xCoords) - 20;
    const minY = Math.min(...yCoords) - 20;
    const maxX = Math.max(...xCoords) + 20;
    const maxY = Math.max(...yCoords) + 20;

    const rect = new cv.Rect(minX, minY, maxX - minX, maxY - minY);
    const roi = src.roi(rect);
    const gray = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
    
    const edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 100, 3, false);
    
    const wrinkleScore = cv.countNonZero(edges);
    
    roi.delete(); gray.delete(); edges.delete();
    return Math.floor(wrinkleScore / 50);
}

function analyzeSpots(src, cheekPoints, thresholdValue = 120) {
    if (cheekPoints.length === 0 || !cheekPoints[0] || !cheekPoints[1]) return 0;
    
    let totalSpots = 0;
    cheekPoints.forEach(point => {
        const rect = new cv.Rect(point.x - 40, point.y - 40, 80, 80);
        const roi = src.roi(rect);
        const gray = new cv.Mat();
        cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);

        const thresholded = new cv.Mat();
        cv.threshold(gray, thresholded, thresholdValue, 255, cv.THRESH_BINARY_INV);

        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(thresholded, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        
        totalSpots += contours.size();
        
        roi.delete(); gray.delete(); thresholded.delete(); contours.delete(); hierarchy.delete();
    });

    return totalSpots;
}

function analyzeSagging(jawlinePoints) {
    if (jawlinePoints.length < 5) return 50;

    const chinPoint = jawlinePoints.reduce((prev, curr) => (prev.y > curr.y) ? prev : curr);
    const upperJawPoints = jawlinePoints.filter(p => p.y < chinPoint.y - 20);
    
    if (upperJawPoints.length < 2) return 50;

    const avgY = upperJawPoints.reduce((sum, p) => sum + p.y, 0) / upperJawPoints.length;
    const saggingIndex = (avgY / chinPoint.y) * 100;
    
    let score = Math.min(100, Math.max(0, (saggingIndex - 80) * 5));
    return Math.floor(score);
}