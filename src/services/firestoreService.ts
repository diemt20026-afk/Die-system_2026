import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Die, Profile, Log, MonthlySalesRecord } from '../types';

const DIES_COLLECTION = 'dies';
const PROFILES_COLLECTION = 'profiles';
const LOGS_COLLECTION = 'logs';
const SALES_COLLECTION = 'monthly_sales';

// Subscribe to Dies in real-time
export function subscribeDies(onData: (dies: Die[]) => void, onError?: (err: unknown) => void) {
  const colRef = collection(db, DIES_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const dies: Die[] = [];
      snapshot.forEach((docSnap) => {
        dies.push({ id: docSnap.id, ...docSnap.data() } as Die);
      });
      onData(dies);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, DIES_COLLECTION);
    }
  );
}

// Subscribe to Profiles in real-time
export function subscribeProfiles(onData: (profiles: Profile[]) => void, onError?: (err: unknown) => void) {
  const colRef = collection(db, PROFILES_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const profiles: Profile[] = [];
      snapshot.forEach((docSnap) => {
        profiles.push({ dieCode: docSnap.id, ...docSnap.data() } as Profile);
      });
      onData(profiles);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, PROFILES_COLLECTION);
    }
  );
}

// Subscribe to Logs in real-time
export function subscribeLogs(onData: (logs: Log[]) => void, onError?: (err: unknown) => void) {
  const colRef = collection(db, LOGS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const logs: Log[] = [];
      snapshot.forEach((docSnap) => {
        logs.push({ id: docSnap.id, ...docSnap.data() } as Log);
      });
      // Sort newest first
      logs.sort((a, b) => new Date(b.timestampRaw).getTime() - new Date(a.timestampRaw).getTime());
      onData(logs);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, LOGS_COLLECTION);
    }
  );
}

// Subscribe to Monthly Sales in real-time
export function subscribeMonthlySales(onData: (sales: MonthlySalesRecord[]) => void, onError?: (err: unknown) => void) {
  const colRef = collection(db, SALES_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const sales: MonthlySalesRecord[] = [];
      snapshot.forEach((docSnap) => {
        sales.push(docSnap.data() as MonthlySalesRecord);
      });
      onData(sales);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, SALES_COLLECTION);
    }
  );
}

// Save or Update Die
export async function saveDieToCloud(die: Die): Promise<void> {
  const docRef = doc(db, DIES_COLLECTION, die.id);
  const data = { ...die };
  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${DIES_COLLECTION}/${die.id}`);
  }
}

// Update specific fields of a Die
export async function updateDieInCloud(dieId: string, updates: Partial<Die>): Promise<void> {
  const docRef = doc(db, DIES_COLLECTION, dieId);
  try {
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${DIES_COLLECTION}/${dieId}`);
  }
}

// Delete a Die
export async function deleteDieFromCloud(dieId: string): Promise<void> {
  const docRef = doc(db, DIES_COLLECTION, dieId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${DIES_COLLECTION}/${dieId}`);
  }
}

// Save or Update Profile
export async function saveProfileToCloud(profile: Profile): Promise<void> {
  const docRef = doc(db, PROFILES_COLLECTION, profile.dieCode);
  const data = { ...profile };
  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PROFILES_COLLECTION}/${profile.dieCode}`);
  }
}

// Delete Profile
export async function deleteProfileFromCloud(dieCode: string): Promise<void> {
  const docRef = doc(db, PROFILES_COLLECTION, dieCode);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PROFILES_COLLECTION}/${dieCode}`);
  }
}

// Add History Log
export async function addLogToCloud(log: Log): Promise<void> {
  const docRef = doc(db, LOGS_COLLECTION, log.id);
  try {
    await setDoc(docRef, log);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${LOGS_COLLECTION}/${log.id}`);
  }
}

// Save Monthly Sales Batch
export async function saveMonthlySalesBatchToCloud(records: MonthlySalesRecord[]): Promise<void> {
  if (records.length === 0) return;
  const batch = writeBatch(db);
  for (const record of records) {
    // Unique ID combining profileName and month
    const safeKey = `${record.profileName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}___${record.month}`;
    const docRef = doc(db, SALES_COLLECTION, safeKey);
    batch.set(docRef, record, { merge: true });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SALES_COLLECTION);
  }
}

// Seed initial cloud data if collection is empty
export async function seedInitialCloudDataIfEmpty(
  fallbackDies: Die[],
  fallbackProfiles: Profile[],
  fallbackLogs: Log[],
  fallbackSales: MonthlySalesRecord[]
): Promise<void> {
  try {
    const diesSnapshot = await getDocs(collection(db, DIES_COLLECTION));
    if (diesSnapshot.empty && fallbackDies.length > 0) {
      console.log('Seeding initial dies to Firebase Cloud Firestore...');
      const batch = writeBatch(db);
      for (const die of fallbackDies) {
        const docRef = doc(db, DIES_COLLECTION, die.id);
        batch.set(docRef, die);
      }
      for (const profile of fallbackProfiles) {
        const docRef = doc(db, PROFILES_COLLECTION, profile.dieCode);
        batch.set(docRef, profile);
      }
      for (const log of fallbackLogs) {
        const docRef = doc(db, LOGS_COLLECTION, log.id);
        batch.set(docRef, log);
      }
      for (const sale of fallbackSales) {
        const safeKey = `${sale.profileName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}___${sale.month}`;
        const docRef = doc(db, SALES_COLLECTION, safeKey);
        batch.set(docRef, sale);
      }
      await batch.commit();
      console.log('Initial cloud seed completed successfully.');
    }
  } catch (err) {
    console.warn('Initial cloud seed skipped or already present:', err);
  }
}
