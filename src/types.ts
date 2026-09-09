export interface MonthlySalesRecord {
  profileName: string;
  month: string; // "YYYY-MM"
  targetSalesKg: number;
  updatedAt?: string;
}

export type SpecType = 'min_max' | 'min' | 'max' | 'appearance';

export interface SpecItem {
  id: string;
  name: string;
  type: SpecType;
  min?: number;
  max?: number;
  unit?: string;
}

export type Specs = SpecItem[] | Record<string, any>;

export interface Die {
  id: string;
  dieCode: string;
  dieNumber: string;
  profileName: string;
  invoiceNo?: string;
  location: string;
  model: string;
  toolLifeKg: number;
  status: string;
  currentUsageKg: number;
  isInspected: boolean;
  lastActionTime: string;
  hexColor?: string;
  image?: string | null;
  createdAt: string;
  specs?: Specs;
  statusReason?: string;
  lastInspectionResult?: 'PASS' | 'NG';
}

export interface Profile {
  dieCode: string;
  profileName: string;
  specs: Specs;
  toolLifeKg: number;
  updatedAt: string;
  source?: 'profile' | 'die';
}

export interface Log {
  id: string;
  dieId: string;
  dieCode: string;
  dieNumber: string;
  type: string;
  detail: string;
  weight: number;
  timestamp: string;
  timestampRaw: string;
  userId: string;
  inspectionData?: Record<string, any> | null;
  performedBy?: string | null;
}
