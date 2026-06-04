import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Smartphone, Plus, Trash2, Edit2, Loader2, X, Save, ShieldCheck, Fingerprint, Check, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const ConfigWaiters: React.FC = () => {
    const [terminals, setTerminals] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // UI states
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('ALL');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean, terminal: any | null }>({
        x: 0, y: 0, visible: false, terminal: null
    });
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Form states
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        branch_id: '',
        is_enabled: true,
        mac_address: '',
        series: '',
        verification: '',
        activation: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [termRes, branchRes] = await Promise.all([
                supabase.from('waiter_terminals').select('*, branches(name)').order('created_at', { ascending: false }),
                supabase.from('branches').select('*').order('name', { ascending: true })
            ]);

            setTerminals(termRes.data || []);
            setBranches(branchRes.data || []);

            // Set default branch if available and none selected
            if (branchRes.data && branchRes.data.length > 0 && !formData.branch_id) {
                setFormData(prev => ({ ...prev, branch_id: branchRes.data[0].id }));
            }
        } catch (error) {
            console.error('Error fetching terminals data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('waiter-terminals-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_terminals' }, fetchData)
            .subscribe();

        const handleClickOutside = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', handleClickOutside);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const handleContextMenu = (e: React.MouseEvent, terminal: any | null = null) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = containerRef.current?.getBoundingClientRect();

        setContextMenu({
            x: e.clientX - (rect?.left || 0),
            y: e.clientY - (rect?.top || 0),
            visible: true,
            terminal: terminal
        });
    };

    const handleSave = async () => {
        if (!formData.name || !formData.branch_id) {
            notify.error('Por favor, ingresa el nombre de la estación y selecciona una sucursal.');
            return;
        }

        setIsSaving(true);
        try {
            const payloadData = {
                name: formData.name,
                branch_id: formData.branch_id,
                is_enabled: formData.is_enabled,
                mac_address: formData.mac_address,
                series: formData.series,
                verification: formData.verification,
                activation: formData.activation
            };

            let error;
            if (formData.id) {
                const res = await supabase.from('waiter_terminals').update(payloadData).eq('id', formData.id);
                error = res.error;
            } else {
                const res = await supabase.from('waiter_terminals').insert(payloadData);
                error = res.error;
            }

            if (error) throw error;

            setShowModal(false);
            fetchData();
            notify.success('Estación guardada correctamente');
        } catch (error: any) {
            notify.error('Error al guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            const { error } = await supabase.from('waiter_terminals').delete().eq('id', confirmDelete.id);
            if (error) throw error;
            fetchData();
            notify.success('Estación eliminada correctamente');
        } catch (error: any) {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const openModal = (terminal: any = null) => {
        if (terminal) {
            setFormData({
                id: terminal.id,
                name: terminal.name || '',
                branch_id: terminal.branch_id || (branches[0]?.id || ''),
                is_enabled: terminal.is_enabled ?? true,
                mac_address: terminal.mac_address || '',
                series: terminal.series || '',
                verification: terminal.verification || '',
                activation: terminal.activation || ''
            });
        } else {
            setFormData({
                id: '',
                name: '',
                branch_id: branches[0]?.id || '',
                is_enabled: true,
                mac_address: '',
                series: '',
                verification: '',
                activation: ''
            });
        }
        setShowModal(true);
    };

    const requestMacAddress = () => {
        // Simular obtención de MAC a través de agente/plugin local
        notify.info('Obteniendo MAC desde el agente local de Lector DigitalPersona U.are.U...');
        setTimeout(() => {
            setFormData(prev => ({
                ...prev,
                mac_address: '00:1A:2B:3C:4D:5E'
            }));
            notify.success('MAC obtenida correctamente: 00:1A:2B:3C:4D:5E');
        }, 800);
    };

    const filteredTerminals = useMemo(() => {
        return terminals.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.mac_address && item.mac_address.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesBranch = branchFilter === 'ALL' || item.branch_id === branchFilter;
            return matchesSearch && matchesBranch;
        });
    }, [terminals, searchTerm, branchFilter]);

    return (
        <div ref={containerRef} className="flex-1 flex flex-col bg-white overflow-hidden text-[11px] font-sans h-full select-none relative animate-fade-in">
            {/* Toolbar */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-2 space-y-2">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-slate-900 font-medium">Sucursal</span>
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 py-1 outline-none text-slate-900 font-medium focus:border-[#106ebe] shadow-sm transition-all text-[11px]"
                        >
                            <option value="ALL">TODAS LAS SUCURSALES</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar estación..."
                            className="bg-white border border-gray-400 rounded-sm px-2 py-1 text-[11px] w-72 outline-none text-slate-900 font-medium focus:border-[#106ebe] shadow-sm transition-all"
                        />
                        <button
                            onClick={fetchData}
                            className="bg-[#e1e1e1] border border-gray-400 px-6 py-1 text-[11px] font-medium hover:bg-[#d0d0d0] text-slate-900 shadow-sm rounded-sm transition-colors active:scale-95"
                        >
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Grid Area */}
            <div
                className="flex-1 overflow-auto bg-white relative"
                onContextMenu={(e) => handleContextMenu(e, null)}
            >
                <div className="min-w-full inline-block align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#e8e8e8] sticky top-0 z-10 border-b border-gray-400 select-none">
                            <tr className="h-8">
                                <th scope="col" className="px-6 py-2 text-left text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[50%]">
                                    Estación
                                </th>
                                <th scope="col" className="px-6 py-2 text-left text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[40%]">
                                    Dirección MAC
                                </th>
                                <th scope="col" className="px-6 py-2 text-center text-[10px] font-medium text-black uppercase w-[10%]">
                                    Habilitado
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading && filteredTerminals.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-20 text-center text-slate-500 font-medium italic">
                                        <Loader2 className="animate-spin text-[#106ebe] mx-auto" size={24} />
                                    </td>
                                </tr>
                            ) : terminals.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-20 text-center text-slate-500 font-medium italic">
                                        No hay estaciones de meseros creadas. <br />
                                        Haz clic derecho para registrar una nueva.
                                    </td>
                                </tr>
                            ) : filteredTerminals.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-20 text-center text-slate-500 font-medium italic">
                                        No se encontraron resultados para "{searchTerm}".
                                    </td>
                                </tr>
                            ) : (
                                filteredTerminals.map((item, index) => {
                                    const isSelected = formData.id === item.id;
                                    return (
                                        <tr
                                            key={item.id}
                                            onContextMenu={(e) => handleContextMenu(e, item)}
                                            onClick={() => setFormData(prev => ({ ...prev, id: item.id }))} // Just internal select logic
                                            onDoubleClick={() => openModal(item)}
                                            className={`h-6 transition-colors border-b border-gray-50 cursor-default ${isSelected
                                                ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                                                : 'text-slate-900 even:bg-slate-50/50 hover:bg-[#cce8ff]'
                                                }`}
                                        >
                                            <td className="px-4 font-medium flex items-center gap-2 h-6 border-r border-gray-100">
                                                <Monitor size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                                <span className="uppercase tracking-tight text-[10px]">{item.name}</span>
                                            </td>
                                            <td className="px-4 border-r border-gray-100 uppercase text-[10px] tracking-tight">
                                                <span className={isSelected ? 'text-blue-100' : 'text-slate-500'}>{item.mac_address || '---'}</span>
                                            </td>
                                            <td className="px-4 text-center">
                                                <div className="flex justify-center items-center h-full">
                                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${item.is_enabled ? (isSelected ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                        {item.is_enabled ? <Check size={10} strokeWidth={4} /> : <X size={10} strokeWidth={4} />}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    className="absolute z-[1000] bg-white border border-gray-400 shadow-[2px_2px_5px_rgba(0,0,0,0.2)] py-1 min-w-[220px]"
                    style={{ top: `${Math.min(contextMenu.y, (containerRef.current?.clientHeight || 0) - 150)}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => {
                            setContextMenu({ ...contextMenu, visible: false });
                            openModal(null);
                        }}
                        className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-medium transition-colors group text-slate-900"
                    >
                        <Plus size={14} className="group-hover:text-white text-emerald-600" /> Nuevo Registro
                    </button>

                    {contextMenu.terminal && (
                        <>
                            <div className="h-px bg-gray-200 my-1"></div>
                            <button
                                onClick={() => {
                                    setContextMenu({ ...contextMenu, visible: false });
                                    openModal(contextMenu.terminal);
                                }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-medium transition-colors group text-slate-900"
                            >
                                <Edit2 size={14} className="text-[#106ebe] group-hover:text-white" /> Modificar
                            </button>
                            <button
                                onClick={() => {
                                    setContextMenu({ ...contextMenu, visible: false });
                                    setConfirmDelete(contextMenu.terminal);
                                }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-medium transition-colors group text-slate-900"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Editing Modal */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[500px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col animate-slide-up pointer-events-auto">
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <h3 className="text-[12px] font-medium text-white tracking-wide flex items-center gap-2">
                                    Mantenimiento de Estaciones
                                </h3>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton
                                        onClick={handleSave}
                                        loading={isSaving}
                                        title="Guardar"
                                        variant="minimal"
                                    />
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1"
                                        title="Cerrar"
                                    >
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4 border-b border-gray-300">
                                {/* Datos de Estación Fieldset */}
                                <div className="border border-gray-400 p-3 pt-4 relative bg-[#f0f0f0] rounded-sm">
                                    <span className="text-[11px] text-slate-800 font-medium px-1 absolute -top-2.5 left-2 bg-[#f0f0f0]">Datos de Estación</span>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-800 w-[90px] text-right shrink-0">Estación</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="flex-1 bg-white border border-gray-400 rounded-sm px-2 py-0.5 outline-none text-slate-900 focus:border-[#106ebe] text-[11px] min-w-0"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-800 w-[90px] text-right shrink-0">Sucursal</label>
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <select
                                                    value={formData.branch_id}
                                                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                                    className="erp-input-field min-w-[280px] px-2 py-0.5 outline-none text-slate-900 focus:border-[#106ebe] text-[11px] min-w-0 truncate"
                                                >
                                                    {branches.map(b => (
                                                        <option key={b.id} value={b.id}>{b.name}</option>
                                                    ))}
                                                </select>

                                                <label className="flex items-center gap-1.5 cursor-pointer shrink-0 pr-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_enabled}
                                                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                                                        className="w-3 h-3 accent-[#106ebe] border-gray-400"
                                                    />
                                                    <span className="text-[11px] text-slate-800">Habilitado</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lector de Huella Fieldset */}
                                <div className="border border-gray-400 p-3 pt-4 relative bg-[#e6e6e6] rounded-sm">
                                    <span className="text-[11px] text-slate-800 font-medium px-1 absolute -top-2.5 left-2 bg-[#e6e6e6]">Lector de Huella</span>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-800 w-[90px] text-right shrink-0">Dirección MAC</label>
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <input
                                                    type="text"
                                                    value={formData.mac_address}
                                                    onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                                                    className="flex-1 bg-white border border-gray-400 rounded-sm px-2 py-0.5 outline-none text-slate-900 focus:border-[#106ebe] text-[11px] font-mono min-w-0"
                                                />
                                                <button
                                                    onClick={requestMacAddress}
                                                    className="bg-[#106ebe] text-white px-3 py-0.5 text-[11px] border border-blue-800 hover:bg-[#106ebe] active:bg-blue-800 whitespace-nowrap shrink-0 shadow-sm transition-colors rounded-sm"
                                                >
                                                    Obtener MAC
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-800 w-[90px] text-right shrink-0">Serie</label>
                                            <input
                                                type="text"
                                                value={formData.series}
                                                onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                                                className="flex-1 bg-white border border-gray-400 rounded-sm px-2 py-0.5 outline-none text-slate-900 focus:border-[#106ebe] text-[11px] min-w-0"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-800 w-[90px] text-right shrink-0">Verificación</label>
                                            <input
                                                type="text"
                                                value={formData.verification}
                                                onChange={(e) => setFormData({ ...formData, verification: e.target.value })}
                                                className="flex-1 bg-white border border-gray-400 rounded-sm px-2 py-0.5 outline-none text-slate-900 focus:border-[#106ebe] text-[11px] min-w-0"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-800 w-[90px] text-right shrink-0">Activación</label>
                                            <input
                                                type="text"
                                                value={formData.activation}
                                                onChange={(e) => setFormData({ ...formData, activation: e.target.value })}
                                                className="flex-1 bg-white border border-gray-400 rounded-sm px-2 py-0.5 outline-none text-slate-900 focus:border-[#106ebe] text-[11px] min-w-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
            {confirmDelete && (
                <WindowsConfirmModal
                    title="Confirmar Eliminación"
                    message="¿Estás seguro de que deseas eliminar esta estación permanentemente?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};
