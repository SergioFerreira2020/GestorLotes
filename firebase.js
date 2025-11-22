// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyD1dM_OCuvmv6udGpwSSZmE6IG97Ef-_4M",
    authDomain: "gestorroupa.firebaseapp.com",
    projectId: "gestorroupa",
    storageBucket: "gestorroupa.appspot.com",
    messagingSenderId: "100802720492",
    appId: "1:100802720492:web:86b1e11d849fd5e2cc6bc9",
    measurementId: "G-SGZLSQ53KG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore DB
export const db = getFirestore(app);

// Export everything needed
export {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    where
};
