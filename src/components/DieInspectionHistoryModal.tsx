import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ClipboardCheck, 
  History, 
  Calendar, 
  User, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  FileText, 
  ShieldCheck,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import { Die, Log, Profile, normalizeSpecs, SpecItem } from '../types';

interface DieInspectionHistoryModalProps {
  die: Die;
  allLogs: Log[];
  profiles: Profile[];
  onClose: () => void;
  onInspectNow?: (die: Die) => void;
}

export const DieInspectionHistoryModal: React.FC<DieInspectionHistoryModalProps> = ({
  die,
  allLogs,
  profiles,
  onClose,
  onInspectNow
}) => {
  const [activeTab, setActiveTab] = useState<'inspections' | 'all_activities'>('inspections');
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);

  // 1. Filter logs for this specific die
  const dieLogs = useMemo(() => {
    return allLogs
      .filter(l => l.dieId === die.id || (l.dieCode === die.dieCode && l.dieNumber === die.dieNumber))
      .sort((a, b) => {
        const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
        const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
  }, [allLogs, die]);

  // 2. Filter inspection logs specifically
  const inspectionLogs = useMemo(() => {
    return dieLogs.filter(l => l.type === 'Inspection');
  }, [dieLogs]);

  // 3. Resolve active specs for this die
  const activeSpecs = useMemo(() => {
    const masterProfile = profiles.find(p => p.dieCode === die.dieCode);
    if (masterProfile && masterProfile.specs && normalizeSpecs(masterProfile.specs).length > 0) {
      return normalizeSpecs(masterProfile.specs);
    }
    return normalizeSpecs(die.specs || []);
  }, [profiles, die]);

  // The latest inspection round (ครั้งที่แล้ว)
  const latestInspection = inspectionLogs.length > 0 ? inspectionLogs[0] : null;

  // Helper to determine if a log judgment is NG or PASS
  const getLogJudgment = (log: Log): 'PASS' | 'NG' => {
    if (log.inspectionData?._judgment === 'NG') return 'NG';
    if (log.inspectionData?._judgment === 'PASS') return 'PASS';
    const detailLower = (log.detail || '').toLowerCase();
    if (detailLower.includes('ng') || detailLower.includes('ไม่ผ่านเกณฑ์')) return 'NG';
    return 'PASS';
  };

  // Helper to format spec target label
  const formatSpecTarget = (spec: SpecItem) => {
    if (spec.type === 'appearance') return 'ต้องผ่านเกณฑ์สมบูรณ์';
    if (spec.type === 'min_max') {
      const min = spec.min ?? 0;
      const max = spec.max ?? 0;
      return `${min} - ${max} ${spec.unit || 'mm'}`;
    }
    if (spec.type === 'min') {
      return `≥ ${spec.min ?? 0} ${spec.unit || 'mm'}`;
    }
    if (spec.type === 'max') {
      return `≤ ${spec.max ?? 0} ${spec.unit || 'mm'}`;
    }
    return '-';
  };

  // Helper to evaluate a measurement against spec
  const evaluateValue = (spec: SpecItem, actual: any): { isPass: boolean; text: string } => {
    if (actual === undefined || actual === null || actual === '') {
      return { isPass: false, text: 'ไม่มีข้อมูล' };
    }
    if (spec.type === 'appearance') {
      const isPass = actual === 'PASS';
      return { isPass, text: actual };
    }
    const val = typeof actual === 'number' ? actual : parseFloat(actual);
    if (isNaN(val)) return { isPass: false, text: String(actual) };

    if (spec.type === 'min_max') {
      const min = spec.min ?? 0;
      const max = spec.max ?? 0;
      const isPass = (min === 0 && max === 0) || (val >= min && val <= max);
      return { isPass, text: `${val} ${spec.unit || 'mm'}` };
    }
    if (spec.type === 'min') {
      const min = spec.min ?? 0;
      const isPass = val >= min;
      return { isPass, text: `${val} ${spec.unit || 'mm'}` };
    }
    if (spec.type === 'max') {
      const max = spec.max ?? 0;
      const isPass = val <= max;
      return { isPass, text: `${val} ${spec.unit || 'mm'}` };
    }
    return { isPass: true, text: `${val} ${spec.unit || 'mm'}` };
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 text-left animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-start shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <History size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 font-display">
                  Inspection History
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  ตรวจแล้ว {inspectionLogs.length} รอบ
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white font-display mt-0.5 flex items-center gap-2">
                <span>{die.dieCode}</span>
                <span className="text-slate-400 font-mono text-base font-normal">(Die No. {die.dieNumber})</span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                {die.profileName || 'Master Profile'} • ตำแหน่ง: <span className="font-semibold text-white">{die.location || '-'}</span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector & Actions Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('inspections')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'inspections'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ClipboardCheck size={14} />
              <span>รอบการตรวจสอบ ({inspectionLogs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all_activities')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all_activities'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Activity size={14} />
              <span>ประวัติกิจกรรมทั้งหมด ({dieLogs.length})</span>
            </button>
          </div>

          {onInspectNow && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onInspectNow(die);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer hover:-translate-y-0.5"
            >
              <ClipboardCheck size={14} />
              <span>+ ตรวจสอบคุณภาพรอบใหม่</span>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {activeTab === 'inspections' ? (
            <>
              {/* ========================================================================= */}
              {/* SECTION: ผลการตรวจสอบรอบล่าสุด (ครั้งที่แล้ว) - DIRECT USER REQUIREMENT */}
              {/* ========================================================================= */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 font-display">
                      ผลการตรวจสอบรอบล่าสุด (ครั้งที่แล้ว)
                    </h3>
                  </div>
                  {latestInspection && (
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {latestInspection.timestamp}
                    </span>
                  )}
                </div>

                {latestInspection ? (
                  (() => {
                    const judgment = getLogJudgment(latestInspection);
                    const isNg = judgment === 'NG';
                    const inspData = latestInspection.inspectionData || {};
                    const ngReasons: string[] = Array.isArray(inspData._ngReasons) ? inspData._ngReasons : [];
                    const notes: string = inspData._notes || '';
                    const inspector = latestInspection.performedBy === 'admin' 
                      ? 'ผู้ดูแลระบบ (Admin)' 
                      : latestInspection.performedBy || latestInspection.userId || 'เจ้าหน้าที่ (User)';

                    return (
                      <div className={`rounded-2xl border p-5 space-y-4 shadow-xs transition-all ${
                        isNg 
                          ? 'bg-rose-50/70 border-rose-200' 
                          : 'bg-emerald-50/70 border-emerald-200'
                      }`}>
                        
                        {/* Result Headline Banner */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                              isNg 
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-200' 
                                : 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                            }`}>
                              {isNg ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                  isNg 
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}>
                                  ผลการตรวจ: {judgment}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold">
                                  โดย: {inspector}
                                </span>
                              </div>
                              <h4 className="text-sm font-black text-slate-900 mt-1 font-display">
                                {isNg 
                                  ? 'ไม่ผ่านเกณฑ์การตรวจสอบคุณภาพ (NG) - มีค่าหลุดเกณฑ์ Spec' 
                                  : 'ผ่านเกณฑ์มาตรฐานคุณภาพเรียบร้อย (PASS) - พร้อมใช้งาน'}
                              </h4>
                            </div>
                          </div>

                          <div className="text-left sm:text-right shrink-0">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">วัน-เวลาที่ตรวจ</span>
                            <span className="text-xs font-mono font-bold text-slate-700">{latestInspection.timestamp}</span>
                          </div>
                        </div>

                        {/* NG Reasons list if failed */}
                        {isNg && ngReasons.length > 0 && (
                          <div className="bg-white p-3.5 rounded-xl border border-rose-200 space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                              <AlertTriangle size={12} />
                              จุดที่หลุดเกณฑ์มาตรฐาน ({ngReasons.length} จุด):
                            </span>
                            <ul className="space-y-1 pl-1">
                              {ngReasons.map((reason, idx) => (
                                <li key={idx} className="text-xs text-rose-800 font-semibold flex items-start gap-1.5">
                                  <span className="text-rose-500 font-bold">•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Detail text if not redundant */}
                        {latestInspection.detail && !isNg && (
                          <div className="text-xs text-slate-600 font-medium bg-white/70 px-3.5 py-2 rounded-xl border border-slate-200/60">
                            {latestInspection.detail}
                          </div>
                        )}

                        {/* Dimension & Appearance Spec Points Table */}
                        {activeSpecs.length > 0 ? (
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-display">
                                ค่าที่วัดได้จริงเทียบกับเกณฑ์มาตรฐาน (Inspection Spec Points)
                              </span>
                              <span className="text-[9px] font-bold text-slate-400">
                                รวม {activeSpecs.length} จุดตรวจ
                              </span>
                            </div>

                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                  <th className="px-4 py-2">จุดตรวจสอบ</th>
                                  <th className="px-3 py-2">เกณฑ์มาตรฐาน (Spec)</th>
                                  <th className="px-3 py-2 text-right">ค่าที่วัดได้จริง</th>
                                  <th className="px-4 py-2 text-center">ผลการประเมิน</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {activeSpecs.map((spec) => {
                                  const actual = inspData[spec.name] ?? inspData[spec.id];
                                  const evaluation = evaluateValue(spec, actual);

                                  return (
                                    <tr key={spec.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-4 py-2.5">
                                        <span className="font-bold text-slate-800 block">{spec.name}</span>
                                        <span className="text-[9px] text-slate-400 uppercase">
                                          {spec.type === 'appearance' ? 'Appearance (ลักษณะภายนอก)' : `เกณฑ์ ${spec.type}`}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 font-mono text-slate-600 font-medium">
                                        {formatSpecTarget(spec)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                                        {actual !== undefined && actual !== null ? (
                                          spec.type === 'appearance' ? (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                              actual === 'PASS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                            }`}>
                                              {actual}
                                            </span>
                                          ) : (
                                            `${actual} ${spec.unit || 'mm'}`
                                          )
                                        ) : (
                                          <span className="text-slate-300 italic font-normal">ไม่มีบันทึก</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        {actual !== undefined && actual !== null ? (
                                          evaluation.isPass ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                              <CheckCircle2 size={10} /> PASS
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                                              <AlertTriangle size={10} /> NG
                                            </span>
                                          )
                                        ) : (
                                          <span className="text-slate-400 text-[10px]">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          // Fallback if no specs defined, show raw inspection values recorded
                          Object.keys(inspData).filter(k => !k.startsWith('_')).length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                              <span className="text-[10px] font-black uppercase text-slate-400 block">
                                รายละเอียดค่าที่บันทึกไว้ในรอบนี้:
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(inspData)
                                  .filter(([k]) => !k.startsWith('_'))
                                  .map(([key, val]) => (
                                    <div key={key} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                      <span className="text-[10px] font-bold text-slate-400 block truncate">{key}</span>
                                      <span className="text-xs font-mono font-black text-slate-800">{String(val)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )
                        )}

                        {/* Inspector Notes */}
                        {notes && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                            <span className="font-bold text-slate-400 uppercase text-[9px] block mb-0.5">หมายเหตุการตรวจสอบ:</span>
                            <p className="font-medium text-slate-800">{notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                    <div className="w-12 h-12 bg-white rounded-2xl mx-auto flex items-center justify-center text-slate-400 shadow-xs border border-slate-200">
                      <ClipboardCheck size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 font-display">ยังไม่มีประวัติการตรวจสอบสำหรับแม่พิมพ์ No. {die.dieNumber}</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        แม่พิมพ์นี้ยังไม่เคยผ่านการบันทึกการตรวจสอบคุณภาพ สามารถกดปุ่มด้านล่างเพื่อเริ่มทำการตรวจสอบรอบแรกได้ทันที
                      </p>
                    </div>
                    {onInspectNow && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onInspectNow(die);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer hover:-translate-y-0.5"
                      >
                        <ClipboardCheck size={14} />
                        <span>เริ่มตรวจสอบคุณภาพรอบแรก</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* SECTION: ประวัติการตรวจสอบในแต่ละรอบ (ALL ROUNDS TIMELINE) */}
              {/* ========================================================================= */}
              {inspectionLogs.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-indigo-600" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 font-display">
                        การตรวจสอบในแต่ละรอบ ({inspectionLogs.length} รอบ)
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">
                      เรียงจากรอบล่าสุดไปเก่าสุด
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {inspectionLogs.map((log, index) => {
                      const roundNumber = inspectionLogs.length - index;
                      const isLatest = index === 0;
                      const judgment = getLogJudgment(log);
                      const isNg = judgment === 'NG';
                      const isExpanded = expandedRoundId === log.id;
                      const inspData = log.inspectionData || {};
                      const ngReasons: string[] = Array.isArray(inspData._ngReasons) ? inspData._ngReasons : [];
                      const notes: string = inspData._notes || '';

                      return (
                        <div 
                          key={log.id} 
                          className={`rounded-2xl border transition-all ${
                            isLatest 
                              ? 'border-indigo-200 bg-indigo-50/20 shadow-xs' 
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {/* Round summary header click to expand */}
                          <div 
                            onClick={() => setExpandedRoundId(isExpanded ? null : log.id)}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs font-display shrink-0 ${
                                isNg 
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}>
                                R{roundNumber}
                              </div>

                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-slate-900 font-display">
                                    รอบที่ {roundNumber} {isLatest && <span className="text-indigo-600 font-bold">(ครั้งล่าสุด)</span>}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                    isNg 
                                      ? 'bg-rose-100 text-rose-800' 
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {judgment}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {log.timestamp}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                                  {log.detail}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <span className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
                                {isExpanded ? 'ย่อรายละเอียด' : 'ดูผลตรวจและจุดวัด'}
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            </div>
                          </div>

                          {/* Expanded detailed breakdown */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 bg-slate-50/50 rounded-b-2xl animate-in fade-in duration-150">
                              
                              {/* Inspector info */}
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                <span className="flex items-center gap-1">
                                  <User size={12} className="text-slate-400" />
                                  ผู้ตรวจ: <span className="font-bold text-slate-700">{log.performedBy || log.userId || 'Admin'}</span>
                                </span>
                                <span className="font-mono text-slate-400">{log.timestamp}</span>
                              </div>

                              {/* NG Points if any */}
                              {isNg && ngReasons.length > 0 && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                                  <span className="text-[10px] font-black text-rose-700 uppercase block">จุดที่หลุดเกณฑ์:</span>
                                  {ngReasons.map((r, i) => (
                                    <p key={i} className="text-xs text-rose-800 font-semibold">• {r}</p>
                                  ))}
                                </div>
                              )}

                              {/* Measurement table for this specific round */}
                              {activeSpecs.length > 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                      <tr>
                                        <th className="px-3 py-2">จุดตรวจ</th>
                                        <th className="px-2 py-2">เกณฑ์มาตรฐาน</th>
                                        <th className="px-2 py-2 text-right">ค่าที่วัดได้</th>
                                        <th className="px-3 py-2 text-center">สถานะ</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {activeSpecs.map((spec) => {
                                        const actual = inspData[spec.name] ?? inspData[spec.id];
                                        const evalRes = evaluateValue(spec, actual);
                                        return (
                                          <tr key={spec.id} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-2 font-bold text-slate-800">{spec.name}</td>
                                            <td className="px-2 py-2 font-mono text-slate-500 text-[11px]">{formatSpecTarget(spec)}</td>
                                            <td className="px-2 py-2 text-right font-mono font-bold text-slate-800 text-[11px]">
                                              {actual !== undefined && actual !== null ? String(actual) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              {actual !== undefined && actual !== null ? (
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                                  evalRes.isPass ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                                }`}>
                                                  {evalRes.isPass ? 'PASS' : 'NG'}
                                                </span>
                                              ) : (
                                                <span className="text-slate-300">-</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                Object.keys(inspData).filter(k => !k.startsWith('_')).length > 0 && (
                                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {Object.entries(inspData)
                                        .filter(([k]) => !k.startsWith('_'))
                                        .map(([k, v]) => (
                                          <div key={k} className="p-1.5 bg-slate-50 rounded border border-slate-100">
                                            <span className="text-[10px] text-slate-400 block">{k}</span>
                                            <span className="font-mono font-bold text-slate-800">{String(v)}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )
                              )}

                              {notes && (
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-600">
                                  <span className="font-bold text-slate-400 text-[9px] uppercase block mb-0.5">หมายเหตุ:</span>
                                  <p>{notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            // =========================================================================
            // SECTION: ประวัติกิจกรรมทั้งหมดของแม่พิมพ์นี้ (STATUS, PRODUCTION, INSPECT)
            // =========================================================================
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 font-display">
                  ประวัติกิจกรรมทั้งหมด (Total {dieLogs.length} Events)
                </h3>
              </div>

              {dieLogs.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {dieLogs.map((log) => {
                    const isInsp = log.type === 'Inspection';
                    const isProd = log.type === 'Production';
                    return (
                      <div key={log.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              isInsp 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : isProd 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {log.type}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">{log.timestamp}</span>
                          </div>
                          <p className="font-medium text-slate-800">{log.detail}</p>
                          {log.performedBy && (
                            <span className="text-[10px] text-slate-400 block">
                              โดย: {log.performedBy === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่ (User)'}
                            </span>
                          )}
                        </div>

                        {log.weight > 0 && (
                          <div className="text-right shrink-0">
                            <span className="font-mono font-black text-indigo-600">+{log.weight.toLocaleString()} kg</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  ยังไม่มีประวัติกิจกรรมของแม่พิมพ์นี้
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            แม่พิมพ์: <span className="font-bold text-slate-800">{die.dieCode}</span> • No. <span className="font-bold text-slate-800">{die.dieNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
