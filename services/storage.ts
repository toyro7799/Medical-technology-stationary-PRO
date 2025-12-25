import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { Sheet } from '../types';
import { DEFAULT_ADMIN_PASS } from '../constants';

const firebaseConfig = {
  apiKey: "AIzaSyBIkUZVVt1apvAu6Lewh8cwWm6NLEY5GoM",
  authDomain: "medical-technology-4b426.firebaseapp.com",
  projectId: "medical-technology-4b426",
  storageBucket: "medical-technology-4b426.firebasestorage.app",
  messagingSenderId: "40369588750",
  appId: "1:40369588750:web:faebb27a98e2ab87088a5f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Helper: Image Compression ---
// Firestore has a 1MB limit per document. This helper ensures images fit.
const compressBase64 = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    // If string length is approx < 800KB, it's safe (Base64 is ~1.33x larger than binary)
    // 800,000 chars is roughly 600KB binary, leaving plenty of room for overhead.
    if (base64.length < 800 * 1024) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // aggressive resize for very large images
      const MAX_DIM = 1024;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64); // Fallback
        return;
      }

      // Fill background white (for transparent PNGs converted to JPEG)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Start with decent quality
      let quality = 0.7;
      let newStr = canvas.toDataURL('image/jpeg', quality);

      // Loop to reduce quality if still too big
      // Target: under 800KB string length
      while (newStr.length > 800 * 1024 && quality > 0.1) {
        quality -= 0.1;
        newStr = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(newStr);
    };
    img.onerror = () => {
      console.warn("Image compression failed to load image, saving original.");
      resolve(base64);
    };
  });
};

// --- Helper: ID Generator ---
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// --- Admin Auth Logic ---

export const getAdminPassword = async (): Promise<string> => {
  try {
    const docRef = doc(db, 'settings', 'admin');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().passwordHash;
    }
  } catch (error) {
    console.error("Error fetching admin password:", error);
  }
  return DEFAULT_ADMIN_PASS;
};

export const setAdminPassword = async (newPassword: string): Promise<void> => {
  try {
    const docRef = doc(db, 'settings', 'admin');
    await setDoc(docRef, { passwordHash: newPassword }, { merge: true });
  } catch (error) {
    console.error("Error setting admin password:", error);
    throw error;
  }
};

// --- Sheet Data Logic ---

export const getSheets = async (): Promise<Sheet[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'sheets'));
    const sheets: Sheet[] = [];
    querySnapshot.forEach((doc) => {
      sheets.push(doc.data() as Sheet);
    });
    return sheets.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Error fetching sheets:", error);
    return [];
  }
};

export const addSheet = async (sheet: Sheet): Promise<void> => {
  try {
    if (sheet.imageUrl) {
      sheet.imageUrl = await compressBase64(sheet.imageUrl);
    }
    await setDoc(doc(db, 'sheets', sheet.id), sheet);
  } catch (error) {
    console.error("Error adding sheet:", error);
    throw error;
  }
};

export const updateSheet = async (updatedSheet: Sheet): Promise<void> => {
  try {
    if (updatedSheet.imageUrl) {
      updatedSheet.imageUrl = await compressBase64(updatedSheet.imageUrl);
    }
    await updateDoc(doc(db, 'sheets', updatedSheet.id), { ...updatedSheet });
  } catch (error) {
    console.error("Error updating sheet:", error);
    throw error;
  }
};

export const deleteSheet = async (id: string, imageUrl?: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'sheets', id));
  } catch (error) {
    console.error("Error deleting sheet:", error);
    throw error;
  }
};

// --- Custom Subjects Logic ---

export const getAllCustomSubjects = async (): Promise<Record<string, string[]>> => {
    try {
        const docRef = doc(db, 'settings', 'customSubjects');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as Record<string, string[]>;
        }
    } catch (error) {
        console.error("Error fetching custom subjects", error);
    }
    return {};
};

export const addCustomSubject = async (year: string, department: string, subject: string): Promise<void> => {
  try {
    const key = `${year}_${department}`;
    const docRef = doc(db, 'settings', 'customSubjects');
    await setDoc(docRef, { [key]: arrayUnion(subject) }, { merge: true });
  } catch (error) {
    console.error("Error adding custom subject:", error);
    throw error;
  }
};

// --- Notification Logic ---

export const isSubscribedToTopic = (topic: string): boolean => {
  const subs = JSON.parse(localStorage.getItem('med_app_subs') || '[]');
  return subs.includes(topic);
};

export const subscribeToTopic = (topic: string): void => {
  const subs = JSON.parse(localStorage.getItem('med_app_subs') || '[]');
  if (!subs.includes(topic)) {
    subs.push(topic);
    localStorage.setItem('med_app_subs', JSON.stringify(subs));
    console.log(`Subscribed to ${topic}`);
  }
};

export const unsubscribeFromTopic = (topic: string): void => {
  let subs = JSON.parse(localStorage.getItem('med_app_subs') || '[]');
  subs = subs.filter((t: string) => t !== topic);
  localStorage.setItem('med_app_subs', JSON.stringify(subs));
  console.log(`Unsubscribed from ${topic}`);
};