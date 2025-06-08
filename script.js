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
    stagedPhoto: null, // { url: string, mode: string, viewAngle: string, file: File | null } - 환자 미지정 상태의 사진
};

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


    // 주요 기능 버튼에 클릭 이벤트를 연결합니다.
    document.getElementById('analyzeBtn').addEventListener('click', toggleAnalysisPanel); // AI 분석 패널 토글
    document.getElementById('compareBtn').addEventListener('click', handleCompareButtonClick); // 사진 비교 모드 시작/취소
    document.getElementById('fullScreenBtn').addEventListener('click', toggleFullScreen); // 전체 화면 토글
    document.getElementById('zoomInBtn').addEventListener('click', () => zoomImage(state.zoomStep)); // 확대 버튼
    document.getElementById('zoomOutBtn').addEventListener('click', () => zoomImage(-state.zoomStep)); // 축소 버튼
    document.getElementById('resetViewBtn').addEventListener('click', resetZoomAndPan); // 초기화 버튼
    document.getElementById('deletePhotoBtn').addEventListener('click', () => { // 사진 삭제 버튼
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

    // 로컬 및 웹 파일 업로드 버튼에 이벤트 리스너 추가
    document.getElementById('uploadLocalImageBtn').addEventListener('click', () => {
        console.log("PC에서 불러오기 버튼 클릭됨. (uploadLocalImageBtn)"); // 디버깅 로그 추가
        document.getElementById('localFileInput').click(); // 숨겨진 파일 입력창 클릭 이벤트를 강제로 발생시킵니다.
    });
    document.getElementById('localFileInput').addEventListener('change', (event) => {
        console.log("localFileInput change 이벤트 발생."); // 디버깅 로그 추가
        handleLocalFileSelect(event); // 파일 선택 시 실행될 함수 연결
    });
    
    // '웹에서 사진 불러오기' 버튼 이벤트 리스너 수정
    document.getElementById('uploadWebImageBtn').addEventListener('click', () => {
        console.log("웹에서 불러오기 버튼 클릭됨. (uploadWebImageBtn)"); // 디버깅 로그 추가
        showWebImageSelectModal();
    });

    // '새 환자 추가' 버튼 이벤트 리스너 추가
    document.getElementById('addPatientBtn').addEventListener('click', () => {
        console.log("새 환자 추가 버튼 클릭됨. (addPatientBtn)"); // 디버깅 로그 추가
        addNewPatient();
    });

    // 웹 이미지 선택 모달 닫기 버튼 이벤트 리스너 추가
    document.getElementById('closeWebImageSelectModal').addEventListener('click', () => {
        console.log("웹 이미지 선택 모달 닫기 버튼 클릭됨."); // 디버깅 로그 추가
        document.getElementById('webImageSelectOverlay').classList.add('hidden');
    });

    // 드래그 앤 드롭 이벤트 리스너 추가 (모든 이미지 래퍼에 적용)
    const mainImageWrapper = document.getElementById('mainImageWrapper');
    const compareImageWrapper = document.getElementById('compareImageWrapper');
    const tertiaryImageWrapper = document.getElementById('tertiaryImageWrapper');

    [mainImageWrapper, compareImageWrapper, tertiaryImageWrapper].forEach(wrapper => {
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
    patientListEl.innerHTML = '<p class="text-center text-gray-500 py-4">환자 목록을 불러오는 중...</p>'; // 로딩 메시지
    try {
        const patientsCol = collection(db, 'patients'); // 'patients' 컬렉션 참조
        const patientSnapshot = await getDocs(patientsCol); // 모든 환자 문서 가져오기
        const patients = patientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // 문서 데이터 가공
        
        if (patientSnapshot.empty) {
            console.log('Firestore에 환자 문서가 없습니다.'); // Debug log
        } else {
            console.log('fetchPatients: 불러온 환자 수:', patients.length); // Debug log
        }

        // 검색어 필터링 (클라이언트 측에서, Firebase 쿼리로도 가능)
        const filteredPatients = patients.filter(patient => 
            patient.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            patient.chartId.toLowerCase().includes(searchTerm.toLowerCase())
        );

        renderPatientList(filteredPatients); // 필터링된 환자 목록을 화면에 그립니다.
        if (filteredPatients.length === 0) {
            patientListEl.innerHTML = '<p class="text-center text-gray-500 py-4">환자가 없습니다. "새 환자 추가" 버튼으로 추가해보세요.</p>';
        }
    }
    catch (error) {
        console.error("환자 목록을 불러오는 중 오류 발생:", error);
        patientListEl.innerHTML = '<p class="text-center text-red-500 py-4">환자 목록을 불러오지 못했습니다.</p>';
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
        li.className = 'patient-list-item p-2 cursor-pointer border-b border-gray-200 flex justify-between items-center';
        // 현재 선택된 환자라면 'selected' 클래스를 추가하여 강조합니다.
        if(patient.id === state.selectedPatientId) li.classList.add('selected');

        // 환자 정보를 li 안에 넣어줍니다.
        li.innerHTML = `
            <div>
                <p class="font-semibold">${patient.name}</p>
                <p class="text-sm text-gray-500">${patient.chartId} | ${patient.birth}</p>
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
            const { url, mode, viewAngle, file, ai_analysis } = state.stagedPhoto;
            const photoDate = new Date().toISOString().slice(0, 10);
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
                date: photoDate,
                uploadedAt: new Date(),
                ai_analysis: ai_analysis // staged photo에서 가져온 AI 분석 데이터
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

    document.getElementById('photoDateFilter').value = '';
    document.getElementById('photoAngleFilter').value = 'all';
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
    const patientDoc = await getDocs(query(collection(db, 'patients'), where(documentId(), '==', patientId)));
    const selectedPatient = patientDoc.docs.length > 0 ? patientDoc.docs[0].data() : null;

    if (selectedPatient) {
        document.getElementById('photoListHeader').innerText = `${selectedPatient.name}님의 사진 목록`;
        // stagedPhoto가 없거나, Firestore에 저장된 사진이라면 뷰어의 환자 정보를 업데이트합니다.
        if (!state.stagedPhoto && state.primaryPhotoId) {
            const currentPhoto = await getPhotoById(state.primaryPhotoId);
            if (currentPhoto) {
                 document.getElementById('viewerPatientName').innerText = `${selectedPatient.name} (${selectedPatient.chartId})`;
                 document.getElementById('viewerPhotoInfo').innerText = `${currentPhoto.date} | ${currentPhoto.mode} | ${currentPhoto.viewAngle}`;
            }
        }
    } else {
        document.getElementById('photoListHeader').innerText = `선택된 환자의 사진 목록`;
    }
    
    console.log('fetchPhotos 함수 호출 시작 (selectPatient).'); // 디버깅 로그 추가
    fetchPhotos(patientId); // 필터링된 사진 목록을 불러옵니다.
    console.log('selectPatient 함수 종료.'); // 디버깅 로그 추가
}

// fetchPhotos: Firestore에서 특정 환자의 사진 목록을 불러와 화면에 그립니다.
// 이제 state의 필터 변수들을 직접 참조합니다.
async function fetchPhotos(patientId) {
    console.log('fetchPhotos 호출됨. patientId:', patientId); // Debug log
    if (!patientId) {
        renderPhotoList([]); // 환자 ID가 없으면 빈 목록을 그립니다.
        console.log('fetchPhotos: patientId가 유효하지 않아 빈 사진 목록을 렌더링합니다.'); // Debug log
        return;
    }
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = '<p class="text-center text-gray-500 py-4">사진 목록을 불러오는 중...</p>'; // 로딩 메시지

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

        const photoSnapshot = await getDocs(q);
        let photos = photoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (photoSnapshot.empty) {
            console.log(`fetchPhotos: 환자 ${patientId}에 대한 사진 문서가 없습니다.`); // Debug log
        } else {
            console.log(`fetchPhotos: 불러온 사진 수 (${patientId}):`, photos.length); // Debug log
        }

        // 최신순으로 정렬 (uploadedAt을 기준으로)
        photos.sort((a, b) => {
            // Firestore Timestamp 객체를 JavaScript Date 객체로 변환하여 비교
            const dateA = a.uploadedAt && a.uploadedAt.toDate ? a.uploadedAt.toDate().getTime() : 0;
            const dateB = b.uploadedAt && b.uploadedAt.toDate ? b.uploadedAt.toDate().getTime() : 0;
            return dateB - dateA;
        });

        renderPhotoList(photos); // 불러온 사진 목록을 화면에 그립니다.
        if (photos.length === 0) {
            photoListEl.innerHTML = '<p class="text-center text-gray-500 py-4">이 환자의 사진이 없습니다. PC나 웹에서 사진을 불러와 추가해보세요.</p>';
        }

    } catch (error) {
        console.error("사진 목록을 불러오는 중 오류 발생:", error);
        photoListEl.innerHTML = '<p class="text-center text-red-500 py-4">사진 목록을 불러오지 못했습니다.</p>';
    }
}

// renderPhotoList: 선택된 환자의 사진 목록을 화면에 그립니다.
function renderPhotoList(photos) {
    console.log('renderPhotoList 호출됨. 렌더링할 사진 수:', photos.length); // Debug log
    const photoListEl = document.getElementById('photoList');
    photoListEl.innerHTML = ''; // 기존 사진 목록을 비웁니다.
    
    photos.forEach(photo => {
        const li = document.createElement('li'); // 새로운 리스트 아이템(li)을 만듭니다.
        // Tailwind CSS 클래스를 적용하여 스타일을 입힙니다.
        li.className = 'photo-list-item p-1 cursor-pointer rounded-md flex items-center space-x-2';
        // 현재 선택된(비교 모드 포함) 사진이라면 'selected' 클래스를 추가합니다.
        if(photo.id === state.primaryPhotoId || photo.id === state.secondaryPhotoId || photo.id === state.tertiaryPhotoId) li.classList.add('selected');

        // 사진 썸네일과 정보를 li 안에 넣어줍니다.
        li.innerHTML = `
            <img src="${photo.url}" alt="${photo.mode}" class="w-16 h-16 object-cover rounded-md mb-2">
            <div>
                <p class="font-medium text-sm">${photo.mode} (${photo.viewAngle})</p>
                <p class="text-xs text-gray-500">${photo.date}</p>
            </div>
        `;
        // li를 클릭하면 selectPhoto 함수가 호출되도록 이벤트를 연결합니다.
        li.addEventListener('click', () => {
            console.log('사진 목록 아이템 클릭됨. Photo ID:', photo.id); // 디버깅 로그 추가
            selectPhoto(photo.id);
        });
        photoListEl.appendChild(li); // 완성된 li를 사진 목록에 추가합니다.
    });
}

// selectPhoto: 사진을 선택했을 때 실행되는 함수입니다.
async function selectPhoto(photoId) {
    console.log('selectPhoto 호출됨. photoId:', photoId); // 디버깅 로그 추가
    state.stagedPhoto = null; // Staged photo 초기화

    // Fetch the selected photo to get its full data
    const photo = await getPhotoById(photoId);

    if (!photo) {
        alert("선택된 사진 정보를 찾을 수 없습니다.");
        return;
    }

    if (state.isCompareSelectionActive) { // If in the process of selecting photos for comparison
        console.log('비교 사진 선택 중. 현재 단계:', state.compareSelectionStep);
        // Hide analysis panel if visible
        state.isAnalysisPanelVisible = false;
        document.getElementById('analysisPanel').classList.add('hidden');
        document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white'); 
        document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
        clearAnalysis();

        if (state.compareSelectionStep === 1) { // Selecting the second photo
            if (photoId === state.comparePhotoIds[0]) {
                alert('이미 첫 번째 사진으로 선택되었습니다. 다른 사진을 선택해주세요.');
                return;
            }
            state.comparePhotoIds[1] = photoId; // Second photo
            if (state.compareCount === 2) {
                // Done with 2 photos, comparison ready
                console.log('2장 비교 사진 선택 완료.');
                state.isCompareSelectionActive = false; // Selection complete
                state.isComparingPhotos = true; // Now actively comparing, drag/drop enabled
                state.compareSelectionStep = 0; // Reset step
                document.getElementById('compareBtn').innerText = '사진비교 해제'; // Change button to cancel
            } else if (state.compareCount === 3) {
                console.log('두 번째 사진 선택 완료. 세 번째 사진 선택 단계로 이동.');
                state.compareSelectionStep = 2; // Move to third photo selection
                document.getElementById('compareBtn').innerText = '비교할 세 번째 사진 선택...';
                alert('비교할 세 번째 사진을 좌측 목록에서 선택해주세요.');
            }
        } else if (state.compareSelectionStep === 2) { // Selecting the third photo
            if (photoId === state.comparePhotoIds[0] || photoId === state.comparePhotoIds[1]) {
                alert('이미 선택된 사진입니다. 다른 사진을 선택해주세요.');
                return;
            }
            state.comparePhotoIds[2] = photoId; // Third photo
            // Done with 3 photos, comparison ready
            console.log('3장 비교 사진 선택 완료.');
            state.isCompareSelectionActive = false; // Selection complete
            state.isComparingPhotos = true; // Now actively comparing, drag/drop enabled
            state.compareSelectionStep = 0; // Reset step
            document.getElementById('compareBtn').innerText = '사진비교 해제'; // Change button to cancel
        }
        console.log('비교 모드 진입 (updateComparisonDisplay 호출 전), comparePhotoIds:', state.comparePhotoIds);
        await updateComparisonDisplay(); // Update display with new comparison set
    } else {
        // Single photo view (not in comparison selection or active comparison)
        console.log('단일 사진 뷰 모드. photoId:', photoId);
        state.primaryPhotoId = photoId;
        state.secondaryPhotoId = null;
        state.tertiaryPhotoId = null;
        state.comparePhotoIds = [photoId]; // Set for single view
        state.isCompareSelectionActive = false; // Ensure off
        state.isComparingPhotos = false; // Ensure off
        state.compareSelectionStep = 0;
        state.compareCount = 0;
        await updateComparisonDisplay(); // Update display for single photo
        // Button text should revert to '사진 비교' if not in compare mode
        document.getElementById('compareBtn').innerText = '사진 비교';
        document.getElementById('compareBtn').classList.remove('bg-green-200');
    }
    fetchPhotos(state.selectedPatientId); // Refresh photo list to show selected items
    console.log('selectPhoto 함수 종료. 현재 state.isComparingPhotos:', state.isComparingPhotos);
}

// toggleAnalysisPanel: AI 분석 패널을 보이거나 숨깁니다.
function toggleAnalysisPanel() {
    state.isAnalysisPanelVisible = !state.isAnalysisPanelVisible; // 상태를 토글합니다.
    const panel = document.getElementById('analysisPanel');
    const btn = document.getElementById('analyzeBtn');

    console.log('AI 분석 버튼 클릭됨. 현재 isAnalysisPanelVisible:', state.isAnalysisPanelVisible);
    console.log('현재 primaryPhotoId:', state.primaryPhotoId);

    if (state.isAnalysisPanelVisible) { // 패널을 보이게 할 때
        panel.classList.remove('hidden'); // 패널을 보입니다.
        btn.classList.add('bg-[#4CAF50]', 'text-white'); // 버튼 색상을 변경하여 활성화 상태를 표시합니다.
        
        if (state.primaryPhotoId) {
            getDoc(doc(db, 'photos', state.primaryPhotoId))
                .then(snapshot => {
                    if (snapshot.exists()) {
                        const photoData = { id: snapshot.id, ...snapshot.data() };
                        console.log('Firestore에서 불러온 사진 데이터:', photoData);
                        if (photoData.ai_analysis && Object.keys(photoData.ai_analysis).length > 0) {
                            renderAnalysis(photoData);
                        } else {
                            clearAnalysis();
                            document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>이 사진에 대한 AI 분석 정보가 없습니다. 새로 사진을 업로드하거나 다른 사진을 선택해보세요.</p>";
                            console.log('AI 분석 데이터가 없거나 비어있습니다.');
                        }
                    } else {
                        clearAnalysis();
                        document.getElementById('analysisContent').innerHTML = "<p class='text-gray-500'>선택된 사진 정보를 찾을 수 없습니다.</p>";
                        console.log('선택된 사진 문서가 Firestore에 존재하지 않습니다.');
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
            console.log('primaryPhotoId가 설정되지 않았습니다.');
        }
    } else { // 패널을 숨길 때
        panel.classList.add('hidden'); // 패널을 숨깁니다.
        btn.classList.remove('bg-[#4CAF50]', 'text-white'); 
        btn.classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
        clearAnalysis(); // 분석 내용을 지웁니다.
        console.log('AI 분석 패널이 숨겨졌습니다.');
    }
}

// renderAnalysis: 선택된 사진의 AI 분석 결과를 캔버스에 그리고 패널에 표시합니다.
// 이제 Firestore에서 가져온 photo 객체의 ai_analysis 데이터를 사용합니다.
function renderAnalysis(photo) {
    console.log('renderAnalysis 호출됨. photo:', photo);
    const contentEl = document.getElementById('analysisContent');
    const canvas = document.getElementById('analysisCanvas');
    const ctx = canvas.getContext('2d');
    const img = document.getElementById('mainImage');
    
    // 이미지가 로드된 후 캔버스 크기 및 그리기
    const render = () => {
        canvas.width = img.naturalWidth; // 캔버스 내부 해상도를 이미지 원본 해상도에 맞춤
        canvas.height = img.naturalHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height); // 기존 그림을 지웁니다.
        let html = '';

        if (photo && photo.ai_analysis && photo.ai_analysis.type) { // photo와 ai_analysis 데이터가 있을 때만 렌더링
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
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // 노란색
                ctx.lineWidth = Math.max(2, canvas.width / 400); // 캔버스 크기에 비례하여 선 굵기 조정
                for(let i=0; i < wrinkles; i++){ // 가상의 주름 표시
                     ctx.beginPath();
                     const x = Math.random() * canvas.width * 0.6 + canvas.width * 0.2;
                     const y = Math.random() * canvas.height * 0.7 + canvas.height * 0.15;
                     ctx.arc(x, y, canvas.width / 80, 0, 2 * Math.PI); // 크기 조정
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
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)'; // 하늘색
                ctx.lineWidth = Math.max(3, canvas.width / 300); // 캔버스 크기에 비례하여 선 굵기 조정
                ctx.setLineDash([5, 5]); // 점선
                if (lifting_sim) { // lifting_sim 데이터가 있을 경우에만 그립니다.
                    lifting_sim.forEach(line => {
                        ctx.beginPath();
                        // 좌표는 0-1000 기준이라고 가정하고 캔버스 크기에 맞춰 스케일링
                        const scaleX = canvas.width / 800; // 샘플 데이터가 800x1200 기준으로 생성된 경우
                        const scaleY = canvas.height / 1200; // 샘플 데이터가 800x1200 기준으로 생성된 경우

                        ctx.moveTo(line.x1 * scaleX, line.y1 * scaleY);
                        ctx.lineTo(line.x2 * scaleX, line.y2 * scaleY);
                        ctx.stroke();
                        
                        // 화살표 그리기
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
                ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'; // 빨간색 (투명도 15%)
                for(let i=0; i < pigmentation/2; i++){ // 가상의 색소침착 표시
                     const x = Math.random() * canvas.width;
                     const y = Math.random() * canvas.height;
                     ctx.fillRect(x,y, canvas.width / 40, canvas.height / 60); // 크기 조정
                }
            }
        } else {
            html = "<p class='text-gray-500'>이 사진에 대한 AI 분석 정보가 없습니다.</p>";
            console.log('AI 분석 데이터 유형이 정의되지 않았거나 photo 객체가 유효하지 않습니다.');
        }
        contentEl.innerHTML = html; // 분석 결과를 패널에 표시합니다.
    }
    
    // 이미지가 로드된 후에 캔버스 크기를 설정하고 그리기
    if (img.complete) {
        render();
    } else {
        img.onload = render;
    }
    window.onresize = render; // 창 크기 변경 시에도 다시 렌더링
}

// clearAnalysis: 분석 패널의 내용을 지우고 캔버스를 초기화합니다.
function clearAnalysis() {
    const canvas = document.getElementById('analysisCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 내용을 지웁니다.
    document.getElementById('analysisContent').innerHTML = ''; // 분석 패널 내용을 비웁니다.
}

// handleCompareButtonClick: '사진 비교' 버튼 클릭 시 실행됩니다.
function handleCompareButtonClick() {
    console.log('handleCompareButtonClick 호출됨. 현재 isComparingPhotos:', state.isComparingPhotos, 'isCompareSelectionActive:', state.isCompareSelectionActive);
    // Check if there's at least one photo selected to start comparison
    if (!state.primaryPhotoId) { // primaryPhotoId가 null이면 선택된 사진 없음
        alert('먼저 비교할 첫 번째 사진을 불러오거나 선택해주세요.');
        return;
    }

    if (state.isComparingPhotos || state.isCompareSelectionActive) { // If currently in comparison display mode OR selection mode, clicking button cancels it
        console.log('비교 모드 또는 선택 모드 활성 중. 비교 모드 해제 시작.');
        state.isComparingPhotos = false;
        state.isCompareSelectionActive = false;
        state.compareSelectionStep = 0;
        state.compareCount = 0;
        document.getElementById('compareBtn').innerText = '사진 비교';
        document.getElementById('compareBtn').classList.remove('bg-green-200');
        
        // Revert to single primary photo view if it exists, otherwise to placeholder
        if (state.primaryPhotoId) {
            state.comparePhotoIds = [state.primaryPhotoId];
            updateComparisonDisplay(); // This will render single photo
        } else {
            resetViewerToPlaceholder(); // This will clear everything
        }
        
        // If analysis panel was visible, re-render analysis for the primary photo (if still selected)
        if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
            getPhotoById(state.primaryPhotoId).then(photo => {
                if (photo) renderAnalysis(photo);
            });
        }
    } else { // Not in comparison display mode, so initiate selection
        console.log('비교 모드 비활성. 비교 선택 시작.');
        // Hide analysis panel if visible
        state.isAnalysisPanelVisible = false;
        document.getElementById('analysisPanel').classList.add('hidden');
        document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white'); 
        document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
        clearAnalysis();

        // Show compare choice overlay
        document.getElementById('compareChoiceOverlay').classList.remove('hidden');
    }
}

// startCompareSelection: 비교할 사진 개수(2장 또는 3장)를 선택했을 때 실행됩니다.
function startCompareSelection(count) {
    console.log('startCompareSelection 호출됨. count:', count);
    document.getElementById('compareChoiceOverlay').classList.add('hidden'); // 선택 팝업을 숨깁니다.
    state.isCompareSelectionActive = true; // Set selection active
    state.isComparingPhotos = false; // Ensure comparison display is off during selection
    state.compareCount = count; // 비교할 사진 개수를 저장합니다.
    state.compareSelectionStep = 1; // 두 번째 사진 선택 단계로 설정합니다.

    // Initialize comparePhotoIds with the primary photo if it exists
    state.comparePhotoIds = state.primaryPhotoId ? [state.primaryPhotoId, null, null].slice(0, count) : [null, null, null].slice(0, count);
    
    document.getElementById('compareBtn').innerText = '비교할 두 번째 사진 선택...'; // 버튼 텍스트를 변경합니다.
    document.getElementById('compareBtn').classList.add('bg-green-200'); // 버튼 색상을 변경하여 활성화 표시
    alert('비교할 두 번째 사진을 좌측 목록에서 선택하거나 PC/웹에서 불러와 선택해주세요.'); // 사용자에게 안내

    // Hide analysis panel
    state.isAnalysisPanelVisible = false;
    document.getElementById('analysisPanel').classList.add('hidden');
    document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white'); 
    document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]'); 
    clearAnalysis();

    resetZoomAndPan(); // 확대/이동 상태 초기화
    updateComparisonDisplay(); // Initial display for compare selection
    console.log('startCompareSelection 종료. state.isCompareSelectionActive:', state.isCompareSelectionActive, 'state.isComparingPhotos:', state.isComparingPhotos);
}

// updateComparisonDisplay: 현재 state.comparePhotoIds 배열을 기반으로 비교 뷰를 렌더링합니다.
async function updateComparisonDisplay() {
    console.log('updateComparisonDisplay 호출됨. 현재 comparePhotoIds:', state.comparePhotoIds);
    const mainImageWrapper = document.getElementById('mainImageWrapper');
    const compareImageWrapper = document.getElementById('compareImageWrapper');
    const tertiaryImageWrapper = document.getElementById('tertiaryImageWrapper');
    const imageContainer = document.getElementById('image-container');
    const viewerPatientName = document.getElementById('viewerPatientName');
    const viewerPhotoInfo = document.getElementById('viewerPhotoInfo');

    document.getElementById('viewerPlaceholder').classList.add('hidden');
    document.getElementById('imageViewer').classList.remove('hidden');
    document.getElementById('imageViewer').classList.add('flex'); // Ensure imageViewer is visible

    const photoElements = [
        { id: 'mainImage', wrapper: mainImageWrapper },
        { id: 'compareImage', wrapper: compareImageWrapper },
        { id: 'tertiaryImage', wrapper: tertiaryImageWrapper }
    ];

    let infoTexts = [];
    let patientData = null; // To store patient data once for the viewer header

    // 이미지 래퍼들의 클래스 초기화
    photoElements.forEach(el => {
        el.wrapper.classList.add('hidden');
        el.wrapper.classList.remove('flex-1', 'w-full');
        document.getElementById(el.id).src = '';
        el.wrapper.dataset.photoId = ''; // Data ID 초기화
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
                // Store photoId on wrapper for drag/drop
                wrapperEl.dataset.photoId = photo.id;
                infoTexts.push(`${photo.date} (${photo.mode} ${photo.viewAngle})`);
                if (!patientData) { // Fetch patient data only once from the first available photo
                    const patientDoc = await getDoc(doc(db, 'patients', photo.patientId));
                    patientData = patientDoc.exists() ? patientDoc.data() : null;
                }
            }
        }
    }

    // Adjust layout based on number of visible images
    if (state.comparePhotoIds.filter(id => id !== null).length > 1) { // 실제로 2장 이상 비교 중일 때
        imageContainer.classList.remove('flex-col');
        imageContainer.classList.add('flex-row', 'gap-4', 'justify-center', 'items-center');
    } else if (state.comparePhotoIds.filter(id => id !== null).length === 1) { // Only primary photo, single view
        mainImageWrapper.classList.remove('hidden'); // Ensure main image is visible
        mainImageWrapper.classList.remove('flex-1');
        mainImageWrapper.classList.add('w-full');
        // Other wrappers are already hidden by the loop initial cleanup
        imageContainer.classList.remove('flex-row', 'gap-4');
        imageContainer.classList.add('flex-col');
    }
    else {
        // No photos selected, revert to placeholder
        resetViewerToPlaceholder();
        console.log('updateComparisonDisplay: 비교할 사진이 없어 플레이스홀더로 초기화.');
        return; // Don't proceed with updating viewer info if no photos
    }

    if (patientData) {
        viewerPatientName.innerText = `${patientData.name} (${patientData.chartId})`;
    } else {
        viewerPatientName.innerText = '사진 뷰어';
    }
    viewerPhotoInfo.innerText = infoTexts.join(' vs ');

    resetZoomAndPan();
    // In comparison mode, analysis panel is always hidden
    state.isAnalysisPanelVisible = false;
    document.getElementById('analysisPanel').classList.add('hidden');
    document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white');
    document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]');
    clearAnalysis();
    console.log('updateComparisonDisplay 종료. 현재 state.isComparingPhotos:', state.isComparingPhotos);
}

// resetComparisonView function will be simplified, as updateComparisonDisplay handles most of it.
async function resetComparisonView() {
    console.log('resetComparisonView 호출됨.');
    state.secondaryPhotoId = null;
    state.tertiaryPhotoId = null;
    state.compareCount = 0;
    // If there's a primary photo, revert to single view, otherwise to placeholder
    if (state.primaryPhotoId) {
        state.comparePhotoIds = [state.primaryPhotoId];
    } else {
        state.comparePhotoIds = [];
    }
    state.isComparingPhotos = false; // 비교 모드 해제
    state.isCompareSelectionActive = false; // 선택 모드 해제
    await updateComparisonDisplay();
}

// toggleFullScreen: 전체 화면 모드를 토글합니다. (실제 전체 화면은 아님)
function toggleFullScreen() {
    const sidebar = document.getElementById('sidebar');
    const mainViewer = document.getElementById('mainViewer');
    const fullScreenBtn = document.getElementById('fullScreenBtn');

    const isSimulatedFullScreen = mainViewer.classList.contains('full-screen-viewer');

    if (isSimulatedFullScreen) { // 현재 시뮬레이션 전체 화면이라면 일반 모드로
        sidebar.classList.remove('hidden'); 
        mainViewer.classList.remove('full-screen-viewer', 'w-full'); 
        mainViewer.classList.add('md:w-2/3', 'lg:w-3/4'); 
        fullScreenBtn.innerText = '전체 화면'; 
    } else { // 현재 일반 모드라면 시뮬레이션 전체 화면으로
        sidebar.classList.add('hidden'); 
        mainViewer.classList.add('full-screen-viewer', 'w-full'); 
        mainViewer.classList.remove('md:w-2/3', 'lg:w-3/4'); 
        fullScreenBtn.innerText = '전체 화면 종료'; 
    }
    // 분석 캔버스가 보인다면 새 크기에 맞춰 다시 렌더링합니다.
    if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
        getPhotoById(state.primaryPhotoId).then(photo => {
            if (photo) renderAnalysis(photo);
        });
    }
    resetZoomAndPan(); 
}

// applyTransforms: 이미지와 캔버스에 확대/이동 변환을 적용합니다.
function applyTransforms() {
    const images = [document.getElementById('mainImage'), document.getElementById('compareImage'), document.getElementById('tertiaryImage')];
    const analysisCanvas = document.getElementById('analysisCanvas');

    // 각 이미지에 변환을 적용합니다.
    images.forEach(img => {
        if (!img.classList.contains('hidden')) {
            img.style.transform = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px) scale(${state.currentZoomLevel})`;
        }
    });
    // 캔버스 변환은 메인 이미지의 변환과 일치해야 합니다.
    const mainImage = document.getElementById('mainImage');
    if (mainImage && !mainImage.classList.contains('hidden')) {
         const mainImageRect = mainImage.getBoundingClientRect();
         const containerRect = document.getElementById('image-container').getBoundingClientRect();
         
         // 캔버스 위치를 컨테이너 내에서 이미지 위치에 맞춰 계산합니다.
         const canvasX = mainImageRect.left - containerRect.left;
         const canvasY = mainImageRect.top - containerRect.top;

         // 캔버스의 CSS transform 적용 (위치 및 확대/축소)
         // 캔버스의 내부 해상도(width/height attribute)는 이미지의 naturalWidth/Height를 따르므로,
         // 여기서는 CSS transform만 적용하여 보이는 크기를 조절합니다.
         analysisCanvas.style.left = `${canvasX}px`;
         analysisCanvas.style.top = `${canvasY}px`;
         analysisCanvas.style.transform = `scale(${state.currentZoomLevel})`;
         analysisCanvas.style.width = `${mainImageRect.width}px`; // 실제 보이는 크기
         analysisCanvas.style.height = `${mainImageRect.height}px`;

    } else {
        // 메인 이미지가 보이지 않으면 캔버스를 숨기고 초기화합니다.
        analysisCanvas.style.left = '0px';
        analysisCanvas.style.top = '0px';
        analysisCanvas.style.transform = 'scale(1.0)';
        analysisCanvas.style.width = '0px';
        analysisCanvas.style.height = '0px';
    }
}

// zoomImage: 이미지 확대/축소를 처리합니다.
function zoomImage(step) {
    let newZoomLevel = state.currentZoomLevel + step;
    if (newZoomLevel > state.maxZoom) newZoomLevel = state.maxZoom; 
    if (newZoomLevel < state.minZoom) newZoomLevel = state.minZoom; 
    
    state.currentZoomLevel = newZoomLevel;
    applyTransforms(); 
    
    // 분석 패널이 보이는 상태라면 분석 결과도 다시 렌더링하여 확대/축소에 맞춥니다.
    if (state.isAnalysisPanelVisible && state.primaryPhotoId) {
        getPhotoById(state.primaryPhotoId).then(photo => {
            if (photo) renderAnalysis(photo);
        });
    }
}

// resetZoomAndPan: 확대/이동 상태를 초기화합니다.
function resetZoomAndPan() {
    state.currentZoomLevel = 1.0;
    state.currentTranslateX = 0;
    state.currentTranslateY = 0;
    state.lastTranslateX = 0;
    state.lastTranslateY = 0;
    applyTransforms(); 
}

// handleMouseWheelZoom: 마우스 휠 이벤트로 확대/축소를 처리합니다.
function handleMouseWheelZoom(e) {
    e.preventDefault(); 
    const zoomDirection = e.deltaY < 0 ? state.zoomStep : -state.zoomStep; 
    zoomImage(zoomDirection);
}

// handleMouseDown: 마우스 클릭 시 드래그 시작을 처리합니다.
function handleMouseDown(e) {
    if (e.button === 0 && state.currentZoomLevel > 1.0) { 
        state.isDragging = true;
        state.startX = e.clientX; 
        state.startY = e.clientY; 
        state.lastTranslateX = state.currentTranslateX; 
        state.lastTranslateY = state.currentTranslateY;
        document.getElementById('image-container').classList.add('cursor-grabbing'); // 커서 변경
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseleave', handleMouseUp); 
    }
}

// handleMouseMove: 마우스 드래그 중 이동을 처리합니다.
function handleMouseMove(e) {
    if (!state.isDragging) return; 

    const dx = e.clientX - state.startX; 
    const dy = e.clientY - state.startY; 

    state.currentTranslateX = state.lastTranslateX + dx; 
    state.currentTranslateY = state.lastTranslateY + dy; 
    
    applyTransforms(); 
}

// handleMouseUp: 마우스 버튼을 뗄 때 드래그 종료를 처리합니다.
function handleMouseUp() {
    state.isDragging = false; 
    document.getElementById('image-container').classList.remove('cursor-grabbing'); // 커서 원래대로
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mouseleave', handleMouseUp);
}

// handleDragStart: 드래그 시작 시 호출
function handleDragStart(e) {
    console.log('Drag Start Event: target ID:', e.target.closest('.image-wrapper')?.id, 'isComparingPhotos:', state.isComparingPhotos, 'comparePhotoIds.length:', state.comparePhotoIds.length);
    // Only allow dragging when actually comparing photos (isComparingPhotos is true) and there's more than one photo to reorder
    if (!state.isComparingPhotos || state.comparePhotoIds.filter(id => id !== null).length <= 1) { // Filter out nulls for accurate count
        e.preventDefault(); 
        console.log('Drag prevented: Not actively comparing or less than 2 valid photos to compare.');
        return;
    }

    const draggedWrapper = e.target.closest('.image-wrapper'); // 실제 래퍼 요소 가져오기
    if (draggedWrapper && draggedWrapper.dataset.photoId) {
        e.dataTransfer.setData('text/plain', draggedWrapper.dataset.photoId);
        e.dataTransfer.effectAllowed = 'move';
        draggedWrapper.classList.add('dragging-source'); // 드래그 소스에 시각적 피드백 추가
        console.log('Drag started for photoId:', draggedWrapper.dataset.photoId);
    } else {
        console.log('Drag prevented: No photoId on dragged element or not a valid wrapper.');
        e.preventDefault(); // 유효하지 않은 드래그 방지
    }
}

// handleDragOver: 드롭 대상 위로 드래그 시 호출
function handleDragOver(e) {
    e.preventDefault(); // 드롭 허용
    // console.log('Drag Over Event:', e.target.closest('.image-wrapper')?.id);
    // dataTransfer에 'text/plain' 타입이 포함되어 있는지 확인 (드래그 시작 시 설정된 데이터)
    if (e.dataTransfer.types.includes('text/plain')) {
        e.dataTransfer.dropEffect = 'move';
        const targetWrapper = e.target.closest('.image-wrapper');
        if (targetWrapper && targetWrapper.dataset.photoId && targetWrapper !== e.target.closest('.dragging-source')) { // 드래그 소스 자기 자신은 제외
            targetWrapper.classList.add('drag-over'); // 드롭 대상에 시각적 피드백 추가
        }
    }
}

// handleDragLeave: 드롭 대상에서 벗어날 때 호출
function handleDragLeave(e) {
    // console.log('Drag Leave Event:', e.target.closest('.image-wrapper')?.id);
    e.target.closest('.image-wrapper')?.classList.remove('drag-over'); // 시각적 피드백 제거
}

// handleDrop: 드롭 시 호출
async function handleDrop(e) {
    e.preventDefault();
    console.log('Drop Event on:', e.target.closest('.image-wrapper')?.id);
    const targetWrapper = e.target.closest('.image-wrapper');
    targetWrapper?.classList.remove('drag-over'); // 시각적 피드백 제거

    if (targetWrapper && targetWrapper.dataset.photoId) {
        const draggedPhotoId = e.dataTransfer.getData('text/plain');
        const targetPhotoId = targetWrapper.dataset.photoId;
        console.log('Dragged ID:', draggedPhotoId, 'Target ID:', targetPhotoId);

        if (draggedPhotoId === targetPhotoId) { // 자기 자신 위에 드롭한 경우
            console.log('Dropped on itself. No change.');
            return;
        }

        const draggedIndex = state.comparePhotoIds.indexOf(draggedPhotoId);
        const targetIndex = state.comparePhotoIds.indexOf(targetPhotoId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            // 배열 순서 변경
            const newComparePhotoIds = [...state.comparePhotoIds]; // 배열 복사
            const [draggedItem] = newComparePhotoIds.splice(draggedIndex, 1);
            newComparePhotoIds.splice(targetIndex, 0, draggedItem);
            
            state.comparePhotoIds = newComparePhotoIds; // 새로운 배열로 상태 업데이트
            
            // 일관성을 위해 primary, secondary, tertiary ID 업데이트
            state.primaryPhotoId = state.comparePhotoIds[0] || null;
            state.secondaryPhotoId = state.comparePhotoIds[1] || null;
            state.tertiaryPhotoId = state.comparePhotoIds[2] || null;

            console.log('New comparePhotoIds order:', state.comparePhotoIds);
            await updateComparisonDisplay(); // 새 순서로 비교 뷰 다시 렌더링
        } else {
            console.log('Invalid drag or target index:', draggedIndex, targetIndex);
        }
    } else {
        console.log('Drop target has no photoId or is not a valid wrapper.');
    }
}

// handleDragEnd: 드래그가 끝날 때 (성공/실패 무관) 호출
function handleDragEnd(e) {
    console.log('Drag End Event:', e.target.closest('.image-wrapper')?.id);
    e.target.closest('.image-wrapper')?.classList.remove('dragging-source'); // 소스 피드백 제거
}

// generateSampleAIAnalysis: 모드에 따라 샘플 AI 분석 데이터를 생성합니다.
function generateSampleAIAnalysis(mode) {
    let analysis = {};
    if (mode.includes('F-ray')) { // F-ray 또는 F-ray_C0 등 포함하는 경우
        analysis = {
            type: 'fray',
            sagging: Math.floor(Math.random() * 100), // 0-99 사이의 무작위 값
            lifting_sim: [
                { x1: 200, y1: 300, x2: 400, y2: 280 },
                { x1: 250, y1: 500, x2: 450, y2: 480 },
                { x1: 300, y1: 700, x2: 500, y2: 680 }
            ]
        };
    } else if (mode.includes('Portrait')) { // Portrait 포함하는 경우
        analysis = {
            type: 'portrait',
            wrinkles: Math.floor(Math.random() * 20) + 5, // 5-24 사이
            pores: Math.floor(Math.random() * 30) + 10,   // 10-39 사이 (퍼센트)
            spots: Math.floor(Math.random() * 15) + 3    // 3-17 사이
        };
    } else if (mode.includes('UV')) { // UV 포함하는 경우
        analysis = {
            type: 'uv',
            pigmentation: Math.floor(Math.random() * 100), // 0-99 사이
            sebum: Math.floor(Math.random() * 100)      // 0-99 사이
        };
    } else {
        analysis = {
            type: 'general',
            message: '이 사진에 대한 특정 AI 분석 데이터가 없습니다.'
        };
    }
    return analysis;
}

// handleLocalFileSelect: 로컬 파일 선택 시 Firebase Storage에 업로드하고 Firestore에 정보 저장, 화면에 표시합니다.
async function handleLocalFileSelect(event) {
    console.log("handleLocalFileSelect 함수 실행됨."); // 디버깅 로그 추가
    const file = event.target.files[0]; 
    if (!file) { console.log("선택된 파일 없음."); return; }
    console.log("선택된 파일:", file.name);

    // 파일 이름과 확장자를 가져옵니다.
    const fileName = file.name;
    const baseName = fileName.split('.')[0]; // 확장자 제외한 이름 (예: 문성희_01022554520_F-ray_C0_20250529)
    const parts = baseName.split('_'); // 언더스코어(_)로 분리

    let photoMode = 'PC Upload'; // 기본 모드
    let viewAngle = 'C0'; // 기본 뷰 각도
    let photoDate = new Date().toISOString().slice(0, 10); // 기본 촬영 날짜 (업로드 날짜)

    // 파일 이름에서 모드, 각도, 날짜 유추 (형식: 이름_전화번호_촬영모드_각도_촬영일자.jpg)
    if (parts.length >= 5) { // 최소 5개의 파트가 있을 때만 파싱
        photoMode = parts[2]; // 세 번째 파트: 촬영모드
        viewAngle = parts[3]; // 네 번째 파트: 각도
        const datePart = parts[4]; // 다섯 번째 파트: 촬영일자 (YYYYMMDD)
        if (datePart.length === 8 && !isNaN(datePart)) { //InstrumentedTestMMDD 형식 확인
            photoDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
        }
    } else {
        // 파일명 형식이 맞지 않을 경우 기본값 사용 또는 경고
        console.warn("Filename format is not as expected: 이름_전화번호_촬영모드_각도_촬영일자.jpg. Using default values for mode/angle/date.");
    }
    
    // AI 분석 데이터 생성
    const aiAnalysisData = generateSampleAIAnalysis(photoMode);

    // 환자가 선택되지 않았을 경우, 일단 사진을 뷰어에 표시하고 stagedPhoto에 저장
    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(file, 'local', photoMode, viewAngle, photoDate, aiAnalysisData);
        alert("사진이 뷰어에 불러와졌습니다. 사진을 저장하려면 좌측에서 환자를 선택하거나 '새 환자 추가' 버튼을 이용하세요.");
        return;
    }

    // 환자가 선택되어 있다면 바로 Firestore에 저장 및 표시
    await displayImageAndSave(file, 'local', state.selectedPatientId, photoMode, viewAngle, photoDate, aiAnalysisData); 
}

// showWebImageSelectModal: 웹 이미지 선택 모달을 표시하고 Storage에서 이미지 목록을 불러옵니다.
async function showWebImageSelectModal() {
    console.log("showWebImageSelectModal 함수 실행됨."); // 디버깅 로그 추가
    const webImageSelectOverlay = document.getElementById('webImageSelectOverlay');
    const storageImageList = document.getElementById('storageImageList');
    
    webImageSelectOverlay.classList.remove('hidden');
    storageImageList.innerHTML = '<p class="col-span-full text-center text-gray-500">Storage에서 이미지를 불러오는 중...</p>';

    try {
        // 'images' 폴더의 참조를 가져옵니다.
        const listRef = ref(storage, 'images/');
        // 폴더 내 모든 항목(파일)을 나열합니다.
        const res = await listAll(listRef);

        storageImageList.innerHTML = ''; // 기존 로딩 메시지 제거

        if (res.items.length === 0) {
            storageImageList.innerHTML = '<p class="col-span-full text-center text-gray-500">\'images\' 폴더에 사진이 없습니다.</p>';
            return;
        }

        for (const itemRef of res.items) {
            const imageUrl = await getDownloadURL(itemRef);
            const fileName = itemRef.name; // 파일 이름 (예: 'Portrait_C0.jpg')

            const imgDiv = document.createElement('div');
            imgDiv.className = 'relative flex flex-col items-center justify-center p-2 border rounded-md hover:shadow-lg transition-shadow';
            imgDiv.innerHTML = `
                <img src="${imageUrl}" alt="${fileName}" class="w-24 h-24 object-cover rounded-md mb-2">
                <span class="text-xs text-gray-600 truncate w-full text-center">${fileName}</span>
            `;
            // 이미지 클릭 시 해당 이미지를 선택하여 뷰어에 표시
            imgDiv.addEventListener('click', () => selectWebImageFromStorage(imageUrl, fileName));
            storageImageList.appendChild(imgDiv);
        }

    } catch (error) {
        console.error("Storage 이미지 목록 불러오기 실패:", error);
        storageImageList.innerHTML = '<p class="col-span-full text-center text-red-500">이미지 목록을 불러오지 못했습니다. 오류: ' + error.message + '</p>';
    }
}

// selectWebImageFromStorage: Storage에서 선택된 웹 이미지를 처리합니다.
async function selectWebImageFromStorage(imageUrl, fileName) {
    console.log("selectWebImageFromStorage 함수 실행됨. URL:", imageUrl); // 디버깅 로그 추가
    document.getElementById('webImageSelectOverlay').classList.add('hidden'); // 모달 닫기

    const baseName = fileName.split('.')[0]; // 확장자 제외한 이름
    const parts = baseName.split('_'); // 언더스코어(_)로 분리

    let photoMode = 'Web URL'; // 기본 모드
    let viewAngle = 'C0'; // 기본 뷰 각도
    let photoDate = new Date().toISOString().slice(0, 10); // 기본 촬영 날짜 (현재 날짜)

    // 파일 이름에서 모드, 각도, 날짜 유추 (형식: 이름_전화번호_촬영모드_각도_촬영일자.jpg)
    if (parts.length >= 5) {
        photoMode = parts[2]; // 세 번째 파트: 촬영모드
        viewAngle = parts[3]; // 네 번째 파트: 각도
        const datePart = parts[4]; // 다섯 번째 파트: 촬영일자 (YYYYMMDD)
        if (datePart.length === 8 && !isNaN(datePart)) {
            photoDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
        }
    } else {
        console.warn("Filename format is not as expected for web image: 이름_전화번호_촬영모드_각도_촬영일자.jpg. Using default values for mode/angle/date.");
    }
    
    // AI 분석 데이터 생성
    const aiAnalysisData = generateSampleAIAnalysis(photoMode);

    // 환자가 선택되지 않았을 경우, 일단 사진을 뷰어에 표시하고 stagedPhoto에 저장
    if (!state.selectedPatientId) {
        await displayImageWithoutSaving(imageUrl, 'web', photoMode, viewAngle, photoDate, aiAnalysisData);
        alert("사진이 뷰어에 불러와졌습니다. 사진을 저장하려면 좌측에서 환자를 선택하거나 '새 환자 추가' 버튼을 이용하세요.");
        return;
    }

    // 환자가 선택되어 있다면 바로 Firestore에 저장 및 표시
    await displayImageAndSave(imageUrl, 'web', state.selectedPatientId, photoMode, viewAngle, photoDate, aiAnalysisData);
}


// displayImageAndSave: 이미지를 뷰어에 표시하고 Firestore에 저장합니다. (환자 ID가 있을 때)
async function displayImageAndSave(source, sourceType, patientId, photoMode, viewAngle, photoDate, aiAnalysisData = {}) {
    console.log("displayImageAndSave 함수 실행됨. sourceType:", sourceType, "patientId:", patientId); // 디버깅 로그 추가
    const viewerPlaceholder = document.getElementById('viewerPlaceholder');
    const imageViewer = document.getElementById('imageViewer');
    const mainImage = document.getElementById('mainImage');

    viewerPlaceholder.classList.remove('hidden');
    imageViewer.classList.add('hidden');
    viewerPlaceholder.innerHTML = `
        <div class="text-center text-gray-500">
            <h3 class="mt-2 text-lg font-medium">사진을 불러오는 중입니다...</h3>
            <p class="mt-1 text-sm">잠시만 기다려주세요.</p>
        </div>
    `;

    try {
        let imageUrlToDisplay;

        if (sourceType === 'local') {
            const file = source;
            // 파일 이름을 고유하게 만들기 위해 타임스탬프 추가
            const storageRef = ref(storage, `photos/${patientId}/${file.name}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            imageUrlToDisplay = await getDownloadURL(snapshot.ref);
            console.log('File uploaded to Firebase Storage:', imageUrlToDisplay);
        } else if (sourceType === 'web') {
            imageUrlToDisplay = source;
            console.log('Loading image from Web URL:', imageUrlToDisplay);
        }

        // Firestore에 사진 메타데이터 저장
        const newPhotoData = {
            patientId: patientId,
            url: imageUrlToDisplay,
            mode: photoMode,
            viewAngle: viewAngle,
            date: photoDate, // 파싱된 photoDate 사용
            uploadedAt: new Date(),
            ai_analysis: aiAnalysisData, // AI 분석 데이터 포함
        };
        const docRef = await addDoc(collection(db, 'photos'), newPhotoData);
        state.primaryPhotoId = docRef.id; // Firestore 문서 ID를 primaryPhotoId로 사용

        console.log("Photo metadata saved to Firestore with ID:", state.primaryPhotoId);

        // 뷰어에 사진을 표시합니다.
        state.comparePhotoIds = [state.primaryPhotoId];
        await updateComparisonDisplay();

        // 새 사진이 추가되었으므로 현재 환자의 사진 목록을 새로고침합니다.
        fetchPhotos(patientId); // 필터링을 유지하기 위해 인자 없이 호출

    } catch (error) {
        console.error("사진을 불러오거나 Firestore에 저장하는 중 오류 발생:", error);
        alert("사진을 불러오거나 저장하는데 실패했습니다. 오류: " + error.message);
        resetViewerToPlaceholder();
    }
}

// displayImageWithoutSaving: 이미지를 뷰어에 표시하지만 Firestore에는 저장하지 않습니다. (환자 ID가 없을 때)
async function displayImageWithoutSaving(source, sourceType, photoMode, viewAngle, photoDate, aiAnalysisData = {}) {
    console.log("displayImageWithoutSaving 함수 실행됨. sourceType:", sourceType); // 디버깅 로그 추가
    const viewerPlaceholder = document.getElementById('viewerPlaceholder');
    const imageViewer = document.getElementById('imageViewer');
    const mainImage = document.getElementById('mainImage');

    viewerPlaceholder.classList.remove('hidden');
    imageViewer.classList.add('hidden');
    viewerPlaceholder.innerHTML = `
        <div class="text-center text-gray-500">
            <h3 class="mt-2 text-lg font-medium">사진을 불러오는 중입니다...</h3>
            <p class="mt-1 text-sm">잠시만 기다려주세요.</p>
        </div>
    `;

    try {
        let imageUrlToDisplay;

        if (sourceType === 'local') {
            // 로컬 파일은 임시 URL을 사용합니다.
            imageUrlToDisplay = URL.createObjectURL(source);
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: source, date: photoDate, ai_analysis: aiAnalysisData };
        } else if (sourceType === 'web') {
            imageUrlToDisplay = source;
            state.stagedPhoto = { url: imageUrlToDisplay, mode: photoMode, viewAngle: viewAngle, file: null, date: photoDate, ai_analysis: aiAnalysisData };
        }
        
        state.primaryPhotoId = null; // stagedPhoto는 아직 Firestore ID가 없음

        // 뷰어에 사진을 표시합니다. (환자 정보는 "미지정")
        const viewerPatientName = document.getElementById('viewerPatientName');
        const viewerPhotoInfo = document.getElementById('viewerPhotoInfo');
        const mainImageWrapper = document.getElementById('mainImageWrapper');
        const compareImageWrapper = document.getElementById('compareImageWrapper');
        const tertiaryImageWrapper = document.getElementById('tertiaryImageWrapper');
        const imageContainer = document.getElementById('image-container');

        document.getElementById('viewerPlaceholder').classList.add('hidden');
        document.getElementById('imageViewer').classList.remove('hidden');
        document.getElementById('imageViewer').classList.add('flex');

        document.getElementById('mainImage').src = imageUrlToDisplay;
        mainImageWrapper.classList.remove('hidden');
        mainImageWrapper.classList.add('w-full');
        compareImageWrapper.classList.add('hidden');
        tertiaryImageWrapper.classList.add('hidden');

        imageContainer.classList.remove('flex-row', 'gap-4');
        imageContainer.classList.add('flex-col');

        viewerPatientName.innerText = `환자 미지정 - 선택 필요`;
        viewerPhotoInfo.innerText = `${photoDate} | ${photoMode} | ${viewAngle}`;

        resetZoomAndPan();
        state.isAnalysisPanelVisible = false;
        document.getElementById('analysisPanel').classList.add('hidden');
        document.getElementById('analyzeBtn').classList.remove('bg-[#4CAF50]', 'text-white');
        document.getElementById('analyzeBtn').classList.add('bg-[#E8F5E9]', 'text-[#2E7D32]');
        
        // Staged Photo 상태임을 알림
        console.log("Photo staged for patient assignment:", state.stagedPhoto);

    } catch (error) {
        console.error("사진을 불러오는 중 오류 발생:", error);
        alert("사진을 불러는데 실패했습니다. 오류: " + error.message);
        resetViewerToPlaceholder();
        state.stagedPhoto = null; // 오류 발생 시 stagedPhoto 초기화
    }
}

// resetViewerToPlaceholder: 뷰어를 초기 플레이스홀더 상태로 되돌리는 함수
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
    state.primaryPhotoId = null; // 뷰어가 초기화되면 primaryPhotoId도 초기화
    state.comparePhotoIds = []; // 비교 사진 ID 배열도 초기화
    state.isComparingPhotos = false; // 비교 모드 해제
    state.isCompareSelectionActive = false; // 선택 모드 해제
}

// deletePhoto: 선택된 사진을 Firestore에서 삭제합니다. (Storage에서는 삭제하지 않음)
async function deletePhoto(photoId) {
    if (!confirm('정말로 이 사진을 삭제하시겠습니까? 데이터베이스에서만 삭제되며, 원본 사진 파일은 Storage에 유지됩니다.')) {
        return; // 사용자가 취소하면 아무것도 하지 않음
    }

    try {
        // Firestore에서 사진 문서 삭제
        // doc 함수를 사용하여 특정 문서에 대한 참조를 만듭니다.
        await deleteDoc(doc(db, 'photos', photoId)); 
        console.log('Photo document deleted from Firestore:', photoId);

        alert('사진이 데이터베이스에서 성공적으로 삭제되었습니다.');

        // 4. UI 업데이트
        // 삭제된 사진이 현재 뷰어의 primaryPhotoId에 해당한다면 초기화
        if (state.primaryPhotoId === photoId) {
            state.primaryPhotoId = null; 
        }
        // comparePhotoIds 배열에서도 삭제된 사진 ID 제거
        state.comparePhotoIds = state.comparePhotoIds.filter(id => id !== photoId);

        if (state.comparePhotoIds.length > 0) {
            // 비교 뷰에 남은 사진이 있다면 다시 렌더링
            state.primaryPhotoId = state.comparePhotoIds[0]; // 첫 번째 남은 사진을 primary로 설정
            await updateComparisonDisplay();
        } else {
            // 남은 사진이 없으면 플레이스홀더로 되돌림
            resetViewerToPlaceholder(); 
        }

        // 삭제된 사진이 속한 환자의 사진 목록을 새로고침
        if (state.selectedPatientId) {
            fetchPhotos(state.selectedPatientId); // 필터링을 유지하기 위해 인자 없이 호출
        } else {
            // 선택된 환자가 없더라도 목록을 다시 불러올 필요가 있을 수 있음 (하지만 이 경우 목록은 비어있을 것)
            fetchPatients(); // 환자 목록을 새로고침하여 혹시 모를 변경사항 반영
        }

    } catch (error) {
        console.error("사진 삭제 중 오류 발생:", error);
        alert("사진 삭제에 실패했습니다: " + error.message);
    }
}
