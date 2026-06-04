import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Upload, Trash2, Play, Loader2, Check, AlertCircle, Edit2, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { getSecureSoundUrl } from '../../utils/supabaseUtils';

interface Sound {
    id: string;
    name: string;
    file_url: string;
    file_size: number | null;
    mime_type: string | null;
    duration_seconds: number | null;
    is_active: boolean;
    created_at: string;
}

export const ConfigSoundsCard: React.FC = () => {
    const [sounds, setSounds] = useState<Sound[]>([]);
    const [settings, setSettings] = useState({
        defaultSoundId: '',
        waiterSoundId: '',
        posNotificationSoundId: '',
        posWarningSoundId: '',
        enabled: true,
        volume: 0.8,
        voiceVolume: 1.0,
        voicePhrase: 'Nueva orden en cocina'
    });
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const notify = useNotify();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [playing, setPlaying] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, sound: Sound } | null>(null);
    const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetchSounds();
        fetchSettings();
    }, []);

    const fetchSounds = async () => {
        try {
            const { data } = await supabase
                .from('sound_library')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (data) {
                setSounds(data);
            }
        } catch (error) {
            console.error('Error fetching sounds:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (data) {
                console.log('📊 KDS: Sound Settings Loaded:', data);
                setSettings({
                    defaultSoundId: data.kds_default_sound_id || '',
                    waiterSoundId: (data as any).waiter_sound_id || '',
                    posNotificationSoundId: (data as any).pos_notification_sound_id || '',
                    posWarningSoundId: (data as any).pos_warning_sound_id || '',
                    enabled: data.kds_alert_enabled ?? true,
                    volume: data.kds_alert_volume ?? 0.8,
                    voiceVolume: (data as any).kds_voice_volume ?? 1.0,
                    voicePhrase: (data as any).kds_voice_phrase || 'Nueva orden en cocina'
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        console.log('Starting upload for file:', file.name, 'Size:', file.size, 'Type:', file.type);

        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/x-wav'];
        if (!validTypes.includes(file.type)) {
            console.warn('Invalid file type:', file.type);
            notify.error(`Formato no válido (${file.type}). Use MP3, WAV o OGG.`);
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            notify.error('El archivo es muy grande. Máximo 5MB.');
            return;
        }

        setUploading(true);
        // Message removal handled by notify
        try {
            // Upload file to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `kds-alert-${Date.now()}.${fileExt}`;

            console.log('Uploading to storage bucket "kds-sounds" as:', fileName);
            const { error: uploadError } = await supabase.storage
                .from('kds-sounds')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Storage upload error:', uploadError);
                throw new Error(`Error de Storage: ${uploadError.message}`);
            }

            console.log('Upload successful, getting public URL...');
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('kds-sounds')
                .getPublicUrl(fileName);

            console.log('Public URL retrieved:', publicUrl);

            // Get audio duration with safety timeout
            console.log('Calculating audio duration...');
            const duration = await new Promise<number>((resolve) => {
                const audio = new Audio(URL.createObjectURL(file));
                const timeout = setTimeout(() => {
                    console.warn('Duration calculation timed out, defaulting to 0');
                    resolve(0);
                }, 3000);

                audio.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    console.log('Duration calculated:', audio.duration);
                    resolve(audio.duration);
                };

                audio.onerror = () => {
                    clearTimeout(timeout);
                    console.warn('Error loading audio metadata, defaulting to 0');
                    resolve(0);
                };
            });

            console.log('Inserting into database "sound_library"...');
            // Insert into sound_library
            const { error: insertError } = await supabase
                .from('sound_library')
                .insert({
                    name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                    file_url: publicUrl,
                    file_size: file.size,
                    mime_type: file.type,
                    duration_seconds: Math.round(duration * 100) / 100,
                    is_active: true
                });

            if (insertError) {
                console.error('Database insert error:', insertError);
                throw new Error(`Error de Base de Datos: ${insertError.message}`);
            }

            console.log('Process complete!');
            await fetchSounds();
            notify.success('Sonido subido exitosamente');
        } catch (error: any) {
            console.error('Upload process failed:', error);
            notify.error(error.message || 'Error al subir el archivo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            // Reset the input so the same file can be uploaded again
            e.target.value = '';
        }
    };

    const handleDeleteSound = async () => {
        if (!confirmDeleteId) return;

        try {
            const soundId = confirmDeleteId;
            const sound = sounds.find(s => s.id === soundId);
            if (!sound) return;

            // Delete file from storage
            const fileName = sound.file_url.split('/').pop();
            if (fileName) {
                await supabase.storage.from('kds-sounds').remove([fileName]);
            }

            // Mark as inactive in database (soft delete)
            await supabase
                .from('sound_library')
                .update({ is_active: false })
                .eq('id', soundId);

            // If this was the default sound, clear it
            if (settings.defaultSoundId === soundId) {
                await supabase
                    .from('system_settings')
                    .update({ kds_default_sound_id: null })
                    .eq('id', 1);
                setSettings(prev => ({ ...prev, defaultSoundId: '' }));
            }

            await fetchSounds();
            notify.success('Sonido eliminado');
        } catch (error: any) {
            notify.error('Error al eliminar el sonido');
        }
        setConfirmDeleteId(null);
    };

    const handleRenameSound = async (soundId: string) => {
        if (!editName.trim()) return;

        try {
            await supabase
                .from('sound_library')
                .update({ name: editName.trim() })
                .eq('id', soundId);

            await fetchSounds();
            setEditingId(null);
            setEditName('');
            notify.success('Sonido renombrado');
        } catch (error: any) {
            notify.error('Error al renombrar');
        }
    };

    const handleTestSound = (soundUrl: string, soundId: string) => {
        setPlaying(soundId);

        const secureUrl = getSecureSoundUrl(soundUrl);
        console.log('🧪 KDS Test: Playback request', { soundId, secureUrl, volume: settings.volume });

        if (audioRef.current) {
            console.log('🧪 KDS Test: Using audioRef');
            audioRef.current.pause();
            audioRef.current.src = secureUrl;
            audioRef.current.volume = settings.volume;

            audioRef.current.play()
                .then(() => {
                    console.log('✅ KDS Test: Started');
                    if (audioRef.current) {
                        audioRef.current.onended = () => setPlaying(null);
                    }
                })
                .catch(err => {
                    console.error('❌ KDS Test Error (Ref):', err);
                    // Fallback to internal audio instance if Ref fails
                    playWithInternalAudio(secureUrl);
                });
        } else {
            console.warn('🧪 KDS Test: audioRef is null, using internal');
            playWithInternalAudio(secureUrl);
        }
    };

    const playWithInternalAudio = (url: string) => {
        const audio = new Audio(url);
        audio.volume = settings.volume;
        audio.play()
            .then(() => {
                audio.onended = () => setPlaying(null);
            })
            .catch(err => {
                console.error('❌ KDS Test Error (Internal):', err);
                notify.error('Audio bloqueado por el navegador. Haga clic en la pantalla.');
                setPlaying(null);
            });
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        // Message removal handled by notify
        try {
            // 1. Always save to local storage for immediate station effect
            const currentSettings = JSON.parse(localStorage.getItem('system_settings') || '{}');
            const newLocalSettings = {
                ...currentSettings,
                pos_notification_sound_id: settings.posNotificationSoundId,
                pos_warning_sound_id: settings.posWarningSoundId,
                kds_alert_volume: settings.volume,
                waiter_sound_id: settings.waiterSoundId,
                kds_default_sound_id: settings.defaultSoundId
            };
            localStorage.setItem('system_settings', JSON.stringify(newLocalSettings));

            // 2. Try to persist to database
            const { error } = await supabase
                .from('system_settings')
                .update({
                    kds_default_sound_id: settings.defaultSoundId || null,
                    waiter_sound_id: settings.waiterSoundId || null,
                    pos_notification_sound_id: settings.posNotificationSoundId || null,
                    pos_warning_sound_id: settings.posWarningSoundId || null,
                    kds_alert_enabled: settings.enabled,
                    kds_alert_volume: settings.volume,
                    kds_voice_volume: settings.voiceVolume,
                    kds_voice_phrase: settings.voicePhrase
                })
                .eq('id', 1);

            if (error) {
                console.warn('Database sync failed (possibly missing column), but settings saved locally:', error);
                notify.success('Configuración aplicada localmente');
            } else {
                notify.success('Configuración guardada en la nube');
            }
        } catch (error: any) {
            console.error('Error saving sound settings:', error);
            notify.error('Error al sincronizar con el servidor');
        } finally {
            setSaving(false);
        }
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'N/A';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-[#fcfdfe] p-4 gap-4 relative select-none overflow-hidden">
            <audio ref={audioRef} />

            {/* CLICK AWAY FOR CONTEXT MENU */}
            {contextMenu && (
                <div
                    className="absolute inset-0 z-[100]"
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                />
            )}

            {/* TOP SETTINGS BAR */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Alertas KDS</span>
                        <div
                            onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ${settings.enabled ? 'bg-[#106ebe]' : 'bg-gray-200'}`}
                        >
                            <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all duration-300 transform ${settings.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </label>
                </div>

                <div className="flex items-center gap-4 flex-1 max-w-lg">
                    <div className="flex flex-col flex-1 gap-1">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Altavoz</span>
                            <span className="text-[10px] font-medium text-[#106ebe]">{Math.round(settings.volume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={settings.volume}
                            onChange={(e) => setSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                            className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#106ebe]"
                        />
                    </div>
                    <div className="flex flex-col flex-1 gap-1">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Voz IA</span>
                            <span className="text-[10px] font-medium text-[#106ebe]">{Math.round(settings.voiceVolume * 2 * 100) / 2}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={settings.voiceVolume}
                            onChange={(e) => setSettings(prev => ({ ...prev, voiceVolume: parseFloat(e.target.value) }))}
                            className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#106ebe]"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col gap-1 w-full md:w-64">
                        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest px-1">Frase IA (Nueva Orden)</span>
                        <input
                            type="text"
                            value={settings.voicePhrase}
                            onChange={(e) => setSettings(prev => ({ ...prev, voicePhrase: e.target.value }))}
                            className="bg-gray-50 border border-gray-100 rounded-lg py-1.5 px-3 text-[11px] font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#106ebe]/10"
                            placeholder="Ej: Nueva orden en camino"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest px-1">Cocina (Default)</span>
                        <select
                            value={settings.defaultSoundId}
                            onChange={(e) => setSettings(prev => ({ ...prev, defaultSoundId: e.target.value }))}
                            className="bg-gray-50 border border-gray-100 rounded-lg py-1 px-3 text-[11px] font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#106ebe]/10"
                        >
                            <option value="">Sin sonido</option>
                            {sounds.map(sound => (
                                <option key={sound.id} value={sound.id}>{sound.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest px-1">Mesero (Listo)</span>
                        <select
                            value={settings.waiterSoundId}
                            onChange={(e) => setSettings(prev => ({ ...prev, waiterSoundId: e.target.value }))}
                            className="bg-gray-50 border border-gray-100 rounded-lg py-1 px-3 text-[11px] font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#106ebe]/10"
                        >
                            <option value="">Original (Ding)</option>
                            {sounds.map(sound => (
                                <option key={sound.id} value={sound.id}>{sound.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest px-1">Notificaciones POS</span>
                        <select
                            value={settings.posNotificationSoundId}
                            onChange={(e) => setSettings(prev => ({ ...prev, posNotificationSoundId: e.target.value }))}
                            className="bg-gray-50 border border-gray-100 rounded-lg py-1 px-3 text-[11px] font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#106ebe]/10"
                        >
                            <option value="">Sin sonido</option>
                            {sounds.map(sound => (
                                <option key={sound.id} value={sound.id}>{sound.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-medium text-red-400 uppercase tracking-widest px-1">Advertencias POS</span>
                        <select
                            value={settings.posWarningSoundId}
                            onChange={(e) => setSettings(prev => ({ ...prev, posWarningSoundId: e.target.value }))}
                            className="bg-red-50/50 border border-red-100 rounded-lg py-1 px-3 text-[11px] font-medium text-red-700 outline-none focus:ring-2 focus:ring-red-500/10"
                        >
                            <option value="">Igual a Notif.</option>
                            {sounds.map(sound => (
                                <option key={sound.id} value={sound.id}>{sound.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <WindowsSaveButton
                    onClick={handleSaveSettings}
                    loading={saving}
                    title="Guardar Configuración de Sonidos"
                />
            </div>

            {/* BUTTON TO UPLOAD */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-[#106ebe]" />
                    <span className="text-[11px] font-medium text-gray-600 uppercase tracking-widest">Librería de Sonidos</span>
                </div>

                <label className={`flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-[10px] font-semibold uppercase tracking-widest hover:bg-green-600 transition-all cursor-pointer active:scale-95 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                        type="file"
                        accept="audio/mpeg,audio/wav,audio/ogg"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                    />
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    <span>Subir Nuevo Sonido</span>
                </label>
            </div>

            {/* SOUNDS TABLE */}
            <div className="flex-1 overflow-auto bg-white rounded-2xl border border-gray-100 shadow-sm relative">
                <table className="w-full border-collapse text-[11px]">
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-gray-50/80 backdrop-blur-md border-b border-gray-100 font-medium">
                            <th className="py-2 px-4 text-left text-gray-400 uppercase tracking-widest w-[8%]">Tipo</th>
                            <th className="py-2 px-4 text-left text-gray-400 uppercase tracking-widest w-[62%]">Nombre</th>
                            <th className="py-2 px-4 text-left text-gray-400 uppercase tracking-widest w-[15%]">Tamaño</th>
                            <th className="py-2 px-4 text-left text-gray-400 uppercase tracking-widest w-[15%]">Duración</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sounds.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-gray-400 font-medium uppercase tracking-widest opacity-50">
                                    No hay sonidos registrados
                                </td>
                            </tr>
                        ) : (
                            sounds.map((sound) => (
                                <tr
                                    key={sound.id}
                                    onClick={() => setSelectedSoundId(sound.id)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setSelectedSoundId(sound.id);
                                        const rect = containerRef.current?.getBoundingClientRect();
                                        setContextMenu({
                                            x: e.clientX - (rect?.left || 0),
                                            y: e.clientY - (rect?.top || 0),
                                            sound
                                        });
                                    }}
                                    className={`transition-all cursor-default relative font-medium ${selectedSoundId === sound.id
                                        ? 'bg-blue-50/50 text-[#106ebe] shadow-[inset_3px_0_0_#106ebe]'
                                        : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                >
                                    <td className="py-2 px-4">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleTestSound(sound.file_url, sound.id);
                                            }}
                                            disabled={playing === sound.id}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${playing === sound.id
                                                ? 'bg-emerald-500 text-white shadow-lg animate-pulse'
                                                : 'bg-blue-50 text-[#106ebe] hover:bg-[#106ebe] hover:text-white'
                                                }`}
                                        >
                                            {playing === sound.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                        </button>
                                    </td>
                                    <td className="py-2 px-4">
                                        {editingId === sound.id ? (
                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameSound(sound.id);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                    className="flex-1 bg-white border border-blue-200 rounded-lg px-2 py-1 outline-none text-[11px] focus:ring-2 focus:ring-blue-100"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleRenameSound(sound.id)} className="text-green-500 hover:text-green-600">
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="text-red-500 hover:text-red-600">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="font-medium">{sound.name}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-4 text-gray-500">{formatFileSize(sound.file_size)}</td>
                                    <td className="py-2 px-4 text-gray-500">{formatDuration(sound.duration_seconds)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* CONTEXT MENU */}
            {contextMenu && (
                <div
                    className="absolute z-[110] w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 animate-in fade-in zoom-in duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        onClick={() => {
                            handleTestSound(contextMenu.sound.file_url, contextMenu.sound.id);
                            setContextMenu(null);
                        }}
                        disabled={playing === contextMenu.sound.id}
                        className="w-full text-left px-4 py-2 text-[10px] font-medium text-gray-700 hover:bg-gray-50 hover:text-green-600 flex items-center gap-3 transition-colors uppercase tracking-widest"
                    >
                        {playing === contextMenu.sound.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                        <span>Probar Sonido</span>
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(contextMenu.sound.id);
                            setEditName(contextMenu.sound.name);
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 text-[10px] font-medium text-gray-700 hover:bg-gray-50 hover:text-[#106ebe] flex items-center gap-3 transition-colors uppercase tracking-widest"
                    >
                        <Edit2 size={12} />
                        <span>Renombrar</span>
                    </button>
                    <div className="h-px bg-gray-50 my-1" />
                    <button
                        onClick={() => {
                            setConfirmDeleteId(contextMenu.sound.id);
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 text-[10px] font-medium text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors uppercase tracking-widest"
                    >
                        <Trash2 size={12} />
                        <span>Eliminar</span>
                    </button>
                </div>
            )}

            {confirmDeleteId && (
                <WindowsConfirmModal
                    title="Confirmar Eliminación"
                    message="¿Eliminar este sonido? Las estaciones que lo usen perderán la asignación."
                    onConfirm={handleDeleteSound}
                    onCancel={() => setConfirmDeleteId(null)}
                    onDeny={() => setConfirmDeleteId(null)}
                />
            )}

            {/* FOOTER */}
            <div className="bg-gray-50/50 px-4 py-2 border-t border-gray-100 flex justify-between items-center rounded-b-2xl">
                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest">
                    {sounds.length} Sonidos Disponibles
                </span>
                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest">
                    Configuración de Estaciones KDS
                </span>
            </div>
        </div>
    );
};
