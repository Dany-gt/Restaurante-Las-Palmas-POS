import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CheckCircle, ShoppingCart, Loader2, MessageSquare, ChevronRight, Hash, Trash2, Utensils, ArrowLeft, FileEdit } from 'lucide-react';
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
  image_url?: string;
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
          if (!lo.group_id) continue;
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
          if (!lm.group_id) continue;
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

      const assignedOptionGroupIds = legacyOpts?.map(lo => lo.group_id).filter(Boolean) || [];
      const assignedModifierGroupIds = legacyMods?.map(lm => lm.group_id).filter(Boolean) || [];

      if (assignedOptionGroupIds.length > 0) {
        const { data: optItems, error: optError } = await supabase
          .from('group_items')
          .select('*, products(*)')
          .in('option_group_id', assignedOptionGroupIds)
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true });

        console.log(`[POS Debug] Fetched ${optItems?.length || 0} option items. Error:`, optError);
        if (optItems) console.log('[POS Debug] Option Items Titles:', optItems.map(i => i.item_name || i.option_catalog?.item_name || i.products?.name));

        optItems?.forEach(item => {
          const cat = item.option_catalog || {};
          const prod = item.products || {};
          const grp = configMap.get(item.option_group_id);
          if (grp) {
            grp.items.push({
              id: item.id || `opt-${Math.random()}`,
              name: item.item_name || cat.item_name || prod.name || 'Sin Nombre',
              display_name: item.display_name || cat.display_name || prod.name || 'Sin Nombre',
              image_url: prod.image_url || null,
              color_code: item.color_code || cat.color_code,
              extra_price: item.extra_price ?? 0,
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
          .select('*, modifier_catalog(*), products(*)')
          .in('modifier_group_id', assignedModifierGroupIds)
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true });

        console.log(`[POS Debug] Fetched ${modItems?.length || 0} modifier items. Error:`, modError);
        if (modItems) console.log('[POS Debug] Modifier Items Titles:', modItems.map(i => i.item_name || i.modifier_catalog?.item_name || i.products?.name));

        modItems?.forEach(item => {
          const cat = item.modifier_catalog || {};
          const prod = item.products || {};
          const grp = configMap.get(item.modifier_group_id);
          if (grp) {
            grp.items.push({
              id: item.id || `mod-${Math.random()}`,
              name: item.item_name || cat.item_name || prod.name || 'Sin Nombre',
              display_name: item.display_name || cat.display_name || prod.name || 'Sin Nombre',
              image_url: prod.image_url || null,
              color_code: item.color_code || cat.color_code,
              extra_price: item.extra_price ?? cat.extra_price ?? prod.price ?? 0,
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
    const currentGroup = groups.find(g => g.id === item.group_id);
    if (!currentGroup) return;

    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      const grpQty = prev.filter(i => i.group_id === item.group_id).reduce((sum, i) => sum + i.quantity, 0);

      // Toggle Off: Si ya existe, al tocarlo lo quitamos
      if (existing) {
        return prev.filter(i => i.id !== item.id);
      }

      // Toggle On: Asignar de golpe el máximo permitido del grupo (si es 0, asigna 1), pero los modificadores siempre son 1
      const qtyToSet = currentGroup.type === 'MODIFIER' ? 1 : (currentGroup.max_selection > 0 ? currentGroup.max_selection : 1);

      // Comportamiento de Radio Button (Solo 1 opción permitida)
      if (currentGroup.max_selection === 1) {
        const withoutOthers = prev.filter(i => i.group_id !== item.group_id);
        return [...withoutOthers, { ...item, quantity: qtyToSet }];
      }
      // Comportamiento de Multi-Selección
      else {
        // Si ya hay otros ítems seleccionados que suman o superan el límite del grupo, no hacemos nada
        if (currentGroup.max_selection > 0 && grpQty >= currentGroup.max_selection) {
          return prev;
        }
        return [...prev, { ...item, quantity: qtyToSet }];
      }
    });

    // Regresar a la vista de categorías automáticamente solo para OPCIONES
    // Los modificadores permiten selección múltiple, así que no deben regresar automáticamente
    if (groups.length > 1 && currentGroup.type === 'OPTION') {
      setTimeout(() => {
        setView('CATEGORIES');
      }, 100);
    }
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
      if (grp.type === 'MODIFIER') return; // Modificadores no tienen límites
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2e303d] animate-fade-in font-sans">
      <div className="w-full h-full bg-[#2e303d] flex overflow-hidden relative">

        {/* Left Side (Header + Content) */}
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* Header - Left Area Only */}
          <div className="px-6 py-4 bg-[#2e303d] flex justify-between items-center shrink-0 border-b border-white/5">
            <button
              onClick={() => {
                if (view === 'DETAIL' && groups.length > 1) setView('CATEGORIES');
                else onClose();
              }}
              className="w-[2.5cm] h-[1.3cm] bg-[#3e4153] hover:bg-[#464859] text-gray-400 hover:text-white rounded-md transition-all flex items-center justify-center border border-white/5"
            >
              <ArrowLeft size={32} strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-3 text-[11px] sm:text-xs md:text-xs lg:text-sm font-semibold text-white uppercase tracking-wider">
              <span>Orden: #{orderNumber || '000'}</span>
              <span className="text-white/40">|</span>
              <span>{tableName || 'SIN MESA'}</span>
              <span className="text-white/40">|</span>
              <span>Atiende: {waiterName?.toUpperCase() || 'MESERO'}</span>
            </div>

            <button
              onClick={onClose}
              title="Regresar al Menú"
              className="w-[2.5cm] h-[1.3cm] bg-[#3e4153] hover:bg-[#464859] text-green-400 hover:text-green-300 rounded-md transition-all flex items-center justify-center border border-white/5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 14 4 9 9 4" />
                <path d="M20 20V9H4" />
              </svg>
            </button>
          </div>

          {/* Dynamic Notes Overlay */}
          {showNotes && (
            <div className="absolute inset-0 z-[110] bg-black/80  flex items-center justify-center p-4 sm:p-6 animate-fade-in">
              <div className="w-full max-w-xl bg-[#1c1f26] rounded-xl border border-white/10  /50 p-6 sm:p-8 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/20 text-white/60 rounded-xl flex items-center justify-center border border-white/10">
                    <FileEdit size={20} />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white uppercase tracking-tight">Instrucciones Especiales</h4>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-0.5">Notas opcionales para cocina</p>
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
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold uppercase tracking-widest py-4 rounded-xl transition-all active:scale-95  /5"
                  >
                    Confirmar Nota
                  </button>
                  <button
                    onClick={() => { setNotes(''); setShowNotes(false); }}
                    className="px-6 bg-white/5 hover:bg-white/10 text-gray-400 font-semibold uppercase tracking-widest py-4 rounded-xl transition-all"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Center: Layered Content */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${view === 'CATEGORIES' ? '' : 'p-12'}`}>

            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mb-6 text-white/20" size={64} />
                <span className="text-sm font-semibold uppercase tracking-[0.3em]">Cargando...</span>
              </div>
            ) : view === 'CATEGORIES' ? (
              <div className="h-full flex flex-col items-center animate-fade-in overflow-y-auto custom-scrollbar">

                {/* Options Section */}
                {groups.filter(g => g.type === 'OPTION').length > 0 && (
                  <div className="flex-1 w-full flex flex-col justify-center py-6">
                    <div className="max-w-4xl mx-auto w-full px-12">
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
                              className={`group w-[220px] h-20 rounded-md transition-all duration-300 flex flex-col items-center justify-center gap-1.5 relative overflow-hidden ${selectedGroupId === grp.id
                                ? 'bg-[#00609a] ring-2 ring-white shadow-lg'
                                : 'bg-[#004b79] hover:bg-[#005a8f] shadow-md'
                                }`}
                            >
                              <span className={`text-base font-semibold uppercase tracking-tight transition-transform group-hover:scale-105 text-white`}>
                                {grp.group_prompt || grp.name}
                              </span>
                              {(() => {
                                const min = grp.min_selection;
                                const max = grp.max_selection;
                                if (min === 0 && (max === 0 || max >= 99)) return null;
                                return (
                                  <div className="flex items-center gap-4 text-[10px] font-medium text-white/90 tracking-wide mt-1 transition-transform group-hover:scale-105">
                                    <span>Mínimo: {min}</span>
                                    <span>Máximo: {max >= 99 ? '∞' : max}</span>
                                  </div>
                                );
                              })()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Full-width Separator Line — edge to edge */}
                {groups.filter(g => g.type === 'OPTION').length > 0 && groups.filter(g => g.type === 'MODIFIER').length > 0 && (
                  <div className="w-full h-[1px] bg-white/15 flex-shrink-0" />
                )}

                {/* Modifiers Section */}
                {groups.filter(g => g.type === 'MODIFIER').length > 0 && (
                  <div className="flex-1 w-full flex flex-col justify-center py-6">
                    <div className="max-w-4xl mx-auto w-full px-12">
                      <div className="flex flex-wrap justify-center gap-6">
                        {groups.filter(g => g.type === 'MODIFIER').map(grp => {
                          const qtyInGroup = selectedItems.filter(i => i.group_id === grp.id).reduce((sum, i) => sum + i.quantity, 0);
                          const hasRequired = qtyInGroup >= grp.min_selection;
                          return (
                            <button
                              key={grp.id}
                              onClick={() => { setSelectedGroupId(grp.id); setView('DETAIL'); }}
                              className={`group w-[220px] h-20 rounded-md transition-all duration-300 flex flex-col items-center justify-center gap-1.5 relative overflow-hidden ${selectedGroupId === grp.id
                                ? 'bg-[#357a80] ring-2 ring-white shadow-lg'
                                : 'bg-[#2b6469] hover:bg-[#327379] shadow-md'
                                }`}
                            >
                              <span className={`text-base font-semibold uppercase tracking-tight transition-transform group-hover:scale-105 text-white`}>
                                {grp.group_prompt || grp.name}
                              </span>
                              {(() => {
                                const min = grp.min_selection;
                                const max = grp.max_selection;
                                if (min === 0 && (max === 0 || max >= 99)) return null;
                                return (
                                  <div className="flex items-center gap-4 text-[10px] font-medium text-white/90 tracking-wide mt-1 transition-transform group-hover:scale-105">
                                    <span>Mínimo: {min}</span>
                                    <span>Máximo: {max >= 99 ? '∞' : max}</span>
                                  </div>
                                );
                              })()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : currentGroup ? (
              <div className="h-full flex flex-col animate-fade-in-right pt-6 px-10">

                <div className={currentGroup.type === 'MODIFIER' ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 place-items-center max-w-5xl mx-auto w-full" : "flex flex-wrap justify-center gap-6"}>
                  {currentGroup.items.map(item => {
                    const selection = selectedItems.find(i => i.id === item.id);
                    const qty = selection?.quantity || 0;
                    const grpQty = selectedItems.filter(i => i.group_id === item.group_id).reduce((sum, i) => sum + i.quantity, 0);
                    const isDisabled = currentGroup.max_selection === 1
                      ? false
                      : (qty === 0 && currentGroup.max_selection > 0 && grpQty >= currentGroup.max_selection);

                    const isMod = currentGroup.type === 'MODIFIER';
                    const bgColor = item.color_code || (isMod ? '#b87333' : '');

                    return (
                      <div key={item.id} className="relative group">
                        <button
                          disabled={isDisabled}
                          onClick={() => incrementItem(item)}
                          onDoubleClick={() => handleDoubleClick(item)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                          style={bgColor ? {
                            backgroundColor: bgColor
                          } : undefined}
                          className={`${isMod ? 'w-[220px] h-20 rounded-md gap-1' : 'w-36 h-44 rounded-[16px] gap-1.5'} p-3 transition-all duration-200 flex flex-col items-center justify-center relative overflow-hidden ${bgColor
                            ? (qty > 0 ? 'brightness-110 shadow-[0_0_15px_rgba(255,255,255,0.2)] ring-2 ring-white' : 'hover:brightness-110 shadow-md')
                            : (qty > 0
                              ? 'bg-[#40465c] ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                              : isDisabled
                                ? 'bg-[#3b4156]/30 opacity-40 pointer-events-none'
                                : 'bg-[#3b4156] hover:bg-[#484f6a] shadow-md')
                            }`}
                        >
                          {/* Image Container (Only for Options, not Modifiers) */}
                          {!isMod && (
                            <div className="w-full h-20 flex items-center justify-center shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="max-w-full max-h-full object-contain drop-shadow-md" />
                              ) : (
                                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center">
                                  <span className="text-white/20 text-[9px] font-medium uppercase tracking-wider">Img</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Text Container */}
                          <span className={`text-[10px] font-semibold uppercase tracking-tight text-center leading-tight text-white line-clamp-3 px-1 ${!isMod ? 'mt-2' : ''}`}>
                            {item.display_name || item.name}
                          </span>

                          {/* Price */}
                          <span className={`${isMod ? 'text-[11px]' : 'text-[10px]'} font-medium text-white/80 shrink-0`}>
                            {item.extra_price > 0 && !isMod ? '+' : ''}Q{(Number(item.extra_price) || 0).toFixed(2)}
                          </span>

                          {/* Selected Badge eliminado a petición del usuario */}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Summary Sidebar */}
        <div className="w-[393px] bg-[#2e303d] border-l border-white/5 flex flex-col p-4 relative shrink-0">
          <div className="relative z-10 flex flex-col h-full">
            {/* Items Detail Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="bg-[#9093a2] py-2 px-3 flex justify-between items-center shadow-sm mb-1">
                <span className="text-xs font-medium text-white uppercase">
                  {itemQuantity > 1 ? `${itemQuantity} ` : ''}{product.name}
                </span>
                <span className="text-xs font-medium text-white">Q{((Number(product.price) || 0) * itemQuantity).toFixed(2)}</span>
              </div>

              {selectedItems.map(mod => (
                <div key={mod.id} className="group flex justify-between items-center py-2 px-3 bg-[#3e4153]/40 border-b border-[#3e4153] hover:bg-[#3e4153]/80 transition-colors">
                  <span className="text-xs font-medium text-white/90 uppercase pl-3 flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${mod.type === 'ADD' ? 'bg-white/60' : 'bg-white/30'}`}></div>
                    {mod.quantity > 1 ? `${mod.quantity} ` : ''}{mod.display_name || mod.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">
                      Q{((Number(mod.extra_price) || 0) * (mod.quantity || 1)).toFixed(2)}
                    </span>
                    <button onClick={() => decrementItem(mod)} title="Eliminar Modificador" className="opacity-0 group-hover:opacity-100 p-1 text-white/50 hover:text-white transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {notes && (
                <div className="mt-3 p-3 bg-white/5 rounded border border-white/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-medium text-white/50 uppercase">Notas</span>
                    <button onClick={() => setNotes('')} className="text-[10px] font-medium text-white/40 hover:text-white">Limpiar</button>
                  </div>
                  <p className="text-xs text-white/90">"{notes}"</p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="mt-3 flex flex-col gap-2.5">
              {/* Row 1: Square Action Buttons */}
              <div className="grid grid-cols-4 gap-2 h-[71px]">
                <button
                  onClick={() => setShowNotes(true)}
                  title="Agregar / Editar Nota Especial"
                  className="bg-white/5 border border-white/10 rounded-none flex items-center justify-center text-white transition-all active:scale-95 hover:bg-white/10"
                >
                  <FileEdit size={32} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => { setNotes(''); setSelectedItems([]); setItemQuantity(1); }}
                  title="Limpiar Selección y Notas"
                  className="bg-white/5 border border-white/10 rounded-none flex items-center justify-center text-white transition-all active:scale-95 hover:bg-white/10"
                >
                  <Trash2 size={32} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setItemQuantity(prev => Math.max(1, prev - 1))}
                  title="Restar Cantidad"
                  className="bg-white/5 border border-white/10 rounded-none flex items-center justify-center text-white transition-all active:scale-95 hover:bg-white/10"
                >
                  <Minus size={32} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setItemQuantity(prev => prev + 1)}
                  title="Sumar Cantidad"
                  className="bg-white/5 border border-white/10 rounded-none flex items-center justify-center text-white transition-all active:scale-95 hover:bg-white/10"
                >
                  <Plus size={32} strokeWidth={1.5} />
                </button>
              </div>

              {/* Row 2: Main Confirmation & Price */}
              <div className="flex items-center justify-between p-2 bg-[#3a3b4d] rounded-md border border-white/10 shadow-sm">
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
                  className="flex flex-col items-center justify-center w-[125px] h-[120px] bg-transparent border border-white/40 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all gap-1.5"
                >
                  <svg viewBox="0 0 100 100" className="w-[72px] h-[72px]" stroke="none" fill="none">
                    <defs>
                      <mask id="cutlery-mask">
                        {/* Make everything visible */}
                        <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
                        {/* Erase the circle line inside the fork handle */}
                        <rect x="33.25" y="80" width="4.5" height="10" fill="#000000" />
                        {/* Erase the circle line inside the spoon handle */}
                        <rect x="62.25" y="80" width="4.5" height="10" fill="#000000" />
                      </mask>
                    </defs>
                    <style>{`
                      .solid-cutlery {
                        fill: none !important;
                        stroke: #ffffff !important;
                        stroke-width: 2.5px !important;
                        stroke-linecap: round !important;
                        stroke-linejoin: round !important;
                      }
                      .ring-line {
                        fill: none !important;
                        stroke: #ffffff !important;
                        stroke-width: 2.5px !important;
                      }
                    `}</style>
                    {/* Outer Ring */}
                    <circle cx="50" cy="50" r="44" className="ring-line" />

                    {/* Inner Ring - Perfect Circle with Mask applied */}
                    <circle cx="50" cy="50" r="37" className="ring-line" mask="url(#cutlery-mask)" />

                    {/* Fork (left) - Left outer boundary */}
                    <path
                      d="M 27.5 30 L 27.5 50 C 27.5 56, 32 58, 32 60 L 32 82.3"
                      className="solid-cutlery"
                    />

                    {/* Fork (left) - Right outer boundary */}
                    <path
                      d="M 39 85.3 L 39 60 C 39 58, 43.5 56, 43.5 50 L 43.5 30"
                      className="solid-cutlery"
                    />

                    {/* Fork (left) - Middle prongs */}
                    <path
                      d="M 32.8 30 L 32.8 54"
                      className="solid-cutlery"
                    />
                    <path
                      d="M 38.2 30 L 38.2 54"
                      className="solid-cutlery"
                    />

                    {/* Spoon (right) - Seamless path ending on the circle points */}
                    <path
                      d="M 61 85.3 L 61 62 C 59 60, 56.5 58, 56.5 52 C 56.5 46, 56.5 30, 64.5 30 C 72.5 30, 72.5 46, 72.5 52 C 72.5 58, 70 60, 68 62 L 68 82.3"
                      className="solid-cutlery"
                    />
                  </svg>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider text-center px-1 whitespace-nowrap">
                    {getValidationErrors().length > 0 ? 'Faltan' : 'Enviar a Comanda'}
                  </span>
                </button>

                <div className="flex-1 flex flex-col justify-end pl-4 pb-1 h-[120px]">
                  <div className="flex justify-between items-baseline border-t border-white/10 border-dashed pt-1 w-full">
                    <span className="text-[11px] font-semibold text-white">Sub-Total</span>
                    <span className="text-[11px] font-semibold text-white tabular-nums">
                      Q{(calculateTotal() || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {getValidationErrors().length > 0 && (
                <div className="space-y-1 mt-1">
                  {getValidationErrors().map((err, i) => (
                    <p key={i} className="text-[9px] font-medium text-red-400 uppercase flex items-center gap-1">
                      <X size={10} /> {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
