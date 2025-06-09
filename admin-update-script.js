// admin-update-script.js
const admin = require('firebase-admin');

// Firebase Admin SDK 초기화 (서비스 계정 키 파일 경로를 입력하세요)
// Firebase 프로젝트 설정에서 '서비스 계정' 탭에서 새 비공개 키를 생성하여 다운로드할 수 있습니다.
const serviceAccount = require('./frayviewer-63e13-firebase-adminsdk-fbsvc-438da4d463.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com" // Realtime Database를 사용하지 않는다면 필요 없음
});

const db = admin.firestore();

async function addProcedureStatusToPhotos() {
  const photosRef = db.collection('photos');
  const snapshot = await photosRef.get();

  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }  

  const batch = db.batch();
  let updateCount = 0;

  snapshot.forEach(doc => {
    // 기존 문서에 procedureStatus 필드가 없는 경우에만 추가
    if (!doc.data().procedureStatus) {
      const docRef = photosRef.doc(doc.id);
      batch.update(docRef, { procedureStatus: 'None' }); // 기본값 'None'으로 설정
      updateCount++;
    }
  });

  if (updateCount > 0) {
    await batch.commit();
    console.log(`${updateCount} documents successfully updated with procedureStatus.`);
  } else {
    console.log('No documents needed update.');
  }
}

addProcedureStatusToPhotos()
  .then(() => {
    console.log('Update complete.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error updating documents:', error);
    process.exit(1);
  });