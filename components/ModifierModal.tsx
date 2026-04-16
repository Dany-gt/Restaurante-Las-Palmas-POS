import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CheckCircle, ShoppingCart, Loader2, MessageSquare, ChevronRight, Hash, Trash2, Utensils } from 'lucide-react';
import { Product } from '../types';
import { supabase } from '../supabase';

interface SelectionItem {
  id: string;
  name: string;
  display_name?: string;
  color_code?: string;
  extra_price: number;
  type: 'ADD' | 'REMOVE';
  group_id: string;
  group_type: 'OPTION' | 'MODIFIER';
  quantity: number;
  min_quantity: number;
  max_quantity: number;
}

interface GroupConfig {
  id: string;
  name: string;
  group_prompt: string;
  min_selection: number;
  max_selection: number;
  type: 'OPTION' | 'MODIFIER';
  items: SelectionItem[];
}

interface ModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onConfirm: (product: Product, selectedModifiers: any[], notes: string, quantity: number) => void;
  orderNumber?: string | number;
  tableName?: string;
  waiterName?: string;
}

export const ModifierModal: React.FC<ModifierModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
  orderNumber,
  tableName,
  waiterName
}) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [view, setView] = useState<'CATEGORIES' | 'DETAIL'>('CATEGORIES');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectionItem[]>([]);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [itemQuantity, setItemQuantity] = useState(1);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && product) {
      fetchConfiguration();
      setNotes('');
      setSelectedItems([]);
      setShowNotes(false);
      setSelectedGroupId(null);
      setView('CATEGORIES');
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (showNotes && notesRef.current) {
      notesRef.current.focus();
    }
  }, [showNotes]);

  const fetchConfiguration = async () => {
    setLoading(true);
    try {
      const { data: legacyOpts } = await supabase.from('product_option_groups').select('*, option_groups(*)').eq('product_id', product.id);
      const { data: legacyMods } = await supabase.from('product_modifier_groups').select('*, modifier_groups(*)').eq('product_id', product.id);

      const configMap = new Map<string, GroupConfig>();

      if (legacyOpts) {
        for (const lo of legacyOpts) {
          if (!lo.option_groups) continue;
          if (!configMap.has(lo.group_id)) {
            configMap.set(lo.group_id, {
              id: lo.group_id,
              name: lo.option_groups.name,
              group_prompt: lo.option_groups.group_prompt || lo.option_groups.name,
              min_selection: lo.option_groups.min_selection || 0,
              max_selection: lo.option_groups.max_selection || 1,
              type: 'OPTION',
              items: []
            });
          }
        }
      }

      if (legacyMods) {
        for (const lm of legacyMods) {
          if (!lm.modifier_groups) continue;
          if (!configMap.has(lm.group_id)) {
            configMap.set(lm.group_id, {
              id: lm.group_id,
              name: lm.modifier_groups.name,
              group_prompt: lm.modifier_groups.group_prompt || lm.modifier_groups.name,
              min_selection: lm.modifier_groups.min_selection || 0,
              max_selection: lm.modifier_groups.max_selection || 99,
              type: 'MODIFIER',
              items: []
            });
          }
        }
      }

      const assignedOptionGroupIds = legacyOpts?.map(lo => lo.group_id) || [];
      const assignedModifierGroupIds = legacyMods?.map(lm => lm.group_id) || [];

      if (assignedOptionGroupIds.length > 0) {
        const { data: optItems, error: optError } = await supabase
          .from('group_items')
          .select('*')
          .in('option_group_id', assignedOptionGroupIds)
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true });

        console.log(`[POS Debug] Fetched ${optItems?.length || 0} option items. Error:`, optError);
        if (optItems) console.log('[POS Debug] Option Items Titles:', optItems.map(i => i.item_name));

        optItems?.forEach(item => {
          const grp = configMap.get(item.option_group_id);
          if (grp) {
            grp.items.push({
              id: item.id,
              name: item.item_name,
              display_name: item.display_name,
              color_code: item.color_code,
              extra_price: item.extra_price,
              type: (item.modifier_type?.toUpperCase() || 'ADD') as 'ADD' | 'REMOVE',
              group_id: item.option_group_id,
              group_type: 'OPTION',
              quantity: 0,
              min_quantity: item.min_quantity || 0,
              max_quantity: item.max_quantity || 0
            });
          }
        });
      }

      if (assignedModifierGroupIds.length > 0) {
        const { data: modItems, error: modError } = await supabase
          .from('group_items')
          .select('*')
          .in('modifier_group_id', assignedModifierGroupIds)
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true });

        console.log(`[POS Debug] Fetched ${modItems?.length || 0} modifier items. Error:`, modError);
        if (modItems) console.log('[POS Debug] Modifier Items Titles:', modItems.map(i => i.item_name));

        modItems?.forEach(item => {
          const grp = configMap.get(item.modifier_group_id);
          if (grp) {
            grp.items.push({
              id: item.id,
              name: item.item_name,
              display_name: item.display_name,
              color_code: item.color_code,
              extra_price: item.extra_price,
              type: (item.modifier_type?.toUpperCase() || 'ADD') as 'ADD' | 'REMOVE',
              group_id: item.modifier_group_id,
              group_type: 'MODIFIER',
              quantity: 0,
              min_quantity: item.min_quantity || 0,
              max_quantity: item.max_quantity || 0
            });
          }
        });
      }

      const flattenedGroups = Array.from(configMap.values()).filter(g => g.items.length > 0);
      setGroups(flattenedGroups);
    } catch (error) {
      console.error('Error fetching customizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementItem = (item: SelectionItem) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        // Toggle Off: If already selected, remove it
        return prev.filter(i => i.id !== item.id);
      } else {
        // Toggle On: Set to maximum quantity allowed (or 1 if unlimited)
        const qtyToSet = item.max_quantity > 0 ? item.max_quantity : 1;
        return [...prev, { ...item, quantity: qtyToSet }];
      }
    });
  };

  const decrementItem = (item: SelectionItem) => {
    setSelectedItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleDoubleClick = (item: SelectionItem) => {
    setShowNotes(true);
  };

  const handleContextMenu = (e: React.MouseEvent, item: SelectionItem) => {
    e.preventDefault();
    setShowNotes(true);
  };

  const getValidationErrors = () => {
    const errors: string[] = [];
    groups.forEach(grp => {
      const selectedCount = selectedItems.filter(i => i.group_id === grp.id).reduce((sum, i) => sum + i.quantity, 0);
      if (selectedCount < grp.min_selection) {
        errors.push(`Seleccione al menos ${grp.min_selection} en: ${grp.name}`);
      }
    });
    return errors;
  };

  const calculateTotal = () => {
    const extra = selectedItems.reduce((acc, m) => acc + (m.extra_price * m.quantity), 0);
    return Number(product.price) + extra;
  };

  if (!isOpen) return null;

  const currentGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-fade-in font-['Montserrat']">
      <div className="w-full h-full bg-[#0f1115] flex flex-col overflow-hidden relative">

        {/* Header - Full Width */}
        <div className="px-10 py-5 bg-[#16191f] border-b border-white/5 flex justify-center items-center shrink-0 relative">
          <div className="flex items-center gap-5 text-[10px] font-black uppercase tracking-[0.25em]">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold">ORDEN:</span>
              <span className="text-indigo-400">#{orderNumber || '000'}</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10"></div>
            <span className="text-gray-300">{tableName || 'SIN MESA'}</span>
            <div className="w-[1px] h-3 bg-white/10"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold">ATIENDE:</span>
              <span className="text-gray-400">{waiterName?.toUpperCase() || 'MESERO'}</span>
            </div>
          </div>
          <button onClick={onClose} className="absolute right-10 w-12 h-12 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all flex items-center justify-center border border-white/5">
            <X size={24} />
          </button>
        </div>

        {/* Dynamic Notes Overlay */}
        {showNotes && (
          <div className="absolute inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="w-full max-w-xl bg-[#1c1f26] rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/20 text-white/60 rounded-xl flex items-center justify-center border border-white/10">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white uppercase tracking-tight">Instrucciones Especiales</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Notas opcionales para cocina</p>
                </div>
              </div>
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Término medio, sin sal, etc..."
                className="w-full h-32 bg-[#0f1115] border border-white/5 rounded-xl p-4 text-base text-gray-300 placeholder-gray-700 focus:outline-none focus:border-white/20 focus:bg-[#16191f] transition-all resize-none leading-relaxed"
              />
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowNotes(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-white/5"
                >
                  Confirmar Nota
                </button>
                <button
                  onClick={() => { setNotes(''); setShowNotes(false); }}
                  className="px-6 bg-white/5 hover:bg-white/10 text-gray-400 font-black uppercase tracking-widest py-4 rounded-xl transition-all"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Areas */}
        <div className="flex-1 flex overflow-hidden">

          {/* Center: Layered Content */}
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[#0a0c10]">

            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mb-6 text-white/20" size={64} />
                <span className="text-sm font-black uppercase tracking-[0.3em]">Cargando...</span>
              </div>
            ) : view === 'CATEGORIES' ? (
              <div className="h-full flex flex-col items-center justify-center animate-fade-in py-10 overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl w-full space-y-16">
                  {/* Options Section (Up) */}
                  {groups.filter(g => g.type === 'OPTION').length > 0 && (
                    <div className="space-y-10">
                      <div className="flex items-center gap-6">
                        <div className="h-[1px] flex-1 bg-white/5" />
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] whitespace-nowrap opacity-60">Opciones Seleccionables</h4>
                        <div className="h-[1px] flex-1 bg-white/5" />
                      </div>
                      <div className="flex flex-wrap justify-center gap-6">
                        {groups.filter(g => g.type === 'OPTION').map(grp => {
                          const qtyInGroup = selectedItems.filter(i => i.group_id === grp.id).reduce((sum, i) => sum + i.quantity, 0);
                          const hasRequired = qtyInGroup >= grp.min_selection;
                          return (
                            <button
                              key={grp.id}
                              onClick={() => {
                                setSelectedGroupId(grp.id);
                                setView('DETAIL');
                              }}
                              className={`group w-64 h-24 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1.5 relative overflow-hidden ${selectedGroupId === grp.id
                                ? 'bg-white/5 border-white/20 shadow-xl shadow-white/5'
                                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10'
                                }`}
                            >
                              <span className={`text-base font-black uppercase tracking-tight transition-transform group-hover:scale-105 ${hasRequired ? 'text-white' : 'text-white'}`}>
                                {grp.group_prompt || grp.name}
                              </span>
                              {qtyInGroup > 0 && (
                                <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg ${hasRequired ? 'bg-white/20 text-white border border-white/20' : 'bg-white/20 text-white/60'}`}>
                                  {qtyInGroup}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Horizontal Separator Line */}
                  {groups.filter(g => g.type === 'OPTION').length > 0 && groups.filter(g => g.type === 'MODIFIER').length > 0 && (
                    <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent py-4" />
                  )}

                  {/* Modifiers Section (Down) */}
                  {groups.filter(g => g.type === 'MODIFIER').length > 0 && (
                    <div className="space-y-10">
                      <div className="flex items-center gap-6">
                        <div className="h-[1px] flex-1 bg-white/5" />
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] whitespace-nowrap opacity-60">Modificadores Adicionales</h4>
                        <div className="h-[1px] flex-1 bg-white/5" />
                      </div>
                      <div className="flex flex-wrap justify-center gap-6">
                        {groups.filter(g => g.type === 'MODIFIER').map(grp => {
                          const qtyInGroup = selectedItems.filter(i => i.group_id === grp.id).reduce((sum, i) => sum + i.quantity, 0);
                          const hasRequired = qtyInGroup >= grp.min_selection;
                          return (
                            <button
                              key={grp.id}
                              onClick={() => { setSelectedGroupId(grp.id); setView('DETAIL'); }}
                              className={`group w-64 h-24 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1.5 relative overflow-hidden ${selectedGroupId === grp.id
                                ? 'bg-white/5 border-white/20 shadow-xl shadow-white/5'
                                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10'
                                }`}
                            >
                              <span className={`text-base font-black uppercase tracking-tight transition-transform group-hover:scale-105 ${qtyInGroup > 0 ? 'text-white' : 'text-white'}`}>
                                {grp.group_prompt || grp.name}
                              </span>
                              {qtyInGroup > 0 && (
                                <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg ${hasRequired ? 'bg-white/20 text-white border border-white/20' : 'bg-white/20 text-white/60'}`}>
                                  {qtyInGroup}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : currentGroup ? (
              <div className="h-full flex flex-col animate-fade-in-right">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setView('CATEGORIES')}
                      className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-all text-gray-400 hover:text-white group"
                    >
                      <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                      <h4 className="text-2xl font-black text-white uppercase tracking-tight">{currentGroup.group_prompt || currentGroup.name}</h4>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">
                        {currentGroup.max_selection === 0 ? 'Selección Ilimitada' : currentGroup.min_selection > 0 ? `Selección Obligatoria (${currentGroup.min_selection})` : 'Selección Opcional'}
                        {currentGroup.max_selection > 0 && ` • Máximo ${currentGroup.max_selection}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setView('CATEGORIES')}
                    className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 border border-white/10"
                  >
                    Listo
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 xxl:grid-cols-6 gap-4">
                  {currentGroup.items.map(item => {
                    const selection = selectedItems.find(i => i.id === item.id);
                    const qty = selection?.quantity || 0;
                    const grpQty = selectedItems.filter(i => i.group_id === item.group_id).reduce((sum, i) => sum + i.quantity, 0);
                    const isDisabled = qty === 0 && currentGroup.max_selection > 0 && grpQty >= currentGroup.max_selection;

                    return (
                      <div key={item.id} className="relative group">
                        <button
                          disabled={isDisabled}
                          onClick={() => incrementItem(item)}
                          onDoubleClick={() => handleDoubleClick(item)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                          className={`w-full h-32 px-5 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1.5 overflow-hidden ${qty > 0
                            ? 'bg-white/5 border-white/20 shadow-xl shadow-white/5'
                            : isDisabled
                              ? 'bg-transparent border-white/5 opacity-10 pointer-events-none'
                              : 'bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.06]'
                            }`}
                        >
                          <span className={`text-base font-black uppercase tracking-tight text-center leading-tight ${qty > 0 ? 'text-white' : 'text-white'}`}>
                            {item.display_name || item.name}
                          </span>
                          {(item.min_quantity > 0 || item.max_quantity > 0) && (
                            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                              {item.max_quantity > 0 ? `Min: ${item.min_quantity} / Máx: ${item.max_quantity}` : `Mínimo: ${item.min_quantity}`}
                            </span>
                          )}
                          {item.extra_price > 0 && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${qty > 0 ? 'bg-white/20 text-white border border-white/10' : 'bg-white/5 text-gray-400 border border-white/5'}`}>
                              +Q{item.extra_price.toFixed(2)}
                            </span>
                          )}
                          {qty === 0 && !isDisabled && (item.type === 'ADD' ? <Plus size={16} className="absolute top-4 right-4 text-white/10" /> : <Minus size={16} className="absolute top-4 right-4 text-white/10" />)}
                          {qty > 0 && (
                            <div className="absolute top-2 left-3 px-2 py-0.5 bg-white/10 rounded-full text-[8px] font-black text-white uppercase tracking-tighter border border-white/10">
                              x{qty}
                            </div>
                          )}
                        </button>

                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* Right: Summary Sidebar */}
          <div className="w-[320px] bg-[#111318] border-l border-white/5 flex flex-col p-5 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

            <div className="relative z-10 flex flex-col h-full">
              {/* Items Detail Area */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-4">
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 mb-3 flex justify-between items-center transition-all">
                  <div className="flex-1">
                    <span className="text-xs font-black text-white uppercase block leading-tight">{product.name}</span>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Precio Base: Q{Number(product.price).toFixed(2)}</span>
                  </div>
                  {itemQuantity > 1 && (
                    <div className="bg-white/10 px-2.5 py-1 rounded-md">
                      <span className="text-[10px] font-black text-white">{itemQuantity}x</span>
                    </div>
                  )}
                </div>

                {selectedItems.map(mod => (
                  <div key={mod.id} className="group relative flex justify-between items-center py-2 px-4 rounded-xl bg-[#16191f] border border-white/5 animate-fade-in-right">
                    <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wide flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${mod.type === 'ADD' ? 'bg-white/40' : 'bg-white/20'}`}></div>
                      {mod.quantity > 1 && <span className="text-white/60 font-black">{mod.quantity}x</span>}
                      {mod.display_name || mod.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-white/40">
                        {mod.extra_price > 0 ? `+Q${(mod.extra_price * mod.quantity).toFixed(2)}` : '--'}
                      </span>
                      <button onClick={() => decrementItem(mod)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-all">
                        <Trash2 size={12} className="shrink-0" />
                      </button>
                    </div>
                  </div>
                ))}

                {notes && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <MessageSquare size={16} className="text-white/40" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Notas</span>
                      </div>
                      <button onClick={() => setNotes('')} className="text-[9px] font-bold text-white/40 uppercase tracking-widest hover:text-white Transition-all">Limpiar</button>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed bg-white/10 p-6 rounded-2xl border border-white/10">
                      "{notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex flex-col gap-2">
                  {/* Row 1: Square Action Buttons */}
                  <div className="flex gap-2 justify-between">
                    <button
                      onClick={() => setShowNotes(true)}
                      className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                    >
                      <MessageSquare size={18} />
                    </button>
                    <button
                      onClick={() => { setNotes(''); setSelectedItems([]); setItemQuantity(1); }}
                      className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-rose-500 transition-all active:scale-95"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => setItemQuantity(prev => Math.max(1, prev - 1))}
                      className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                    >
                      <Minus size={18} />
                    </button>
                    <button
                      onClick={() => setItemQuantity(prev => prev + 1)}
                      className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* Row 2: Main Confirmation & Price (Flat layout) */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <button
                      disabled={getValidationErrors().length > 0}
                      onClick={() => {
                        const transformedModifiers = selectedItems.map(item => ({
                          ...item,
                          name: item.name,
                          price: item.extra_price,
                          item_quantity: item.quantity
                        }));
                        onConfirm(product, transformedModifiers, notes, itemQuantity);
                        onClose();
                      }}
                      className="flex flex-col items-center justify-center gap-2 w-28 h-28 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 disabled:opacity-20 transition-all active:scale-95 group"
                    >
                      <Utensils size={32} className="text-white group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black text-white uppercase tracking-widest text-center leading-tight px-1">
                        {getValidationErrors().length > 0 ? 'Faltan requeridos' : 'Enviar a Comanda'}
                      </span>
                    </button>

                    <div className="text-right flex-1 pl-6">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1.5 border-b border-white/5 border-dashed pb-1.5">Sub-Total</p>
                      <p className="text-2xl font-black text-white tabular-nums tracking-tighter">
                        Q{calculateTotal().toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {getValidationErrors().length > 0 && (
                    <div className="space-y-2">
                      {getValidationErrors().map((err, i) => (
                        <p key={i} className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest flex items-center gap-2">
                          <X size={12} /> {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
};
