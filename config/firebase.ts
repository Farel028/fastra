// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDO_K0kqkUULayyQOfs4InNmd4bVhUReak",
  authDomain: "entrack-fardss.firebaseapp.com",
  projectId: "entrack-fardss",
  storageBucket: "entrack-fardss.firebasestorage.app",
  messagingSenderId: "971638255573",
  appId: "1:971638255573:web:e5b44919b9b8dcef85575c",
  measurementId: "G-5FZ8E3CH1E",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const firestore = getFirestore(app);
