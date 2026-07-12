rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Kullanıcılar kendi profillerini oluşturabilir ve okuyabilir
    match /users/{uid} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update: if request.auth != null && request.auth.uid == uid;
    }

    // Config ve Maçlar herkes tarafından okunabilir
    match /config/admin {
      allow read: if true;
    }
    match /matches/{matchId} {
      allow read: if request.auth != null;
    }

    // Tahminler: Sadece giriş yapan ve kendi verisi olan
    match /predictions/{predId} {
      allow read, create, update: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
  }
}
