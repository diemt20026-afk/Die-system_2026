import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  ClipboardCheck, 
  Plus, 
  Search, 
  AlertTriangle, 
  History,
  X,
  Layout,
  ChevronDown,
  UploadCloud,
  Activity,
  BarChart3,
  FileCog,
  Target,
  Eye,
  EyeOff,
  PlusCircle,
  Trash2,
  Download,
  User as UserIcon,
  BarChart,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Check,
  CheckCircle2,
  XCircle,
  Sliders,
  Sparkles,
  Filter,
  RotateCcw,
  Hash,
  ShoppingCart,
  Calendar,
  TrendingDown,
  AlertCircle,
  Save,
  HelpCircle,
  Calculator,
  Clock,
  KeyRound,
  ShieldCheck,
  Lock,
  Unlock,
  Edit3,
  ShieldAlert,
  Cloud,
  CloudOff,
  Loader2
} from 'lucide-react';
import { cleanSpecItem } from './types';
import {
  subscribeDies,
  subscribeProfiles,
  subscribeLogs,
  subscribeMonthlySales,
  saveDieToCloud,
  updateDieInCloud,
  deleteDieFromCloud,
  saveProfileToCloud,
  saveProfileAndSyncDies,
  deleteProfileFromCloud,
  addLogToCloud,
  deleteLogFromCloud,
  deleteLogsBatchFromCloud,
  clearAllLogsFromCloud,
  saveMonthlySalesBatchToCloud,
  seedInitialCloudDataIfEmpty
} from './services/firestoreService';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
  Legend
} from 'recharts';
import { DieInspectionHistoryModal } from './components/DieInspectionHistoryModal';

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

export const normalizeSpecs = (rawSpecs: any): SpecItem[] => {
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
          min: 0,
          max: 0,
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
      else type = 'min_max';

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
};

export const defaultSpecTemplate: SpecItem[] = [
  { id: 'sp_1', name: 'T1A', type: 'min_max', min: 2.1, max: 2.3, unit: 'mm' },
  { id: 'sp_2', name: 'T1B', type: 'min_max', min: 2.1, max: 2.3, unit: 'mm' },
  { id: 'sp_3', name: 'T2A', type: 'min_max', min: 4.8, max: 5.2, unit: 'mm' },
  { id: 'sp_4', name: 'T2B', type: 'min_max', min: 4.8, max: 5.2, unit: 'mm' },
  { id: 'sp_5', name: 'Surface Quality (ผิวงาน)', type: 'appearance', unit: '-' },
  { id: 'sp_6', name: 'Crack Check (รอยร้าว)', type: 'appearance', unit: '-' }
];

interface Die {
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

interface Profile {
  dieCode: string;
  profileName: string;
  specs: Specs;
  toolLifeKg: number;
  updatedAt: string;
  source?: 'profile' | 'die';
}

interface Log {
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

const FALLBACK_DIES: Die[] = [
  {
    id: "die_1",
    dieCode: "TA0034",
    dieNumber: "01",
    profileName: "Aluminium Profile H-Section",
    invoiceNo: "INV-2026-001",
    location: "Rack A-02",
    model: "EX-500",
    toolLifeKg: 10000,
    status: "Available",
    currentUsageKg: 3500,
    isInspected: true,
    lastActionTime: "16/7/2026, 08:30:15",
    createdAt: "2026-07-16T08:30:15.000Z",
    specs: {
      t1a: { min: 2.1, max: 2.3 },
      t1b: { min: 2.1, max: 2.3 },
      t2a: { min: 4.8, max: 5.2 },
      t2b: { min: 4.8, max: 5.2 },
      t3: { min: 1.5, max: 1.7 },
      t4: { min: 0.8, max: 1.0 }
    }
  },
  {
    id: "die_2",
    dieCode: "TA0034",
    dieNumber: "02",
    profileName: "Aluminium Profile H-Section",
    invoiceNo: "INV-2026-001",
    location: "Rack A-03",
    model: "EX-500",
    toolLifeKg: 10000,
    status: "Production",
    currentUsageKg: 9150,
    isInspected: false,
    lastActionTime: "15/7/2026, 14:45:00",
    createdAt: "2026-07-16T08:31:00.000Z",
    specs: {
      t1a: { min: 2.1, max: 2.3 },
      t1b: { min: 2.1, max: 2.3 },
      t2a: { min: 4.8, max: 5.2 },
      t2b: { min: 4.8, max: 5.2 },
      t3: { min: 1.5, max: 1.7 },
      t4: { min: 0.8, max: 1.0 }
    }
  },
  {
    id: "die_3",
    dieCode: "TB0112",
    dieNumber: "01",
    profileName: "U-Channel Heavy Frame",
    invoiceNo: "INV-2026-015",
    location: "Rack B-05",
    model: "EX-800",
    toolLifeKg: 15000,
    status: "Maintenance",
    currentUsageKg: 12000,
    isInspected: false,
    lastActionTime: "16/7/2026, 09:12:30",
    createdAt: "2026-07-16T08:32:00.000Z",
    specs: {
      t1a: { min: 3.0, max: 3.2 },
      t1b: { min: 3.0, max: 3.2 },
      t2a: { min: 6.0, max: 6.4 },
      t2b: { min: 6.0, max: 6.4 },
      t3: { min: 2.0, max: 2.2 },
      t4: { min: 1.2, max: 1.4 }
    }
  }
];

const FALLBACK_PROFILES: Profile[] = [
  {
    dieCode: "TA0034",
    profileName: "Aluminium Profile H-Section",
    specs: {
      t1a: { min: 2.1, max: 2.3 },
      t1b: { min: 2.1, max: 2.3 },
      t2a: { min: 4.8, max: 5.2 },
      t2b: { min: 4.8, max: 5.2 },
      t3: { min: 1.5, max: 1.7 },
      t4: { min: 0.8, max: 1.0 }
    },
    toolLifeKg: 10000,
    updatedAt: "2026-07-16T08:30:15.000Z"
  },
  {
    dieCode: "TB0112",
    profileName: "U-Channel Heavy Frame",
    specs: {
      t1a: { min: 3.0, max: 3.2 },
      t1b: { min: 3.0, max: 3.2 },
      t2a: { min: 6.0, max: 6.4 },
      t2b: { min: 6.0, max: 6.4 },
      t3: { min: 2.0, max: 2.2 },
      t4: { min: 1.2, max: 1.4 }
    },
    toolLifeKg: 15000,
    updatedAt: "2026-07-16T08:32:00.000Z"
  }
];

const FALLBACK_LOGS: Log[] = [
  {
    id: "log_1",
    dieId: "die_1",
    dieCode: "TA0034",
    dieNumber: "01",
    type: "Inspection",
    detail: "ตรวจสอบผ่าน (Visual & Dimension OK)",
    weight: 0,
    timestamp: "16/7/2026, 08:30:15",
    timestampRaw: "2026-07-16T08:30:15.000Z",
    userId: "init_user",
    inspectionData: { t1a: 2.2, t1b: 2.21, t2a: 5.0, t2b: 4.95, t3: 1.6, t4: 0.9 },
    performedBy: "admin"
  },
  {
    id: "log_2",
    dieId: "die_2",
    dieCode: "TA0034",
    dieNumber: "02",
    type: "Production",
    detail: "ผลิต 1,500 kg",
    weight: 1500,
    timestamp: "15/7/2026, 14:45:00",
    timestampRaw: "2026-07-15T14:45:00.000Z",
    userId: "init_user",
    performedBy: "user"
  }
];

const FALLBACK_SALES: MonthlySalesRecord[] = [
  { profileName: "Aluminium Profile H-Section", month: "2026-09", targetSalesKg: 3500 },
  { profileName: "Aluminium Profile H-Section", month: "2026-10", targetSalesKg: 4000 },
  { profileName: "Aluminium Profile H-Section", month: "2026-11", targetSalesKg: 4200 },
  { profileName: "U-Channel Heavy Frame", month: "2026-09", targetSalesKg: 1200 },
  { profileName: "U-Channel Heavy Frame", month: "2026-10", targetSalesKg: 1500 },
  { profileName: "U-Channel Heavy Frame", month: "2026-11", targetSalesKg: 1800 }
];

const App = () => {
  const [role, setRole] = useState<'admin' | 'user'>('admin'); 
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');

  const [activeTab, setActiveTab] = useState('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDieCode, setSearchDieCode] = useState('');
  const [searchDieNumber, setSearchDieNumber] = useState('');
  const [searchProfileName, setSearchProfileName] = useState('');
  const [selectedDie, setSelectedDie] = useState<Die | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showAddDieModal, setShowAddDieModal] = useState(false);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [showLogDetailModal, setShowLogDetailModal] = useState<Log | null>(null);
  const [viewHistoryDie, setViewHistoryDie] = useState<Die | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ 
    id: string; 
    type: 'die' | 'profile' | 'log' | 'logs_selected' | 'logs_all'; 
    title: string;
    targetIds?: string[];
  } | null>(null); 
  const [showReasonModal, setShowReasonModal] = useState<{ dieId: string; newStatus: string } | null>(null); 
  const [judgmentError, setJudgmentError] = useState<string[] | null>(null);

  // History Tab specific states (show latest 20 items, selective delete, delete all)
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [showAllHistory, setShowAllHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');
  
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [specFormItems, setSpecFormItems] = useState<SpecItem[]>([]);
  const [inspectionAppearance, setInspectionAppearance] = useState<Record<string, 'PASS' | 'NG'>>({});
  const [inspectionNumericValues, setInspectionNumericValues] = useState<Record<string, string>>({});
  const [inspectionNotes, setInspectionNotes] = useState<string>('');
  
  const [dies, setDies] = useState<Die[]>(() => {
    try {
      const saved = localStorage.getItem('die_app_dies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [logs, setLogs] = useState<Log[]>(() => {
    try {
      const saved = localStorage.getItem('die_app_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const saved = localStorage.getItem('die_app_profiles');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'procurement'>('overview');
  const [profileChartMetric, setProfileChartMetric] = useState<'total' | 'avg'>('total');
  const [profileChartSort, setProfileChartSort] = useState<'remain_desc' | 'name_asc'>('remain_desc');

  // Monthly Sales & Procurement states
  const [monthlySales, setMonthlySales] = useState<MonthlySalesRecord[]>(() => {
    try {
      const saved = localStorage.getItem('die_app_monthly_sales');
      return saved ? JSON.parse(saved) : FALLBACK_SALES;
    } catch {
      return FALLBACK_SALES;
    }
  });
  const [procurementBaseMonth, setProcurementBaseMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [editedSales, setEditedSales] = useState<Record<string, number>>({});
  const [procurementFilter, setProcurementFilter] = useState<'all' | 'needs_order'>('all');
  const [salesSaveStatus, setSalesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Security Passcode Requirement: P120012-061
  const REQUIRED_SECURITY_CODE = 'P120012-061';

  const isSecurityCodeValid = (input: string): boolean => {
    if (!input) return false;
    const trimmed = input.trim().toUpperCase();
    const alphanumericOnly = trimmed.replace(/[^A-Z0-9]/g, '');
    return (
      trimmed === 'P120012-061' ||
      alphanumericOnly === 'P120012061' ||
      trimmed === 'P1200012-061' ||
      alphanumericOnly === 'P1200012061'
    );
  };

  // Delete Passcode states
  const [deletePasscode, setDeletePasscode] = useState('');
  const [deletePasscodeError, setDeletePasscodeError] = useState(false);
  const [showDeletePasscode, setShowDeletePasscode] = useState(false);

  // Security Prompt Modal states (for Die Spec Setting & Edit Data)
  interface SecurityPromptConfig {
    title: string;
    subtitle: string;
    actionTag: string;
    targetName?: string;
    onSuccess: () => void;
  }
  const [securityPrompt, setSecurityPrompt] = useState<SecurityPromptConfig | null>(null);
  const [securityCodeInput, setSecurityCodeInput] = useState('');
  const [securityCodeError, setSecurityCodeError] = useState(false);
  const [showSecurityCode, setShowSecurityCode] = useState(false);

  const openSecurityPrompt = (config: SecurityPromptConfig) => {
    setSecurityPrompt(config);
    setSecurityCodeInput('');
    setSecurityCodeError(false);
    setShowSecurityCode(false);
  };

  const handleVerifySecurityPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSecurityCodeValid(securityCodeInput)) {
      setSecurityCodeError(true);
      return;
    }
    const cb = securityPrompt?.onSuccess;
    setSecurityPrompt(null);
    setSecurityCodeInput('');
    setSecurityCodeError(false);
    if (cb) {
      cb();
    }
  };

  // Edit Die states
  const [editingDie, setEditingDie] = useState<Die | null>(null);
  const [showEditDieModal, setShowEditDieModal] = useState(false);
  const [editDieSaving, setEditDieSaving] = useState(false);
  const [specSaving, setSpecSaving] = useState(false);

  const handleEditDieSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDie || role !== 'admin') return;
    setEditDieSaving(true);
    const formData = new FormData(e.currentTarget);
    const time = getCurrentTimestamp();

    const updatedDie = {
      dieCode: (formData.get('dieCode') as string) || editingDie.dieCode,
      dieNumber: (formData.get('dieNumber') as string) || editingDie.dieNumber,
      profileName: (formData.get('profileName') as string) || editingDie.profileName,
      invoiceNo: (formData.get('invoiceNo') as string) || '',
      location: (formData.get('location') as string) || editingDie.location,
      model: (formData.get('model') as string) || editingDie.model,
      toolLifeKg: parseFloat(formData.get('toolLifeKg') as string) || 10000,
      currentUsageKg: parseFloat(formData.get('currentUsageKg') as string) || 0,
      status: (formData.get('status') as string) || editingDie.status,
      statusReason: (formData.get('statusReason') as string) || undefined,
      lastActionTime: time.display
    };

    // Optimistic local state update
    setDies(prev => {
      const next = prev.map(d => d.id === editingDie.id ? { ...d, ...updatedDie } : d);
      try { localStorage.setItem('die_app_dies', JSON.stringify(next)); } catch {}
      return next;
    });

    // Save to Firebase Cloud
    saveDieToCloud({ ...editingDie, ...updatedDie } as Die).catch(err => console.warn('Cloud die edit notice:', err));

    try {
      await fetch(`/api/dies/${editingDie.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDie)
      }).catch(() => null);

      await addLogCloud(
        editingDie.id,
        'Edit Data',
        `แก้ไขข้อมูลแม่พิมพ์ ${updatedDie.dieCode} (${updatedDie.dieNumber}) เรียบร้อยแล้ว`
      );

      setShowEditDieModal(false);
      setEditingDie(null);
      fetchData();
    } catch (err) {
      console.warn('Updated die in local cache:', err);
      setShowEditDieModal(false);
      setEditingDie(null);
    } finally {
      setEditDieSaving(false);
    }
  };

  // Fetch all data from full-stack Express server as fallback (never overwrites connected Cloud Firestore)
  const fetchData = async () => {
    if (cloudSyncStatus === 'connected') {
      setLoading(false);
      return;
    }
    try {
      const [diesRes, profilesRes, logsRes, salesRes] = await Promise.all([
        fetch('/api/dies').catch(() => null),
        fetch('/api/profiles').catch(() => null),
        fetch('/api/logs').catch(() => null),
        fetch('/api/monthly-sales').catch(() => null)
      ]);

      if (diesRes && diesRes.ok) {
        const diesData = await diesRes.json().catch(() => null);
        if (Array.isArray(diesData) && diesData.length > 0) {
          setDies(diesData);
          try { localStorage.setItem('die_app_dies', JSON.stringify(diesData)); } catch {}
        }
      }

      if (profilesRes && profilesRes.ok) {
        const profilesData = await profilesRes.json().catch(() => null);
        if (Array.isArray(profilesData) && profilesData.length > 0) {
          setProfiles(profilesData);
          try { localStorage.setItem('die_app_profiles', JSON.stringify(profilesData)); } catch {}
        }
      }

      if (logsRes && logsRes.ok) {
        const logsData = await logsRes.json().catch(() => null);
        if (Array.isArray(logsData) && logsData.length > 0) {
          const sorted = logsData.sort((a: any, b: any) => new Date(b.timestampRaw).getTime() - new Date(a.timestampRaw).getTime());
          setLogs(sorted);
          try { localStorage.setItem('die_app_logs', JSON.stringify(sorted)); } catch {}
        }
      }

      if (salesRes && salesRes.ok) {
        const salesData = await salesRes.json().catch(() => null);
        if (Array.isArray(salesData) && salesData.length > 0) {
          setMonthlySales(salesData);
          try { localStorage.setItem('die_app_monthly_sales', JSON.stringify(salesData)); } catch {}
        }
      }
    } catch {
      // Graceful silent fallback to local storage cache without unhandled errors
    } finally {
      setLoading(false);
    }
  };

  const executeSaveMonthlySales = async () => {
    setSalesSaveStatus('saving');
    try {
      const recordsToSave = Object.entries(editedSales).map(([key, val]) => {
        const [profileName, month] = key.split('___');
        return {
          profileName,
          month,
          targetSalesKg: Number(val) || 0
        };
      });

      if (recordsToSave.length > 0) {
        setMonthlySales(prev => {
          const updated = [...prev];
          recordsToSave.forEach(item => {
            const idx = updated.findIndex(
              s => s.profileName.trim().toLowerCase() === item.profileName.trim().toLowerCase() && s.month === item.month
            );
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], targetSalesKg: item.targetSalesKg, updatedAt: new Date().toISOString() };
            } else {
              updated.push({ ...item, updatedAt: new Date().toISOString() });
            }
          });
          try { localStorage.setItem('die_app_monthly_sales', JSON.stringify(updated)); } catch {}
          return updated;
        });

        // Save batch to Firebase Cloud
        saveMonthlySalesBatchToCloud(recordsToSave).catch(err => console.warn('Cloud sales save notice:', err));

        const res = await fetch('/api/monthly-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordsToSave)
        }).catch(() => null);

        if (res && res.ok) {
          const updated = await res.json().catch(() => null);
          if (Array.isArray(updated)) {
            setMonthlySales(updated);
            try { localStorage.setItem('die_app_monthly_sales', JSON.stringify(updated)); } catch {}
          }
        }
      }
      setSalesSaveStatus('saved');
      setTimeout(() => setSalesSaveStatus('idle'), 3000);
    } catch (err) {
      console.warn('Saved monthly sales to local cache:', err);
      setSalesSaveStatus('saved');
      setTimeout(() => setSalesSaveStatus('idle'), 3000);
    }
  };

  const handleSaveMonthlySales = () => {
    if (role !== 'admin') return;
    openSecurityPrompt({
      title: 'ยืนยันบันทึกการแก้ไขข้อมูลยอดขาย 3 เดือน',
      subtitle: 'กรุณากรอกรหัสความปลอดภัยเพื่อยืนยันการบันทึกการแก้ไขยอดขาย / แผนการผลิต',
      actionTag: 'แก้ไขข้อมูล (Edit Sales Data)',
      onSuccess: () => {
        executeSaveMonthlySales();
      }
    });
  };

  // Real-time synchronization with Firebase Cloud Firestore
  useEffect(() => {
    let unsubDies: (() => void) | undefined;
    let unsubProfiles: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;
    let unsubSales: (() => void) | undefined;

    // Seed initial data to cloud ONLY on first deployment if system was never initialized
    seedInitialCloudDataIfEmpty(FALLBACK_DIES, FALLBACK_PROFILES, FALLBACK_LOGS, FALLBACK_SALES);

    try {
      unsubDies = subscribeDies(
        (cloudDies) => {
          // Accurately reflect deletions across all devices (even when array is empty)
          setDies(cloudDies);
          try { localStorage.setItem('die_app_dies', JSON.stringify(cloudDies)); } catch {}
          setCloudSyncStatus('connected');
        },
        () => {
          setCloudSyncStatus('offline');
          fetchData();
        }
      );

      unsubProfiles = subscribeProfiles(
        (cloudProfiles) => {
          setProfiles(cloudProfiles);
          try { localStorage.setItem('die_app_profiles', JSON.stringify(cloudProfiles)); } catch {}
          setCloudSyncStatus('connected');
        },
        () => {
          setCloudSyncStatus('offline');
          fetchData();
        }
      );

      unsubLogs = subscribeLogs(
        (cloudLogs) => {
          const sorted = [...cloudLogs].sort((a, b) => new Date(b.timestampRaw).getTime() - new Date(a.timestampRaw).getTime());
          setLogs(sorted);
          try { localStorage.setItem('die_app_logs', JSON.stringify(sorted)); } catch {}
          setCloudSyncStatus('connected');
        },
        () => setCloudSyncStatus('offline')
      );

      unsubSales = subscribeMonthlySales(
        (cloudSales) => {
          setMonthlySales(cloudSales);
          try { localStorage.setItem('die_app_monthly_sales', JSON.stringify(cloudSales)); } catch {}
          setCloudSyncStatus('connected');
        },
        () => setCloudSyncStatus('offline')
      );
    } catch (err) {
      console.warn("Firestore subscription notice:", err);
      setCloudSyncStatus('offline');
      fetchData();
    }

    return () => {
      unsubDies?.();
      unsubProfiles?.();
      unsubLogs?.();
      unsubSales?.();
    };
  }, []);

  const getCurrentTimestamp = () => {
    const now = new Date();
    return { display: now.toLocaleString('th-TH'), raw: now.toISOString() };
  };

  const addLogCloud = async (dieId: string, type: string, detail: string, weight = 0, inspectionData: Record<string, any> | null = null) => {
    const time = getCurrentTimestamp();
    const die = dies.find(d => d.id === dieId);
    
    const logPayload: Log = {
      id: "log_" + Date.now(),
      dieId, 
      dieCode: die?.dieCode || 'N/A',
      dieNumber: die?.dieNumber || 'N/A',
      type, 
      detail, 
      weight, 
      timestamp: time.display, 
      timestampRaw: time.raw, 
      userId: role || 'user',
      inspectionData: inspectionData || null,
      performedBy: role
    };

    setLogs(prev => {
      const next = [logPayload, ...prev];
      try { localStorage.setItem('die_app_logs', JSON.stringify(next)); } catch {}
      return next;
    });

    // Write to Firebase Cloud Firestore
    addLogToCloud(logPayload).catch(err => console.warn('Cloud log sync notice:', err));

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
      }).catch(() => null);
    } catch {
      // Local state and storage already updated
    }
  };

  const exportInventoryDetailed = () => {
    const headers = [
      'Registration Date', 'Die Code', 'Die No.', 'Profile Name', 'Status', 'Invoice No.', 'Target (kg)', 
      'Usage (kg)', 'Remain (kg)', 'Progress (%)', 'Last Action'
    ];
    
    const rows = filteredDies.map(die => {
      const progress = ((die.currentUsageKg / die.toolLifeKg) * 100).toFixed(2);
      const remain = Math.max(0, die.toolLifeKg - die.currentUsageKg);
      const regDate = die.createdAt ? new Date(die.createdAt).toLocaleString('th-TH') : 'N/A';
      
      return [
        `"${regDate}"`,
        die.dieCode || 'N/A',
        die.dieNumber || 'N/A',
        die.profileName || 'N/A',
        die.status || 'N/A',
        die.invoiceNo || 'N/A',
        die.toolLifeKg || 0,
        die.currentUsageKg || 0,
        remain,
        `${progress}%`,
        die.lastActionTime || '-'
      ];
    });

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Die_Inventory_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportHistoryLogs = () => {
    const headers = [
      'Timestamp', 'Die Code', 'Die No.', 'Activity Type', 'Description', 'Weight (kg)', 'Performed By', 'Inspection Data'
    ];

    const rows = logs.map(log => {
      const inspectionStr = log.inspectionData 
        ? Object.entries(log.inspectionData).map(([k, v]) => `${k}:${v}`).join(' | ') 
        : '-';

      return [
        `"${log.timestamp}"`,
        log.dieCode || 'N/A',
        log.dieNumber || 'N/A',
        log.type || 'N/A',
        `"${log.detail || '-'}"`,
        log.weight || 0,
        log.performedBy || 'Unknown',
        `"${inspectionStr}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Die_History_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm || role !== 'admin') return;
    if (!isSecurityCodeValid(deletePasscode)) {
      setDeletePasscodeError(true);
      return;
    }
    const target = { ...showDeleteConfirm };
    setShowDeleteConfirm(null);
    setDeletePasscode('');
    setDeletePasscodeError(false);

    try {
      if (target.type === 'die') {
        setDies(prev => {
          const next = prev.filter(d => d.id !== target.id);
          try { localStorage.setItem('die_app_dies', JSON.stringify(next)); } catch {}
          return next;
        });
        await deleteDieFromCloud(target.id).catch(err => console.warn('Cloud die delete notice:', err));
        await fetch(`/api/dies/${target.id}`, { method: 'DELETE' }).catch(() => null);
        await addLogCloud(target.id, 'Delete Data', `ลบข้อมูลแม่พิมพ์ ${target.title} ออกจากระบบถาวร`);
      } else if (target.type === 'profile') {
        setProfiles(prev => {
          const next = prev.filter(p => p.dieCode !== target.id);
          try { localStorage.setItem('die_app_profiles', JSON.stringify(next)); } catch {}
          return next;
        });
        await deleteProfileFromCloud(target.id).catch(err => console.warn('Cloud profile delete notice:', err));
        await fetch(`/api/profiles/${target.id}`, { method: 'DELETE' }).catch(() => null);
      } else if (target.type === 'log') {
        const logId = target.id;
        setLogs(prev => {
          const next = prev.filter(l => l.id !== logId);
          try { localStorage.setItem('die_app_logs', JSON.stringify(next)); } catch {}
          return next;
        });
        setSelectedLogIds(prev => prev.filter(id => id !== logId));
        await deleteLogFromCloud(logId).catch(err => console.warn('Cloud log delete notice:', err));
        await fetch(`/api/logs/${logId}`, { method: 'DELETE' }).catch(() => null);
      } else if (target.type === 'logs_selected') {
        const idsToDelete = target.targetIds || selectedLogIds;
        if (idsToDelete.length > 0) {
          const set = new Set(idsToDelete);
          setLogs(prev => {
            const next = prev.filter(l => !set.has(l.id));
            try { localStorage.setItem('die_app_logs', JSON.stringify(next)); } catch {}
            return next;
          });
          setSelectedLogIds([]);
          await deleteLogsBatchFromCloud(idsToDelete).catch(err => console.warn('Cloud batch log delete notice:', err));
          await fetch('/api/logs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsToDelete })
          }).catch(() => null);
        }
      } else if (target.type === 'logs_all') {
        setLogs([]);
        try { localStorage.setItem('die_app_logs', JSON.stringify([])); } catch {}
        setSelectedLogIds([]);
        await clearAllLogsFromCloud().catch(err => console.warn('Cloud clear all logs notice:', err));
        await fetch('/api/logs', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [] })
        }).catch(() => null);
      }
    } catch (error) { 
      console.warn("Delete Error:", error); 
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setPreviewImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const changeDieStatus = async (dieId: string, newStatus: string, reason: string | null = null) => {
    setShowStatusMenu(null);
    const time = getCurrentTimestamp();
    
    const updateData: Partial<Die> = { status: newStatus, lastActionTime: time.display };
    if (reason) {
      updateData.statusReason = reason;
    }

    setDies(prev => {
      const next = prev.map(d => d.id === dieId ? { ...d, ...updateData } : d);
      try { localStorage.setItem('die_app_dies', JSON.stringify(next)); } catch {}
      return next;
    });

    // Save status update to Firebase Cloud
    updateDieInCloud(dieId, updateData).catch(err => console.warn('Cloud die status notice:', err));

    try {
      await fetch(`/api/dies/${dieId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      }).catch(() => null);
      
      const logDetail = `เปลี่ยนสถานะเป็น ${newStatus}${reason ? ` (สาเหตุ: ${reason})` : ''}`;
      await addLogCloud(dieId, 'Status Update', logDetail);
      fetchData();
    } catch (err) {
      console.warn("Notice: Status updated locally:", err);
    }
  };

  const handleAddDie = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (role !== 'admin') return;
    const formData = new FormData(e.currentTarget);
    const time = getCurrentTimestamp();
    const dieCode = formData.get('dieCode') as string;
    const profileSpec = profiles.find(p => p.dieCode === dieCode);
    const existingDieSpec = dies.find(d => d.dieCode === dieCode);
    
    const newDieData: Die = {
      id: "die_" + Date.now(),
      dieCode: dieCode,
      dieNumber: (formData.get('dieNumber') as string) || '01',
      profileName: (formData.get('profileName') as string) || '',
      invoiceNo: (formData.get('invoiceNo') as string) || '', 
      location: (formData.get('location') as string) || '',
      model: (formData.get('model') as string) || '',
      toolLifeKg: profileSpec ? profileSpec.toolLifeKg : (existingDieSpec ? existingDieSpec.toolLifeKg : 10000),
      status: 'Available',
      currentUsageKg: 0,
      isInspected: false,
      lastActionTime: time.display,
      hexColor: '#4f46e5',
      image: previewImage,
      createdAt: time.raw,
      specs: profileSpec ? profileSpec.specs : (existingDieSpec ? existingDieSpec.specs : {})
    };

    setDies(prev => {
      const next = [...prev, newDieData];
      try { localStorage.setItem('die_app_dies', JSON.stringify(next)); } catch {}
      return next;
    });

    // Save new die to Firebase Cloud
    saveDieToCloud(newDieData).catch(err => console.warn('Cloud die save notice:', err));

    try {
      await fetch('/api/dies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDieData)
      }).catch(() => null);
      setShowAddDieModal(false);
      setPreviewImage(null);
      fetchData();
    } catch (err) {
      console.warn("Notice: Die added locally:", err);
      setShowAddDieModal(false);
      setPreviewImage(null);
    }
  };

  const openSpecModal = (profile: Profile) => {
    setSelectedProfile(profile);
    const normalized = normalizeSpecs(profile.specs);
    if (normalized.length > 0) {
      setSpecFormItems(normalized);
    } else {
      setSpecFormItems(defaultSpecTemplate);
    }
    setShowSpecModal(true);
  };

  const addSpecPoint = (type: SpecType = 'min_max') => {
    const isApp = type === 'appearance';
    const count = specFormItems.filter(s => isApp ? s.type === 'appearance' : s.type !== 'appearance').length + 1;
    const newItem: SpecItem = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: isApp ? `จุดตรวจ Appearance #${count}` : `จุดวัดขนาด #${count}`,
      type,
      min: isApp ? undefined : 0,
      max: isApp ? undefined : 0,
      unit: isApp ? '-' : 'mm'
    };
    setSpecFormItems(prev => [...prev, newItem]);
  };

  const updateSpecPoint = (id: string, updates: Partial<SpecItem>) => {
    setSpecFormItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        if (updates.type) {
          if (updates.type === 'appearance') {
            updated.unit = '-';
            updated.min = undefined;
            updated.max = undefined;
          } else if (updates.type === 'min') {
            updated.max = undefined;
            if (updated.unit === '-') updated.unit = 'mm';
          } else if (updates.type === 'max') {
            updated.min = undefined;
            if (updated.unit === '-') updated.unit = 'mm';
          } else if (updates.type === 'min_max') {
            if (updated.unit === '-') updated.unit = 'mm';
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const removeSpecPoint = (id: string) => {
    setSpecFormItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSpecSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProfile || role !== 'admin') return;
    const formData = new FormData(e.currentTarget);
    const time = getCurrentTimestamp();
    const dieCode = (formData.get('dieCode') as string) || selectedProfile.dieCode;
    if (!dieCode) return;

    const newToolLife = parseFloat(formData.get('toolLifeKg') as string) || 0;
    const profileName = (formData.get('profileName') as string) || "";

    // Clean and validate every spec point according to its type
    const cleanedSpecs = specFormItems.map(cleanSpecItem);

    const profilePayload = {
      dieCode: dieCode,
      profileName: profileName,
      specs: cleanedSpecs,
      toolLifeKg: newToolLife,
      updatedAt: time.raw
    };

    setSpecSaving(true);

    try {
      // 1. Optimistic update in state & localStorage
      setProfiles(prev => {
        const exists = prev.some(p => p.dieCode === profilePayload.dieCode);
        const next = exists
          ? prev.map(p => p.dieCode === profilePayload.dieCode ? { ...p, ...profilePayload } : p)
          : [...prev, profilePayload];
        try { localStorage.setItem('die_app_profiles', JSON.stringify(next)); } catch {}
        return next;
      });

      setDies(prev => {
        const next = prev.map(d => {
          if (d.dieCode === profilePayload.dieCode) {
            return {
              ...d,
              profileName: profilePayload.profileName || d.profileName,
              toolLifeKg: profilePayload.toolLifeKg || d.toolLifeKg,
              specs: profilePayload.specs || d.specs
            };
          }
          return d;
        });
        try { localStorage.setItem('die_app_dies', JSON.stringify(next)); } catch {}
        return next;
      });

      // 2. Persist to Firebase Firestore AND synchronize all dies sharing this dieCode
      await saveProfileAndSyncDies(profilePayload);

      // 3. Persist to server fallback
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload)
      }).catch(err => console.warn('Server fallback API notice:', err));

      setShowSpecModal(false);
      setSelectedProfile(null);
    } catch (err) {
      console.warn("Notice: Profile spec updated locally:", err);
      setShowSpecModal(false);
      setSelectedProfile(null);
    } finally {
      setSpecSaving(false);
    }
  };

  // Helper to always resolve the active master specifications for any die
  const getActiveDieSpecs = (die: Die | null | undefined): any => {
    if (!die) return {};
    const masterProfile = profiles.find(p => p.dieCode === die.dieCode);
    if (masterProfile && masterProfile.specs && normalizeSpecs(masterProfile.specs).length > 0) {
      return masterProfile.specs;
    }
    return die.specs || {};
  };

  const openInspectionModal = (die: Die) => {
    setSelectedDie(die);
    setJudgmentError(null);
    const activeSpecs = getActiveDieSpecs(die);
    const normalized = normalizeSpecs(activeSpecs);
    const initialApp: Record<string, 'PASS' | 'NG'> = {};
    const appItems = normalized.filter(s => s.type === 'appearance');
    if (appItems.length > 0) {
      appItems.forEach(item => {
        initialApp[item.id] = 'PASS';
      });
    } else {
      initialApp['visual_surface'] = 'PASS';
      initialApp['visual_crack'] = 'PASS';
      initialApp['visual_clean'] = 'PASS';
    }
    setInspectionAppearance(initialApp);
    setInspectionNumericValues({});
    setInspectionNotes('');
    setShowInspectionModal(true);
  };

  const handleInspectionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDie) return;
    const activeSpecs = getActiveDieSpecs(selectedDie);
    const dieSpecs = normalizeSpecs(activeSpecs);
    const appearanceItems = dieSpecs.filter(s => s.type === 'appearance');
    const numericItems = dieSpecs.filter(s => s.type !== 'appearance');

    let missingErrors: string[] = [];
    let outOfSpecErrors: string[] = [];
    let inspectionValues: Record<string, any> = {};

    // 1. Appearance / Visual checks
    if (appearanceItems.length > 0) {
      appearanceItems.forEach(item => {
        const result = inspectionAppearance[item.id] || 'PASS';
        inspectionValues[item.name] = result;
        if (result === 'NG') {
          outOfSpecErrors.push(`${item.name}: ผลประเมินลักษณะภายนอกไม่ผ่านเกณฑ์ (NG)`);
        }
      });
    } else {
      const defaultVisuals = [
        { key: 'visual_surface', label: 'Surface Quality (ผิวงาน)' },
        { key: 'visual_crack', label: 'Crack Check (รอยร้าว)' },
        { key: 'visual_clean', label: 'Cleanliness (ความสะอาด)' }
      ];
      defaultVisuals.forEach(v => {
        const result = inspectionAppearance[v.key] || 'PASS';
        inspectionValues[v.label] = result;
        if (result === 'NG') {
          outOfSpecErrors.push(`${v.label}: ผลประเมินลักษณะภายนอกไม่ผ่านเกณฑ์ (NG)`);
        }
      });
    }

    // 2. Numeric dimension checks (min, max, min_max)
    numericItems.forEach(item => {
      const rawVal = (inspectionNumericValues[item.id] ?? '').toString().trim();
      if (rawVal === '') {
        missingErrors.push(`${item.name}: ยังไม่ได้ระบุค่าตัวเลขที่วัดได้จริง`);
        return;
      }

      const actual = parseFloat(rawVal);
      if (isNaN(actual)) {
        missingErrors.push(`${item.name}: กรุณาระบุเป็นค่าตัวเลขที่ถูกต้อง`);
        return;
      }

      inspectionValues[item.name] = actual;

      if (item.type === 'min_max') {
        const min = item.min ?? 0;
        const max = item.max ?? 0;
        if (min > 0 || max > 0) {
          if (actual < min || actual > max) {
            outOfSpecErrors.push(`${item.name}: วัดได้ ${actual} ${item.unit || 'mm'} (เกณฑ์กำหนด ${min} - ${max} ${item.unit || 'mm'})`);
          }
        }
      } else if (item.type === 'min') {
        const min = item.min ?? 0;
        if (actual < min) {
          outOfSpecErrors.push(`${item.name}: วัดได้ ${actual} ${item.unit || 'mm'} ต่ำกว่าเกณฑ์ขั้นต่ำ (≥ ${min} ${item.unit || 'mm'})`);
        }
      } else if (item.type === 'max') {
        const max = item.max ?? 0;
        if (actual > max) {
          outOfSpecErrors.push(`${item.name}: วัดได้ ${actual} ${item.unit || 'mm'} สูงกว่าเกณฑ์สูงสุด (≤ ${max} ${item.unit || 'mm'})`);
        }
      }
    });

    // If there are missing fields that have not been typed yet, require them
    if (missingErrors.length > 0) {
      setJudgmentError(missingErrors);
      return;
    }

    // System decision: NG if any out-of-spec errors, otherwise PASS
    const isNg = outOfSpecErrors.length > 0;
    const judgment: 'PASS' | 'NG' = isNg ? 'NG' : 'PASS';
    const time = getCurrentTimestamp();

    const inspectionRecord = {
      ...inspectionValues,
      _judgment: judgment,
      _ngReasons: isNg ? outOfSpecErrors : [],
      _notes: inspectionNotes.trim() || undefined,
      _testedAt: time.display
    };

    const nextStatus = isNg ? 'Hold' : 'Available';
    const nextStatusReason = isNg
      ? `ผลตรวจ NG: ${outOfSpecErrors[0]}${outOfSpecErrors.length > 1 ? ` (+${outOfSpecErrors.length - 1} จุด)` : ''}`
      : 'ผ่านการตรวจสอบคุณภาพ (PASS)';

    const dieUpdates: Partial<Die> = {
      isInspected: !isNg,
      lastInspectionResult: judgment,
      status: nextStatus,
      statusReason: nextStatusReason,
      lastActionTime: time.display
    };

    setDies(prev => {
      const next = prev.map(d => d.id === selectedDie.id ? { ...d, ...dieUpdates } : d);
      try { localStorage.setItem('die_app_dies', JSON.stringify(next)); } catch {}
      return next;
    });

    // Save inspection state to Firebase Cloud
    updateDieInCloud(selectedDie.id, dieUpdates)
      .catch(err => console.warn('Cloud inspection update notice:', err));

    try {
      await fetch(`/api/dies/${selectedDie.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dieUpdates)
      }).catch(() => null);

      const logDetail = isNg
        ? `ผลการตรวจ: ไม่ผ่านเกณฑ์ (NG) - พบ ${outOfSpecErrors.length} จุดหลุด Spec (${outOfSpecErrors.join(', ')})`
        : 'ผลการตรวจ: ผ่านเกณฑ์มาตรฐาน (PASS) - ทุกจุดขนาดและลักษณะภายนอกถูกต้องตาม Spec';

      await addLogCloud(selectedDie.id, 'Inspection', logDetail, 0, inspectionRecord);
      setShowInspectionModal(false);
      setJudgmentError(null);
      setInspectionNumericValues({});
      setInspectionNotes('');
      fetchData();
    } catch (err) {
      console.warn("Notice: Inspection logged locally:", err);
      setShowInspectionModal(false);
      setJudgmentError(null);
      setInspectionNumericValues({});
      setInspectionNotes('');
    }
  };

  const handleProductionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDie) return;
    const formData = new FormData(e.currentTarget);
    const weight = parseFloat(formData.get('weight') as string) || 0;
    const time = getCurrentTimestamp();
    const newUsage = (selectedDie.currentUsageKg || 0) + weight;

    setDies(prev => {
      const next = prev.map(d => d.id === selectedDie.id ? { 
        ...d, 
        currentUsageKg: newUsage, 
        status: 'Production', 
        isInspected: false, 
        lastActionTime: time.display 
      } : d);
      try { localStorage.setItem('die_app_dies', JSON.stringify(next)); } catch {}
      return next;
    });

    // Save production usage to Firebase Cloud
    updateDieInCloud(selectedDie.id, { 
      currentUsageKg: newUsage, 
      status: 'Production', 
      isInspected: false, 
      lastActionTime: time.display 
    }).catch(err => console.warn('Cloud production update notice:', err));

    try {
      await fetch(`/api/dies/${selectedDie.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentUsageKg: newUsage, 
          status: 'Production', 
          isInspected: false, 
          lastActionTime: time.display 
        })
      }).catch(() => null);

      await addLogCloud(selectedDie.id, 'Production', `ผลิต ${weight} kg`, weight);
      setShowProductionModal(false);
      fetchData();
    } catch (err) {
      console.warn("Notice: Production logged locally:", err);
      setShowProductionModal(false);
    }
  };

  const filteredDies = useMemo(() => {
    return dies.filter(d => {
      const matchDieCode = !searchDieCode.trim() || (d.dieCode || '').toLowerCase().includes(searchDieCode.trim().toLowerCase());
      const matchDieNumber = !searchDieNumber.trim() || (d.dieNumber || '').toLowerCase().includes(searchDieNumber.trim().toLowerCase());
      const matchProfileName = !searchProfileName.trim() || (d.profileName || '').toLowerCase().includes(searchProfileName.trim().toLowerCase());
      return matchDieCode && matchDieNumber && matchProfileName;
    });
  }, [dies, searchDieCode, searchDieNumber, searchProfileName]);

  const hasActiveInventoryFilters = Boolean(searchDieCode.trim() || searchDieNumber.trim() || searchProfileName.trim());
  const clearInventoryFilters = () => {
    setSearchDieCode('');
    setSearchDieNumber('');
    setSearchProfileName('');
  };

  const getMergedProfiles = () => {
    const merged: Record<string, Profile> = {};
    profiles.forEach(p => { merged[p.dieCode] = { ...p, source: 'profile' }; });
    dies.forEach(d => {
      if (!merged[d.dieCode]) {
        merged[d.dieCode] = {
          dieCode: d.dieCode,
          profileName: d.profileName,
          specs: d.specs || {},
          toolLifeKg: d.toolLifeKg || 10000,
          source: 'die',
          updatedAt: d.createdAt
        };
      }
    });
    return Object.values(merged).filter(p => 
      p.dieCode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.profileName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getProfileSummary = useMemo(() => {
    const summary: Record<string, { profileCode: string; profileName: string; qty: number; totalRemainKg: number }> = {};
    dies.forEach(d => {
      const code = d.dieCode || 'Unknown';
      if (!summary[code]) {
        summary[code] = {
          profileCode: code,
          profileName: d.profileName || '-',
          qty: 0,
          totalRemainKg: 0
        };
      }
      summary[code].qty += 1;
      summary[code].totalRemainKg += Math.max(0, (d.toolLifeKg || 0) - (d.currentUsageKg || 0));
    });
    return Object.values(summary).filter(s => 
        s.profileCode.toLowerCase().includes(dashboardSearch.toLowerCase()) || 
        s.profileName.toLowerCase().includes(dashboardSearch.toLowerCase())
    );
  }, [dies, dashboardSearch]);

  const profileRemainChartData = useMemo(() => {
    const map: Record<string, {
      profileName: string;
      dieCodes: Set<string>;
      dieCount: number;
      totalRemainKg: number;
      totalUsageKg: number;
      totalTargetKg: number;
      criticalCount: number;
    }> = {};

    dies.forEach(d => {
      const pName = (d.profileName || d.dieCode || 'Unnamed Profile').trim();
      if (!map[pName]) {
        map[pName] = {
          profileName: pName,
          dieCodes: new Set(),
          dieCount: 0,
          totalRemainKg: 0,
          totalUsageKg: 0,
          totalTargetKg: 0,
          criticalCount: 0
        };
      }
      const usage = d.currentUsageKg || 0;
      const target = d.toolLifeKg || 10000;
      const remain = Math.max(0, target - usage);
      const isCritical = target > 0 ? (usage / target) > 0.9 : false;

      if (d.dieCode) map[pName].dieCodes.add(d.dieCode);
      map[pName].dieCount += 1;
      map[pName].totalRemainKg += remain;
      map[pName].totalUsageKg += usage;
      map[pName].totalTargetKg += target;
      if (isCritical) map[pName].criticalCount += 1;
    });

    const list = Object.values(map).map(item => {
      const avgRemain = item.dieCount > 0 ? Math.round(item.totalRemainKg / item.dieCount) : 0;
      const progressPct = item.totalTargetKg > 0 ? Math.round((item.totalUsageKg / item.totalTargetKg) * 100) : 0;
      const val = profileChartMetric === 'total' ? Math.round(item.totalRemainKg) : avgRemain;
      return {
        profileName: item.profileName,
        dieCodesList: Array.from(item.dieCodes).join(', '),
        dieCount: item.dieCount,
        totalRemainKg: Math.round(item.totalRemainKg),
        avgRemainKg: avgRemain,
        totalUsageKg: Math.round(item.totalUsageKg),
        totalTargetKg: Math.round(item.totalTargetKg),
        progressPct,
        criticalCount: item.criticalCount,
        value: val
      };
    }).filter(item => {
      if (!dashboardSearch.trim()) return true;
      const q = dashboardSearch.trim().toLowerCase();
      return item.profileName.toLowerCase().includes(q) || item.dieCodesList.toLowerCase().includes(q);
    });

    if (profileChartSort === 'remain_desc') {
      return list.sort((a, b) => b.value - a.value);
    } else {
      return list.sort((a, b) => a.profileName.localeCompare(b.profileName));
    }
  }, [dies, dashboardSearch, profileChartMetric, profileChartSort]);

  const CustomProfileTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 text-xs space-y-2.5 min-w-[240px] z-50 pointer-events-none text-left">
          <div className="border-b border-slate-700 pb-2">
            <p className="font-black text-sm text-indigo-300 font-display">{data.profileName}</p>
            <p className="text-[10px] text-slate-400 font-mono">Die Code: {data.dieCodesList || 'N/A'}</p>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">จำนวนในคลัง:</span>
              <span className="font-bold text-white">{data.dieCount} ตัว</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Remain รวม:</span>
              <span className="font-black text-emerald-400">{data.totalRemainKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Remain เฉลี่ย/ตัว:</span>
              <span className="font-black text-emerald-300">{data.avgRemainKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ผลิตแล้ว:</span>
              <span className="font-bold text-slate-300">{data.totalUsageKg.toLocaleString()} kg ({data.progressPct}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Tool Life:</span>
              <span className="font-bold text-slate-400">{data.totalTargetKg.toLocaleString()} kg</span>
            </div>
            {data.criticalCount > 0 && (
              <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 text-rose-400 font-bold text-[10px]">
                <AlertTriangle size={12} className="animate-pulse" />
                <span>ใกล้หมดอายุ ({data.criticalCount} ตัว &gt;90%)</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const get3Months = (baseMonthStr: string) => {
    const parts = (baseMonthStr || '2026-09').split('-');
    const y = parseInt(parts[0], 10) || 2026;
    const m = (parseInt(parts[1], 10) || 9) - 1;

    const dates = [
      new Date(y, m, 1),
      new Date(y, m + 1, 1),
      new Date(y, m + 2, 1)
    ];

    const thMonthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    return dates.map((d, idx) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${yyyy}-${mm}`;
      const thMonth = thMonthNames[d.getMonth()];
      const thYear = yyyy + 543;
      const tag = idx === 0 ? 'เดือนปัจจุบัน (M)' : idx === 1 ? 'เดือนหน้า (M+1)' : '2 เดือนหน้า (M+2)';
      return {
        key,
        shortLabel: `${thMonth} ${String(thYear).slice(-2)}`,
        fullLabel: `${thMonth} ${thYear}`,
        tag,
        index: idx
      };
    });
  };

  const procurement3Months = useMemo(() => {
    return get3Months(procurementBaseMonth);
  }, [procurementBaseMonth]);

  const handleSaleInputChange = (profileName: string, monthKey: string, value: string) => {
    const numVal = Math.max(0, Number(value) || 0);
    const key = `${profileName}___${monthKey}`;
    setEditedSales(prev => ({
      ...prev,
      [key]: numVal
    }));
  };

  const getSaleInputValue = (profileName: string, monthKey: string) => {
    const key = `${profileName}___${monthKey}`;
    if (editedSales[key] !== undefined) {
      return editedSales[key];
    }
    const found = monthlySales.find(
      s => s.profileName.trim().toLowerCase() === profileName.trim().toLowerCase() && s.month === monthKey
    );
    return found ? found.targetSalesKg : 0;
  };

  const procurementPlanningData = useMemo(() => {
    const profileMap: Record<string, {
      profileName: string;
      dieCodes: Set<string>;
      diesCount: number;
      toolLifeTarget: number;
      toolLifeRemain: number;
    }> = {};

    profiles.forEach(p => {
      const name = (p.profileName || p.dieCode).trim();
      if (!profileMap[name]) {
        profileMap[name] = {
          profileName: name,
          dieCodes: new Set(),
          diesCount: 0,
          toolLifeTarget: p.toolLifeKg || 10000,
          toolLifeRemain: 0
        };
      }
      if (p.dieCode) profileMap[name].dieCodes.add(p.dieCode);
    });

    dies.forEach(d => {
      const name = (d.profileName || d.dieCode || 'Unknown Profile').trim();
      if (!profileMap[name]) {
        profileMap[name] = {
          profileName: name,
          dieCodes: new Set(),
          diesCount: 0,
          toolLifeTarget: d.toolLifeKg || 10000,
          toolLifeRemain: 0
        };
      }
      if (d.dieCode) profileMap[name].dieCodes.add(d.dieCode);
      profileMap[name].diesCount += 1;
      const remain = Math.max(0, (d.toolLifeKg || 10000) - (d.currentUsageKg || 0));
      profileMap[name].toolLifeRemain += remain;
      if (d.toolLifeKg) {
        profileMap[name].toolLifeTarget = d.toolLifeKg;
      }
    });

    const [m0, m1, m2] = procurement3Months;

    return Object.values(profileMap).map(item => {
      const m0Sales = getSaleInputValue(item.profileName, m0.key);
      const m1Sales = getSaleInputValue(item.profileName, m1.key);
      const m2Sales = getSaleInputValue(item.profileName, m2.key);
      const total3MonthsSales = m0Sales + m1Sales + m2Sales;
      // Formula: tool life remain by profile - ยอดขายรวม
      const balanceKg = item.toolLifeRemain - total3MonthsSales;
      const needsOrder = balanceKg < 0;
      const deficitKg = needsOrder ? Math.abs(balanceKg) : 0;
      const targetPerDie = item.toolLifeTarget > 0 ? item.toolLifeTarget : 10000;
      const recommendedDiesOrder = needsOrder ? Math.ceil(deficitKg / targetPerDie) : 0;

      return {
        profileName: item.profileName,
        dieCodesList: Array.from(item.dieCodes).join(', ') || '-',
        diesCount: item.diesCount,
        toolLifeTarget: targetPerDie,
        toolLifeRemain: item.toolLifeRemain,
        m0Sales,
        m1Sales,
        m2Sales,
        total3MonthsSales,
        balanceKg,
        needsOrder,
        deficitKg,
        recommendedDiesOrder
      };
    });
  }, [dies, profiles, monthlySales, editedSales, procurement3Months]);

  const filteredProcurementData = useMemo(() => {
    return procurementPlanningData.filter(item => {
      if (procurementFilter === 'needs_order' && !item.needsOrder) return false;
      if (!dashboardSearch.trim()) return true;
      const q = dashboardSearch.trim().toLowerCase();
      return (
        item.profileName.toLowerCase().includes(q) ||
        item.dieCodesList.toLowerCase().includes(q)
      );
    });
  }, [procurementPlanningData, procurementFilter, dashboardSearch]);

  const procurementSummary = useMemo(() => {
    const totalProfiles = procurementPlanningData.length;
    const urgentCount = procurementPlanningData.filter(p => p.needsOrder).length;
    const totalRemain = procurementPlanningData.reduce((sum, p) => sum + p.toolLifeRemain, 0);
    const total3MonthsDemand = procurementPlanningData.reduce((sum, p) => sum + p.total3MonthsSales, 0);
    const overallBalance = totalRemain - total3MonthsDemand;
    return {
      totalProfiles,
      urgentCount,
      totalRemain,
      total3MonthsDemand,
      overallBalance
    };
  }, [procurementPlanningData]);

  const exportProcurementCSV = () => {
    const [m0, m1, m2] = procurement3Months;
    const headers = [
      'Profile Name',
      'Die Codes',
      'Dies Qty',
      'Target Tool Life (kg/die)',
      'Tool Life Remain (kg)',
      `Sales ${m0.fullLabel} (kg)`,
      `Sales ${m1.fullLabel} (kg)`,
      `Sales ${m2.fullLabel} (kg)`,
      'Total 3-Month Sales (kg)',
      'Net Balance (kg)',
      'Status / Order Required',
      'Deficit (kg)',
      'Recommended Dies to Order'
    ];

    const rows = filteredProcurementData.map(p => [
      `"${p.profileName.replace(/"/g, '""')}"`,
      `"${p.dieCodesList.replace(/"/g, '""')}"`,
      p.diesCount,
      p.toolLifeTarget,
      p.toolLifeRemain,
      p.m0Sales,
      p.m1Sales,
      p.m2Sales,
      p.total3MonthsSales,
      p.balanceKg,
      p.needsOrder ? 'ORDER REQUIRED (ต้องสั่งซื้อแล้ว)' : 'SUFFICIENT (เพียงพอ)',
      p.deficitKg,
      p.recommendedDiesOrder
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Die_Procurement_Plan_${procurementBaseMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ProcurementChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 text-xs space-y-2.5 min-w-[260px] z-50 pointer-events-none text-left font-sans">
          <div className="border-b border-slate-700 pb-2">
            <p className="font-black text-sm text-indigo-300 font-display">{data.profileName}</p>
            <p className="text-[10px] text-slate-400 font-mono">Die Code: {data.dieCodesList}</p>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Tool Life Remain:</span>
              <span className="font-black text-indigo-400">{data.toolLifeRemain.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ยอดขายรวม 3 เดือน:</span>
              <span className="font-black text-amber-400">{data.total3MonthsSales.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5">
              <span className="text-slate-400">ดุลสุทธิ (Balance):</span>
              <span className={`font-black ${data.balanceKg < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                {data.balanceKg >= 0 ? `+${data.balanceKg.toLocaleString()}` : `${data.balanceKg.toLocaleString()}`} kg
              </span>
            </div>
            {data.needsOrder ? (
              <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 text-rose-400 font-bold text-[10px]">
                <AlertTriangle size={14} className="animate-pulse flex-shrink-0" />
                <span>🚨 ต้องสั่งซื้อแล้ว! (ขาด {data.deficitKg.toLocaleString()} kg, แนะนำ {data.recommendedDiesOrder} ตัว)</span>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 text-emerald-400 font-bold text-[10px]">
                <CheckCircle2 size={14} className="flex-shrink-0" />
                <span>✅ กำลังผลิตเพียงพอต่อยอดขาย 3 เดือน</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderSpecCheck = (label: string, key: string) => {
    const s = selectedDie?.specs?.[key];
    return (
      <div key={key}>
        <div className="flex justify-between text-[9px] font-bold mb-1">
          <span className="text-slate-400 font-display uppercase">{label}</span>
          {s && <span className="text-indigo-600 font-mono">{s.min}-{s.max}</span>}
        </div>
        <input name={`val_${key}`} type="number" step="0.001" className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-left outline-none focus:border-indigo-500 bg-white" placeholder="Actual" required />
      </div>
    );
  };

  const UsageChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    
    return (
      <div className="w-full">
        <div className="flex items-end h-64 gap-2 md:gap-4 px-2 pb-12 pt-8 border-b border-slate-100 relative overflow-visible">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-12 pt-8 opacity-20">
            {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-slate-300 border-dashed"></div>)}
          </div>

          {data.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs italic">
              ไม่พบข้อมูลจากการค้นหา
            </div>
          ) : (
            data.map((d, i) => {
              const heightPercent = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
              const barHeight = d.value > 0 ? `max(4px, ${heightPercent}%)` : '0px';

              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 pointer-events-none">
                    <div className="bg-slate-900 text-white text-[10px] font-mono font-black px-2 py-1 rounded shadow-xl whitespace-nowrap">
                      {d.value.toLocaleString()} kg
                    </div>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1"></div>
                  </div>

                  <div 
                    className={`w-full rounded-t-md transition-all duration-700 ease-out shadow-sm ${d.color} group-hover:brightness-110 group-hover:scale-x-105 origin-bottom`} 
                    style={{ height: barHeight }}
                  >
                  </div>

                  <div className="absolute top-full mt-3 w-full text-center">
                    <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-tighter block rotate-45 origin-top-left whitespace-nowrap ml-2">
                      {d.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const navItems = [
    { id: 'inventory', icon: Layout, label: 'คลังแม่พิมพ์' },
    ...(role === 'admin' ? [{ id: 'spec', icon: FileCog, label: 'Die Spec (Min-Max)' }] : []),
    { id: 'history', icon: History, label: 'ประวัติกิจกรรม' },
    ...(role === 'admin' ? [{ id: 'dashboard', icon: BarChart3, label: 'Dashboard' }] : [])
  ];

  const dashboardFilteredDies = dies.filter(d => 
    d.dieCode?.toLowerCase().includes(dashboardSearch.toLowerCase()) || 
    d.dieNumber?.toLowerCase().includes(dashboardSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden text-left">
      <nav className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-slate-800/50">
          <h1 className="text-xl font-bold flex items-center gap-2 tracking-tighter"><Package className="text-indigo-400" /> Die <span className="underline underline-offset-4 decoration-indigo-500">Manager</span></h1>
          <div className="mt-3 flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${role === 'admin' ? 'bg-emerald-400' : 'bg-indigo-400'} animate-pulse`}></div>
              <span className="text-[10px] font-black uppercase text-slate-200 tracking-wider">{role === 'admin' ? 'Administrator' : 'Operator User'}</span>
            </div>
            <button 
              onClick={() => setRole(r => r === 'admin' ? 'user' : 'admin')}
              className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer ml-1"
              title="คลิกเพื่อสลับระหว่าง Admin / Operator"
            >
              สลับ
            </button>
          </div>
        </div>
        <div className="mt-6 flex-1 text-sm space-y-1 px-2">
          {navItems.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400'}`}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800/60">
          <button 
            onClick={() => setRole(r => r === 'admin' ? 'user' : 'admin')} 
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-slate-700/50 hover:text-white"
            title="สลับโหมดมุมมอง Admin / Operator"
          >
            <UserIcon size={14} className="text-indigo-400" />
            <span>โหมด: {role === 'admin' ? 'Admin' : 'Operator'} (สลับ)</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b h-16 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase font-display">{activeTab}</h2>
            {activeTab === 'inventory' && (
              <button 
                onClick={exportInventoryDetailed}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-100 transition-colors"
              >
                <Download size={14} /> Export Report
              </button>
            )}
            {activeTab === 'history' && (
              <button 
                onClick={exportHistoryLogs}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet size={14} /> Export Excel (CSV)
              </button>
            )}
          </div>
          <div className="flex gap-4 items-center">
            {/* Firebase Cloud Sync Badge */}
            <div 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                cloudSyncStatus === 'connected' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : cloudSyncStatus === 'syncing'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
              title="ระบบจัดเก็บและซิงค์ข้อมูลบน Firebase Cloud แบบเรียลไทม์ เจ้าหน้าที่สามารถลงข้อมูลหรือติดตามได้จากทุกที่"
            >
              {cloudSyncStatus === 'connected' ? (
                <>
                  <Cloud size={14} className="text-emerald-600 animate-pulse" />
                  <span className="hidden md:inline">Firebase Cloud: เชื่อมต่อแล้ว</span>
                  <span className="md:hidden">Cloud</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </>
              ) : cloudSyncStatus === 'syncing' ? (
                <>
                  <Cloud size={14} className="text-amber-500 animate-pulse" />
                  <span className="hidden md:inline">กำลังเชื่อมต่อ Cloud...</span>
                </>
              ) : (
                <>
                  <CloudOff size={14} className="text-rose-500" />
                  <span className="hidden md:inline">โหมดออฟไลน์</span>
                </>
              )}
            </div>

            {activeTab !== 'inventory' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="ค้นหารหัส หรือ ชื่อโปรไฟล์..." 
                  value={searchTerm}
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent border focus:bg-white focus:border-indigo-500 rounded-xl text-xs w-64 outline-none transition-all" 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
            )}
            {activeTab === 'inventory' && role === 'admin' && <button onClick={() => setShowAddDieModal(true)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5">+ เพิ่มแม่พิมพ์</button>}
            {activeTab === 'spec' && role === 'admin' && (
              <button 
                onClick={() => openSecurityPrompt({
                  title: 'เพิ่ม Profile Die Spec ใหม่',
                  subtitle: 'กรุณากรอกรหัสความปลอดภัยเพื่อเข้าสู่หน้ากำหนด Die Profile และเกณฑ์มาตรฐานใหม่ (Die Spec Setting)',
                  actionTag: 'Die Spec Setting',
                  onSuccess: () => openSpecModal({ dieCode: '', profileName: '', specs: defaultSpecTemplate, toolLifeKg: 10000, updatedAt: '' })
                })} 
                className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <Lock size={14} className="text-emerald-200" />
                <PlusCircle size={16} /> 
                เพิ่ม Profile Spec
              </button>
            )}
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold uppercase tracking-widest">กำลังดาวน์โหลดข้อมูล...</span>
            </div>
          ) : activeTab === 'inventory' && (
            <div className="space-y-6">
              {/* Inventory Query & Search Bar */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Filter size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-display">ค้นหาและกรองข้อมูลแม่พิมพ์</h3>
                      <p className="text-[11px] text-slate-400 font-medium">แยกค้นหาตาม Die Code, Die Number และ Profile Name</p>
                    </div>
                  </div>

                  {/* 3 Dedicated Query Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-2xl">
                    {/* 1. Die Code Search */}
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 ml-1">Die Code</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="ค้นหา Die Code..."
                          value={searchDieCode}
                          onChange={(e) => setSearchDieCode(e.target.value)}
                          className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold outline-none transition-all uppercase font-mono"
                        />
                        {searchDieCode && (
                          <button
                            type="button"
                            onClick={() => setSearchDieCode('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="ล้าง"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2. Die Number Search */}
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 ml-1">Die Number</label>
                      <div className="relative">
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="ค้นหา Die No..."
                          value={searchDieNumber}
                          onChange={(e) => setSearchDieNumber(e.target.value)}
                          className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold outline-none transition-all font-mono"
                        />
                        {searchDieNumber && (
                          <button
                            type="button"
                            onClick={() => setSearchDieNumber('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="ล้าง"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 3. Profile Name Search */}
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 ml-1">Profile Name</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="ค้นหาชื่อ Profile..."
                          value={searchProfileName}
                          onChange={(e) => setSearchProfileName(e.target.value)}
                          className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold outline-none transition-all"
                        />
                        {searchProfileName && (
                          <button
                            type="button"
                            onClick={() => setSearchProfileName('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="ล้าง"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Result counter & Clear button */}
                  <div className="flex items-center gap-3 shrink-0 self-end lg:self-center pt-2 lg:pt-0">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">ผลการค้นหา</span>
                      <span className="text-xs font-black text-indigo-600 font-mono">
                        {filteredDies.length} <span className="text-slate-400 font-normal">/ {dies.length} ตัว</span>
                      </span>
                    </div>
                    {hasActiveInventoryFilters && (
                      <button
                        type="button"
                        onClick={clearInventoryFilters}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                        title="ล้างคำค้นหาทั้งหมด"
                      >
                        <RotateCcw size={12} /> ล้างค้นหา
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Table Card */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-visible shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-5">Profile Details</th>
                      <th className="px-6 py-5 text-center">Status</th>
                      <th className="px-6 py-5">Tool Life Progress</th>
                      <th className="px-6 py-5">Remain (kg)</th>
                      <th className="px-6 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDies.map(die => {
                      const usage = die.currentUsageKg || 0;
                      const life = die.toolLifeKg || 10000; 
                      const progress = (usage / life) * 100;
                      const remain = Math.max(0, life - usage);
                      const isCritical = progress > 90;
                      return (
                        <tr key={die.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <Package size={20} />
                              </div>
                              <div>
                                 <span className="font-black text-sm text-slate-900 block font-display">{die.dieCode}</span>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">No. {die.dieNumber} | {die.profileName}</span>
                                 {die.invoiceNo && <span className="block text-[9px] text-indigo-600 font-black uppercase mt-1 font-mono">Inv: {die.invoiceNo}</span>}
                                 
                                 {/* Inspection Status Badge & History Action */}
                                 <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                   {die.lastInspectionResult === 'PASS' ? (
                                     <button 
                                       type="button"
                                       onClick={(e) => { e.stopPropagation(); setViewHistoryDie(die); }}
                                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer" 
                                       title="คลิกเพื่อดูข้อมูลประวัติการตรวจ (รอบก่อนหน้า PASS)"
                                     >
                                       <Check size={10} /> ตรวจ: PASS
                                     </button>
                                   ) : die.lastInspectionResult === 'NG' ? (
                                     <button 
                                       type="button"
                                       onClick={(e) => { e.stopPropagation(); setViewHistoryDie(die); }}
                                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 animate-pulse transition-colors cursor-pointer" 
                                       title="คลิกเพื่อดูข้อมูลประวัติว่ารอบก่อนหน้าไม่ผ่านเพราะอะไร (NG)"
                                     >
                                       <AlertTriangle size={10} /> ตรวจ: NG
                                     </button>
                                   ) : die.isInspected ? (
                                     <button 
                                       type="button"
                                       onClick={(e) => { e.stopPropagation(); setViewHistoryDie(die); }}
                                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                                       title="คลิกเพื่อดูข้อมูลประวัติการตรวจ"
                                     >
                                       <Check size={10} /> พร้อมผลิต
                                     </button>
                                   ) : (
                                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                       ยังไม่ตรวจ
                                     </span>
                                   )}

                                   <button
                                     type="button"
                                     onClick={(e) => { e.stopPropagation(); setViewHistoryDie(die); }}
                                     className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-colors cursor-pointer"
                                     title="คลิกเพื่อดูข้อมูลประวัติการตรวจสอบในแต่ละรอบ"
                                   >
                                     <History size={10} /> ข้อมูลประวัติ
                                   </button>
                                 </div>

                                 {die.statusReason && (
                                   <span className={`block text-[9px] font-medium mt-1 ${die.lastInspectionResult === 'NG' ? 'text-rose-600 font-bold' : 'text-amber-600'}`}>
                                     หมายเหตุ: {die.statusReason}
                                   </span>
                                 )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center overflow-visible">
                            <div className="relative inline-block text-center overflow-visible">
                              <button onClick={() => setShowStatusMenu(showStatusMenu === die.id ? null : die.id)} className="px-4 py-1.5 border-2 rounded-xl text-[10px] font-black uppercase tracking-wider min-w-[120px] hover:bg-slate-50 transition-all flex items-center justify-between bg-white">
                                {die.status} <ChevronDown size={10} className="ml-2" />
                              </button>
                              {showStatusMenu === die.id && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-white border border-slate-200 shadow-2xl rounded-2xl z-[100] py-2 overflow-hidden">
                                  {['Available', 'Production', 'Maintenance', 'Hold', 'Scrap'].map(s => (
                                    <button 
                                      key={s} 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setShowStatusMenu(null);
                                        if (s === 'Hold' || s === 'Scrap') {
                                          setShowReasonModal({ dieId: die.id, newStatus: s });
                                        } else {
                                          changeDieStatus(die.id, s);
                                        }
                                      }} 
                                      className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors ${die.status === s ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-1.5">
                              <div className={`h-full transition-all duration-1000 ${isCritical ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(100, progress)}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                              <span className="text-slate-400 font-mono">Used: {usage.toLocaleString()} kg</span>
                              <span className={isCritical ? 'text-rose-500 animate-pulse font-mono' : 'text-slate-500 font-mono'}>{progress.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className={`text-sm font-black flex items-center gap-1.5 font-mono ${isCritical ? 'text-rose-600' : 'text-slate-700'}`}>
                                {remain.toLocaleString()}
                                {isCritical && <AlertTriangle size={14} className="animate-bounce text-rose-500" />}
                             </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {/* ปุ่มข้อมูลประวัติการตรวจสอบของ Die นี้ */}
                              <button 
                                type="button"
                                onClick={() => setViewHistoryDie(die)} 
                                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:-translate-y-0.5"
                                title={`ข้อมูลประวัติการตรวจสอบในแต่ละรอบ (Die No. ${die.dieNumber})`}
                              >
                                <History size={14} className="text-indigo-600" />
                                <span>ข้อมูลประวัติ</span>
                              </button>

                              <button 
                                onClick={() => openInspectionModal(die)} 
                                className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${
                                  die.lastInspectionResult === 'NG'
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                                    : die.lastInspectionResult === 'PASS'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100'
                                }`} 
                                title={die.lastInspectionResult === 'NG' ? 'ตรวจสอบแม่พิมพ์ (ผลล่าสุด NG - คลิกเพื่อตรวจสอบใหม่)' : 'ตรวจสอบแม่พิมพ์ (Inspection)'}
                              >
                                <ClipboardCheck size={18} />
                                {die.lastInspectionResult === 'NG' && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></span>
                                )}
                              </button>
                              <button 
                                disabled={!die.isInspected || die.lastInspectionResult === 'NG'} 
                                onClick={() => { setSelectedDie(die); setShowProductionModal(true); }} 
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${
                                  die.isInspected && die.lastInspectionResult !== 'NG'
                                    ? 'bg-slate-900 text-white cursor-pointer hover:bg-emerald-600 hover:shadow-emerald-200 hover:-translate-y-0.5' 
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                }`}
                                title={
                                  die.lastInspectionResult === 'NG'
                                    ? 'ไม่สามารถผลิตได้: แม่พิมพ์ไม่ผ่านการตรวจสอบ (NG)'
                                    : !die.isInspected
                                    ? 'ต้องผ่านการตรวจสอบคุณภาพ (PASS) ก่อนทำการผลิต'
                                    : 'พร้อมสำหรับการผลิต'
                                }
                              >
                                ผลิต
                              </button>
                              {role === 'admin' && (
                                <>
                                  <button
                                    onClick={() => openSecurityPrompt({
                                      title: `แก้ไขข้อมูลแม่พิมพ์: ${die.dieCode} (${die.dieNumber})`,
                                      subtitle: 'กรุณากรอกรหัสความปลอดภัยเพื่อเข้าสู่หน้าจอแก้ไขข้อมูลแม่พิมพ์ (Edit Die)',
                                      actionTag: 'แก้ไขข้อมูล (Edit Data)',
                                      targetName: `${die.dieCode} (${die.dieNumber})`,
                                      onSuccess: () => {
                                        setEditingDie({ ...die });
                                        setShowEditDieModal(true);
                                      }
                                    })}
                                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                                    title="แก้ไขข้อมูลแม่พิมพ์ (ต้องระบุรหัสความปลอดภัย)"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowDeleteConfirm({ id: die.id, type: 'die', title: `แม่พิมพ์ ${die.dieCode} (${die.dieNumber})` });
                                      setDeletePasscode('');
                                      setDeletePasscodeError(false);
                                      setShowDeletePasscode(false);
                                    }}
                                    className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                    title="ลบแม่พิมพ์ (ต้องระบุรหัสความปลอดภัย)"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredDies.length === 0 && (
                  <div className="p-16 text-center text-slate-400 space-y-2">
                    <Package className="mx-auto text-slate-300 mb-1" size={32} />
                    <p className="text-xs font-bold text-slate-500">ไม่พบแม่พิมพ์ที่ตรงกับเงื่อนไขการค้นหา</p>
                    {hasActiveInventoryFilters && (
                      <button
                        type="button"
                        onClick={clearInventoryFilters}
                        className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                      >
                        ล้างการค้นหาเพื่อดูรายการทั้งหมด
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'spec' && role === 'admin' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0">
                    <Lock size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider font-display text-white">ระบบควบคุมความปลอดภัย Die Spec Setting</h4>
                      <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-[9px] font-mono font-bold rounded border border-amber-400/30">PIN Protected</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">การเพิ่ม/แก้ไขเกณฑ์ขนาด จุดวัด หรือการลบ Profile ต้องผ่านการตรวจสอบรหัสความปลอดภัยเฉพาะผู้ดูแลระบบ</p>
                  </div>
                </div>
                <button 
                  onClick={() => openSecurityPrompt({
                    title: 'เพิ่ม Profile Die Spec ใหม่',
                    subtitle: 'กรุณากรอกรหัสความปลอดภัยเพื่อเข้าสู่หน้ากำหนด Die Profile และเกณฑ์มาตรฐานใหม่ (Die Spec Setting)',
                    actionTag: 'Die Spec Setting',
                    onSuccess: () => openSpecModal({ dieCode: '', profileName: '', specs: defaultSpecTemplate, toolLifeKg: 10000, updatedAt: '' })
                  })} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-md shadow-emerald-900/30"
                >
                  <Lock size={13} className="text-emerald-200" />
                  <PlusCircle size={15} /> 
                  เพิ่ม Profile Spec
                </button>
              </div>

              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-6 py-5">Die Profile (Key)</th><th className="px-6 py-5">Inspection Points & Specs (จุดวัดและเกณฑ์)</th><th className="px-6 py-5">Target (kg)</th><th className="px-6 py-5 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getMergedProfiles().map(profile => {
                      const normalized = normalizeSpecs(profile.specs);
                      return (
                        <tr key={profile.dieCode} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-5">
                            <span className="font-black text-sm text-slate-900 block font-display">{profile.dieCode}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{profile.profileName}</span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-wrap gap-1.5 max-w-xl">
                              {normalized.map(item => {
                                if (item.type === 'appearance') {
                                  return (
                                    <span key={item.id} className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] rounded-lg border border-purple-200 font-bold flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                      {item.name}: <span className="font-mono font-black text-purple-800">PASS/NG</span>
                                    </span>
                                  );
                                }
                                if (item.type === 'min') {
                                  return (
                                    <span key={item.id} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg border border-emerald-200 font-mono font-bold">
                                      {item.name} ≥ {item.min} {item.unit || 'mm'}
                                    </span>
                                  );
                                }
                                if (item.type === 'max') {
                                  return (
                                    <span key={item.id} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg border border-amber-200 font-mono font-bold">
                                      {item.name} ≤ {item.max} {item.unit || 'mm'}
                                    </span>
                                  );
                                }
                                return (
                                  <span key={item.id} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] rounded-lg border border-indigo-200 font-mono font-bold">
                                    {item.name}: {item.min} - {item.max} {item.unit || 'mm'}
                                  </span>
                                );
                              })}
                              {normalized.length === 0 && <span className="text-slate-300 text-[10px] italic">ยังไม่ได้ตั้งค่าจุดวัด</span>}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm font-black text-slate-700 font-mono">{(profile.toolLifeKg || 10000).toLocaleString()}</td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => openSecurityPrompt({
                                  title: `ตั้งค่า Die Spec: ${profile.dieCode}`,
                                  subtitle: `กรุณากรอกรหัสความปลอดภัยเพื่อเข้าสู่การตั้งค่าจุดวัดและเกณฑ์ขนาด (Die Spec Setting)`,
                                  actionTag: 'Die Spec Setting',
                                  targetName: profile.dieCode,
                                  onSuccess: () => openSpecModal(profile)
                                })} 
                                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                              >
                                <Lock size={12} className="text-amber-400" />
                                ตั้งค่า Spec
                              </button>
                              <button 
                                onClick={() => {
                                  setShowDeleteConfirm({ id: profile.dieCode, type: 'profile', title: `Profile ${profile.dieCode}` });
                                  setDeletePasscode('');
                                  setDeletePasscodeError(false);
                                  setShowDeletePasscode(false);
                                }} 
                                className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer" 
                                title="ลบ Profile (ต้องระบุรหัสความปลอดภัย)"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'history' && (() => {
            // Filter logs by search text and activity type
            const filteredLogs = logs.filter(log => {
              const die = dies.find(d => d.id === log.dieId);
              const dieCode = (log.dieCode || die?.dieCode || '').toLowerCase();
              const dieNo = (log.dieNumber || die?.dieNumber || '').toLowerCase();
              const detail = (log.detail || '').toLowerCase();
              const type = (log.type || '').toLowerCase();
              const query = historySearch.toLowerCase().trim();

              const matchesSearch = !query || 
                dieCode.includes(query) || 
                dieNo.includes(query) || 
                detail.includes(query) || 
                type.includes(query) ||
                (log.timestamp || '').toLowerCase().includes(query);

              const matchesType = historyTypeFilter === 'all' || log.type === historyTypeFilter;

              return matchesSearch && matchesType;
            });

            // Show latest 20 items by default, or all if toggled
            const displayedLogs = showAllHistory ? filteredLogs : filteredLogs.slice(0, 20);
            const isAllDisplayedSelected = displayedLogs.length > 0 && displayedLogs.every(l => selectedLogIds.includes(l.id));

            const toggleSelectAllDisplayed = () => {
              if (isAllDisplayedSelected) {
                const displayedSet = new Set(displayedLogs.map(l => l.id));
                setSelectedLogIds(prev => prev.filter(id => !displayedSet.has(id)));
              } else {
                const newSelected = new Set([...selectedLogIds, ...displayedLogs.map(l => l.id)]);
                setSelectedLogIds(Array.from(newSelected));
              }
            };

            const toggleSelectLog = (id: string) => {
              setSelectedLogIds(prev =>
                prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
              );
            };

            return (
              <div className="space-y-4 text-left">
                {/* Top Control Toolbar */}
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <History size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 tracking-tight font-display">
                          ประวัติกิจกรรมแม่พิมพ์ (Activity History)
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {showAllHistory ? `ทั้งหมด ${filteredLogs.length} รายการ` : `แสดง 20 รายการล่าสุด`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        {filteredLogs.length > 20 && !showAllHistory 
                          ? `แสดงเฉพาะ 20 รายการล่าสุดเพื่อลดความหนาแน่น (ทั้งหมดในระบบ ${logs.length} รายการ)` 
                          : `บันทึกกิจกรรมและการใช้งานทั้งหมด ${logs.length} รายการ`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Toggle show 20 vs show all */}
                    {filteredLogs.length > 20 && (
                      <button
                        type="button"
                        onClick={() => setShowAllHistory(!showAllHistory)}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                          showAllHistory
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Sliders size={13} />
                        {showAllHistory ? 'แสดงเฉพาะ 20 ล่าสุด' : `ดูทั้งหมด (${filteredLogs.length})`}
                      </button>
                    )}

                    {/* Export Excel (CSV) */}
                    <button
                      type="button"
                      onClick={exportHistoryLogs}
                      className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black uppercase hover:bg-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <FileSpreadsheet size={14} />
                      <span>Export Excel</span>
                    </button>

                    {/* Delete All Logs (Admin only) */}
                    {role === 'admin' && logs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm({
                            id: 'all',
                            type: 'logs_all',
                            title: `ประวัติกิจกรรมทั้งหมด (${logs.length} รายการ)`
                          });
                          setDeletePasscode('');
                          setDeletePasscodeError(false);
                          setShowDeletePasscode(false);
                        }}
                        className="px-3.5 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="ลบประวัติทั้งหมดในระบบ (ต้องใช้รหัสความปลอดภัย)"
                      >
                        <Trash2 size={14} />
                        <span>ลบประวัติทั้งหมด</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter and Selection Bar */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="text"
                        placeholder="ค้นหา Die Code, Die No., รายละเอียด..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs outline-none transition-all font-bold"
                      />
                      {historySearch && (
                        <button
                          onClick={() => setHistorySearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <select
                      value={historyTypeFilter}
                      onChange={(e) => setHistoryTypeFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="all">กิจกรรมทั้งหมด</option>
                      <option value="Inspection">Inspection (ตรวจรับ)</option>
                      <option value="Production">Production (การผลิต)</option>
                      <option value="Status Change">Status Change (เปลี่ยนสถานะ)</option>
                      <option value="Die Master">Die Master (จัดการแม่พิมพ์)</option>
                      <option value="Delete Data">Delete Data (ลบข้อมูล)</option>
                    </select>
                  </div>

                  {/* Bulk Selection Actions */}
                  {selectedLogIds.length > 0 && (
                    <div className="flex items-center gap-2 bg-rose-50/80 border border-rose-200 px-3.5 py-1.5 rounded-xl animate-in fade-in duration-150">
                      <span className="text-xs font-black text-rose-800">
                        เลือก {selectedLogIds.length} รายการ
                      </span>
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteConfirm({
                              id: 'selected',
                              type: 'logs_selected',
                              title: `ประวัติกิจกรรมที่เลือก (${selectedLogIds.length} รายการ)`,
                              targetIds: [...selectedLogIds]
                            });
                            setDeletePasscode('');
                            setDeletePasscodeError(false);
                            setShowDeletePasscode(false);
                          }}
                          className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-black hover:bg-rose-700 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Trash2 size={12} />
                          <span>ลบที่เลือก</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedLogIds([])}
                        className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                          {role === 'admin' && (
                            <th className="px-4 py-4 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={isAllDisplayedSelected}
                                onChange={toggleSelectAllDisplayed}
                                disabled={displayedLogs.length === 0}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                title={isAllDisplayedSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมดที่แสดง"}
                              />
                            </th>
                          )}
                          <th className="px-5 py-4">Timestamp</th>
                          <th className="px-5 py-4">Die ID</th>
                          <th className="px-5 py-4">Activity</th>
                          <th className="px-5 py-4">Detail</th>
                          <th className="px-5 py-4 text-right">Weight / Action</th>
                          {role === 'admin' && (
                            <th className="px-4 py-4 w-16 text-center">Manage</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedLogs.map(log => {
                          const die = dies.find(d => d.id === log.dieId);
                          const isSelected = selectedLogIds.includes(log.id);
                          return (
                            <tr 
                              key={log.id} 
                              className={`text-xs transition-colors ${
                                isSelected ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {role === 'admin' && (
                                <td className="px-4 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectLog(log.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                  />
                                </td>
                              )}
                              <td className="px-5 py-4 text-slate-500 font-medium font-mono whitespace-nowrap">
                                {log.timestamp}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                 <span className="font-black text-slate-900 font-display">{log.dieCode || die?.dieCode || 'N/A'}</span> 
                                 <span className="text-slate-400 font-bold ml-1 uppercase font-mono">({log.dieNumber || die?.dieNumber || 'N/A'})</span>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                {(() => {
                                  const isInspectionNg = log.type === 'Inspection' && (log.inspectionData?._judgment === 'NG' || log.detail.includes('NG'));
                                  const isInspectionPass = log.type === 'Inspection' && (log.inspectionData?._judgment === 'PASS' || log.detail.includes('PASS'));
                                  
                                  return (
                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                      isInspectionNg
                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                        : isInspectionPass || log.type === 'Inspection'
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                        : log.type === 'Production' 
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                        : log.type === 'Delete Data'
                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}>
                                      {isInspectionNg ? 'Inspection (NG)' : isInspectionPass ? 'Inspection (PASS)' : log.type}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-5 py-4 text-slate-600 font-medium">
                                <div className="max-w-md break-words">{log.detail}</div>
                                {log.performedBy && (
                                  <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                                    โดย: {log.performedBy === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่ (User)'}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right whitespace-nowrap">
                                {log.type === 'Inspection' && log.inspectionData ? (
                                  <button 
                                    onClick={() => setShowLogDetailModal(log)} 
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 ml-auto text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-100"
                                  >
                                    <Eye size={12} /> ผลตรวจ
                                  </button>
                                ) : (
                                   <span className="font-black text-sm text-slate-700 font-mono">{log.weight > 0 ? `+${log.weight.toLocaleString()} kg` : '-'}</span>
                                )}
                              </td>
                              {role === 'admin' && (
                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowDeleteConfirm({
                                        id: log.id,
                                        type: 'log',
                                        title: `ประวัติกิจกรรม: ${log.dieCode || 'N/A'} (${log.type}) วันที่ ${log.timestamp}`
                                      });
                                      setDeletePasscode('');
                                      setDeletePasscodeError(false);
                                      setShowDeletePasscode(false);
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="ลบรายการประวัตินี้ (ต้องระบุรหัสความปลอดภัย)"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {displayedLogs.length === 0 && (
                    <div className="p-16 text-center text-slate-400 text-xs font-bold">
                      <History className="w-10 h-10 mx-auto text-slate-300 mb-2.5" />
                      {historySearch || historyTypeFilter !== 'all' 
                        ? 'ไม่พบประวัติกิจกรรมที่ตรงกับเงื่อนไขการค้นหา' 
                        : 'ยังไม่มีประวัติกิจกรรมในระบบ'}
                    </div>
                  )}

                  {/* Table Footer Notice */}
                  {filteredLogs.length > 20 && !showAllHistory && (
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold text-slate-500">
                      <span>กำลังแสดง 20 รายการล่าสุด เพื่อความรวดเร็วและไม่แสดงข้อมูลที่เยอะเกินไป (ทั้งหมด {filteredLogs.length} รายการ)</span>
                      <button
                        type="button"
                        onClick={() => setShowAllHistory(true)}
                        className="text-indigo-600 hover:text-indigo-800 font-black cursor-pointer underline underline-offset-2"
                      >
                        แสดงประวัติทั้งหมด ({filteredLogs.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'dashboard' && role === 'admin' && (
            <div className="space-y-8 text-left">
              {/* Dashboard Sub-Tabs Navigation */}
              <div className="bg-white p-2.5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDashboardSubTab('overview')}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                      dashboardSubTab === 'overview'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <BarChart3 size={16} />
                    <span>ภาพรวมสถิติ & กราฟ (Overview & Analytics)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardSubTab('procurement')}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer relative ${
                      dashboardSubTab === 'procurement'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <ShoppingCart size={16} />
                    <span>บันทึกยอดขาย & วางแผนสั่งซื้อ Die (Sales & Procurement)</span>
                    {procurementSummary.urgentCount > 0 && (
                      <span className="ml-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white flex items-center gap-1 shadow-sm animate-pulse">
                        <AlertTriangle size={10} />
                        {procurementSummary.urgentCount} ต้องสั่งซื้อ
                      </span>
                    )}
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-slate-400 px-3">
                  <Clock size={14} className="text-slate-400" />
                  <span>Sync ข้อมูลล่าสุดจากฐานข้อมูลระบบ</span>
                </div>
              </div>

              {dashboardSubTab === 'overview' && (
                <div className="space-y-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                   <h3 className="text-lg font-black text-slate-900 tracking-tight font-display">Dashboard Filters</h3>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">เจาะจงดูข้อมูลแม่พิมพ์รายตัวในกราฟและตารางสรุป</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="ค้นหา Die Code หรือ Die No. ใน Dashboard..." 
                    className="pl-10 pr-4 py-2.5 bg-slate-100 border-transparent border focus:bg-white focus:border-indigo-500 rounded-xl text-xs w-full md:w-80 outline-none transition-all font-bold"
                    value={dashboardSearch}
                    onChange={(e) => setDashboardSearch(e.target.value)}
                  />
                  {dashboardSearch && (
                    <button 
                      onClick={() => setDashboardSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-5 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"><Activity size={24} /></div>
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Dies</p><p className="text-3xl font-black text-slate-900 tracking-tight font-display font-mono">{dies.length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-5 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"><ClipboardCheck size={24} /></div>
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Ready</p><p className="text-3xl font-black text-slate-900 tracking-tight font-display font-mono">{dies.filter(d => d.status === 'Available').length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-5 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"><AlertTriangle size={24} /></div>
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Critical</p><p className="text-3xl font-black text-slate-900 tracking-tight font-display font-mono">{dies.filter(d => ((d.currentUsageKg || 0) / (d.toolLifeKg || 10000)) > 0.9).length}</p></div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-5 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"><TrendingUp size={24} /></div>
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Prod.</p><p className="text-3xl font-black text-slate-900 tracking-tight font-display font-mono">{dies.reduce((sum, d) => sum + (d.currentUsageKg || 0), 0).toLocaleString()} <span className="text-xs font-bold text-slate-400 uppercase">kg</span></p></div>
                </div>
              </div>

              {/* Tool Life Remain by Profile Name Chart Card */}
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-xs">
                        <BarChart3 size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">
                          Tool Life Remain by Profile Name
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          กราฟแสดงอายุการใช้งานคงเหลือ (Tool Life Remain kg) แยกตามแต่ละ Profile Name
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Metric Controls: Total vs Avg & Sorting */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Metric toggle */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setProfileChartMetric('total')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${profileChartMetric === 'total' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        ผลรวมคงเหลือ (Total)
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileChartMetric('avg')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${profileChartMetric === 'avg' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        เฉลี่ยต่อตัว (Avg / Die)
                      </button>
                    </div>

                    {/* Sort toggle */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setProfileChartSort('remain_desc')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${profileChartSort === 'remain_desc' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                        title="เรียงตามอายุคงเหลือจากมากไปน้อย"
                      >
                        คงเหลือสูงสุด ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileChartSort('name_asc')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${profileChartSort === 'name_asc' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                        title="เรียงตามชื่อ Profile A-Z"
                      >
                        ชื่อ A-Z
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chart Container */}
                <div className="w-full h-80 md:h-96">
                  {profileRemainChartData.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                      <Layers size={36} className="text-slate-200" />
                      <span className="text-xs font-bold">ไม่พบข้อมูล Profile ที่ตรงกับการค้นหา</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={profileRemainChartData}
                        margin={{ top: 20, right: 30, left: 10, bottom: 65 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="profileName"
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                          angle={-28}
                          textAnchor="end"
                          interval={0}
                          height={65}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                          tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`}
                          unit=" kg"
                        />
                        <RechartsTooltip content={<CustomProfileTooltip />} />
                        <Bar
                          dataKey="value"
                          name={profileChartMetric === 'total' ? 'Remain รวม (kg)' : 'Remain เฉลี่ย (kg)'}
                          radius={[8, 8, 0, 0]}
                          maxBarSize={56}
                        >
                          {profileRemainChartData.map((entry, index) => {
                            let barColor = '#4f46e5';
                            if (entry.criticalCount > 0 || entry.value < 1000) {
                              barColor = '#f43f5e';
                            } else if (entry.value < 3000) {
                              barColor = '#f59e0b';
                            } else {
                              barColor = index % 2 === 0 ? '#4f46e5' : '#6366f1';
                            }
                            return <Cell key={`cell-${index}`} fill={barColor} />;
                          })}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Chart Legend & Insights footer */}
                <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-[11px] font-medium text-slate-500">
                  <div className="flex flex-wrap items-center gap-5 font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-indigo-600 inline-block"></span>
                      <span>ปกติ (&gt;3,000 kg)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-amber-500 inline-block"></span>
                      <span>ปานกลาง (1,000 - 3,000 kg)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-rose-500 inline-block"></span>
                      <span>ต่ำ / วิกฤต (&lt;1,000 kg หรือใช้งาน &gt;90%)</span>
                    </span>
                  </div>

                  <div className="text-right text-xs font-mono font-bold text-slate-400">
                    แสดงทั้งหมด <span className="text-indigo-600 font-black">{profileRemainChartData.length}</span> Profile
                  </div>
                </div>
              </div>

              {/* Die Profile Summary Section */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center">
                   <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 font-display"><Layers className="text-indigo-600" /> Die Profile Summary in Stock</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">สรุปจำนวนและอายุการใช้งานคงเหลือแยกตามรายโปรไฟล์</p>
                   </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-10 py-5">Die Code & Profile Name</th>
                                <th className="px-10 py-5 text-center">In Stock (Q'ty)</th>
                                <th className="px-10 py-5 text-right">Summary Tool Life Remain (kg)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {getProfileSummary.map(s => (
                                <tr key={s.profileCode} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-10 py-5">
                                        <span className="font-black text-slate-900 text-sm block font-display">{s.profileCode}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{s.profileName}</span>
                                    </td>
                                    <td className="px-10 py-5 text-center">
                                        <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs border border-indigo-100 font-mono">
                                            {s.qty} ตัว
                                        </span>
                                    </td>
                                    <td className="px-10 py-5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-slate-900 text-lg tracking-tight font-mono">
                                                {s.totalRemainKg.toLocaleString()}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">kg available</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {getProfileSummary.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-10 py-20 text-center text-slate-300 text-xs italic">ไม่พบข้อมูลสรุปรายโปรไฟล์</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col min-h-[500px]">
                  <div className="flex justify-between items-center mb-12">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Die Usage Comparison (kg)</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">ปริมาณการผลิตสะสมของแม่พิมพ์แต่ละตัว</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl text-indigo-600 shadow-inner"><BarChart size={24} /></div>
                  </div>
                  <div className="flex-1 flex items-center">
                    <UsageChart 
                      data={dashboardFilteredDies.slice(0, 10).map(d => ({ 
                        label: `${d.dieCode}-${d.dieNumber}`, 
                        value: d.currentUsageKg || 0, 
                        color: ((d.currentUsageKg || 0) / (d.toolLifeKg || 10000)) > 0.9 ? 'bg-gradient-to-t from-rose-600 to-rose-400' : 'bg-gradient-to-t from-indigo-600 to-indigo-400' 
                      }))} 
                    />
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col min-h-[500px]">
                  <div className="flex justify-between items-center mb-12">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Tool Life Remaining (kg)</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">อายุการใช้งานที่เหลืออยู่ของแม่พิมพ์แต่ละตัว</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl text-emerald-500 shadow-inner"><Target size={24} /></div>
                  </div>
                  <div className="flex-1 flex items-center">
                    <UsageChart 
                      data={dashboardFilteredDies.slice(0, 10).map(d => ({ 
                        label: `${d.dieCode}-${d.dieNumber}`, 
                        value: Math.max(0, (d.toolLifeKg || 10000) - (d.currentUsageKg || 0)), 
                        color: 'bg-gradient-to-t from-emerald-600 to-emerald-400' 
                      }))} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {dashboardSubTab === 'procurement' && (
            <div className="space-y-8 text-left">
              {/* Concept Banner & Formula Explanation */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 md:p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-500/30">
                      <Calculator size={12} />
                      ระบบประเมินความต้องการแม่พิมพ์ล่วงหน้า 3 เดือน
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black tracking-tight font-display text-white">
                      บันทึกยอดขาย/ผลิต & วางแผนสั่งซื้อ Die
                    </h3>
                    <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
                      บันทึกเป้าหมายยอดขายหรือกำลังการผลิตในแต่ละเดือนของแต่ละ Profile Name ระบบจะนำยอดขายรวม 3 เดือน (เดือนปัจจุบัน + 2 เดือนหน้า) มาหักลบกับ Tool Life Remain หากผลลัพธ์ติดลบ จะแจ้งเตือน "ต้องสั่งซื้อแล้ว!" ทันที
                    </p>
                  </div>

                  {/* Formula Box */}
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/15 min-w-[300px] space-y-3 font-mono text-xs">
                    <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={14} />
                      สูตรคำนวณสั่งซื้อ Die:
                    </div>
                    <div className="p-3 bg-black/40 rounded-xl space-y-1 text-[11px] text-slate-200">
                      <p className="text-indigo-300 font-bold">1. ยอดขายรวม = M + (M+1) + (M+2)</p>
                      <p className="text-emerald-300 font-bold">2. ยอดที่ต้องสั่งซื้อ die = Tool Life Remain - ยอดขายรวม</p>
                      <p className="text-rose-400 font-bold">3. ถ้าผลลัพธ์ &lt; 0 ➜ 🚨 แจ้งเตือนต้องสั่งซื้อแล้ว</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Procurement KPI Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className={`p-6 rounded-3xl border shadow-sm relative overflow-hidden transition-all ${
                  procurementSummary.urgentCount > 0
                    ? 'bg-rose-50/70 border-rose-200 ring-2 ring-rose-500/20'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className={`absolute top-0 left-0 w-1 h-full ${procurementSummary.urgentCount > 0 ? 'bg-rose-600' : 'bg-emerald-500'}`}></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">ต้องสั่งซื้อแม่พิมพ์ (Order Needed)</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className={`text-3xl font-black font-display font-mono ${procurementSummary.urgentCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {procurementSummary.urgentCount}
                        </p>
                        <span className="text-xs text-slate-400 font-bold">/ {procurementSummary.totalProfiles} Profile</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        {procurementSummary.urgentCount > 0 ? 'Tool Life ไม่พอต่อยอดขาย 3 เดือน' : 'กำลังการผลิตทุก Profile เพียงพอ'}
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      procurementSummary.urgentCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {procurementSummary.urgentCount > 0 ? <AlertTriangle size={24} className="animate-pulse" /> : <CheckCircle2 size={24} />}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ยอดขายรวม 3 เดือน (3M Demand)</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tight font-display font-mono mt-1">
                        {procurementSummary.total3MonthsDemand.toLocaleString()} <span className="text-xs font-bold text-slate-400 uppercase">kg</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        {procurement3Months[0].shortLabel} - {procurement3Months[2].shortLabel}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                      <TrendingUp size={24} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tool Life Remain รวมทั้งหมด</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tight font-display font-mono mt-1">
                        {procurementSummary.totalRemain.toLocaleString()} <span className="text-xs font-bold text-slate-400 uppercase">kg</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        อายุการใช้งานคงเหลือของแม่พิมพ์ในคลัง
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Target size={24} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${procurementSummary.overallBalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ยอดดุลสุทธิรวม (Overall Balance)</p>
                      <p className={`text-3xl font-black tracking-tight font-display font-mono mt-1 ${
                        procurementSummary.overallBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {procurementSummary.overallBalance >= 0 ? '+' : ''}{procurementSummary.overallBalance.toLocaleString()} <span className="text-xs font-bold text-slate-400 uppercase">kg</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        Remain รวม - ยอดขาย 3 เดือน
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      procurementSummary.overallBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      <Layers size={24} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Urgent Warning Banner */}
              {procurementSummary.urgentCount > 0 && (
                <div className="bg-rose-50 border-2 border-rose-300 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-600/30">
                      <AlertTriangle size={24} className="animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-rose-950 font-display">
                        🚨 แจ้งเตือนเร่งด่วน: ตรวจพบ {procurementSummary.urgentCount} Profile ที่ต้องสั่งซื้อแม่พิมพ์ใหม่!
                      </h4>
                      <p className="text-xs text-rose-800 font-medium">
                        Tool Life คงเหลือไม่เพียงพอต่อยอดขายรวม 3 เดือนข้างหน้า กรุณาเตรียมเปิดใบสั่งซื้อ (PO) แม่พิมพ์ใหม่เพื่อป้องกันสายการผลิตสะดุด
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProcurementFilter('needs_order')}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm whitespace-nowrap ${
                        procurementFilter === 'needs_order'
                          ? 'bg-rose-700 text-white'
                          : 'bg-white text-rose-700 hover:bg-rose-100 border border-rose-300'
                      }`}
                    >
                      ดูเฉพาะรายการที่ต้องสั่งซื้อ ({procurementSummary.urgentCount})
                    </button>
                    {procurementFilter === 'needs_order' && (
                      <button
                        type="button"
                        onClick={() => setProcurementFilter('all')}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        ดูทั้งหมด
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Comparison Recharts Chart */}
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight font-display flex items-center gap-2.5">
                      <TrendingDown className="text-indigo-600" size={24} />
                      เปรียบเทียบ Tool Life Remain vs ยอดขายรวม 3 เดือน (ราย Profile)
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      แท่งสีครามแสดง Tool Life คงเหลือ (kg) และแท่งสีส้มแสดงยอดขายรวม 3 เดือน หากยอดขายสูงกว่า Remain (ติดลบ) จะต้องสั่งซื้อแม่พิมพ์ใหม่
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                      <Calendar size={14} className="text-slate-500" />
                      ช่วงเวลา: {procurement3Months[0].shortLabel} - {procurement3Months[2].shortLabel}
                    </span>
                  </div>
                </div>

                <div className="w-full h-80 md:h-96">
                  {filteredProcurementData.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                      <Package size={32} className="text-slate-200" />
                      <span className="text-xs font-bold">ไม่พบข้อมูล Profile ที่ตรงกับเงื่อนไข</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={filteredProcurementData}
                        margin={{ top: 20, right: 30, left: 15, bottom: 65 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="profileName"
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                          angle={-25}
                          textAnchor="end"
                          interval={0}
                          height={65}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                          tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`}
                          unit=" kg"
                        />
                        <RechartsTooltip content={<ProcurementChartTooltip />} />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          wrapperStyle={{ paddingBottom: '16px', fontSize: '12px', fontWeight: 700 }}
                        />
                        <Bar
                          dataKey="toolLifeRemain"
                          name="Tool Life Remain (kg)"
                          fill="#4f46e5"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="total3MonthsSales"
                          name="ยอดขายรวม 3 เดือน (kg)"
                          fill="#f59e0b"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Toolbar & Filters for Table */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Month Picker */}
                  <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-bold">
                    <Calendar size={16} className="text-indigo-600" />
                    <span className="text-slate-600 whitespace-nowrap">เดือนปัจจุบัน (M):</span>
                    <input
                      type="month"
                      value={procurementBaseMonth}
                      onChange={(e) => setProcurementBaseMonth(e.target.value)}
                      className="bg-white px-2.5 py-1 rounded-xl text-xs font-black text-slate-900 border border-slate-200 outline-none focus:border-indigo-500 cursor-pointer font-mono"
                    />
                  </div>

                  {/* Quick Filter buttons */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setProcurementFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        procurementFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      ทั้งหมด ({procurementSummary.totalProfiles})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProcurementFilter('needs_order')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        procurementFilter === 'needs_order'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {procurementSummary.urgentCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>}
                      ต้องสั่งซื้อ ({procurementSummary.urgentCount})
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="ค้นหา Profile / Die Code..."
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      className="pl-9 pr-3 py-2 bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 rounded-xl text-xs w-full font-bold outline-none transition-all"
                    />
                    {dashboardSearch && (
                      <button onClick={() => setDashboardSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveMonthlySales}
                    disabled={salesSaveStatus === 'saving'}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer ${
                      salesSaveStatus === 'saved'
                        ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                    }`}
                  >
                    {salesSaveStatus === 'saving' ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : salesSaveStatus === 'saved' ? (
                      <>
                        <Check size={16} />
                        <span>บันทึกสำเร็จ!</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>บันทึกยอดขาย (Save)</span>
                      </>
                    )}
                  </button>

                  {/* Export CSV Button */}
                  <button
                    type="button"
                    onClick={exportProcurementCSV}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer border border-slate-200"
                    title="ส่งออกรายงานแผนสั่งซื้อ CSV"
                  >
                    <Download size={15} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Detailed Procurement Table */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 min-w-[200px]">Profile Name & Die Code</th>
                        <th className="px-4 py-4 text-center">ในคลัง</th>
                        <th className="px-5 py-4 text-right bg-indigo-50/50 text-indigo-900 border-x border-indigo-100">
                          Tool Life Remain (kg)
                        </th>
                        <th className="px-4 py-4 text-center min-w-[130px] bg-amber-50/30">
                          <span className="block text-slate-700 font-bold">{procurement3Months[0].shortLabel}</span>
                          <span className="text-[9px] text-amber-700 font-normal">เดือนปัจจุบัน (M)</span>
                        </th>
                        <th className="px-4 py-4 text-center min-w-[130px] bg-amber-50/30">
                          <span className="block text-slate-700 font-bold">{procurement3Months[1].shortLabel}</span>
                          <span className="text-[9px] text-amber-700 font-normal">+1 เดือนหน้า</span>
                        </th>
                        <th className="px-4 py-4 text-center min-w-[130px] bg-amber-50/30">
                          <span className="block text-slate-700 font-bold">{procurement3Months[2].shortLabel}</span>
                          <span className="text-[9px] text-amber-700 font-normal">+2 เดือนหน้า</span>
                        </th>
                        <th className="px-5 py-4 text-right bg-amber-100/40 text-amber-950 border-x border-amber-200 font-black">
                          ยอดขายรวม 3 เดือน
                        </th>
                        <th className="px-5 py-4 text-right min-w-[140px] font-black">
                          ดุลสุทธิ (Balance)
                        </th>
                        <th className="px-6 py-4 text-center min-w-[200px]">
                          สถานะการสั่งซื้อ Die
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredProcurementData.map(item => {
                        return (
                          <tr
                            key={item.profileName}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              item.needsOrder ? 'bg-rose-50/30' : ''
                            }`}
                          >
                            {/* Profile Name & Code */}
                            <td className="px-6 py-4">
                              <span className="font-black text-slate-900 text-sm block font-display">
                                {item.profileName}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                  Die: {item.dieCodesList}
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  • สเปก {item.toolLifeTarget.toLocaleString()} kg/ตัว
                                </span>
                              </div>
                            </td>

                            {/* Dies in stock */}
                            <td className="px-4 py-4 text-center">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-mono font-bold">
                                {item.diesCount} ตัว
                              </span>
                            </td>

                            {/* Tool Life Remain */}
                            <td className="px-5 py-4 text-right bg-indigo-50/30 border-x border-indigo-100 font-mono">
                              <span className="font-black text-indigo-700 text-sm block">
                                {item.toolLifeRemain.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-indigo-500 font-semibold uppercase">kg remain</span>
                            </td>

                            {/* Month 0 Input */}
                            <td className="px-4 py-3 text-center bg-amber-50/10">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={item.m0Sales}
                                  onChange={(e) => handleSaleInputChange(item.profileName, procurement3Months[0].key, e.target.value)}
                                  className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs font-mono font-bold text-right outline-none transition-all shadow-xs"
                                />
                                <span className="text-[9px] text-slate-400 ml-1">kg</span>
                              </div>
                            </td>

                            {/* Month 1 Input */}
                            <td className="px-4 py-3 text-center bg-amber-50/10">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={item.m1Sales}
                                  onChange={(e) => handleSaleInputChange(item.profileName, procurement3Months[1].key, e.target.value)}
                                  className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs font-mono font-bold text-right outline-none transition-all shadow-xs"
                                />
                                <span className="text-[9px] text-slate-400 ml-1">kg</span>
                              </div>
                            </td>

                            {/* Month 2 Input */}
                            <td className="px-4 py-3 text-center bg-amber-50/10">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={item.m2Sales}
                                  onChange={(e) => handleSaleInputChange(item.profileName, procurement3Months[2].key, e.target.value)}
                                  className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs font-mono font-bold text-right outline-none transition-all shadow-xs"
                                />
                                <span className="text-[9px] text-slate-400 ml-1">kg</span>
                              </div>
                            </td>

                            {/* Total 3-Month Sales */}
                            <td className="px-5 py-4 text-right bg-amber-100/30 border-x border-amber-200 font-mono">
                              <span className="font-black text-amber-900 text-sm block">
                                {item.total3MonthsSales.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-amber-700 font-semibold uppercase">kg (3 months)</span>
                            </td>

                            {/* Balance (Remain - Sales) */}
                            <td className="px-5 py-4 text-right font-mono">
                              <span className={`font-black text-sm block ${
                                item.needsOrder ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {item.balanceKg >= 0 ? `+${item.balanceKg.toLocaleString()}` : item.balanceKg.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold uppercase">
                                {item.needsOrder ? 'kg ขาด (Deficit)' : 'kg เหลือ (Surplus)'}
                              </span>
                            </td>

                            {/* Status & Order Alert */}
                            <td className="px-6 py-4 text-center">
                              {item.needsOrder ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 text-white rounded-full text-[11px] font-black shadow-sm animate-pulse">
                                    <AlertTriangle size={12} />
                                    ต้องสั่งซื้อแล้ว!
                                  </span>
                                  <div className="text-[10px] text-rose-700 font-bold">
                                    <span>ขาดอีก {item.deficitKg.toLocaleString()} kg</span>
                                    <span className="block text-[9px] text-rose-600 font-medium">
                                      (แนะนำสั่งซื้อ +{item.recommendedDiesOrder} ตัว)
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-black border border-emerald-200">
                                    <CheckCircle2 size={12} />
                                    กำลังผลิตเพียงพอ
                                  </span>
                                  <span className="text-[10px] text-emerald-600 font-medium font-mono">
                                    รองรับได้อีก +{item.balanceKg.toLocaleString()} kg
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredProcurementData.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-20 text-center text-slate-400">
                            <Package className="mx-auto text-slate-300 mb-2" size={32} />
                            <p className="text-xs font-bold text-slate-500">ไม่พบข้อมูล Profile ที่ตรงกับเงื่อนไขการค้นหา</p>
                            {procurementFilter === 'needs_order' && (
                              <button
                                type="button"
                                onClick={() => setProcurementFilter('all')}
                                className="text-[11px] text-indigo-600 hover:underline font-bold mt-2 cursor-pointer"
                              >
                                แสดงรายการ Profile ทั้งหมด
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer of Table with Quick Save */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500 text-[11px]">
                    แสดง <span className="font-bold text-slate-700">{filteredProcurementData.length}</span> จากทั้งหมด <span className="font-bold text-slate-700">{procurementSummary.totalProfiles}</span> Profile
                    {procurementSummary.urgentCount > 0 && (
                      <span className="text-rose-600 font-bold ml-2">
                        (ต้องสั่งซื้อ {procurementSummary.urgentCount} Profile)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      💡 สามารถพิมพ์ตัวเลขยอดขายลงในช่องได้โดยตรง แล้วกดปุ่มบันทึก
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveMonthlySales}
                      disabled={salesSaveStatus === 'saving'}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      {salesSaveStatus === 'saved' ? '✅ บันทึกแล้ว' : 'บันทึกข้อมูลยอดขาย'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </main>

      {/* Reason Modal for Hold/Scrap */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 text-left">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full overflow-hidden border border-slate-200 shadow-2xl">
            <div className="px-10 py-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-xs uppercase tracking-widest text-amber-400 font-display">ระบุสาเหตุการเปลี่ยนสถานะ</h3>
              <button onClick={() => setShowReasonModal(null)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const reasonElement = (e.currentTarget.elements.namedItem('reason') as HTMLTextAreaElement);
              changeDieStatus(showReasonModal.dieId, showReasonModal.newStatus, reasonElement.value);
              setShowReasonModal(null);
            }} className="p-10 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                  สาเหตุที่ต้องปรับเป็นสถานะ <span className={`font-black text-sm px-2 py-0.5 rounded ml-1 ${showReasonModal.newStatus === 'Scrap' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>{showReasonModal.newStatus}</span>
                </label>
                <textarea
                  name="reason"
                  rows={4}
                  required
                  placeholder="กรุณาระบุรายละเอียด หรือปัญหาที่พบ..."
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-amber-500 rounded-2xl text-sm font-bold text-left outline-none transition-all resize-none"
                ></textarea>
              </div>
              <button type="submit" className="w-full py-5 bg-amber-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-200 hover:bg-amber-600 transition-all hover:-translate-y-1 cursor-pointer">
                ยืนยันและบันทึกข้อมูล
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Security Passcode Verification */}
      {showDeleteConfirm && role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 text-left">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight font-display">ยืนยันการลบข้อมูล?</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 px-2 leading-relaxed">
              คุณกำลังจะลบข้อมูล {showDeleteConfirm.title} ออกจากระบบถาวร
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleDelete(); }} className="space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound size={14} className="text-rose-600" />
                    กรุณากรอกรหัสความปลอดภัยเพื่อลบ (Passcode):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">เฉพาะผู้ดูแลระบบ</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={deletePasscode}
                    onChange={(e) => {
                      setDeletePasscode(e.target.value);
                      if (deletePasscodeError) setDeletePasscodeError(false);
                    }}
                    placeholder="••••••••••••"
                    autoComplete="off"
                    autoFocus
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs font-mono font-bold tracking-widest outline-none transition-all ${
                      deletePasscodeError
                        ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/50'
                        : 'border-slate-200 focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100'
                    }`}
                  />
                </div>
                {deletePasscodeError && (
                  <p className="text-[11px] font-bold text-rose-600 mt-2 flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    รหัสผ่านความปลอดภัยไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(null);
                    setDeletePasscode('');
                    setDeletePasscodeError(false);
                  }}
                  className="py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer text-center"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all hover:-translate-y-0.5 cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  ยืนยันลบข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Security Verification Modal (Spec Setting & Edit Data) */}
      {securityPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 text-left">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-sm">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 font-display">ระบบยืนยันสิทธิ์ความปลอดภัย</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security Authorization Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSecurityPrompt(null);
                  setSecurityCodeInput('');
                  setSecurityCodeError(false);
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-6 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg border border-indigo-200 uppercase tracking-wider">
                <ShieldAlert size={12} />
                {securityPrompt.actionTag}
              </div>
              <h4 className="text-base font-black text-slate-800 tracking-tight font-display">{securityPrompt.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{securityPrompt.subtitle}</p>
            </div>

            <form onSubmit={handleVerifySecurityPrompt} className="space-y-5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound size={14} className="text-indigo-600" />
                    กรุณากรอกรหัสความปลอดภัย (Passcode):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">เฉพาะผู้ดูแลระบบ</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={securityCodeInput}
                    onChange={(e) => {
                      setSecurityCodeInput(e.target.value);
                      if (securityCodeError) setSecurityCodeError(false);
                    }}
                    placeholder="••••••••••••"
                    autoComplete="off"
                    autoFocus
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs font-mono font-bold tracking-widest outline-none transition-all ${
                      securityCodeError
                        ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/50'
                        : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                    }`}
                  />
                </div>
                {securityCodeError && (
                  <p className="text-[11px] font-bold text-rose-600 mt-2 flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    รหัสผ่านความปลอดภัยไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง
                  </p>
                )}
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>การลบข้อมูล แก้ไขข้อมูล หรือ Die Spec Setting จำเป็นต้องได้รับอนุญาต</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSecurityPrompt(null);
                    setSecurityCodeInput('');
                    setSecurityCodeError(false);
                  }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck size={15} />
                  ยืนยันรหัสผ่าน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Die Modal */}
      {showEditDieModal && editingDie && role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 text-left">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                  <Edit3 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black tracking-tight font-display">แก้ไขข้อมูลแม่พิมพ์ (Edit Die Data)</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded-md border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck size={11} /> รหัสถูกต้อง
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono font-bold">{editingDie.dieCode} - หมายเลข {editingDie.dieNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditDieModal(false);
                  setEditingDie(null);
                }}
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditDieSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-800">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Die Code (รหัสแม่พิมพ์)</label>
                  <input
                    name="dieCode"
                    type="text"
                    defaultValue={editingDie.dieCode}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Die Number (หมายเลขพิมพ์)</label>
                  <input
                    name="dieNumber"
                    type="text"
                    defaultValue={editingDie.dieNumber}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Profile Name (ชื่อชิ้นงาน / โปรไฟล์)</label>
                <input
                  name="profileName"
                  type="text"
                  defaultValue={editingDie.profileName}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Invoice No. (เลขที่ใบกำกับ)</label>
                  <input
                    name="invoiceNo"
                    type="text"
                    defaultValue={editingDie.invoiceNo || ''}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Location (ตำแหน่งจัดเก็บ)</label>
                  <input
                    name="location"
                    type="text"
                    defaultValue={editingDie.location}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Machine Model (เครื่องรีด)</label>
                  <input
                    name="model"
                    type="text"
                    defaultValue={editingDie.model}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status (สถานะแม่พิมพ์)</label>
                  <select
                    name="status"
                    defaultValue={editingDie.status}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="Available">Available (พร้อมใช้งาน)</option>
                    <option value="Production">Production (กำลังผลิต)</option>
                    <option value="Maintenance">Maintenance (ซ่อมบำรุง)</option>
                    <option value="Hold">Hold (ระงับชั่วคราว)</option>
                    <option value="Scrap">Scrap (ปลดระวาง/ทิ้ง)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tool Life Target (อายุการใช้งาน kg)</label>
                  <input
                    name="toolLifeKg"
                    type="number"
                    defaultValue={editingDie.toolLifeKg}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                    required
                    min={1}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Current Usage (ผลิตสะสมแล้ว kg)</label>
                  <input
                    name="currentUsageKg"
                    type="number"
                    defaultValue={editingDie.currentUsageKg}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                    required
                    min={0}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">หมายเหตุสถานะ (Status Reason - ไม่บังคับ)</label>
                <input
                  name="statusReason"
                  type="text"
                  defaultValue={editingDie.statusReason || ''}
                  placeholder="เช่น ตรวจพบรอยสึกหรอ, รอช่างตรวจสอบ"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDieModal(false);
                    setEditingDie(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={editDieSaving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {editDieSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>บันทึกการแก้ไข</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile/Spec Modal */}
      {showSpecModal && selectedProfile && role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 text-left">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-xl md:max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                  <Sliders size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-[9px] uppercase tracking-[0.2em] text-indigo-400 font-display">Specification Config</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded-md border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck size={11} /> ยืนยันสิทธิ์ความปลอดภัยแล้ว
                    </span>
                  </div>
                  <p className="text-base font-black tracking-tight font-display">{selectedProfile.dieCode || "New Die Profile"}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSpecModal(false)} 
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body & Form */}
            <form onSubmit={handleSpecSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-0.5">Die Code</label>
                  <input 
                    name="dieCode" 
                    type="text" 
                    defaultValue={selectedProfile.dieCode} 
                    placeholder="เช่น TA0034"
                    readOnly={!!selectedProfile.dieCode} 
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold text-left outline-none transition-all uppercase ${selectedProfile.dieCode ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 focus:border-indigo-500'}`} 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-0.5">Profile Name</label>
                  <input 
                    name="profileName" 
                    type="text" 
                    defaultValue={selectedProfile.profileName} 
                    placeholder="ชื่อ Profile / แบบชิ้นงาน"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 text-xs font-bold text-left outline-none transition-all" 
                  />
                </div>
              </div>

              {/* Tool Life Target */}
              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 flex items-center justify-between gap-3">
                <div>
                  <label className="text-[9px] font-black text-indigo-700 uppercase tracking-wider block">Tool Life Target</label>
                  <span className="text-[10px] text-indigo-500 font-semibold">เป้าหมายน้ำหนักการผลิตสะสม</span>
                </div>
                <div className="relative w-36 sm:w-44">
                  <input 
                    name="toolLifeKg" 
                    type="number" 
                    defaultValue={selectedProfile.toolLifeKg || 10000} 
                    className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-indigo-200 bg-white focus:border-indigo-500 text-right outline-none font-black text-sm text-indigo-700 shadow-sm font-mono" 
                    required 
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400 uppercase pointer-events-none">KG</span>
                </div>
              </div>

              {/* Dynamic Measurement & Inspection Points Section */}
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider font-display">จุดตรวจและเกณฑ์วัด (Measurement Points)</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold font-mono">
                      {specFormItems.length} จุด
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => addSpecPoint('min_max')}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={12} /> เพิ่มจุดวัด (Dimension)
                    </button>
                    <button
                      type="button"
                      onClick={() => addSpecPoint('appearance')}
                      className="px-2.5 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sparkles size={12} /> เพิ่มจุดตรวจ (PASS/NG)
                    </button>
                  </div>
                </div>

                {/* Points List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {specFormItems.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`p-2.5 rounded-xl border transition-all ${item.type === 'appearance' ? 'bg-purple-50/40 border-purple-100 hover:border-purple-200' : 'bg-slate-50 border-slate-200/80 hover:border-indigo-200'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center font-mono shrink-0">
                          {index + 1}
                        </span>
                        
                        {/* Point Name Input */}
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={item.name} 
                            onChange={(e) => updateSpecPoint(item.id, { name: e.target.value })}
                            placeholder={item.type === 'appearance' ? 'เช่น ตรวจสอบผิวงาน / รอยร้าว' : 'เช่น T1A, T2B, ความกว้าง'}
                            className="w-full px-2.5 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500"
                            required
                          />
                        </div>

                        {/* Type Selector */}
                        <div className="w-36 shrink-0">
                          <select
                            value={item.type}
                            onChange={(e) => updateSpecPoint(item.id, { type: e.target.value as SpecType })}
                            className="w-full px-2 py-1 text-[11px] font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="min_max">ช่วงค่า (Min - Max)</option>
                            <option value="min">≥ Min (ค่าต่ำสุด)</option>
                            <option value="max">≤ Max (ค่าสูงสุด)</option>
                            <option value="appearance">PASS / NG (Appearance)</option>
                          </select>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => removeSpecPoint(item.id)}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                          title="ลบจุดนี้"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Criteria inputs row */}
                      {item.type === 'appearance' ? (
                        <div className="px-2 py-1 bg-purple-100/60 rounded-lg flex items-center gap-2 text-[10px] text-purple-700 font-semibold">
                          <Sparkles size={12} className="text-purple-600 shrink-0" />
                          <span>การตรวจสอบลักษณะภายนอก (Appearance) — เจ้าหน้าที่จะประเมินผลเป็น <strong className="font-bold text-emerald-700">PASS</strong> หรือ <strong className="font-bold text-rose-600">NG</strong></span>
                        </div>
                      ) : item.type === 'min_max' ? (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 ml-0.5">Min (ค่าต่ำสุด)</div>
                            <input 
                              type="number" 
                              step="any" 
                              value={item.min ?? ''} 
                              onChange={(e) => updateSpecPoint(item.id, { min: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              placeholder="0.000" 
                              className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-center outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 ml-0.5">Max (ค่าสูงสุด)</div>
                            <input 
                              type="number" 
                              step="any" 
                              value={item.max ?? ''} 
                              onChange={(e) => updateSpecPoint(item.id, { max: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              placeholder="0.000" 
                              className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-center outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 ml-0.5">Unit (หน่วย)</div>
                            <input 
                              type="text" 
                              value={item.unit || 'mm'} 
                              onChange={(e) => updateSpecPoint(item.id, { unit: e.target.value })}
                              placeholder="mm" 
                              className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-center outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      ) : item.type === 'min' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 ml-0.5">เกณฑ์ขั้นต่ำ (≥ Min)</div>
                            <input 
                              type="number" 
                              step="any" 
                              value={item.min ?? ''} 
                              onChange={(e) => updateSpecPoint(item.id, { min: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              placeholder="0.000" 
                              className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-center outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 ml-0.5">Unit (หน่วย)</div>
                            <input 
                              type="text" 
                              value={item.unit || 'mm'} 
                              onChange={(e) => updateSpecPoint(item.id, { unit: e.target.value })}
                              placeholder="mm" 
                              className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-center outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 ml-0.5">เกณฑ์สูงสุด (≤ Max)</div>
                            <input 
                              type="number" 
                              step="any" 
                              value={item.max ?? ''} 
                              onChange={(e) => updateSpecPoint(item.id, { max: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              placeholder="0.000" 
                              className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-center outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 ml-0.5">Unit (หน่วย)</div>
                            <input 
                              type="text" 
                              value={item.unit || 'mm'} 
                              onChange={(e) => updateSpecPoint(item.id, { unit: e.target.value })}
                              placeholder="mm" 
                              className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-center outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {specFormItems.length === 0 && (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-xs font-semibold text-slate-400 mb-2">ยังไม่มีจุดตรวจวัดที่กำหนด</p>
                      <button
                        type="button"
                        onClick={() => setSpecFormItems(defaultSpecTemplate)}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        โหลดค่ามาตรฐานเริ่มต้น (Default Template)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5 shrink-0 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowSpecModal(false)} 
                  disabled={specSaving}
                  className="w-1/3 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[11px] uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={specSaving}
                  className="w-2/3 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-wider shadow-md hover:bg-indigo-600 transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {specSaving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving & Syncing...</span>
                    </>
                  ) : (
                    <span>Save Profile Spec</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Die Modal */}
      {showAddDieModal && role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden border border-slate-200 shadow-2xl">
            <div className="px-10 py-6 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-black text-xs uppercase tracking-widest font-display">Register New Tool</h3><button onClick={() => setShowAddDieModal(false)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={20} /></button></div>
            <form onSubmit={handleAddDie} className="p-10 space-y-6">
              <div className="flex justify-center mb-6">
                 <div className="w-24 h-24 border-4 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center relative overflow-hidden bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageUpload} />
                    {previewImage ? <img src={previewImage} className="w-full h-full object-cover" alt="Preview" /> : <UploadCloud className="text-slate-300 group-hover:text-indigo-500 transition-colors" size={32} />}
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Die Code</label>
                  <input name="dieCode" placeholder="เช่น TA0034" className="w-full px-5 py-3.5 bg-slate-50 border-transparent border focus:bg-white focus:border-indigo-500 rounded-2xl text-sm font-bold text-left outline-none transition-all uppercase" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Die Number</label>
                  <input name="dieNumber" placeholder="เช่น 01" className="w-full px-5 py-3.5 bg-slate-50 border-transparent border focus:bg-white focus:border-indigo-500 rounded-2xl text-sm font-bold text-left outline-none transition-all" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profile Name</label>
                <input name="profileName" placeholder="ชื่อเรียก หรือ รายละเอียดโปรไฟล์" className="w-full px-5 py-3.5 bg-slate-50 border-transparent border focus:bg-white focus:border-indigo-500 rounded-2xl text-sm font-bold text-left outline-none transition-all" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Invoice Number</label>
                <input name="invoiceNo" placeholder="เลขที่ใบส่งของ (ถ้ามี)" className="w-full px-5 py-3.5 bg-slate-50 border-transparent border focus:bg-white focus:border-indigo-500 rounded-2xl text-sm font-bold text-left outline-none transition-all uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Model</label>
                   <input name="model" placeholder="รุ่นเครื่องจักร" className="w-full px-5 py-3.5 bg-slate-50 border-transparent border focus:bg-white focus:border-indigo-500 rounded-2xl text-sm font-bold text-left outline-none transition-all" required />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Storage Location</label>
                   <input name="location" placeholder="ชั้นวาง / ล็อค" className="w-full px-5 py-3.5 bg-slate-50 border-transparent border focus:bg-white focus:border-indigo-500 rounded-2xl text-sm font-bold text-left outline-none transition-all" required />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 mt-4 cursor-pointer">ลงทะเบียนแม่พิมพ์</button>
            </form>
          </div>
        </div>
      )}

      {/* Quality Inspection Modal */}
      {showInspectionModal && selectedDie && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 text-left">
          <div className="bg-white rounded-2xl md:rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
             <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div>
                  <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-display">Quality Inspection Check</h3>
                  <p className="text-base font-black font-display tracking-tight">{selectedDie.dieCode} ({selectedDie.dieNumber}) - {selectedDie.profileName}</p>
               </div>
               <button onClick={() => setShowInspectionModal(false)} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={16} /></button>
             </div>
             <form onSubmit={handleInspectionSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
                {judgmentError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 animate-shake">
                    <div className="flex items-center gap-2 text-rose-700 font-black text-xs uppercase tracking-wider mb-2"><AlertTriangle size={15} /> ตรวจสอบพบค่าไม่ผ่านเกณฑ์ (Spec Out of Range)</div>
                    <ul className="text-xs text-rose-600 font-medium space-y-1">
                       {judgmentError.map((err, i) => <li key={i} className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0"></div> {err}</li>)}
                    </ul>
                  </div>
                )}

                {/* Section 1: Appearance Checks (PASS / NG) */}
                {(() => {
                  const normalized = normalizeSpecs(getActiveDieSpecs(selectedDie));
                  const appItems = normalized.filter(s => s.type === 'appearance');
                  const itemsToRender = appItems.length > 0 ? appItems : [
                    { id: 'visual_surface', name: 'Surface Quality (ผิวงาน)', type: 'appearance' as SpecType },
                    { id: 'visual_crack', name: 'Crack Check (รอยร้าว)', type: 'appearance' as SpecType },
                    { id: 'visual_clean', name: 'Cleanliness (ความสะอาด)', type: 'appearance' as SpecType }
                  ];

                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-wider font-display flex items-center gap-1.5">
                          <Sparkles size={13} /> 1. Visual & Appearance Check (ประเมินลักษณะภายนอก)
                        </h4>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">เกณฑ์: ต้อง PASS ทั้งหมด</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {itemsToRender.map(item => {
                          const currentStatus = inspectionAppearance[item.id] || 'PASS';
                          return (
                            <div key={item.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800">{item.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setInspectionAppearance(prev => ({ ...prev, [item.id]: 'PASS' }))}
                                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${currentStatus === 'PASS' ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-emerald-50'}`}
                                >
                                  <Check size={12} /> PASS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInspectionAppearance(prev => ({ ...prev, [item.id]: 'NG' }))}
                                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${currentStatus === 'NG' ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-rose-50'}`}
                                >
                                  <X size={12} /> NG
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Section 2: Dimension Measurements (Min, Max, Min-Max) */}
                {(() => {
                  const normalized = normalizeSpecs(getActiveDieSpecs(selectedDie));
                  const numericItems = normalized.filter(s => s.type !== 'appearance');
                  const appItems = normalized.filter(s => s.type === 'appearance');
                  const effectiveAppItems = appItems.length > 0 ? appItems : [
                    { id: 'visual_surface', name: 'Surface Quality (ผิวงาน)', type: 'appearance' as SpecType },
                    { id: 'visual_crack', name: 'Crack Check (รอยร้าว)', type: 'appearance' as SpecType },
                    { id: 'visual_clean', name: 'Cleanliness (ความสะอาด)', type: 'appearance' as SpecType }
                  ];

                  // Check appearance NG
                  const appNgItems = effectiveAppItems.filter(item => (inspectionAppearance[item.id] || 'PASS') === 'NG');

                  // Check numeric evaluations
                  const numericEvaluations = numericItems.map(item => {
                    const rawVal = (inspectionNumericValues[item.id] ?? '').toString().trim();
                    const numVal = parseFloat(rawVal);
                    const isFilled = rawVal !== '' && !isNaN(numVal);
                    let isNg = false;
                    let errorMsg = '';
                    let criteriaText = '';

                    if (item.type === 'min_max') criteriaText = `${item.min ?? 0} - ${item.max ?? 0} ${item.unit || 'mm'}`;
                    else if (item.type === 'min') criteriaText = `≥ ${item.min ?? 0} ${item.unit || 'mm'}`;
                    else if (item.type === 'max') criteriaText = `≤ ${item.max ?? 0} ${item.unit || 'mm'}`;

                    if (isFilled) {
                      if (item.type === 'min_max') {
                        const min = item.min ?? 0;
                        const max = item.max ?? 0;
                        if (min > 0 || max > 0) {
                          if (numVal < min || numVal > max) {
                            isNg = true;
                            errorMsg = `วัดได้ ${numVal} (เกณฑ์ ${min} - ${max} ${item.unit || 'mm'})`;
                          }
                        }
                      } else if (item.type === 'min') {
                        const min = item.min ?? 0;
                        if (numVal < min) {
                          isNg = true;
                          errorMsg = `วัดได้ ${numVal} ต่ำกว่าเกณฑ์ (≥ ${min} ${item.unit || 'mm'})`;
                        }
                      } else if (item.type === 'max') {
                        const max = item.max ?? 0;
                        if (numVal > max) {
                          isNg = true;
                          errorMsg = `วัดได้ ${numVal} สูงกว่าเกณฑ์ (≤ ${max} ${item.unit || 'mm'})`;
                        }
                      }
                    }

                    return { item, rawVal, numVal, isFilled, isNg, errorMsg, criteriaText };
                  });

                  const filledNumericCount = numericEvaluations.filter(e => e.isFilled).length;
                  const allNumericFilled = numericItems.length === 0 || filledNumericCount === numericItems.length;
                  const numericNgItems = numericEvaluations.filter(e => e.isNg);
                  const hasAnyNg = appNgItems.length > 0 || numericNgItems.length > 0;
                  const currentDecision: 'PASS' | 'NG' | 'PENDING' = hasAnyNg ? 'NG' : allNumericFilled ? 'PASS' : 'PENDING';

                  return (
                    <div className="space-y-4">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-wider font-display flex items-center gap-1.5">
                            <Sliders size={13} /> 2. Dimension Measurement (วัดขนาดตามจุดกำหนด)
                          </h4>
                          <span className="text-[9px] text-slate-400 font-bold uppercase font-mono">หน่วย: มิลลิเมตร (mm)</span>
                        </div>
                        
                        {numericItems.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {numericEvaluations.map(({ item, rawVal, isFilled, isNg, errorMsg, criteriaText }) => {
                              return (
                                <div 
                                  key={item.id} 
                                  className={`p-3 rounded-2xl border transition-all ${
                                    isNg 
                                      ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200/60' 
                                      : isFilled 
                                      ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-200/50' 
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-center text-[10px] font-bold mb-1.5">
                                    <span className="text-slate-800 font-display truncate pr-1" title={item.name}>{item.name}</span>
                                    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                                      isNg 
                                        ? 'bg-rose-200 text-rose-800 font-black' 
                                        : isFilled 
                                        ? 'bg-emerald-100 text-emerald-800 font-black' 
                                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                    }`}>
                                      {criteriaText}
                                    </span>
                                  </div>

                                  <div className="relative">
                                    <input 
                                      name={`val_${item.id}`} 
                                      type="number" 
                                      step="0.001" 
                                      value={rawVal}
                                      onChange={(e) => setInspectionNumericValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-none transition-all ${
                                        isNg 
                                          ? 'border-rose-400 bg-white text-rose-700 focus:ring-2 focus:ring-rose-300' 
                                          : isFilled 
                                          ? 'border-emerald-400 bg-white text-emerald-800 focus:ring-2 focus:ring-emerald-300' 
                                          : 'border-slate-200 bg-white text-slate-800 focus:border-indigo-500'
                                      }`} 
                                      placeholder="ใส่ค่าที่วัดได้" 
                                      required 
                                    />
                                  </div>

                                  {/* Result Tag per Point */}
                                  <div className="mt-1.5 text-center">
                                    {isNg ? (
                                      <div className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-100/80 px-2 py-0.5 rounded-md">
                                        <X size={10} className="stroke-[3]" /> NG: {errorMsg}
                                      </div>
                                    ) : isFilled ? (
                                      <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                        <Check size={10} className="stroke-[3]" /> PASS (ในเกณฑ์ Spec)
                                      </div>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-medium">รอการระบุค่า</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                            ไม่มีจุดวัดขนาดตัวเลข (มีเฉพาะการตรวจลักษณะภายนอก)
                          </div>
                        )}
                      </div>

                      {/* Section 3: Inspection Remarks / Notes (Optional) */}
                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          หมายเหตุการตรวจสอบ (Inspection Notes / Remarks) - ไม่บังคับ
                        </label>
                        <textarea
                          value={inspectionNotes}
                          onChange={(e) => setInspectionNotes(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 font-medium transition-all"
                          placeholder="ระบุข้อสังเกตเพิ่มเติม เช่น ส่งช่างแก้ไขผิวงาน, พบรอยขูดขีดด้านข้าง, ส่งซ่อมบำรุง..."
                        />
                      </div>

                      {/* Section 4: Live System Judgment Decision Box */}
                      {currentDecision === 'NG' && (
                        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                                NG
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                                  ระบบตัดสินใจ: ไม่ผ่านเกณฑ์มาตรฐาน (NG)
                                </h4>
                                <p className="text-[11px] text-rose-700 font-medium">
                                  พบค่าหลุดเกณฑ์ Spec ({appNgItems.length + numericNgItems.length} รายการ) — ยังคงสามารถกดยืนยันบันทึกผลได้ตามปกติ
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 bg-rose-200 text-rose-900 text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0">
                              Decision: NG
                            </span>
                          </div>

                          <div className="bg-white/80 rounded-xl p-2.5 border border-rose-200 text-xs text-rose-700 space-y-1">
                            <p className="text-[10px] font-black text-rose-800 uppercase tracking-wider">รายการที่หลุดเกณฑ์ Spec:</p>
                            {appNgItems.map(item => (
                              <div key={item.id} className="flex items-center gap-2 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                <span>{item.name}: ลักษณะภายนอกไม่ผ่านเกณฑ์ (NG)</span>
                              </div>
                            ))}
                            {numericNgItems.map(e => (
                              <div key={e.item.id} className="flex items-center gap-2 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                <span>{e.item.name}: {e.errorMsg}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentDecision === 'PASS' && (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                                PASS
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                                  ระบบตัดสินใจ: ผ่านเกณฑ์มาตรฐาน (PASS)
                                </h4>
                                <p className="text-[11px] text-emerald-700 font-medium">
                                  ทุกจุดวัดขนาดและลักษณะภายนอกถูกต้องตามเกณฑ์ Spec ครบถ้วน — แม่พิมพ์พร้อมใช้งานผลิต
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-200 text-emerald-900 text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0">
                              Decision: PASS
                            </span>
                          </div>
                        </div>
                      )}

                      {currentDecision === 'PENDING' && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Sliders size={15} className="text-indigo-600 shrink-0" />
                            <span>กรอกค่าตัวเลขแล้ว {filledNumericCount} / {numericItems.length} จุด — ระบบจะประเมินผลตัดสินใจ PASS / NG อัตโนมัติ</span>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase font-mono">Auto Judge</span>
                        </div>
                      )}

                      {/* Action Submit Button */}
                      <div className="pt-1">
                        {currentDecision === 'NG' ? (
                          <button 
                            type="submit" 
                            className="w-full py-3.5 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <AlertTriangle size={16} /> บันทึกผลการตรวจ (ระบบตัดสินใจ: NG ไม่ผ่านเกณฑ์)
                          </button>
                        ) : currentDecision === 'PASS' ? (
                          <button 
                            type="submit" 
                            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 size={16} /> บันทึกผลการตรวจ (ระบบตัดสินใจ: PASS ผ่านเกณฑ์)
                          </button>
                        ) : (
                          <button 
                            type="submit" 
                            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Check size={16} /> บันทึกผลการตรวจสอบ (Inspection Save)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
             </form>
          </div>
        </div>
      )}

      {/* Production Modal */}
      {showProductionModal && selectedDie && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full overflow-hidden border border-slate-200 shadow-2xl">
            <div className="px-10 py-6 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-black text-xs uppercase tracking-widest font-display">Add Production Log</h3><button onClick={() => setShowProductionModal(false)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={20} /></button></div>
            <form onSubmit={handleProductionSubmit} className="p-10 space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block text-center">น้ำหนักรวม Billet (kg)</label>
                <div className="relative group">
                   <input autoFocus name="weight" type="number" step="0.1" className="w-full px-4 py-8 bg-slate-50 border-transparent border-4 focus:bg-white focus:border-indigo-500 rounded-[2rem] text-6xl font-black text-indigo-600 text-center outline-none transition-all group-hover:bg-slate-100/50 font-mono" required placeholder="0.0" />
                   <div className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-200 uppercase pointer-events-none">KG</div>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-1 cursor-pointer">Record Production</button>
            </form>
          </div>
        </div>
      )}

      {/* Die Inspection History Modal (แสดงการตรวจสอบในแต่ละรอบ และผลรอบล่าสุด/ครั้งที่แล้ว) */}
      {viewHistoryDie && (
        <DieInspectionHistoryModal
          die={viewHistoryDie}
          allLogs={logs}
          profiles={profiles}
          onClose={() => setViewHistoryDie(null)}
          onInspectNow={(d) => openInspectionModal(d)}
        />
      )}

      {/* Log Detail Modal */}
      {showLogDetailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl md:rounded-3xl max-w-md w-full overflow-hidden border border-slate-200 shadow-2xl">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-display">Inspection Record</h3>
                <p className="text-sm font-bold font-display">{showLogDetailModal.dieCode} ({showLogDetailModal.dieNumber})</p>
              </div>
              <button onClick={() => setShowLogDetailModal(null)} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={16} /></button>
            </div>
            {(() => {
              const inspData = showLogDetailModal.inspectionData || {};
              const isNg = inspData._judgment === 'NG' || showLogDetailModal.detail?.includes('NG');
              const ngReasons: string[] = Array.isArray(inspData._ngReasons) ? inspData._ngReasons : [];
              const notes: string = inspData._notes || '';
              const measurementEntries = Object.entries(inspData).filter(([k]) => !k.startsWith('_'));

              return (
                <div className="p-6 space-y-4">
                  {/* Decision Banner */}
                  {isNg ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-800 font-black text-xs">
                          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                          <span>ผลการตรวจ: ไม่ผ่านเกณฑ์ (NG)</span>
                        </div>
                        <span className="px-2 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-black rounded uppercase">NG</span>
                      </div>
                      {ngReasons.length > 0 && (
                        <div className="text-[11px] text-rose-700 bg-white/70 p-2 rounded-lg border border-rose-100 space-y-1">
                          <p className="font-bold text-[10px] text-rose-800 uppercase">สาเหตุที่ไม่ผ่าน Spec:</p>
                          {ngReasons.map((r, i) => (
                            <div key={i} className="flex items-start gap-1.5 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-800 font-black text-xs">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>ผลการตรวจ: ผ่านเกณฑ์มาตรฐาน (PASS)</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-black rounded uppercase">PASS</span>
                    </div>
                  )}

                  {/* Measurements Grid */}
                  <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {measurementEntries.map(([k, v]) => {
                      const isPass = v === 'PASS';
                      const isNgValue = v === 'NG' || ngReasons.some(r => r.startsWith(k + ':') || r.includes(k));
                      
                      return (
                        <div 
                          key={k} 
                          className={`p-3 rounded-xl shadow-xs text-center border relative ${
                            isNgValue 
                              ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200' 
                              : 'bg-slate-50 border-slate-200/80'
                          }`}
                        >
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 truncate font-display" title={k}>{k}</p>
                          {isPass ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-black">
                              <Check size={12} /> PASS
                            </span>
                          ) : isNgValue && typeof v === 'string' && v === 'NG' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-md text-xs font-black">
                              <X size={12} /> NG
                            </span>
                          ) : (
                            <div>
                              <p className={`text-base font-black tracking-tight font-mono ${isNgValue ? 'text-rose-700' : 'text-indigo-600'}`}>
                                {v} <span className="text-[10px] text-slate-400 font-bold uppercase">mm</span>
                              </p>
                              {isNgValue && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-rose-200 text-rose-900 text-[8px] font-black rounded">
                                  หลุด Spec
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes / Remarks */}
                  {notes && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-slate-500 uppercase text-[10px] block">หมายเหตุการตรวจ:</span>
                      <p className="font-medium text-slate-800">{notes}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">บันทึกเมื่อ {showLogDetailModal.timestamp}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
