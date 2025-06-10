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
// 예를 들어, 어떤 환자가 선택되었는지, 확대 레벨은 얼마인지 등을 기억해요.
const state = {
    selectedPatientId: null,
    primaryPhotoId: null, // 이 값은 이제 Firestore 문서 ID 또는 Storage URL이 될 수 있습니다.
    secondaryPhotoId: null,
    tertiaryPhotoId: null,
    comparePhotoIds: [], // 비교 뷰에 표시될 사진 ID들의 배열 (순서 중요)
    currentModeFilter: 'all', // 기존 currentFilter의 이름을 변경하여 용도를 명확히 함
    currentDateFilter: '', // 촬영 날짜 필터 추가 (YYYY-MM-DD)
    currentAngleFilter: 'all', // 각도 필터 추가
    currentProcedureStatusFilter: 'all', // [변경] 시술 상태 필터 추가
    isAnalysisPanelVisible: false, // 분석 패널이 보이는지 여부
    isCompareSelectionActive: false, // 사용자가 비교 모드 선택 중 (2장/3장 선택 중)
    isComparingPhotos: false, // 2장 또는 3장의 사진이 실제로 뷰어에 표시되어 비교 중인 상태 (이 상태에서 드래그앤드롭 가능)
    compareSelectionStep: 0, // 0: 선택 중 아님, 1: 두 번째 선택, 2: 세 번째 선택
    compareCount: 0, // 2 또는 3
    currentZoomLevel: 1.0, // 현재 확대 레벨 (1.0 = 원본 크기)
    zoomStep: 0.2, // 확대/축소 시 변화량
    maxZoom: 3.0, // 최대 확대 레벨
    minZoom: 0.5, // 최소 축소 레벨
    isDragging: false, // 사진 드래그 중인지 여부 (팬/줌용)
    startX: 0, // 드래그 시작 시 마우스 X 좌표 (팬/줌용)
    startY: 0, // 드래그 시작 시 마우스 Y 좌표 (팬/줌용)
    currentTranslateX: 0, // 현재 X축 이동량 (팬/줌용)
    currentTranslateY: 0, // 현재 Y축 이동량 (팬/줌용)
    lastTranslateX: 0, // 마지막 이동량 (드래그 연속을 위해 필요) (팬/줌용)
    lastTranslateY: 0, // 마지막 이동량 (드래그 연속을 위해 필요) (팬/줌용)
    stagedPhoto: null, // { url: string, mode: string, viewAngle: string, file: File | null, procedureStatus: string } - 환자 미지정 상태의 사진 [변경] procedureStatus 추가
};

// ========================= [코드 추가] =========================
/**
 * 파일명에서 추출한 영어 상태를 한글로 변환하는 함수
 * @param {string} status - 파일명에서 추출한 영어 시술 상태 (예: 'Before', '1W')
 * @returns {string} - 변환된 한글 시술 상태 (예: '시술 전', '1주 후')
 */
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
    // 매핑되는 값이 있으면 그 값을, 없으면 '기타/미지정'을 반환
    return statusMap[status] || '기타/미지정';
}
// =============================================================

// DOMContentLoaded: 웹 페이지의 모든 HTML이 로드되면 실행되는 부분입니다.
// 이 안에서 모든 초기 설정을 시작합니다.
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 이벤트 발생. 스크립트 실행 시작.'); // 디버깅 로그 추가
    // 이제 MOCK_DB 대신 Firestore에서 환자 목록을 불러옵니다.
    console.log('fetchPatients 함수 호출 시작 (DOMContentLoaded).'); // 디버깅 로그 추가
    fetchPatients(); 
    setupEventListeners(); // 버튼 클릭, 마우스 움직임 등의 이벤트를 설정합니다.
});

// setupEventListeners: 웹사이트의 각종 버튼과 마우스 이벤트들을 연결합니다.
function setupEventListeners() {
    console.log('setupEventListeners 함수 호출됨.'); // 디버깅 로그 추가
    const patientSearch = document.getElementById('patientSearch');
    patientSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase(); // 검색창에 입력된 텍스트를 가져와 소문자로 바꿉니다.
        fetchPatients(searchTerm); // 입력된 텍스트로 환자 검색
    });

    // 촬영 모드 필터 버튼 (mode-filter-btn으로 클래스명 변경)
    const photoModeFilterBtns = document.querySelectorAll('.photo-mode-filter-btn');
    photoModeFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentModeFilter = btn.dataset.filter; // 클릭된 버튼의 필터 값을 상태에 저장합니다.
            
            // 모든 모드 필터 버튼의 색상을 초기화하고, 클릭된 버튼만 활성화 색상으로 바꿉니다.
            photoModeFilterBtns.forEach(b => {
                if (b.dataset.filter === state.currentModeFilter) {
                    b.classList.replace('bg-gray-200', 'bg-[#4CAF50]');
                    b.classList.add('text-white');
                } else {
                    b.classList.replace('bg-[#4CAF50]', 'bg-gray-200');
                    b.classList.remove('text-white');
                }
            });
            fetchPhotos(state.selectedPatientId); // 필터링된 사진 목록을 다시 불러옵니다.
        });
    });

    // 촬영 날짜 필터 (새로 추가)
    document.getElementById('photoDateFilter').addEventListener('change', (e) => {
        state.currentDateFilter = e.target.value; //InstrumentedTest-MM-DD 형식으로 저장
        fetchPhotos(state.selectedPatientId); // 필터링된 사진 목록을 다시 불러옵니다.
    });

    // 각도 필터 (새로 추가)
    document.getElementById('photoAngleFilter').addEventListener('change', (e) => {
        state.currentAngleFilter = e.target.value; // 선택된 각도 값 저장
        fetchPhotos(state.selectedPatientId); // 필터링된 사진 목록을 다시 불러옵니다.
    });

    // [변경] 시술 상태 필터 (새로 추가)
    const photoProcedureStatusFilter = document.getElementById('photoProcedureStatusFilter');
    if (photoProcedureStatusFilter) {
        photoProcedureStatusFilter.addEventListener('change', (e) => {
            state.currentProcedureStatusFilter = e.target.value; // 선택된 시술 상태 값 저장
            fetchPhotos(state.selectedPatientId); // 필터링된 사진 목록을 다시 불러옵니다.
        });
    }


    // 주요 기능 버튼에 클릭 이벤트를 연결합니다.
    document.getElementById('analyzeBtn').addEventListener('click', toggleAnalysisPanel); // AI 분석 패널 토글
    document.getElementById('compareBtn').addEventListener('click', handleCompareButtonClick); // 사진 비교 모드 시작/취소
    document.getElementById('fullScreenBtn').addEventListener('click', toggleFullScreen); // 전체 화면 토글
    document.getElementById('zoomInBtn').addEventListener('click', () => zoomImage(state.zoomStep)); // 확대 버튼
    document.getElementById('zoomOutBtn').addEventListener('click', () => zoomImage(-state.zoomStep)); // 축소 버튼
    document.getElementById('resetViewBtn').addEventListener('click', resetZoomAndPan); // 초기화 버튼
    
    // [이동] 선택 사진 삭제 버튼
    document.getElementById('deletePhotoBtn').addEventListener('click', () => { 
        if (state.primaryPhotoId) {
            deletePhoto(state.primaryPhotoId);
        } else {
            alert('삭제할 사진이 선택되지 않았습니다.');
        }
    });

    // 비교 사진 선택 팝업의 버튼에 이벤트를 연결합니다.
    document.getElementById('choose2PhotosBtn').addEventListener('click', () => startCompareSelection(2)); // 2장 비교 선택
    document.getElementById('choose3PhotosBtn').addEventListener('click', () => startCompareSelection(3)); // 3장 비교 선택

    // 이미지 컨테이너에 마우스 휠 및 드래그 이벤트를 연결합니다.
    const imageContainer = document.getElementById('image-container');
    imageContainer.addEventListener('wheel', handleMouseWheelZoom); // 마우스 휠로 확대/축소
    imageContainer.addEventListener('mousedown', handleMouseDown); // 마우스 클릭(누름) 시 드래그 시작

    // [통합] 사진 불러오기 버튼 이벤트 리스너 추가
    document.getElementById('importPhotoBtn').addEventListener('click', () => {
        console.log("사진 불러오기 버튼 클릭됨. (importPhotoBtn)");
        document.getElementById('importChoiceOverlay').classList.remove('hidden'); // 통합 선택 모달 표시
    });
    // [추가] 통합 불러오기 모달 내 PC에서 불러오기 버튼
    document.getElementById('importFromLocalBtn').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden'); // 모달 닫기
        document.getElementById('localFileInput').click(); // 숨겨진 파일 입력창 클릭 이벤트 발생
    });
    // [추가] 통합 불러오기 모달 내 웹에서 불러오기 버튼
    document.getElementById('importFromWebBtn').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden'); // 모달 닫기
        showWebImageSelectModal(); // 웹 이미지 선택 모달 표시
    });
    // [추가] 통합 불러오기 모달 닫기 버튼
    document.getElementById('closeImportChoiceModal').addEventListener('click', () => {
        document.getElementById('importChoiceOverlay').classList.add('hidden'); // 모달 닫기
    });

    // 로컬 파일 입력창 이벤트는 기존과 동일하게 유지
    document.getElementById('localFileInput').addEventListener('change', (event) => {
        console.log("localFileInput change 이벤트 발생.");
        handleLocalFileSelect(event);
    });
    
    // 웹 이미지 선택 모달 닫기 버튼 이벤트 리스너는 기존과 동일하게 유지
    document.getElementById('closeWebImageSelectModal').addEventListener('click', () => {
        console.log("웹 이미지 선택 모달 닫기 버튼 클릭됨.");
        document.getElementById('webImageSelectOverlay').classList.add('hidden');
    });

    // '새 환자 추가' 버튼 이벤트 리스너 추가
    document.getElementById('addPatientBtn').addEventListener('click', () => {
        console.log("새 환자 추가 버튼 클릭됨. (addPatientBtn)");
        addNewPatient();
    });

    // 드래그 앤 드롭 이벤트 리스너 추가 (모든 이미지 래퍼에 적용)
    // 중요: HTML 파일의 mainImageWrapper, compareImageWrapper, tertiaryImageWrapper div에
    //      'image-wrapper' 클래스를 추가해야 이 리스너들이 정상 작동합니다.
    const imageWrappers = document.querySelectorAll('#mainImageWrapper, #compareImageWrapper, #tertiaryImageWrapper');
    imageWrappers.forEach(wrapper => {
        wrapper.draggable = true; // 드래그 가능하도록 설정
        wrapper.addEventListener('dragstart', handleDragStart);
        wrapper.addEventListener('dragover', handleDragOver);
        wrapper.addEventListener('dragleave', handleDragLeave);
        wrapper.addEventListener('drop', handleDrop);
        wrapper.addEventListener('dragend', handleDragEnd); // 드래그 종료 시 호출
    });
}

// Helper function to get photo data by ID (can be optimized with a cache if needed)
async function getPhotoById(photoId) {
    console.log('getPhotoById 호출됨. photoId:', photoId); // 디버깅 로그 추가
    if (!photoId) return null;
    const photoDoc = await getDoc(doc(db, 'photos', photoId));
    const photoData = photoDoc.exists() ? { id: photoDoc.id, ...photoDoc.data() } : null;
    console.log('getPhotoById 결과:', photoData); // 디버깅 로그 추가
    return photoData;
}


// fetchPatients: Firestore에서 환자 목록을 불러와 화면에 그립니다.
async function fetchPatients(searchTerm = '') {
    console.log('fetchPatients 호출됨. searchTerm:', searchTerm); // Debug log
    const patientListEl = document.getElementById('patientList');
    // [변경] 로딩 메시지 폰트 사이즈 및 간격 조정
    patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자 목록을 불러오는 중...</p>';
    try {
        const patientsCol = collection(db, 'patients'); // 'patients' 컬렉션 참조
        const patientSnapshot = await getDocs(patientsCol); // 모든 환자 문서 가져오기
        const patients = patientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (patientSnapshot.empty) {
            console.log('Firestore에 환자 문서가 없습니다.'); // Debug log
        } else {
            console.log('fetchPatients: 불러온 환자 수:', patients.length); // Debug log
        }

        // 검색어 필터링 (클라이언트 측에서, Firebase 쿼리로도 가능)
        const filteredPatients = patients.filter(patient => 
            patient.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (patient.chartId && patient.chartId.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        renderPatientList(filteredPatients); // 필터링된 환자 목록을 화면에 그립니다.
        if (filteredPatients.length === 0) {
            // [변경] 메시지 폰트 사이즈 및 간격 조정
            patientListEl.innerHTML = '<p class="text-center text-gray-500 py-2 text-sm">환자가 없습니다. "새 환자 추가" 버튼으로 추가해보세요.</p>';
        }
    }
    catch (error) {
        console.error("환자 목록을 불러오는 중 오류 발생:", error);
        // [변경] 에러 메시지 폰트 사이즈 및 간격 조정
        patientListEl.innerHTML = '<p class="text-center text-red-500 py-2 text-sm">환자 목록을 불러오지 못했습니다.</p>';
    }
}

// renderPatientList: 환자 목록을 화면에 그립니다.
// 이제 실제 환자 데이터를 인자로 받아 화면에 렌더링합니다.
function renderPatientList(patients) {
    console.log('renderPatientList 호출됨. 렌더링할 환자 수:', patients.length); // Debug log
    const patientListEl = document.getElementById('patientList');
    patientListEl.innerHTML = ''; // 기존 목록을 비웁니다.
    
    patients.forEach(patient => {
        const li = document.createElement('li'); // 새로운 리스트 아이템(li)을 만듭니다.
        // Tailwind CSS 클래스를 적용하여 스타일을 입힙니다.
        // [변경] p-2를 py-1 px-2로, text-sm 추가
        li.className = 'patient-list-item py-1 px-2 cursor-pointer border-b border-gray-200 flex justify-between items-center text-sm';
        // 현재 선택된 환자라면 'selected' 클래스를 추가하여 강조합니다.
        if(patient.id === state.selectedPatientId) li.classList.add('selected');

        // 환자 정보를 li 안에 넣어줍니다.
        // [변경] 폰트 사이즈 조정
        li.innerHTML = `
            <div>
                <p class="font-semibold text-sm">${patient.name}</p>
                <p class="text-xs text-gray-500">${patient.chartId} | ${patient.birth}</p>
            </div>
            <span class="text-xs text-gray-400">></span>
        `;
        // li를 클릭하면 selectPatient 함수가 호출되도록 이벤트를 연결합니다.
        li.addEventListener('click', () => {
            console.log('환자 목록 아이템 클릭됨. Patient ID:', patient.id); // 디버깅 로그 추가
            selectPatient(patient.id);
        });
        patientListEl.appendChild(li); // 완성된 li를 환자 목록에 추가합니다.
    });
}

// addNewPatient: 새 환자를 Firestore에 추가합니다.
async function addNewPatient() {
    console.log("addNewPatient 함수 실행됨."); // 디버깅 로그 추가
    const name = prompt("새 환자의 이름을 입력해주세요:");
    if (!name) { console.log("새 환자 추가 취소됨 (이름 없음)."); return; }
    const birth = prompt("새 환자의 생년월일을 입력해주세요 (예: 1990-01-01):");
    if (!birth) { console.log("새 환자 추가 취소됨 (생년월일 없음)."); return; }
    const gender = prompt("새 환자의 성별을 입력해주세요 (예: 남/여):");
    if (!gender) { console.log("새 환자 추가 취소됨 (성별 없음)."); return; }
    const chartId = prompt("새 환자의 차트 ID를 입력해주세요 (예: C-20240001):");
    if (!chartId) { console.log("새 환자 추가 취소됨 (차트 ID 없음)."); return; }

    try {
        const patientsCol = collection(db, 'patients');
        await addDoc(patientsCol, {
            name,
            birth,
            gender,
            chartId,
            createdAt: new Date() // 생성 시간 기록
        });
        alert(`${name} 환자가 성공적으로 추가되었습니다!`);
        fetchPatients(); // 환자 목록을 새로고침합니다.
    } catch (error) {
        console.error("환자 추가 중 오류 발생:", error);
        alert("환자 추가에 실패했습니다. 오류: " + error.message);
    }
}

// selectPatient: 환자를 선택했을 때 실행되는 함수입니다.
async function selectPatient(patientId) {
    console.log('selectPatient 호출됨. patientId:', patientId); // 디버깅 로그 추가
    // 만약 현재 stagedPhoto가 있고, 이전에 선택된 환자가 없었다면
    if (state.stagedPhoto && state.selectedPatientId === null) {
        try {
            // stagedPhoto를 현재 선택된 환자에게 연결하여 Firestore에 저장합니다.
            const { url, mode, viewAngle, file, ai_analysis, date, procedureStatus } = state.stagedPhoto; // [변경] procedureStatus 추가
            let imageUrlToDisplay = url;

            // 로컬 파일의 경우 Storage에 업로드
            if (file) {
                const storageRef = ref(storage, `photos/${patientId}/${file.name}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, file);
                imageUrlToDisplay = await getDownloadURL(snapshot.ref);
                console.log('Staged file uploaded to Firebase Storage:', imageUrlToDisplay);
            }

            const newPhotoData = {
                patientId: patientId,
                url: imageUrlToDisplay,
                mode: mode,
                viewAngle: viewAngle,
                date: date, // staged photo에서 가져온 date
                uploadedAt: new Date(),
                ai_analysis: ai_analysis, // staged photo에서 가져온 AI 분석 데이터
                procedureStatus: procedureStatus // [변경] staged photo에서 가져온 시술 상태
            };
            const docRef = await addDoc(collection(db, 'photos'), newPhotoData);
            state.primaryPhotoId = docRef.id; // 새로 저장된 사진의 ID를 primaryPhotoId로 설정
            state.stagedPhoto = null; // stagedPhoto 초기화
            alert('사진이 선택된 환자에게 성공적으로 연결되었습니다.');
        } catch (error) {
            console.error("Staged 사진 저장 중 오류 발생:", error);
            alert("사진을 환자에게 연결하는데 실패했습니다: " + error.message);
        }
    }

    // 환자 선택 상태 업데이트 및 UI 처리
    state.selectedPatientId = patientId;
    
    // 새 환자 선택 시 필터 및 UI 초기화
    state.currentModeFilter = 'all';
    state.currentDateFilter = '';
    state.currentAngleFilter = 'all';
    state.currentProcedureStatusFilter = 'all'; // [변경] 시술 상태 필터 초기화

    document.getElementById('photoDateFilter').value = '';
    document.getElementById('photoAngleFilter').value = 'all';
    // [변경] 시술 상태 필터도 초기화
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

    fetchPatients(); // 환자 목록을 다시 그려서 선택된 환자를 강조 표시

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
    
    console.log('fetchPhotos 함수 호출 시작 (selectPatient).'); // 디버깅 로그 추가
    fetchPhotos(patientId); // 필터링된 사진 목록을 다시 불러옵니다.
    console.log('selectPatient 함수 종료.'); // 디버깅 로그 추가
}

// fetchPhotos: Firestore에서 특정 환자의 사진 목록을 불러와 화면에 그립니다.
async function fetchPhotos(patientId) {
    console.log('fetchPhotos 호출됨. patientId:', patientId); // Debug log
    if (!patientId) {
        renderPhotoList([]); // 환자 ID가 없으면 빈 목록을 그립니다.
        console.log('fetchPhotos: patientId가 유효하지 않아 빈 사진 목록을 렌더링합니다.'); // Debug log
        return;
    }
    const photoListEl = document.getElementById('photoList');
    // [변경] 로딩 메시지 폰트 사이즈 및 간격 조정
    photoListEl.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-2 text-xs">사진 목록을 불러오는 중...</p>'; 

    try {
        const photosCol = collection(db, 'photos');
        let q = query(photosCol, where('patientId', '==', patientId));

        // 촬영 모드 필터 적용
        if (state.currentModeFilter !== 'all') {
            q = query(q, where('mode', '==', state.currentModeFilter));
        }
        // 촬영 날짜 필터 적용
        if (state.currentDateFilter) {
            q = query(q, where('date', '==', state.currentDateFilter));
        }
        // 각도 필터 적용
        if (state.currentAngleFilter !== 'all') {
            q = query(q, where('viewAngle', '==', state.currentAngleFilter));
        }
        // [변경] 시술 상태 필터 적용
        if (state.currentProcedureStatusFilter !== 'all') {
            q = query(q, where('procedureStatus', '==', state.currentProcedureStatusFilter));
        }

        const photoSnapshot = await getDocs(q);
        let photos = photoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (photoSnapshot.empty) {
            console.log(`fetchPhotos: 환자 ${patientId}에 대한 사진 문서가 없습니다.`); // Debug log
        } else {
            console.log(`fetchPhotos: 불러온 사진 수 (${patientId}):`, photos.length); // Debug log
        }

        // 최신순으로 정렬 (uploadedAt을 기준으로)
        photos.sort((a, b) => {
            const dateA = a.uploadedAt?.toDate ? a.uploadedAt.toDate().getTime() : 0;
            const dateB = b.uploadedAt?.toDate ? b.uploadedAt.toDate().getTime() : 0;
            return dateB - dateA;
        });

        renderPhotoList(photos); // 불러온 사진 목록을 화면에 그립니다.
        if (photos.length === 0) {
            photoListEl.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-2 text-xs">이 환자의 사진이 없습니다.</p>';
        }

    } catch (error) {
        console.error("사진 목록을 불러오는 중 오류 발생:", error);
        photoListEl.innerHTML = '<p class="col-span-2 text-center text-red-500 py-2 text-xs">사진 목록을 불러오지 못했습니다.</p>';
    }
}

// renderPhotoList: 선택된 환자의 사진 목록을 화면에 그립니다.
function renderPhotoList(photos) {
    console.log('renderPhotoList 호출됨. 렌더링할 사진 수:', photos.length); // Debug log
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = ''; // 기존 사진 목록을 비웁니다.
    
    photos.forEach(photo => {
        const li = document.createElement('li');
        li.className = 'photo-list-item px-1 py-0.5 cursor-pointer rounded-md flex items-center space-x-1 text-xs';

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.mode;
        img.className = 'w-12 h-12 object-cover rounded-md mr-1';
        img.onerror = () => {
            console.error(`Error loading thumbnail image: ${photo.url}`);
            img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\' viewBox=\'0 0 64 64\'%3E%3Crect width=\'64\' height=\'64\' fill=\'%23f8d7da\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' font-family=\'sans-serif\' font-size=\'8\' fill=\'%23721c24\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3EError%3C/text%3E%3C/svg%3E';
        };

        const divInfo = document.createElement('div');
        divInfo.innerHTML = `
            <p class="font-medium text-xs">${photo.mode} (${photo.viewAngle})</p>
            <p class="text-xxs text-gray-500">${photo.date} | ${photo.procedureStatus || 'N/A'}</p> 
        `;

        li.appendChild(img);
        li.appendChild(divInfo);
        li.addEventListener('click', () => {
            console.log('사진 목록 아이템 클릭됨. Photo ID:', photo.id);
            selectPhoto(photo.id);
        });
        photoListEl.appendChild(li);
    });
}

async function selectPhoto(photoId) {
    console.log('selectPhoto 호출됨. photoId:', photoId);
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
        console.log('비교 사진 선택 중. 현재 단계:', state.compareSelectionStep);
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
                            document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>이 사진에 대한 AI 분석 정보가 없습니다.</p>";
                        }
                    } else {
                        clearAnalysis();
                        document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>선택된 사진 정보를 찾을 수 없습니다.</p>";
                    }
                })
                .catch(error => {
                    console.error("분석 정보 로딩 중 오류:", error);
                    clearAnalysis();
                    document.getElementById('analysisContent').innerHTML = "<p class='text-red-500'>분석 정보를 불러오지 못했습니다. 오류: " + error.message + "</p>";
                });
        } else {
            clearAnalysis();
            document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>AI 분석 결과를 보려면 먼저 사진을 선택해주세요.</p>";
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
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let html = '';

        if (photo?.ai_analysis?.type) {
            console.log('AI 분석 데이터 유형:', photo.ai_analysis.type);
            if (photo.ai_analysis.type === 'portrait') {
                const { wrinkles, pores, spots } = photo.ai_analysis;
                html = `
                    <div class="space-y-3">
                        <div><p class="font-semibold">주름</p><p class="text-blue-600">${wrinkles} 개</p></div>
                        <div><p class="font-semibold">모공</p><p class="text-blue-600">${pores} %</p></div>
                        <div><p class="font-semibold">색소침착</p><p class="text-blue-600">${spots} 개</p></div>
                    </div>
                `;
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
                ctx.lineWidth = Math.max(2, canvas.width / 400);
                for(let i=0; i < wrinkles; i++){
                     ctx.beginPath();
                     const x = Math.random() * canvas.width * 0.6 + canvas.width * 0.2;
                     const y = Math.random() * canvas.height * 0.7 + canvas.height * 0.15;
                     ctx.arc(x, y, canvas.width / 80, 0, 2 * Math.PI);
                     ctx.stroke();
                }
            } else if (photo.ai_analysis.type === 'fray') {
                const { sagging, lifting_sim } = photo.ai_analysis;
                html = `
                    <div class="space-y-3">
                        <div><p class="font-semibold">피부 처짐 지수</p><p class="text-red-600">${sagging} / 100</p></div>
                        <p class="text-sm text-gray-600 mt-4">AI가 예측한 리프팅 시술 후 개선 효과 시뮬레이션입니다.</p>
                    </div>
                `;
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
                ctx.lineWidth = Math.max(3, canvas.width / 300);
                ctx.setLineDash([5, 5]);
                if (lifting_sim) {
                    lifting_sim.forEach(line => {
                        ctx.beginPath();
                        const scaleX = canvas.width / 800;
                        const scaleY = canvas.height / 1200;
                        ctx.moveTo(line.x1 * scaleX, line.y1 * scaleY);
                        ctx.lineTo(line.x2 * scaleX, line.y2 * scaleY);
                        ctx.stroke();
                        ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
                        ctx.beginPath();
                        ctx.moveTo(line.x2*scaleX - 5, line.y2*scaleY);
                        ctx.lineTo(line.x2*scaleX + 5, line.y2*scaleY);
                        ctx.lineTo(line.x2*scaleX, line.y2*scaleY - 8); 
                        ctx.closePath();
                        ctx.fill();
                    });
                }
            } else if (photo.ai_analysis.type === 'uv') {
                const { pigmentation, sebum } = photo.ai_analysis;
                html = `
                    <div class="space-y-3">
                        <div><p class="font-semibold">잠재 색소</p><p class="text-purple-600">${pigmentation} / 100</p></div>
                        <div><p class="font-semibold">피지량</p><p class="text-orange-600">${sebum} / 100</p></div>
                    </div>
                `;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                for(let i=0; i < pigmentation/2; i++){
                     const x = Math.random() * canvas.width;
                     const y = Math.random() * canvas.height;
                     ctx.fillRect(x,y, canvas.width / 40, canvas.height / 60);
                }
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
                    console.error(`Error loading image from Firebase Storage: ${photo.url}`);
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

function generateSampleAIAnalysis(mode) {
    let analysis = {};
    if (mode.includes('F-ray')) {
        analysis = { type: 'fray', sagging: Math.floor(Math.random() * 100), lifting_sim: [ { x1: 200, y1: 300, x2: 400, y2: 280 }, { x1: 250, y1: 500, x2: 450, y2: 480 }, { x1: 300, y1: 700, x2: 500, y2: 680 } ] };
    } else if (mode.includes('Portrait')) {
        analysis = { type: 'portrait', wrinkles: Math.floor(Math.random() * 20) + 5, pores: Math.floor(Math.random() * 30) + 10, spots: Math.floor(Math.random() * 15) + 3 };
    } else if (mode.includes('UV')) {
        analysis = { type: 'uv', pigmentation: Math.floor(Math.random() * 100), sebum: Math.floor(Math.random() * 100) };
    } else {
        analysis = { type: 'general', message: '이 사진에 대한 특정 AI 분석 데이터가 없습니다.' };
    }
    return analysis;
}

// ========================= [코드 수정] =========================
async function handleLocalFileSelect(event) {
    console.log("handleLocalFileSelect 함수 실행됨.");
    const file = event.target.files[0]; 
    if (!file) { console.log("선택된 파일 없음."); return; }
    console.log("선택된 파일:", file.name);

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
    } else {
        console.warn("Filename format is not as expected. Using default values.");
    }
    
    const aiAnalysisData = generateSampleAIAnalysis(photoMode);
    const procedureStatusInKorean = mapStatusToKorean(procedureStatusInEnglish);

    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(file, 'local', photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean);
        alert("사진이 뷰어에 불러와졌습니다. 사진을 저장하려면 좌측에서 환자를 선택하거나 '새 환자 추가' 버튼을 이용하세요.");
        return;
    }

    await displayImageAndSave(file, 'local', state.selectedPatientId, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean); 
}

async function showWebImageSelectModal() {
    console.log("showWebImageSelectModal 함수 실행됨.");
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
                imgEl.src = 'data:image/svg+xml,...'; // 에러 이미지
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
        storageImageList.innerHTML = '<p class="col-span-full text-center text-red-500">이미지 목록을 불러오지 못했습니다. 오류: ' + error.message + '</p>';
    }
}

async function selectWebImageFromStorage(imageUrl, fileName) {
    console.log("selectWebImageFromStorage 함수 실행됨. URL:", imageUrl);
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
    } else {
        console.warn("Filename format is not as expected for web image. Using default values.");
    }
    
    const aiAnalysisData = generateSampleAIAnalysis(photoMode);
    const procedureStatusInKorean = mapStatusToKorean(procedureStatusInEnglish);

    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(imageUrl, 'web', photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean);
        alert("사진이 뷰어에 불러와졌습니다. 사진을 저장하려면 좌측에서 환자를 선택하거나 '새 환자 추가' 버튼을 이용하세요.");
        return;
    }

    await displayImageAndSave(imageUrl, 'web', state.selectedPatientId, photoMode, viewAngle, photoDate, aiAnalysisData, procedureStatusInKorean);
}
// =============================================================

async function displayImageAndSave(source, sourceType, patientId, photoMode, viewAngle, photoDate, aiAnalysisData = {}, procedureStatus = '기타/미지정') {
    console.log("displayImageAndSave 함수 실행됨. sourceType:", sourceType, "patientId:", patientId);
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
    console.log("displayImageWithoutSaving 함수 실행됨. sourceType:", sourceType);
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
    console.log('resetViewerToPlaceholder 호출됨.');
    document.getElementById('viewerPlaceholder').classList.remove('hidden');
    document.getElementById('imageViewer').classList.add('hidden');
    document.getElementById('viewerPlaceholder').innerHTML = `
        <div class="text-center text-gray-500">
            <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1.586-1.586a2 2 0 00-2.828 0L6 14m6-6l.586.586a2 2 0 002.828 0L18 8m-6 6l-1.586 1.586a2 2 0 01-2.828 0L6 14"/></svg>
            <h3 class="mt-2 text-lg font-medium">사진 뷰어</h3>
            <p class="mt-1 text-sm">좌측에서 환자를 검색하고 사진을 선택해주세요.</p>
        </div>
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
        console.log('Photo document deleted from Firestore:', photoId);
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