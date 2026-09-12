import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVbH3osCrYRLSOHAcJEaLqe5c_8_CT3ow",
  authDomain: "dompetku-by-nexyuspay-e2550.firebaseapp.com",
  projectId: "dompetku-by-nexyuspay-e2550",
  storageBucket: "dompetku-by-nexyuspay-e2550.firebasestorage.app",
  messagingSenderId: "165596386810",
  appId: "1:165596386810:web:97a75c66dcc2eec60a8043",
  measurementId: "G-7551Q5S6WM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

window.FirebaseManager = class FirebaseManager {
  static onAuthStateChanged(callback) {
    onAuthStateChanged(auth, callback);
  }
  static async login(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
  }
  static async register(email, password) {
    return await createUserWithEmailAndPassword(auth, email, password);
  }
  static async logout() {
    return await signOut(auth);
  }

  static async saveData(data) {
    try {
      
      if (!auth.currentUser) throw new Error("Sesi telah habis, silakan login ulang");
      const docRef = doc(db, "users", auth.currentUser.uid);
  
      await setDoc(docRef, data);
      return true;
    } catch (e) {
      console.error("Firebase save error", e);
      throw e;
    }
  }

  static async loadData() {
    try {
      
      if (!auth.currentUser) throw new Error("Sesi telah habis, silakan login ulang");
      const docRef = doc(db, "users", auth.currentUser.uid);
  
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        return null;
      }
    } catch (e) {
      console.error("Firebase load error", e);
      throw e;
    }
  }

  static async uploadImage(base64Data, filename) {
    try {
      
      if (!auth.currentUser) throw new Error("Sesi telah habis");
      const storageRef = ref(storage, 'receipts/' + auth.currentUser.uid + '/' + filename);
  
      await uploadString(storageRef, base64Data, 'data_url');
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (e) {
      console.error("Firebase upload error", e);
      throw e;
    }
  }
};
