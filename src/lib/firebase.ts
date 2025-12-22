import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyADzP1OjVoNGTWp0V30hue2B3yh0-fr9Os",
  authDomain: "asmara-pos.firebaseapp.com",
  projectId: "asmara-pos",
  storageBucket: "asmara-pos.firebasestorage.app",
  messagingSenderId: "1065016328628",
  appId: "1:1065016328628:web:57418690c4988b4e4672e1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserSessionPersistence);