import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Firm } from '../types';
import { X, Plus, Edit2, Trash2, Check, Search, Folder, CheckSquare, Square, Save } from 'lucide-react';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupsUpdated?: () => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  onClose,
  onGroupsUpdated
}) => {
  const [groups, setGroups] = useState<string[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState<{ oldName: string; newName: string } | null>(null);
  const [firmSearch, setFirmSearch] = useState('');
  const [assignedFirmIds, setAssignedFirmIds] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const reloadData = () => {
    const loadedGroups = db.getFirmGroups();
    const loadedFirms = db.getFirms();
    setGroups(loadedGroups);
    setFirms(loadedFirms);
    if (!activeGroup || !loadedGroups.includes(activeGroup)) {
      setActiveGroup(loadedGroups[0] || '');
    }
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
      setHasUnsavedChanges(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeGroup) {
      const ids = new Set(firms.filter(f => f.group === activeGroup).map(f => f.id));
      setAssignedFirmIds(ids);
      setHasUnsavedChanges(false);
    } else {
      setAssignedFirmIds(new Set());
    }
  }, [activeGroup, firms]);

  if (!isOpen) return null;

  const handleAddGroup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (groups.includes(trimmed)) {
      alert('Bu isimde bir grup zaten mevcut.');
      return;
    }
    const updated = db.addFirmGroup(trimmed);
    setGroups(updated);
    setNewGroupName('');
    setActiveGroup(trimmed);
    if (onGroupsUpdated) onGroupsUpdated();
  };

  const handleStartEdit = (group: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup({ oldName: group, newName: group });
  };

  const handleSaveRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingGroup) return;
    const trimmed = editingGroup.newName.trim();
    if (!trimmed || trimmed === editingGroup.oldName) {
      setEditingGroup(null);
      return;
    }
    if (groups.includes(trimmed)) {
      alert('Bu isimde başka bir grup zaten var.');
      return;
    }
    const updated = db.renameFirmGroup(editingGroup.oldName, trimmed);
    setGroups(updated);
    if (activeGroup === editingGroup.oldName) {
      setActiveGroup(trimmed);
    }
    setEditingGroup(null);
    setFirms(db.getFirms());
    if (onGroupsUpdated) onGroupsUpdated();
  };

  const handleDeleteGroup = (group: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const count = firms.filter(f => f.group === group).length;
    const confirmMsg = count > 0 
      ? `"${group}" grubunu silmek istediğinize emin misiniz? Bu gruptaki ${count} firma gruptan çıkarılacak (silinmeyecektir).`
      : `"${group}" grubunu silmek istediğinize emin misiniz?`;
    
    if (window.confirm(confirmMsg)) {
      const updated = db.deleteFirmGroup(group);
      setGroups(updated);
      setFirms(db.getFirms());
      if (activeGroup === group) {
        setActiveGroup(updated[0] || '');
      }
      if (onGroupsUpdated) onGroupsUpdated();
    }
  };

  const toggleFirmAssignment = (firmId: string) => {
    if (!activeGroup) return;
    const next = new Set(assignedFirmIds);
    if (next.has(firmId)) {
      next.delete(firmId);
    } else {
      next.add(firmId);
    }
    setAssignedFirmIds(next);
    setHasUnsavedChanges(true);
  };

  const handleSelectAllVisible = () => {
    if (!activeGroup) return;
    const next = new Set(assignedFirmIds);
    filteredFirms.forEach(f => next.add(f.id));
    setAssignedFirmIds(next);
    setHasUnsavedChanges(true);
  };

  const handleDeselectAllVisible = () => {
    if (!activeGroup) return;
    const next = new Set(assignedFirmIds);
    filteredFirms.forEach(f => next.delete(f.id));
    setAssignedFirmIds(next);
    setHasUnsavedChanges(true);
  };

  const handleSaveFirmAssignments = () => {
    if (!activeGroup) return;
    
    // Aktif gruptaki firmaları güncelle
    const allFirms = db.getFirms();
    const updated = allFirms.map(f => {
      const shouldBeInGroup = assignedFirmIds.has(f.id);
      if (shouldBeInGroup && f.group !== activeGroup) {
        return { ...f, group: activeGroup };
      }
      if (!shouldBeInGroup && f.group === activeGroup) {
        return { ...f, group: undefined };
      }
      return f;
    });

    db.saveFirms(updated);
    setFirms(updated);
    setHasUnsavedChanges(false);
    if (onGroupsUpdated) onGroupsUpdated();
    alert(`"${activeGroup}" grubu için firma atamaları başarıyla kaydedildi.`);
  };

  const filteredFirms = firms.filter(f => {
    const q = firmSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (f.name || '').toLowerCase().includes(q) ||
      (f.taxNumber || '').toLowerCase().includes(q) ||
      (f.group || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        
        {/* Üst Başlık */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">Firma Grupları Yönetimi</h3>
              <p className="text-xs text-slate-400">Grupları oluşturun, adlarını düzenleyin ve firmaları gruplara atayın</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* İçerik: Sol (Grup Listesi) + Sağ (Firma Atama) */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Sol Kolon: Gruplar */}
          <div className="w-full md:w-72 bg-slate-950/40 border-r border-slate-800 flex flex-col p-4 space-y-3 shrink-0">
            
            {/* Yeni Grup Ekleme */}
            <form onSubmit={handleAddGroup} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Yeni Grup Adı..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ekle</span>
              </button>
            </form>

            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-1 flex items-center justify-between">
              <span>Mevcut Gruplar</span>
              <span className="text-slate-500">{groups.length} Grup</span>
            </div>

            {/* Grup Listesi */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-48 md:max-h-full">
              {groups.map(group => {
                const isActive = activeGroup === group;
                const firmCount = firms.filter(f => f.group === group).length;
                const isEditing = editingGroup?.oldName === group;

                return (
                  <div
                    key={group}
                    onClick={() => {
                      if (!isEditing) setActiveGroup(group);
                    }}
                    className={`group flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingGroup.newName}
                          onChange={e => setEditingGroup({ ...editingGroup, newName: e.target.value })}
                          className="flex-1 bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white outline-none"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename(e as any);
                            if (e.key === 'Escape') setEditingGroup(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveRename}
                          className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                          title="Kaydet"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGroup(null)}
                          className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                          title="İptal"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 truncate flex-1 pr-1">
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-400' : 'bg-slate-600'}`} />
                          <span className="font-semibold text-xs truncate">{group}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                            {firmCount}
                          </span>
                          
                          {/* Düzenle Butonu */}
                          <button
                            type="button"
                            onClick={(e) => handleStartEdit(group, e)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 opacity-60 group-hover:opacity-100 transition-opacity"
                            title="Grubu Yeniden Adlandır"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          {/* Sil Butonu */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteGroup(group, e)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 opacity-60 group-hover:opacity-100 transition-opacity"
                            title="Grubu Sil"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sağ Kolon: Seçilen Grubun Firmaları */}
          <div className="flex-1 flex flex-col p-4 bg-slate-900/60 overflow-hidden">
            {activeGroup ? (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {activeGroup}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold">
                        Grup Üyesi Firmalar ({assignedFirmIds.size} / {firms.length})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bu gruba dahil etmek istediğiniz firmaların yanındaki kutucuğu işaretleyiniz:
                    </p>
                  </div>

                  {/* Kaydet Butonu */}
                  <button
                    onClick={handleSaveFirmAssignments}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                      hasUnsavedChanges
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{hasUnsavedChanges ? 'Değişiklikleri Kaydet *' : 'Kayıtlı'}</span>
                  </button>
                </div>

                {/* Filtre ve Toplu Seçim Çubuğu */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 py-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Firma Adı veya Vergi No ile Ara..."
                      value={firmSearch}
                      onChange={(e) => setFirmSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <CheckSquare className="w-3 h-3 text-emerald-400" />
                      <span>Filtrelenenleri Ekle</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllVisible}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 text-rose-400" />
                      <span>Filtrelenenleri Çıkar</span>
                    </button>
                  </div>
                </div>

                {/* Firma Listesi Tablosu */}
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800/60">
                  {filteredFirms.map(firm => {
                    const isChecked = assignedFirmIds.has(firm.id);
                    const isOtherGroup = firm.group && firm.group !== activeGroup;

                    return (
                      <div
                        key={firm.id}
                        onClick={() => toggleFirmAssignment(firm.id)}
                        className={`flex items-center justify-between p-2.5 text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : 'hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            className={`p-0.5 rounded ${isChecked ? 'text-amber-400' : 'text-slate-600'}`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                          
                          <div className="min-w-0">
                            <span className={`font-semibold block truncate ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                              {firm.name}
                            </span>
                            {firm.taxNumber && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                VKN: {firm.taxNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isOtherGroup && (
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              Şu an: {firm.group}
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              isChecked
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isChecked ? 'Grup Üyesi' : 'Hariç'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {filteredFirms.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Aramaya uygun firma bulunamadı.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
                <Folder className="w-10 h-10 text-slate-700 mb-2" />
                <span>Firmaları yönetmek için soldaki listeden bir grup seçiniz.</span>
              </div>
            )}
          </div>
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80 text-xs">
          <span className="text-slate-500">
            Toplam {groups.length} Grup, {firms.length} Kayıtlı Firma
          </span>
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                if (window.confirm('Kaydedilmemiş değişiklikleriniz var. Kaydetmeden çıkmak istiyor musunuz?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors border border-slate-700"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};
