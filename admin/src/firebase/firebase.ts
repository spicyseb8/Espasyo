import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
    initializeFirestore,
    persistentLocalCache
} from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyDZx9kcn14JmUhjz-2dfb8wgf1RCtlSLGo",
  authDomain: "espasyo-6072d.firebaseapp.com",
  projectId: "espasyo-6072d",
  storageBucket: "espasyo-6072d.firebasestorage.app",
  messagingSenderId: "396276865497",
  appId: "1:396276865497:web:6f900ae13da8330f69a1c8",
  measurementId: "G-YGH23P0LZT"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache()
});
export const storage = getStorage(app);

export default app;