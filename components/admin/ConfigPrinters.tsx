import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Printer, Plus, Trash2, Loader2, X, CheckCircle, Wifi, Usb, Monitor,
    Search, RefreshCw, Save, Edit3, Star, Check, Smartphone, Building2
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { printService } from '../../services/PrintService';


export const ConfigPrinters: React.FC = () => {
    const [printers, setPrinters] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<any | null>(null);
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
    const [localSearch, setLocalSearch] = useState('');
    const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, printer: any } | null>(null);
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const defaultFormData = {
        name: '',
        connection_type: 'SYSTEM',
        address: '',
        port: 9100,
        paper_width: '80mm',
        is_active: true,
        branch_id: '',
        opens_cash_drawer: false
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [systemPrinters, setSystemPrinters] = useState<any[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);

    const detectPrinters = async () => {
        const electron = (window as any).electronAPI || (window as any).electron;
        if (!electron) {
            notify.info('La detección automática solo funciona en la versión de escritorio.');
            return;
        }
        setIsDetecting(true);
        try {
            const list = await electron.getPrinters();
            setSystemPrinters(list);
            if (list.length > 0) {
                notify.success(`${list.length} impresoras detectadas en Windows`);
            } else {
                notify.alert('No se encontraron impresoras instaladas en este equipo');
            }
        } catch (err) {
            console.error(err);
            notify.error('Error al consultar drivers de impresión');
        } finally {
            setIsDetecting(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log('📡 [ConfigPrinters] Cargando impresoras...');
            const [{ data: printersData, error: pError }, { data: branchesData, error: bError }] = await Promise.all([
                supabase.from('printers').select('*, branch:branches(name)').order('name'),
                supabase.from('branches').select('*').order('name')
            ]);
            
            if (pError) console.error('Error printers:', pError);
            if (bError) console.error('Error branches:', bError);
            
            console.log(`✅ [ConfigPrinters] ${printersData?.length || 0} impresoras cargadas.`);
            setPrinters(printersData || []);
            setBranches(branchesData || []);
        } catch (err) {
            console.error('Catch error fetchData:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Detectamos impresoras al montar si estamos en electron
        const electron = (window as any).electronAPI || (window as any).electron;
        if (electron) detectPrinters();
    }, []);

    const handleSave = async () => {
        if (!formData.name) {
            notify.error('El nombre es obligatorio');
            return;
        }
        setIsSaving(true);
        
        // Limpiamos datos según el tipo de conexión
        const dataToSave = {
            ...formData,
            name: formData.connection_type === 'SYSTEM' ? formData.name : formData.name.toUpperCase(),
            address: formData.connection_type === 'NETWORK' ? formData.address : null,
            port: formData.connection_type === 'NETWORK' ? formData.port : null
        };

        console.log('💾 [ConfigPrinters] Guardando impresora:', dataToSave);

        try {
            const { data, error } = editingPrinter
                ? await supabase.from('printers').update(dataToSave).eq('id', editingPrinter.id).select()
                : await supabase.from('printers').insert([dataToSave]).select();

            if (error) throw error;
            console.log('✅ [ConfigPrinters] Guardado exitoso:', data);
            
            setShowModal(false);
            await fetchData(); // Recarga completa
            notify.success('Punto de impresión guardado correctamente');
        } catch (error: any) {
            console.error('❌ [ConfigPrinters] Error al guardar:', error);
            notify.error('Error al guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('printers').delete().eq('id', confirmDelete.id);
        if (!error) {
            fetchData();
            notify.success('Punto de impresión eliminado correctamente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const openEdit = (printer: any) => {
        setEditingPrinter(printer);
        setFormData({
            name: printer.name,
            connection_type: printer.connection_type,
            address: printer.address || '',
            port: printer.port || 9100,
            paper_width: printer.paper_width || '80mm',
            is_active: printer.is_active,
            branch_id: printer.branch_id || '',
            opens_cash_drawer: printer.opens_cash_drawer || false
        });
        setShowModal(true);
    };

    const filteredPrinters = printers.filter(p => {
        const matchesBranch = selectedBranchFilter === 'ALL' || p.branch_id === selectedBranchFilter;
        const matchesSearch = p.name.toLowerCase().includes(localSearch.toLowerCase()) ||
            (p.branch?.name || '').toLowerCase().includes(localSearch.toLowerCase());
        return matchesBranch && matchesSearch;
    });

    return (
        <div
            className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden"
            ref={containerRef}
            onClick={() => setContextMenu(null)}
        >
            {/* Toolbar Principal - Estilo ERP */}
            <div className="bg-white border-b border-gray-300 p-2 flex flex-wrap items-center gap-4 shrink-0 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-tighter">Sucursal</span>
                    <select
                        value={selectedBranchFilter}
                        onChange={(e) => setSelectedBranchFilter(e.target.value)}
                        className="h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-medium text-[#106ebe] outline-none min-w-[280px]"
                    >
                        <option value="ALL">TODAS LAS SUCURSALES</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={detectPrinters}
                        disabled={isDetecting}
                        className="h-7 px-3 bg-blue-50 text-[#106ebe] hover:bg-[#106ebe] hover:text-white text-[10px] font-medium uppercase rounded border border-blue-200 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isDetecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Detectar Drivers
                    </button>
                </div>

                <div className="flex-1 max-w-md flex items-center gap-1 ml-auto">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Introduzca el texto a buscar..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            className="w-full h-7 pl-8 pr-3 bg-white border border-gray-300 rounded text-[11px] font-medium outline-none focus:border-[#106ebe]"
                        />
                        <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400" />
                    </div>
                    <button className="h-7 px-4 bg-gray-100 hover:bg-[#106ebe] hover:text-white text-gray-600 text-[10px] font-semibold uppercase tracking-widest rounded transition-all border border-gray-200">
                        Buscar
                    </button>
                </div>
            </div>

            {/* Contenedor de Tabla */}
            <div
                className="flex-1 overflow-auto bg-white custom-scrollbar"
                onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), printer: null });
                }}
            >
                {loading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#106ebe]" size={32} /></div>
                ) : (
                    <table className="w-full border-collapse text-[11px]">
                        <thead className="sticky top-0 z-20 bg-[#e8e8e8] select-none">
                            <tr className="border-b border-gray-400 h-10">
                                <th className="px-6 py-2 text-left text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[35%] transition-all">Nombre</th>
                                <th className="px-6 py-2 text-left text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[35%]">Impresora</th>
                                <th className="px-6 py-2 text-center text-[10px] font-medium text-black uppercase w-[15%]">Habilitado</th>
                                <th className="px-6 py-2 text-center text-[10px] font-medium text-black uppercase w-[15%]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredPrinters.map((p, index) => (
                                <tr
                                    key={p.id}
                                    onClick={() => setSelectedPrinterId(p.id)}
                                    onDoubleClick={() => openEdit(p)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedPrinterId(p.id);
                                        const rect = containerRef.current?.getBoundingClientRect();
                                        setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), printer: p });
                                    }}
                                    className={`h-6 transition-colors cursor-default relative border-b border-gray-50 ${
                                        selectedPrinterId === p.id
                                            ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                                            : index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'
                                    } text-slate-900`}
                                >
                                    <td className="px-4 font-medium flex items-center gap-2 h-6 border-r border-gray-100">
                                        <Printer size={12} className={selectedPrinterId === p.id ? 'text-white' : 'text-slate-400'} />
                                        <span className="uppercase tracking-tight text-[10px]">{p.name}</span>
                                    </td>
                                    <td className="px-4 border-r border-gray-100">
                                        <span className={`uppercase tracking-tight text-[10px] ${selectedPrinterId === p.id ? 'text-blue-100' : 'text-slate-500 font-medium'}`}>
                                            {p.connection_type === 'SYSTEM' ? p.name : (p.address || 'LOCAL/USB')}
                                        </span>
                                    </td>
                                    <td className="px-4 border-r border-gray-100">
                                        <div className="flex justify-center items-center h-full">
                                            <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${p.is_active ? (selectedPrinterId === p.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                {p.is_active && <Check size={10} strokeWidth={4} />}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4">
                                        <div className="flex justify-center items-center h-full gap-2">
                                            <button 
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    notify.info('Iniciando prueba de impresión...');
                                                    try {
                                                        const testHtml = `
                                                            <div style="text-align:center; font-family: sans-serif; padding: 20px;">
                                                                <h2 style="margin:0;">PRUEBA POS</h2>
                                                                <p style="font-size:12px;">Punto: ${p.name}</p>
                                                                <p style="font-size:10px;">${new Date().toLocaleString()}</p>
                                                                <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
                                                                <p style="font-size:14px; font-weight:bold;">¡CONEXIÓN EXITOSA!</p>
                                                            </div>
                                                        `;
                                                        
                                                        const electron = (window as any).electronAPI;
                                                        if (!electron) {
                                                            notify.alert('Función solo disponible en Electron');
                                                            return;
                                                        }

                                                        let result;
                                                        if (p.connection_type === 'SYSTEM') {
                                                            result = await electron.printHtml(testHtml, p.name, true);
                                                        } else if (p.connection_type === 'NETWORK') {
                                                            // Usamos el nuevo traductor ESC/POS
                                                            const rawContent = (printService as any).htmlToEscPos(testHtml);
                                                            result = await electron.printToNetwork(p.address, p.port || 9100, rawContent, true);
                                                        }

                                                        if (result?.success) {
                                                            notify.success('Prueba enviada correctamente');
                                                        } else {
                                                            notify.error('Fallo en la prueba: ' + (result?.error || 'Error desconocido'));
                                                        }
                                                    } catch (err: any) {
                                                        notify.error('Error: ' + err.message);
                                                    }
                                                }}
                                                className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase transition-all ${
                                                    selectedPrinterId === p.id 
                                                        ? 'bg-white text-[#106ebe] hover:bg-blue-50' 
                                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                                }`}
                                            >
                                                Prueba
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Menú Contextual */}
            {contextMenu && (
                <div
                    className="absolute z-[1000] bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-75"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => { setEditingPrinter(null); setFormData(defaultFormData); setShowModal(true); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                    >
                        <Plus size={14} className="text-emerald-500 group-hover:text-white" /> Nuevo Registro
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    {contextMenu.printer && (
                        <>
                            <button
                                onClick={() => { openEdit(contextMenu.printer); setContextMenu(null); }}
                                className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Edit3 size={14} className="text-[#106ebe] group-hover:text-white" /> Editar Configuración
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => { setConfirmDelete(contextMenu.printer); setContextMenu(null); }}
                                className="w-full text-left px-4 py-2 text-[11px] font-medium text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar Registro
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                        </>
                    )}
                    <button
                        onClick={() => { fetchData(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-600 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                    >
                        <RefreshCw size={14} className="text-gray-400 group-hover:text-white" /> Refrescar
                    </button>
                </div>
            )}

            {/* Modal de Mantenimiento de Puntos de Impresión */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[600px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col animate-slide-up pointer-events-auto">
                            {/* Header del Modal */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <Printer size={14} className="text-white" />
                                    <span className="text-white text-[12px] font-medium tracking-wide">Mantenimiento de Punto de Impresión</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton
                                        onClick={handleSave}
                                        loading={isSaving}
                                        title="Guardar"
                                        variant="minimal"
                                    />
                                    <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4 border-b border-gray-300">
                                {/* Datos del Punto de Impresión */}
                                <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
                                    <div className="bg-[#cbd5e1] px-3 py-1 border-b border-gray-300">
                                        <span className="text-[11px] font-medium text-[#106ebe] uppercase tracking-tighter">Datos Punto de Impresión</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Nombre</label>
                                            <div className="flex gap-2">
                                                <input
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: formData.connection_type === 'SYSTEM' ? e.target.value : e.target.value.toUpperCase() })}
                                                    type="text"
                                                    placeholder="Nombre descriptivo o Driver..."
                                                    className="flex-1 h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-medium text-[#106ebe] outline-none focus:border-[#106ebe]"
                                                />
                                                {formData.connection_type === 'SYSTEM' && systemPrinters.length > 0 && (
                                                    <select
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-[200px] h-7 bg-emerald-50 border border-emerald-200 rounded px-1 text-[10px] font-semibold text-emerald-700 outline-none"
                                                    >
                                                        <option value="">USAR DRIVER DETECTADO...</option>
                                                        {systemPrinters.map(p => (
                                                            <option key={p.name} value={p.name}>{p.name.toUpperCase()}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Impresora</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <select
                                                    value={formData.connection_type}
                                                    onChange={e => setFormData({ ...formData, connection_type: e.target.value })}
                                                    className="h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-medium text-[#106ebe] outline-none"
                                                >
                                                    <option value="SYSTEM">SISTEMA (WINDOWS)</option>
                                                    <option value="NETWORK">RED (IP)</option>
                                                    <option value="USB">USB</option>
                                                </select>
                                                {formData.connection_type === 'NETWORK' ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={formData.address}
                                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                            type="text"
                                                            placeholder="192.168.1.100"
                                                            className="flex-1 h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-medium text-[#106ebe] outline-none"
                                                        />
                                                        <input
                                                            value={formData.port}
                                                            onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 9100 })}
                                                            type="number"
                                                            placeholder="9100"
                                                            className="w-20 h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-medium text-[#106ebe] outline-none"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                const ok = await printService.checkConnection(formData.address, formData.port);
                                                                if (ok) notify.success('Conexión exitosa');
                                                                else notify.error('No se pudo establecer conexión');
                                                            }}
                                                            className="px-2 h-7 bg-indigo-50 text-indigo-600 text-[9px] font-semibold uppercase rounded border border-indigo-100"
                                                        >
                                                            Probar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="h-7 px-2 flex items-center text-[10px] text-gray-400">
                                                        {formData.connection_type === 'SYSTEM' ? (
                                                            <button 
                                                                onClick={detectPrinters}
                                                                className="text-[#106ebe] hover:underline font-medium"
                                                            >
                                                                Refrescar drivers instalados
                                                            </button>
                                                        ) : 'Puerto local'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Tamaño Papel</label>
                                            <select
                                                value={formData.paper_width}
                                                onChange={e => setFormData({ ...formData, paper_width: e.target.value })}
                                                className="h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-medium text-[#106ebe] outline-none w-[120px]"
                                            >
                                                <option value="80mm">80MM (ESTÁNDAR)</option>
                                                <option value="58mm">58MM (MINI)</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Sucursal</label>
                                            <div className="flex items-center justify-between gap-4">
                                                <select
                                                    value={formData.branch_id}
                                                    onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                                                    className="h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-medium text-[#106ebe] outline-none flex-1 min-w-[280px]"
                                                >
                                                    <option value="">SELECCIONAR SUCURSAL...</option>
                                                    {branches.map(branch => (
                                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Opciones</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                                    <div
                                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                                        className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${formData.is_active ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300'}`}
                                                    >
                                                        {formData.is_active && <Check size={12} strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[11px] font-medium text-gray-700">Impresora Habilitada</span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer select-none group">
                                                    <div
                                                        onClick={() => setFormData({ ...formData, opens_cash_drawer: !formData.opens_cash_drawer })}
                                                        className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-all ${formData.opens_cash_drawer ? 'bg-[#106ebe] border-[#106ebe] text-white shadow-sm' : 'bg-white border-gray-300 group-hover:border-[#106ebe]'}`}
                                                    >
                                                        {formData.opens_cash_drawer && <Check size={12} strokeWidth={4} />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-medium text-[#106ebe] uppercase tracking-tighter">Gaveta de Dinero</span>
                                                        <span className="text-[9px] text-gray-500">Activa el pulso de apertura al imprimir</span>
                                                    </div>
                                                </label>
                                            </div>
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
                    message="¿Desea eliminar este punto de impresión?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};
