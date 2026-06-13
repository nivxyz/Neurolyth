import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDPyHj2MMziyOI-FVdr2yUZfMomYbSs1_s',
  authDomain: 'neurolythlabs.firebaseapp.com',
  projectId: 'neurolythlabs',
  storageBucket: 'neurolythlabs.firebasestorage.app',
  messagingSenderId: '759272141118',
  appId: '1:759272141118:web:691a6fab3e951522bdbc6f',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
