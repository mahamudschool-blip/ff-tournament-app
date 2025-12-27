
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDQcNfcQOkH6rfr4z_vgdG6yUYJJ0SDqKw",
  authDomain: "rdsapp-910f3.firebaseapp.com",
  databaseURL: "https://rdsapp-910f3-default-rtdb.firebaseio.com",
  projectId: "rdsapp-910f3",
  storageBucket: "rdsapp-910f3.firebasestorage.app",
  messagingSenderId: "193789962907",
  appId: "1:193789962907:web:60dae855eed6d454bef43e",
  measurementId: "G-RMGGBHSP5W"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
