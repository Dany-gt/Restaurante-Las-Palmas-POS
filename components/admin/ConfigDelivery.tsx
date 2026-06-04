import React, { useState, useEffect } from 'react';
import { Bike, Globe, Plus, Trash2, Smartphone, CheckCircle, X, Loader2, Edit2, Shield } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';

export const ConfigDelivery: React.FC = () => {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [platforms, setPlatforms] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDriverModal, setShowDriverModal] = useState(false);
    const [showPlatformModal, setShowPlatformModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);

    const [driverForm, setDriverForm] = useState({
        name: '',
        vehicle_info: '',
        phone: '',
        status: 'active',
        branch_id: ''
    });

    const [platformForm, setPlatformForm] = useState({
        name: '',
        commission_percentage: '0',
        is_connected: true
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [driversRes, platformsRes, branchesRes] = await Promise.all([
                supabase.from('delivery_drivers').select('*, branch:branches(name)').order('name'),
                supabase.from('order_platforms').select('*').order('name'),
                supabase.from('branches').select('id, name').order('name')
            ]);
            setDrivers(driversRes.data || []);
            setPlatforms(platformsRes.data || []);
            setBranches(branchesRes.data || []);
        } catch (err) {
            console.error('Error fetching delivery data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveDriver = async () => {
        if (!driverForm.name) return;
        setLoading(true);
        try {
            const dataToSave = {
                ...driverForm,
                name: driverForm.name.toUpperCase(),
                vehicle_info: driverForm.vehicle_info.toUpperCase()
            };

            const { error } = editingItem
                ? await supabase.from('delivery_drivers').update(dataToSave).eq('id', editingItem.id)
                : await supabase.from('delivery_drivers').insert([dataToSave]);

            if (error) throw error;
            setShowDriverModal(false);
            setEditingItem(null);
            setDriverForm({ name: '', vehicle_info: '', phone: '', status: 'active', branch_id: '' });
            fetchData();
        } catch (error: any) {
            alert('Error al guardar repartidor: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlatform = async () => {
        if (!platformForm.name) return;
        setLoading(true);
        try {
            const dataToSave = {
                ...platformForm,
                name: platformForm.name.toUpperCase(),
                commission_percentage: parseFloat(platformForm.commission_percentage)
            };

            const { error } = editingItem
                ? await supabase.from('order_platforms').update(dataToSave).eq('id', editingItem.id)
                : await supabase.from('order_platforms').insert([dataToSave]);

            if (error) throw error;
            setShowPlatformModal(false);
            setEditingItem(null);
            setPlatformForm({ name: '', commission_percentage: '0', is_connected: true });
            fetchData();
        } catch (error: any) {
            alert('Error al guardar plataforma: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (table: string, id: string) => {
        if (!confirm('¿Seguro que desea eliminar este recurso?')) return;
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (!error) fetchData();
    };

    return (
        <div className="p-8 animate-fade-in max-w-7xl mx-auto w-full h-full overflow-y-auto pb-20">
            <div className="flex items-center justify-between mb-12">
                <div className="flex-1"></div>
                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setDriverForm({ name: '', vehicle_info: '', phone: '', status: 'active', branch_id: branches.length > 0 ? branches[0].id : '' });
                            setShowDriverModal(true);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-slate-800 px-6 py-3 rounded-2xl font-semibold text-[10px] tracking-widest uppercase transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={16} /> Nuevo Repartidor
                    </button>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setPlatformForm({ name: '', commission_percentage: '0', is_connected: true });
                            setShowPlatformModal(true);
                        }}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-800 px-6 py-3 rounded-2xl font-semibold text-[10px] tracking-widest uppercase transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={16} /> Nueva Plataforma
                    </button>
                </div>
            </div>

            {loading && drivers.length === 0 && platforms.length === 0 ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Drivers Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                            <Bike className="text-indigo-400" size={20} />
                            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Mis Repartidores</h3>
                        </div>
                        <div className="grid gap-4">
                            {drivers.map(driver => (
                                <div key={driver.id} className="admin-card p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-indigo-400">
                                            <Smartphone size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold uppercase tracking-tight text-white">{driver.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{driver.vehicle_info || 'SIN VEHÍCULO'}</span>
                                                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                                <span className="text-[9px] font-semibold text-indigo-400 uppercase tracking-widest">{driver.branch?.name || 'Sede Principal'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest ${driver.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                {driver.status === 'active' ? 'Libre' : 'Ocupado'}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 transition-all">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(driver);
                                                    setDriverForm({
                                                        name: driver.name,
                                                        vehicle_info: driver.vehicle_info || '',
                                                        phone: driver.phone || '',
                                                        status: driver.status,
                                                        branch_id: driver.branch_id || (branches.length > 0 ? branches[0].id : '')
                                                    });
                                                    setShowDriverModal(true);
                                                }}
                                                className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete('delivery_drivers', driver.id)} className="p-2 hover:bg-rose-500/10 rounded-lg text-rose-400">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Platforms Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                            <Globe className="text-emerald-400" size={20} />
                            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Plataformas Externas</h3>
                        </div>
                        <div className="grid gap-4">
                            {platforms.map(plat => (
                                <div key={plat.id} className="admin-card p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-emerald-400">
                                            <Globe size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold uppercase tracking-tight text-white">{plat.name}</h4>
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Comisión: {plat.commission_percentage}%</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-emerald-400">
                                            <CheckCircle size={16} />
                                            <span className="text-[10px] font-semibold uppercase tracking-widest">{plat.is_connected ? 'Conectado' : 'Desactivado'}</span>
                                        </div>
                                        <div className="flex gap-2 transition-all">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(plat);
                                                    setPlatformForm({
                                                        name: plat.name,
                                                        commission_percentage: plat.commission_percentage.toString(),
                                                        is_connected: plat.is_connected
                                                    });
                                                    setShowPlatformModal(true);
                                                }}
                                                className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete('order_platforms', plat.id)} className="p-2 hover:bg-rose-500/10 rounded-lg text-rose-400">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Driver Modal */}
            {showDriverModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 pointer-events-none">
                    <div className="absolute inset-0" onClick={() => setShowDriverModal(false)} />
                    <DraggableWindow>
                        <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-slide-up pointer-events-auto">
                            <div className="p-8 border-b border-slate-200 flex justify-between items-center bg-white/2">
                                <div>
                                    <h3 className="text-2xl font-semibold uppercase tracking-tighter text-slate-800">{editingItem ? 'Editar Repartidor' : 'Nuevo Repartidor'}</h3>
                                    <p className="text-[10px] font-medium text-slate-500 uppercase mt-1 tracking-widest">Personal de logística interna</p>
                                </div>
                                <button onClick={() => setShowDriverModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-800"><X size={24} /></button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Nombre Completo</label>
                                        <input value={driverForm.name} onChange={e => setDriverForm({ ...driverForm, name: e.target.value })} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 text-sm text-slate-800 font-medium" placeholder="EJ. JUAN PEREZ" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Vehículo</label>
                                            <input value={driverForm.vehicle_info} onChange={e => setDriverForm({ ...driverForm, vehicle_info: e.target.value })} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 text-sm text-slate-800 font-medium" placeholder="EJ. MOTO HONDA" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Teléfono</label>
                                            <input value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 text-sm text-slate-800 font-medium" placeholder="5555-5555" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Sucursal Asignada</label>
                                        <select
                                            value={driverForm.branch_id}
                                            onChange={e => setDriverForm({ ...driverForm, branch_id: e.target.value })}
                                            className="w-full min-w-[280px] bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 text-sm text-slate-800 font-medium appearance-none cursor-pointer"
                                        >
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleSaveDriver} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-slate-800 rounded-2xl font-semibold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95">
                                    {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : (editingItem ? 'Actualizar Repartidor' : 'Registrar Repartidor')}
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}

            {/* Platform Modal */}
            {showPlatformModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 pointer-events-none">
                    <div className="absolute inset-0" onClick={() => setShowPlatformModal(false)} />
                    <DraggableWindow>
                        <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-slide-up pointer-events-auto">
                            <div className="p-8 border-b border-slate-200 flex justify-between items-center bg-white/2">
                                <div>
                                    <h3 className="text-2xl font-semibold uppercase tracking-tighter text-slate-800">{editingItem ? 'Editar Plataforma' : 'Nueva Plataforma'}</h3>
                                    <p className="text-[10px] font-medium text-slate-500 uppercase mt-1 tracking-widest">Integraciones de pedidos externos</p>
                                </div>
                                <button onClick={() => setShowPlatformModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-800"><X size={24} /></button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Nombre de la Plataforma</label>
                                        <input value={platformForm.name} onChange={e => setPlatformForm({ ...platformForm, name: e.target.value })} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 text-sm text-slate-800 font-medium" placeholder="EJ. PEDIDOS YA" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">% Comisión</label>
                                            <input value={platformForm.commission_percentage} onChange={e => setPlatformForm({ ...platformForm, commission_percentage: e.target.value })} type="number" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 text-sm text-slate-800 font-medium" placeholder="0.00" />
                                        </div>
                                        <div className="flex flex-col justify-end pb-2">
                                            <label className="flex items-center justify-between cursor-pointer group p-2 bg-slate-50 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-semibold text-slate-500 group-hover:text-slate-800 uppercase tracking-widest">Activo</span>
                                                <div onClick={() => setPlatformForm({ ...platformForm, is_connected: !platformForm.is_connected })} className={`w-10 h-5 rounded-full p-0.5 transition-all ${platformForm.is_connected ? 'bg-emerald-600' : 'bg-slate-100'}`}>
                                                    <div className={`w-4 h-4 bg-white rounded-full transition-all transform ${platformForm.is_connected ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleSavePlatform} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-800 rounded-2xl font-semibold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95">
                                    {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : (editingItem ? 'Actualizar Plataforma' : 'Registrar Plataforma')}
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}
        </div>
    );
};
