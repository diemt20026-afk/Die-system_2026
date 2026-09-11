export interface MonthlySalesRecord {
  profileName: string;
  month: string; // "YYYY-MM"
  targetSalesTon?: number;
  targetSalesKg?: number;
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

export function cleanSpecItem(item: SpecItem): SpecItem {
  const type = (item.type as SpecType) || 'min_max';
  const isApp = type === 'appearance';
  const hasMin = type === 'min_max' || type === 'min';
  const hasMax = type === 'min_max' || type === 'max';

  const minVal = hasMin && item.min !== undefined && item.min !== null && !isNaN(Number(item.min))
    ? Number(item.min)
    : undefined;
  const maxVal = hasMax && item.max !== undefined && item.max !== null && !isNaN(Number(item.max))
    ? Number(item.max)
    : undefined;

  return {
    id: item.id || `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: item.name || 'Spec Point',
    type,
    min: minVal,
    max: maxVal,
    unit: isApp ? '-' : (item.unit || 'mm')
  };
}

export function normalizeSpecs(rawSpecs: any): SpecItem[] {
  if (!rawSpecs) return [];
  if (Array.isArray(rawSpecs)) {
    return rawSpecs.map((item, idx) => {
      const type = (item.type as SpecType) || 'min_max';
      const hasMin = type === 'min_max' || type === 'min';
      const hasMax = type === 'min_max' || type === 'max';
      return {
        id: item.id || `pt_${idx}_${Date.now()}`,
        name: item.name || `Point ${idx + 1}`,
        type,
        min: hasMin && item.min !== undefined && item.min !== null && !isNaN(Number(item.min)) ? Number(item.min) : undefined,
        max: hasMax && item.max !== undefined && item.max !== null && !isNaN(Number(item.max)) ? Number(item.max) : undefined,
        unit: item.unit ?? (type === 'appearance' ? '-' : 'mm')
      };
    });
  }
  if (typeof rawSpecs === 'object') {
    return Object.entries(rawSpecs).map(([key, val]: [string, any], idx) => {
      if (!val || typeof val !== 'object') {
        return {
          id: key,
          name: key.toUpperCase(),
          type: 'min_max' as SpecType,
          min: undefined,
          max: undefined,
          unit: 'mm'
        };
      }
      if (val.type) {
        const type = (val.type as SpecType) || 'min_max';
        const hasMin = type === 'min_max' || type === 'min';
        const hasMax = type === 'min_max' || type === 'max';
        return {
          id: val.id || key,
          name: val.name || key.toUpperCase(),
          type,
          min: hasMin && val.min !== undefined && val.min !== null && !isNaN(Number(val.min)) ? Number(val.min) : undefined,
          max: hasMax && val.max !== undefined && val.max !== null && !isNaN(Number(val.max)) ? Number(val.max) : undefined,
          unit: val.unit ?? (type === 'appearance' ? '-' : 'mm')
        };
      }
      const hasMin = typeof val.min === 'number' && !isNaN(val.min);
      const hasMax = typeof val.max === 'number' && !isNaN(val.max);
      let type: SpecType = 'min_max';
      if (hasMin && !hasMax) type = 'min';
      else if (!hasMin && hasMax) type = 'max';

      return {
        id: key,
        name: key.toUpperCase(),
        type,
        min: hasMin ? Number(val.min) : undefined,
        max: hasMax ? Number(val.max) : undefined,
        unit: 'mm'
      };
    });
  }
  return [];
}

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
