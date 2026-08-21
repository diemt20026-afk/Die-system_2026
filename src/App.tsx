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
  PlusCircle,
  Trash2,
  Download,
  Lock,
  User as UserIcon,
  LogOut,
  ShieldAlert,
  BarChart,
  TrendingUp,
  FileSpreadsheet,
  Layers
} from 'lucide-react';

interface DieSpec {
  min: number;
  max: number;
}

interface Specs {
  [key: string]: DieSpec;
}

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
  inspectionData?: Record<string, number> | null;
  performedBy?: string | null;
}

const App = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null); 
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [activeTab, setActiveTab] = useState('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDie, setSelectedDie] = useState<Die | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showAddDieModal, setShowAddDieModal] = useState(false);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [showLogDetailModal, setShowLogDetailModal] = useState<Log | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; type: 'die' | 'profile'; title: string } | null>(null); 
  const [showReasonModal, setShowReasonModal] = useState<{ dieId: string; newStatus: string } | null>(null); 
  const [judgmentError, setJudgmentError] = useState<string[] | null>(null);
  
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [dies, setDies] = useState<Die[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [dashboardSearch, setDashboardSearch] = useState('');

  // Fetch all data from full-stack Express server
  const fetchData = async () => {
    try {
      const [diesRes, profilesRes, logsRes] = await Promise.all([
        fetch('/api/dies'),
        fetch('/api/profiles'),
        fetch('/api/logs')
      ]);
      const [diesData, profilesData, logsData] = await Promise.all([
        diesRes.json(),
        profilesRes.json(),
        logsRes.json()
      ]);
      setDies(diesData);
      setProfiles(profilesData);
      setLogs(logsData.sort((a: any, b: any) => new Date(b.timestampRaw).getTime() - new Date(a.timestampRaw).getTime()));
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  // Poll for data updates every 5 seconds to provide "real-time" sync
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLoginError('');
    const { username, password } = loginForm;
    setTimeout(() => {
      if (username === 'admin' && password === 'admin') {
        setRole('admin');
        setActiveTab('inventory');
        setIsAuthenticating(false);
      } else if (username === 'user' && password === '1234') {
        setRole('user');
        setActiveTab('inventory');
        setIsAuthenticating(false);
      } else {
        setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setIsAuthenticating(false);
      }
    }, 500);
  };

  const handleLogout = () => {
    setRole(null);
    setLoginForm({ username: '', password: '' });
  };

  const getCurrentTimestamp = () => {
    const now = new Date();
    return { display: now.toLocaleString('th-TH'), raw: now.toISOString() };
  };

  const addLogCloud = async (dieId: string, type: string, detail: string, weight = 0, inspectionData: Record<string, number> | null = null) => {
    const time = getCurrentTimestamp();
    const die = dies.find(d => d.id === dieId);
    
    const logPayload = {
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

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
      });
      fetchData();
    } catch (err) {
      console.error("Error creating log:", err);
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
    try {
      if (showDeleteConfirm.type === 'die') {
        await fetch(`/api/dies/${showDeleteConfirm.id}`, { method: 'DELETE' });
      } else if (showDeleteConfirm.type === 'profile') {
        await fetch(`/api/profiles/${showDeleteConfirm.id}`, { method: 'DELETE' });
      }
      setShowDeleteConfirm(null);
      fetchData();
    } catch (error) { 
      console.error("Delete Error:", error); 
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

    try {
      await fetch(`/api/dies/${dieId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const logDetail = `เปลี่ยนสถานะเป็น ${newStatus}${reason ? ` (สาเหตุ: ${reason})` : ''}`;
      await addLogCloud(dieId, 'Status Update', logDetail);
      fetchData();
    } catch (err) {
      console.error("Error changing die status:", err);
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
    
    const newDieData = {
      dieCode: dieCode,
      dieNumber: formData.get('dieNumber'),
      profileName: formData.get('profileName'),
      invoiceNo: formData.get('invoiceNo'), 
      location: formData.get('location'),
      model: formData.get('model'),
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

    try {
      await fetch('/api/dies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDieData)
      });
      setShowAddDieModal(false);
      setPreviewImage(null);
      fetchData();
    } catch (err) {
      console.error("Error adding die:", err);
    }
  };

  const handleSpecSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProfile || role !== 'admin') return;
    const formData = new FormData(e.currentTarget);
    const time = getCurrentTimestamp();
    const dieCode = (formData.get('dieCode') as string) || selectedProfile.dieCode;
    if (!dieCode) return;

    const newSpecs: Specs = {};
    ['t1a', 't1b', 't2a', 't2b', 't3', 't4'].forEach(k => {
      newSpecs[k] = { 
        min: parseFloat(formData.get(`spec_${k}_min`) as string) || 0, 
        max: parseFloat(formData.get(`spec_${k}_max`) as string) || 0 
      };
    });
    
    const newToolLife = parseFloat(formData.get('toolLifeKg') as string) || 0;
    const profileName = formData.get('profileName') as string || "";

    const profilePayload = {
      dieCode: dieCode,
      profileName: profileName,
      specs: newSpecs,
      toolLifeKg: newToolLife,
      updatedAt: time.raw
    };

    try {
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload)
      });
      setShowSpecModal(false);
      setSelectedProfile(null);
      fetchData();
    } catch (err) {
      console.error("Error submitting profile spec:", err);
    }
  };

  const handleInspectionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDie) return;
    const formData = new FormData(e.currentTarget);
    const keys = ['t1a', 't1b', 't2a', 't2b', 't3', 't4'];
    let errors: string[] = [];
    let inspectionValues: Record<string, number> = {};
    
    keys.forEach(k => {
      const actual = parseFloat(formData.get(`val_${k}`) as string);
      const spec = selectedDie.specs?.[k];
      inspectionValues[k] = actual;
      if (spec && (spec.min > 0 || spec.max > 0)) {
        if (actual < spec.min || actual > spec.max) {
          errors.push(`${k.toUpperCase()}: ค่า ${actual} ไม่อยู่ในช่วง ${spec.min} - ${spec.max}`);
        }
      }
    });

    if (errors.length > 0) {
      setJudgmentError(errors);
      return;
    }

    const time = getCurrentTimestamp();
    try {
      await fetch(`/api/dies/${selectedDie.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isInspected: true, status: 'Available', lastActionTime: time.display })
      });

      await addLogCloud(selectedDie.id, 'Inspection', 'ตรวจสอบผ่าน (Visual & Dimension OK)', 0, inspectionValues);
      setShowInspectionModal(false);
      setJudgmentError(null);
      fetchData();
    } catch (err) {
      console.error("Error logging inspection:", err);
    }
  };

  const handleProductionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDie) return;
    const formData = new FormData(e.currentTarget);
    const weight = parseFloat(formData.get('weight') as string);
    const time = getCurrentTimestamp();

    try {
      await fetch(`/api/dies/${selectedDie.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentUsageKg: (selectedDie.currentUsageKg || 0) + weight, 
          status: 'Production', 
          isInspected: false, 
          lastActionTime: time.display 
        })
      });

      await addLogCloud(selectedDie.id, 'Production', `ผลิต ${weight} kg`, weight);
      setShowProductionModal(false);
      fetchData();
    } catch (err) {
      console.error("Error logging production:", err);
    }
  };

  const filteredDies = dies.filter(d => 
    d.dieCode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.profileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.dieNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-left relative overflow-hidden border border-slate-100">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-700"></div>
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Package size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-black font-display text-slate-900 text-center mb-2 tracking-tight">Die <span className="underline underline-offset-4 decoration-indigo-600 decoration-3">Manager</span></h1>
          <p className="text-slate-400 text-center text-xs font-bold uppercase tracking-widest mb-10">ระบบบริหารจัดการแม่พิมพ์</p>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Username</label>
              <div className="relative group">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-semibold"
                  placeholder="admin หรือ user"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input 
                  type="password" 
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-semibold"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  required
                />
              </div>
            </div>
            {loginError && (
              <div className="flex items-center gap-2 text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100 animate-pulse">
                <ShieldAlert size={16} />
                <span className="text-xs font-bold">{loginError}</span>
              </div>
            )}
            <button 
              type="submit" 
              disabled={isAuthenticating}
              className={`w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${isAuthenticating ? 'opacity-70 cursor-wait' : 'hover:bg-indigo-600 hover:shadow-indigo-100 hover:-translate-y-1 active:translate-y-0'}`}
            >
              {isAuthenticating ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700/50">
            <div className={`w-2 h-2 rounded-full ${role === 'admin' ? 'bg-emerald-400' : 'bg-indigo-400'} animate-pulse`}></div>
            <span className="text-[10px] font-black uppercase text-slate-200 tracking-wider">{role === 'admin' ? 'Administrator' : 'Operator User'}</span>
          </div>
        </div>
        <div className="mt-6 flex-1 text-sm space-y-1 px-2">
          {navItems.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400'}`}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
            <LogOut size={14} /> ออกจากระบบ
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
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="ค้นหารหัส หรือ ชื่อโปรไฟล์..." className="pl-10 pr-4 py-2 bg-slate-100 border-transparent border focus:bg-white focus:border-indigo-500 rounded-xl text-xs w-64 outline-none transition-all" onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {activeTab === 'inventory' && role === 'admin' && <button onClick={() => setShowAddDieModal(true)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5">+ เพิ่มแม่พิมพ์</button>}
            {activeTab === 'spec' && role === 'admin' && <button onClick={() => { setSelectedProfile({ dieCode: '', profileName: '', specs: {}, toolLifeKg: 10000, updatedAt: '' }); setShowSpecModal(true); }} className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5"><PlusCircle size={16} /> เพิ่ม Profile Spec</button>}
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold uppercase tracking-widest">กำลังดาวน์โหลดข้อมูล...</span>
            </div>
          ) : activeTab === 'inventory' && (
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
                               {die.statusReason && (
                                 <span className="block text-[9px] text-amber-600 font-medium mt-1">
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
                            <button onClick={() => { setSelectedDie(die); setShowInspectionModal(true); setJudgmentError(null); }} className="p-2.5 bg-slate-50 text-slate-600 border border-transparent rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all cursor-pointer" title="ตรวจสอบ"><ClipboardCheck size={18} /></button>
                            <button disabled={!die.isInspected} onClick={() => { setSelectedDie(die); setShowProductionModal(true); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${die.isInspected ? 'bg-slate-900 text-white cursor-pointer hover:bg-emerald-600 hover:shadow-emerald-200 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>ผลิต</button>
                            {role === 'admin' && (
                              <button onClick={() => setShowDeleteConfirm({ id: die.id, type: 'die', title: `แม่พิมพ์ ${die.dieCode} (${die.dieNumber})` })} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer" title="ลบแม่พิมพ์"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredDies.length === 0 && <div className="p-20 text-center text-slate-300 text-xs italic">ไม่พบข้อมูลที่ค้นหา</div>}
            </div>
          )}

          {activeTab === 'spec' && role === 'admin' && (
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
               <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="px-6 py-5">Die Profile (Key)</th><th className="px-6 py-5">Min-Max Specs (mm)</th><th className="px-6 py-5">Target (kg)</th><th className="px-6 py-5 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {getMergedProfiles().map(profile => (
                    <tr key={profile.dieCode} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-black text-sm text-slate-900 block font-display">{profile.dieCode}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{profile.profileName}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {['t1a', 't1b', 't2a', 't2b', 't3', 't4'].map(k => {
                            const spec = profile.specs?.[k];
                            return spec && (spec.min > 0 || spec.max > 0) ? (
                              <span key={k} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[9px] rounded-lg border border-indigo-100 uppercase font-black font-mono">
                                {k}: {spec.min}-{spec.max}
                              </span>
                            ) : null;
                          })}
                          {(!profile.specs || Object.keys(profile.specs).length === 0) && <span className="text-slate-300 text-[10px] italic">ยังไม่ได้ตั้งค่า</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-slate-700 font-mono">{(profile.toolLifeKg || 10000).toLocaleString()}</td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setSelectedProfile(profile); setShowSpecModal(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all cursor-pointer">ตั้งค่า Spec</button>
                          <button onClick={() => setShowDeleteConfirm({ id: profile.dieCode, type: 'profile', title: `Profile ${profile.dieCode}` })} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer" title="ลบ Profile"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="px-6 py-5">Timestamp</th><th className="px-6 py-5">Die ID</th><th className="px-6 py-5">Activity</th><th className="px-6 py-5">Detail</th><th className="px-6 py-5 text-right">Weight/Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => {
                    const die = dies.find(d => d.id === log.dieId);
                    return (
                      <tr key={log.id} className="text-xs hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-5 text-slate-500 font-medium font-mono">{log.timestamp}</td>
                        <td className="px-6 py-5">
                           <span className="font-black text-slate-900 font-display">{log.dieCode || die?.dieCode || 'N/A'}</span> 
                           <span className="text-slate-400 font-bold ml-1 uppercase font-mono">({log.dieNumber || die?.dieNumber || 'N/A'})</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${log.type === 'Inspection' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : log.type === 'Production' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-slate-600 font-medium">{log.detail}</td>
                        <td className="px-6 py-5 text-right">
                          {log.type === 'Inspection' && log.inspectionData ? (
                            <button onClick={() => setShowLogDetailModal(log)} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 ml-auto text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"><Eye size={12} /> ผลตรวจ</button>
                          ) : (
                             <span className="font-black text-sm text-slate-700 font-mono">{log.weight > 0 ? `+${log.weight.toLocaleString()} kg` : '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {logs.length === 0 && <div className="p-20 text-center text-slate-300 text-xs italic">ยังไม่มีประวัติกิจกรรม</div>}
            </div>
          )}

          {activeTab === 'dashboard' && role === 'admin' && (
            <div className="space-y-8 text-left">
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 text-left">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"><Trash2 size={40} /></div>
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight font-display">ยืนยันการลบข้อมูล?</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8 px-4 leading-relaxed">คุณกำลังจะลบข้อมูล {showDeleteConfirm.title} ออกจากระบบถาวร</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowDeleteConfirm(null)} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer">ยกเลิก</button>
              <button onClick={handleDelete} className="py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all hover:-translate-y-1 cursor-pointer">ยืนยันลบข้อมูล</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile/Spec Modal */}
      {showSpecModal && selectedProfile && role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-10 py-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-400 mb-1 font-display">Specification Config</h3>
                <p className="text-xl font-black tracking-tight font-display">{selectedProfile.dieCode || "New Die Profile"}</p>
              </div>
              <button onClick={() => setShowSpecModal(false)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={20} /></button>
            </div>
            <form onSubmit={handleSpecSubmit} className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Die Code</label>
                  <input name="dieCode" type="text" defaultValue={selectedProfile.dieCode} readOnly={!!selectedProfile.dieCode} className={`w-full px-5 py-3.5 rounded-2xl border-2 text-sm font-bold text-left outline-none transition-all ${selectedProfile.dieCode ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-slate-100 focus:border-indigo-500'}`} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profile Name</label>
                  <input name="profileName" type="text" defaultValue={selectedProfile.profileName} className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 text-sm font-bold text-left outline-none transition-all" />
                </div>
              </div>
              <div className="bg-indigo-50/50 p-6 rounded-[1.5rem] border border-indigo-100">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 block">Tool Life Target (kg)</label>
                <input name="toolLifeKg" type="number" defaultValue={selectedProfile.toolLifeKg} className="w-full px-5 py-4 rounded-2xl border-2 border-white bg-white focus:border-indigo-500 text-left outline-none font-black text-2xl text-indigo-700 shadow-sm font-mono" required />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['T1A', 'T1B', 'T2A', 'T2B', 'T3', 'T4'].map(l => (
                  <div key={l} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-500 mb-3 tracking-widest uppercase font-display">{l} Spec (mm)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input name={`spec_${l.toLowerCase()}_min`} type="number" step="0.001" defaultValue={selectedProfile.specs?.[l.toLowerCase()]?.min} placeholder="Min" className="w-full px-3 py-2 text-xs font-bold border-2 border-white rounded-xl bg-white text-left outline-none focus:border-indigo-500 font-mono" />
                      <input name={`spec_${l.toLowerCase()}_max`} type="number" step="0.001" defaultValue={selectedProfile.specs?.[l.toLowerCase()]?.max} placeholder="Max" className="w-full px-3 py-2 text-xs font-bold border-2 border-white rounded-xl bg-white text-left outline-none focus:border-indigo-500 font-mono" />
                    </div>
                  </div>
                ))}
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-600 transition-all hover:-translate-y-1 cursor-pointer">Save Profile Spec</button>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-[2.5rem] max-w-2xl w-full overflow-hidden border border-slate-200 shadow-2xl">
             <div className="px-10 py-6 bg-slate-900 text-white flex justify-between items-center">
               <div>
                  <h3 className="font-black text-xs uppercase tracking-widest text-emerald-400 mb-1 font-display">Quality Inspection</h3>
                  <p className="text-xl font-black font-display">{selectedDie.dieCode} ({selectedDie.dieNumber})</p>
               </div>
               <button onClick={() => setShowInspectionModal(false)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={20} /></button>
             </div>
             <form onSubmit={handleInspectionSubmit} className="p-10 space-y-8">
                {judgmentError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 animate-pulse">
                    <div className="flex items-center gap-2 text-rose-700 font-black text-xs uppercase tracking-widest mb-3"><AlertTriangle size={14} /> Spec Out of Range</div>
                    <ul className="text-[11px] text-rose-600 font-bold space-y-1 list-none">
                       {judgmentError.map((err, i) => <li key={i} className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-rose-400 rounded-full"></div> {err}</li>)}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 font-display">Visual Assessment</h4>
                    <div className="space-y-4">
                      {['Surface Quality (ผิวงาน)', 'Crack Check (รอยร้าว)', 'Cleanliness (ความสะอาด)'].map(c => (
                        <label key={c} className="flex items-center gap-4 cursor-pointer group bg-slate-50 p-4 rounded-2xl hover:bg-indigo-50 transition-colors">
                          <input type="checkbox" className="w-5 h-5 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500" required /> 
                          <span className="text-xs font-black text-slate-700 uppercase tracking-tighter group-hover:text-indigo-700 transition-colors">{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 font-display">Dimension Check (mm)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {['T1A', 'T1B', 'T2A', 'T2B', 'T3', 'T4'].map(k => renderSpecCheck(k, k.toLowerCase()))}
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-600 shadow-2xl transition-all hover:-translate-y-1 cursor-pointer">Confirm Inspection Pass</button>
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

      {/* Log Detail Modal */}
      {showLogDetailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full overflow-hidden border border-slate-200 shadow-2xl">
            <div className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-black text-xs uppercase tracking-widest font-display">Inspection Data</h3><button onClick={() => setShowLogDetailModal(null)} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"><X size={16} /></button></div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(showLogDetailModal.inspectionData || {}).map(([k, v]) => (
                  <div key={k} className="p-4 bg-slate-50 border-2 border-white rounded-2xl shadow-sm text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-display">{k}</p>
                    <p className="text-lg font-black text-indigo-600 tracking-tight font-mono">{v} <span className="text-[10px] text-slate-400 font-bold uppercase">mm</span></p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-100 text-center">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">ตรวจสอบเมื่อ {showLogDetailModal.timestamp}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
