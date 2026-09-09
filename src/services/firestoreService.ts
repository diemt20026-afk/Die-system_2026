import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Die, Profile, Log, MonthlySalesRecord, cleanSpecItem } from '../types';

const DIES_COLLECTION = 'dies';
const PROFILES_COLLECTION = 'profiles';
const LOGS_COLLECTION = 'logs';
const SALES_COLLECTION = 'monthly_sales';

// Recursively sanitize objects so no `undefined` values are ever passed to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value === undefined) {
        cleaned[key] = null;
      } else {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

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
  const specs = Array.isArray(die.specs) ? die.specs.map(cleanSpecItem) : die.specs;
  const data = sanitizeForFirestore({ ...die, specs });
  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${DIES_COLLECTION}/${die.id}`);
  }
}

// Update specific fields of a Die
export async function updateDieInCloud(dieId: string, updates: Partial<Die>): Promise<void> {
  const docRef = doc(db, DIES_COLLECTION, dieId);
  const specs = Array.isArray(updates.specs) ? updates.specs.map(cleanSpecItem) : updates.specs;
  const data = sanitizeForFirestore(specs !== undefined ? { ...updates, specs } : updates);
  try {
    await updateDoc(docRef, data);
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
  const specs = Array.isArray(profile.specs) ? profile.specs.map(cleanSpecItem) : profile.specs;
  const data = sanitizeForFirestore({ ...profile, specs });
  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PROFILES_COLLECTION}/${profile.dieCode}`);
  }
}

// Save Profile and immediately propagate updated specs and tool life to all matching dies in Firestore
export async function saveProfileAndSyncDies(profile: Profile): Promise<void> {
  const docRef = doc(db, PROFILES_COLLECTION, profile.dieCode);
  const specs = Array.isArray(profile.specs) ? profile.specs.map(cleanSpecItem) : profile.specs;
  const sanitizedProfile = sanitizeForFirestore({ ...profile, specs });

  try {
    // 1. Save profile
    await setDoc(docRef, sanitizedProfile, { merge: true });

    // 2. Sync all dies in Firestore with this dieCode so they share the latest profile specs and toolLifeKg
    const diesSnap = await getDocs(collection(db, DIES_COLLECTION));
    const batch = writeBatch(db);
    let count = 0;
    diesSnap.forEach((d) => {
      const dieData = d.data();
      if (dieData.dieCode === profile.dieCode) {
        const updatePayload = sanitizeForFirestore({
          specs: sanitizedProfile.specs,
          profileName: sanitizedProfile.profileName || dieData.profileName,
          toolLifeKg: sanitizedProfile.toolLifeKg || dieData.toolLifeKg
        });
        batch.update(doc(db, DIES_COLLECTION, d.id), updatePayload);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
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
  const data = sanitizeForFirestore({ ...log });
  try {
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${LOGS_COLLECTION}/${log.id}`);
  }
}

// Delete a single log from Cloud
export async function deleteLogFromCloud(logId: string): Promise<void> {
  const docRef = doc(db, LOGS_COLLECTION, logId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${LOGS_COLLECTION}/${logId}`);
  }
}

// Delete multiple logs from Cloud in batches
export async function deleteLogsBatchFromCloud(logIds: string[]): Promise<void> {
  if (!logIds || logIds.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < logIds.length; i += CHUNK_SIZE) {
    const chunk = logIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, LOGS_COLLECTION, id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${LOGS_COLLECTION} (batch)`);
    }
  }
}

// Clear all logs from Cloud
export async function clearAllLogsFromCloud(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, LOGS_COLLECTION));
    const ids = snap.docs.map(d => d.id);
    await deleteLogsBatchFromCloud(ids);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, LOGS_COLLECTION);
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
    batch.set(docRef, sanitizeForFirestore({ ...record }), { merge: true });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SALES_COLLECTION);
  }
}

// Seed initial cloud data ONLY ONCE on first system initialization
// Never re-seed fallback data if system was already initialized, preserving user deletions across all devices
export async function seedInitialCloudDataIfEmpty(
  fallbackDies: Die[],
  fallbackProfiles: Profile[],
  fallbackLogs: Log[],
  fallbackSales: MonthlySalesRecord[]
): Promise<void> {
  try {
    const seedStatusRef = doc(db, 'system', 'seed_status');
    const seedStatusSnap = await getDoc(seedStatusRef).catch(() => null);

    // If system was already seeded or marked initialized, NEVER re-seed deleted data!
    if (seedStatusSnap && seedStatusSnap.exists()) {
      return;
    }

    const diesSnapshot = await getDocs(collection(db, DIES_COLLECTION));
    if (diesSnapshot.empty && fallbackDies.length > 0) {
      console.log('First-time system setup: Seeding initial dies to Firebase Cloud Firestore...');
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
      // Record persistent initialization flag in Firestore
      batch.set(seedStatusRef, {
        initialized: true,
        seededAt: new Date().toISOString(),
        version: "1.0.0"
      });
      await batch.commit();
      console.log('Initial cloud seed completed successfully.');
    } else {
      // Dies already exist in Firestore, mark system as initialized so future empty state won't resurrect fallback data
      await setDoc(seedStatusRef, {
        initialized: true,
        seededAt: new Date().toISOString(),
        version: "1.0.0"
      }, { merge: true }).catch(() => null);
    }
  } catch (err) {
    console.warn('Initial cloud seed check notice:', err);
  }
}
