import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getImageUrl } from '../utils/getImageUrl';
import { DateUtils } from '../utils/DateUtils';
import { Order, Table, Product, Category, OrderItem, User } from '../types';
import { Bell, BellOff, ChevronLeft, ChevronRight, ArrowLeft, CornerUpLeft, Trash2, Printer, CheckCircle, Search, Plus, Minus, Info, Loader2, ShoppingCart as ShoppingCartIcon, CreditCard, FileText, FilePlus, Receipt, Ban, Users, Percent, Settings2, Utensils, Truck, Package, MapPin, Edit3, Banknote, Split, Image, ArrowRightLeft, Mic, MicOff, UserPlus, Grid, UsersRound, ChevronDown, LayoutGrid } from 'lucide-react';
import { supabase } from '../supabase';
import { printService, TicketData } from '../services/PrintService';
import { billingService } from '../services/BillingService';
import { InvoiceModal } from './InvoiceModal';
import { PinModalV2 as PinModal } from './PinModalV2';
import { ModifierModal } from './ModifierModal';
import { PaxModal } from './PaxModal';
import { DiscountModal } from './DiscountModal';
import { TransferTableModal } from './TransferTableModal';
import { TransferWaiterModal } from './TransferWaiterModal';
import { TabletItemActionModal } from './TabletItemActionModal';
import { AccountsManagementModal } from './AccountsManagementModal';
import { AccountsOverviewModal } from './AccountsOverviewModal';
import { DeliveryPaymentModal } from './DeliveryPaymentModal';
import { useSecurityPolicy } from '../hooks/useSecurityPolicy';
import { useModulePermissions } from '../hooks/useModulePermissions';
import { CustomerData } from '../types/billing';
import { ItemStatusBadge } from './ItemStatusBadge';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useNotify } from '../hooks/useNotify';
import { activityLogService } from '../services/ActivityLogService';
import { WindowsConfirmModal } from './WindowsConfirmModal';
import { WindowsInputModal } from './WindowsInputModal';
import { generateUUID } from '../utils/uuid';

export const parseNotes = (notesStr?: string | null) => {
    if (!notesStr) return { mods: '', obs: '', isJson: false, noPrint: false };
    const noPrint = notesStr.includes('*NO IMPRIMIR*');
    const clean = notesStr.replace('*NO IMPRIMIR*', '').trim();
    try {
        if (clean.startsWith('{') && (clean.includes('"mods"') || clean.includes('"obs"'))) {
            const parsed = JSON.parse(clean);
            return { mods: parsed.mods || '', obs: parsed.obs || '', isJson: true, noPrint };
        }
    } catch (e) { }
    return { mods: '', obs: clean, isJson: false, noPrint };
};

export const formatNotesForDisplay = (notesStr?: string | null) => {
    const p = parseNotes(notesStr);
    return [p.mods, p.obs].filter(Boolean).join(' | ');
};

const PlaceholderLogo = () => (
    <div className="flex flex-col items-center justify-center h-full w-full p-0 scale-100 sm:scale-110">
        <div className="flex items-baseline text-white leading-none">
            <span className="text-xl sm:text-2xl font-semibold">R</span>
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.1em] ml-[1px]">ESTAURANTE</span>
        </div>
        <span className="text-xs sm:text-sm font-semibold tracking-tighter text-orange-500 uppercase leading-none mt-1 mb-1.5">LAS PALMAS</span>
        <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-[2px] w-3 sm:w-5 bg-orange-500/80"></div>
            <span className="text-[8px] sm:text-[10px] font-semibold text-white tracking-widest">POS</span>
            <div className="h-[2px] w-3 sm:w-5 bg-orange-500/80"></div>
        </div>
    </div>
);

const ProductCard = React.memo<{
    product: Product,
    currency: string,
    onClick: () => void,
    newStyle?: boolean,
    isChecking?: boolean,
    // v1.4.1 - Shadow Stock Unification
    stockOverride?: number,
    isTablet?: boolean
}>(({ product, currency, onClick, isChecking, stockOverride, isTablet }) => {
    // Si hay stockOverride (shadow stock), lo usamos. Si no, usamos el del producto.
    const stock = stockOverride !== undefined ? stockOverride : product.stock_quantity;
    const isLowStock = stock !== undefined && stock <= (product.min_stock_level || 0);
    const hasStock = stock !== undefined && stock !== null;

    return (
        <button
            onClick={onClick}
            disabled={isChecking}
            className={`rounded-t-none rounded-b-2xl p-1.5 flex flex-col items-center gap-1 border transition-all group active:scale-95 text-center overflow-hidden relative bg-[#3a3b4d] mx-auto w-full h-full ${isChecking ? 'opacity-50 border-white/10 scale-[0.98]' : 'border-white/5'
                }`}
        >
            {/* Checking/Loading Overlay */}
            {isChecking && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20">
                    <Loader2 className="animate-spin text-white/20" size={24} />
                </div>
            )}
            {/* Inventory Badge */}
            {hasStock && (
                <div className="absolute top-2 right-2 text-[10px] font-semibold z-10 text-white">
                    {stock}
                </div>
            )}

            <div className="w-full flex-1 flex items-center justify-center rounded-lg overflow-hidden p-0 min-h-0">
                {product.image_url ? (
                    <img
                        src={getImageUrl(product.image_url)}
                        alt={product.name}
                        className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-300"
                    />
                ) : (
                    <PlaceholderLogo />
                )}
            </div>

            <div className="w-full flex flex-col items-center justify-end shrink-0 gap-1 pb-1">
                <div className="h-[2.5rem] flex items-center justify-center w-full px-1">
                    <div className="text-[9.5px] sm:text-[10.5px] leading-snug font-semibold text-white line-clamp-2 uppercase tracking-wide text-center w-full" title={product.name}>
                        {product.name}
                    </div>
                </div>
                <span className="text-white font-semibold text-[11px] tabular-nums tracking-widest leading-none">
                    {currency}{((product as any).finalPrice ?? product.price).toFixed(2)}
                </span>
            </div>
        </button>
    );
}, (prevProps, nextProps) => {
    // Custom comparison to prevent flicker. 
    // Ignore onClick and only re-render if visual data changed.
    return prevProps.product.id === nextProps.product.id &&
        prevProps.product.stock_quantity === nextProps.product.stock_quantity &&
        prevProps.stockOverride === nextProps.stockOverride &&
        prevProps.product.price === nextProps.product.price &&
        prevProps.product.name === nextProps.product.name &&
        prevProps.product.image_url === nextProps.product.image_url &&
        prevProps.isChecking === nextProps.isChecking &&
        prevProps.isTablet === nextProps.isTablet &&
        prevProps.currency === nextProps.currency;
});

interface OrderViewProps {
    order: Order;
    table: Table | null;
    currentUser: User | null;
    settings?: any;
    onClose?: () => void;
    onCheckout?: (updatedOrder: any) => void;
    waiterVoiceEnabled?: boolean;
    onToggleWaiterVoice?: () => void;
}

export const OrderView: React.FC<OrderViewProps> = ({ order: initialOrder, table, currentUser, settings, onClose, onCheckout, waiterVoiceEnabled, onToggleWaiterVoice }) => {
    const notify = useNotify();
    const { isOnline } = useNetworkStatus();
    const [items, setItems] = useState<OrderItem[]>(initialOrder?.items || []);
    const [selectedCat, setSelectedCat] = useState<Category | null>(null);
    const [selectedSubCat, setSelectedSubCat] = useState<Category | null>(null);
    const [categories, _setCategories] = useState<Category[]>(() => {
        try {
            const cached = localStorage.getItem('cached_categories');
            return cached ? JSON.parse(cached) : [];
        } catch (e) { return []; }
    });
    const setCategories = (val: any) => {
        console.log('🚨 setCategories CALLED with:', val);
        if (Array.isArray(val) && val.length === 0) {
            console.error('❌ CATEGORIES SET TO EMPTY ARRAY! Stack trace:', new Error().stack);
        }
        _setCategories(val);
    };
    const [products, setProducts] = useState<Product[]>(() => {
        try {
            const cached = localStorage.getItem('cached_products');
            return cached ? JSON.parse(cached) : [];
        } catch (e) { return []; }
    });
    const [branchPrices, setBranchPrices] = useState<any[]>(() => {
        try {
            const cached = localStorage.getItem('cached_branch_prices');
            return cached ? JSON.parse(cached) : [];
        } catch (e) { return []; }
    });
    const [branchInventory, setBranchInventory] = useState<any[]>(() => {
        try {
            const cached = localStorage.getItem('cached_branch_inventory');
            return cached ? JSON.parse(cached) : [];
        } catch (e) { return []; }
    });
    const [itemInventory, setItemInventory] = useState<any[]>(() => {
        try {
            const cached = localStorage.getItem('cached_inventory_item_branches');
            return cached ? JSON.parse(cached) : [];
        } catch (e) { return []; }
    });

    // v1.5.2 - Listen for inventory refresh after order submission to update stock badges
    useEffect(() => {
        const handleInventoryRefresh = () => {
            try {
                const cachedInv = localStorage.getItem('cached_branch_inventory');
                if (cachedInv) setBranchInventory(JSON.parse(cachedInv));

                const cachedItemInv = localStorage.getItem('cached_inventory_item_branches');
                if (cachedItemInv) setItemInventory(JSON.parse(cachedItemInv));

                const cachedProds = localStorage.getItem('cached_products');
                if (cachedProds) setProducts(JSON.parse(cachedProds));
            } catch (e) { console.warn('Error refreshing inventory state:', e); }
        };
        window.addEventListener('inventory-state-updated', handleInventoryRefresh);
        return () => window.removeEventListener('inventory-state-updated', handleInventoryRefresh);
    }, []);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(initialOrder?.id || null);
    const [tableOrders, setTableOrders] = useState<any[]>([]);
    const [serverOffset, setServerOffset] = useState<number>(() => {
        const cached = localStorage.getItem('kds_server_offset');
        return cached ? parseInt(cached, 10) : 0;
    });

    // Add 1s ticker to force re-renders in the waiter's summary
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // Tablet detection: Lenovo M9 has CSS viewport < 1350px in landscape
    const [isTablet, setIsTablet] = useState(() => window.innerWidth < 1350);
    // Caja detection: Elo Touch 1509L is 1366x768
    const [isCaja, setIsCaja] = useState(() => window.innerWidth >= 1350 && window.innerWidth <= 1400);

    useEffect(() => {
        const check = () => {
            setIsTablet(window.innerWidth < 1350);
            setIsCaja(window.innerWidth >= 1350 && window.innerWidth <= 1400);
        };
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);


    // Modal states
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showModifierModal, setShowModifierModal] = useState<Product | null>(null);
    const [showPaxModal, setShowPaxModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showTransferWaiterModal, setShowTransferWaiterModal] = useState(false);
    const [showAccountsModal, setShowAccountsModal] = useState(false);
    const [showAccountsOverviewModal, setShowAccountsOverviewModal] = useState(false);
    const [singleItemToTransfer, setSingleItemToTransfer] = useState<OrderItem | null>(null);
    const [showTakeoutClientModal, setShowTakeoutClientModal] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [takeoutData, setTakeoutData] = useState({ name: '', phone: '' });
    const [showDeliveryPaymentModal, setShowDeliveryPaymentModal] = useState(false);
    const [showVoidModal, setShowVoidModal] = useState(false);
    const [swipedItem, setSwipedItem] = useState<{ id: string, action: 'delete' | 'note' } | null>(null);
    const [itemToVoid, setItemToVoid] = useState<OrderItem | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [discountingItem, setDiscountingItem] = useState<OrderItem | null>(null);
    const [checkingProductId, setCheckingProductId] = useState<string | null>(null);
    const [checkingProducts, setCheckingProducts] = useState<Set<string>>(new Set());
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    // Security & Editing states
    const [pendingAction, setPendingAction] = useState<'delete' | 'cancel' | 'edit' | null>(null);
    const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [tabletItemActionModal, setTabletItemActionModal] = useState<OrderItem | null>(null);

    const [customDialog, setCustomDialog] = useState<{
        title?: string;
        message: string;
        onConfirm: () => void;
        onDeny?: () => void;
        onCancel?: () => void;
        type?: 'confirm' | 'alert';
    } | null>(null);

    const [customInput, setCustomInput] = useState<{
        title?: string;
        message: string;
        defaultValue?: string;
        placeholder?: string;
        onConfirm: (value: string) => void;
    } | null>(null);

    const showAlert = (message: string, title: string = 'Atención') => {
        setCustomDialog({
            title,
            message,
            type: 'alert',
            onConfirm: () => setCustomDialog(null)
        });
    };

    const showConfirm = (message: string, onConfirm: () => void, title: string = 'Confirmar') => {
        setCustomDialog({
            title,
            message,
            type: 'confirm',
            onConfirm: () => {
                onConfirm();
                setCustomDialog(null);
            },
            onCancel: () => setCustomDialog(null)
        });
    };

    // Check if current user is the creator of the order
    const isOrderCreator = () => {
        if (!currentUser || !activeOrderId) return true;
        const currentOrder = tableOrders.find(o => o.id === activeOrderId) || (activeOrderId === initialOrder.id ? initialOrder : null);
        if (!currentOrder) return true;
        // Role based bypass
        if (currentUser.role === 'ADMIN' || currentUser.role === 'CAJERO') return true;

        // If limit access is off, everyone can edit
        if (!settings?.limit_order_access) return true;

        // Compare creator ID
        return currentOrder.waiter_id === currentUser.id;
    };

    const handleRenameAccount = async (orderId: string) => {
        const order = tableOrders.find(o => o.id === orderId);
        if (!order) return;

        setCustomInput({
            title: 'Editar Cuenta',
            message: 'Ingrese el nuevo nombre para la cuenta:',
            defaultValue: order.customer_name || '',
            onConfirm: async (newName) => {
                try {
                    const { error } = await supabase.from('orders')
                        .update({ customer_name: newName })
                        .eq('id', orderId);

                    if (error) throw error;
                    await fetchData(false, orderId);
                    notify.success('Nombre actualizado');
                    setCustomInput(null);
                } catch (e) {
                    console.error(e);
                    notify.error('Error al actualizar nombre');
                }
            }
        });
    };

    const handleDeleteEmptyAccount = async (orderId: string, reason?: string) => {
        const order = tableOrders.find(o => o.id === orderId);
        if (!order) return;

        // Regla: No permitir eliminar si solo queda 1 cuenta (debe usar Anular Orden)
        if (tableOrders.length <= 1) {
            setCustomDialog({
                title: 'Acción No Permitida',
                message: 'No puedes eliminar la única cuenta restante desde aquí. Para cancelar toda la orden, sal de esta ventana y presiona "Anular Orden".',
                type: 'alert',
                onConfirm: () => setCustomDialog(null)
            });
            return;
        }

        // Solo ADMIN y CAJERO pueden eliminar cuentas
        if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'CAJERO') {
            setCustomDialog({
                title: 'Acceso Denegado',
                message: 'Solo Administradores y Cajeros pueden eliminar cuentas.',
                type: 'alert',
                onConfirm: () => setCustomDialog(null)
            });
            return;
        }

        const orderItems = order.items || order.order_items || [];

        const proceedToDelete = async () => {
            setCustomDialog(null);
            setProcessing(true);
            try {
                // LOG: Registro de eliminación de cuenta antes de borrarla
                activityLogService.logFinancial({
                    user: currentUser!,
                    module: 'VENTAS',
                    action: 'CUENTA_ELIMINADA',
                    entity_id: orderId,
                    entity_type: 'ORDER',
                    details: {
                        mesa: table?.number,
                        cuenta: order.customer_name,
                        motivo: reason || 'Sin motivo especificado',
                        items_anulados: orderItems.length,
                        items: orderItems.map((i: any) => ({
                            nombre: i.product_name || i.name || i.producto?.nombre,
                            cantidad: i.quantity,
                            precio: i.price
                        })),
                        total_cuenta: (order.subtotal || 0) + (order.tip_amount || 0)
                    }
                }, {
                    amount: (order.subtotal || 0) + (order.tip_amount || 0),
                    type: 'EGRESO',
                    currency: 'GTQ'
                });

                // Eliminar facturas relacionadas primero (evita error de FK)
                await supabase.from('invoices').delete().eq('order_id', orderId);

                const { error } = await supabase.from('orders').delete().eq('id', orderId);
                if (error) throw error;

                if (activeOrderId === orderId) {
                    const remaining = tableOrders.filter(o => o.id !== orderId);
                    setActiveOrderId(remaining.length > 0 ? remaining[0].id : (initialOrder?.id || null));
                }

                await fetchData(false);

                // v1.7.2 - Print Cancellation Receipt for Audit if order had items
                if (orderItems.length > 0) {
                    await printService.printCancelledTicket({
                        orderNumber: order.order_number,
                        createdAt: order.created_at,
                        items: orderItems,
                        tableNumber: table?.number
                    }, reason || 'Sin motivo especificado');
                }

                notify.success('Cuenta eliminada con éxito');
            } catch (e: any) {
                console.error(e);
                notify.error('Error al eliminar cuenta: ' + e.message);
            } finally {
                setProcessing(false);
            }
        };

        if (orderItems.length > 0) {
            // PASO 1: Advertencia de platillos enviados
            setCustomDialog({
                title: 'Acción No Permitida',
                message: 'La Cuenta tiene platillos ya enviados a cocina, necesitará tener permisos para poder eliminarla.',
                type: 'alert',
                onConfirm: () => {
                    // PASO 2: Confirmación de eliminación con platillos
                    setCustomDialog({
                        title: 'Eliminar Cuenta',
                        message: 'Al eliminar esta cuenta también eliminará sus platillos. ¿Seguro de continuar?',
                        type: 'confirm',
                        onConfirm: proceedToDelete,
                        onCancel: () => setCustomDialog(null)
                    });
                }
            });
            return;
        }

        // Cuenta vacía: confirmación directa
        setCustomDialog({
            title: 'Eliminar Cuenta',
            message: '¿Desea proceder a eliminar esta cuenta vacía?',
            type: 'confirm',
            onConfirm: proceedToDelete,
            onCancel: () => setCustomDialog(null)
        });
    };

    const safeParseDate = (d: string | null | undefined) => {
        if (!d) return 0;
        const normalized = d.includes('T') ? d : d.replace(' ', 'T');
        const val = new Date(normalized).getTime();
        return isNaN(val) ? 0 : val;
    };

    // SERVER SYNC
    useEffect(() => {
        const syncTime = async () => {
            try {
                const { data, error } = await supabase.rpc('get_server_time');
                if (error) throw error;

                if (data) {
                    const serverTime = new Date(data).getTime();
                    const clientTime = Date.now();
                    const offset = serverTime - clientTime;
                    setServerOffset(offset);
                    localStorage.setItem('kds_server_offset', offset.toString());
                    console.log('⏱️ OrderView Clock Synced:', { offset });
                }
            } catch (err) {
                console.warn('⚠️ OrderView Sync failed using cached or local time.', err);
            }
        };
        syncTime();
    }, []);

    // OFFLINE VOID SYNC queue
    useEffect(() => {
        if (isOnline) {
            const syncVoids = async () => {
                const pending = localStorage.getItem('pending_voids');
                if (!pending) return;

                try {
                    const voidQueue = JSON.parse(pending);
                    const remaining = [];

                    for (const v of voidQueue) {
                        const { error } = await supabase.from('order_items').update({
                            status: 'voided',
                            void_reason: v.reason,
                            voided_at: v.at
                        }).eq('id', v.id);

                        if (error) remaining.push(v);
                    }

                    if (remaining.length > 0) {
                        localStorage.setItem('pending_voids', JSON.stringify(remaining));
                    } else {
                        localStorage.removeItem('pending_voids');
                        console.log('✅ Offline voids synced successfully');
                    }
                } catch (e) { console.error('Sync voids error:', e); }
            };
            syncVoids();
        }
    }, [isOnline]);

    // Security hook
    const { validatePin, canAccessOrder } = useSecurityPolicy(settings);
    const { can: canCajero } = useModulePermissions('Cajero');

    // ----------------------------------------------------------------------
    // HELPER FUNCTIONS (Edit, Delete, Modifier)
    // ----------------------------------------------------------------------

    const handleEditItem = async (item: OrderItem) => {
        const isSaved = !item.id.startsWith('i-') && item.is_sent;
        if (isSaved) {
            // v1.7.1 - El doble clic en un item enviado ya no inicia la anulación.
            // Se reserva la anulación exclusivamente para el icono del basurero.
            // En su lugar, abrimos la gestión de descuentos ya que "la que vale es descuento".
            const canDiscount = canCajero('Aplicar Descuentos') || currentUser?.role === 'CAJERO' || currentUser?.role === 'ADMIN';
            if (canDiscount) {
                setDiscountingItem(item);
                setShowDiscountModal(true);
            }
            return;
        }
        // Check if item actually has modifiers/options before opening the modal
        try {
            const { data: isCustomizable, error } = await supabase.rpc('check_if_customizable', { p_id: item.product_id });
            if (!error && !isCustomizable) {
                // "a los que no tengan ninguna de ellas el platillo no traigas la seccion"
                return;
            }
        } catch (err) {
            console.error('Error checking customizability in handleEditItem:', err);
        }

        // Item no enviado y es customizable: abrir modal de modificadores
        const mockProduct: Product = {
            id: item.product_id,
            name: item.product_name,
            price: item.price,
            category_id: 'unknown',
            branch_id: currentUser?.branch_id || 'unknown'
        };
        setEditingItemId(item.id);
        setShowModifierModal(mockProduct);
    };

    const handleClose = async () => {
        // SECURITY: Clear soft lock if it was unsaved
        if (activeOrderId === null && table?.id) {
            await supabase.from('tables').update({
                locked_by: null,
                locked_at: null
            }).eq('id', table.id);
        }

        // If order exists in DB (has ID) but has NO items at all, delete it and free the table
        if (activeOrderId && items.length === 0) {
            try {
                await supabase.from('tables').update({
                    locked_by: null,
                    locked_at: null,
                    status: 'available'
                }).eq('id', table?.id);
                await supabase.from('orders').delete().eq('id', activeOrderId);
            } catch (e) {
                console.error('Error cleaning up empty order:', e);
            }
        }
        onClose?.();
    };

    const handleProductClick = async (product: Product) => {
        // Optimistic click sound
        if (settings?.interface_sounds) {
            const tapSound = document.getElementById('tap-sound') as HTMLAudioElement;
            if (tapSound) {
                tapSound.currentTime = 0;
                tapSound.play().catch(() => { });
            }
        }

        // Block interaction if actively checking
        if (checkingProducts.has(product.id)) return;
        setCheckingProducts(prev => new Set(prev).add(product.id));

        try {
            const { data: isCustomizable, error } = await supabase.rpc('check_if_customizable', { p_id: product.id });
            // If the RPC fails or is missing, we default to showing the modal for safety
            if (error) throw error;

            if (isCustomizable) {
                // Case B: Needs configuration. Show modal.
                setShowModifierModal(product);
            } else {
                // Case A: Simple product. Add instantly with default 1 qty.
                await handleModifierConfirm(product, [], '', 1);
            }
        } catch (err) {
            console.error('Error checking product configurability:', err);
            // Fallback: Show modal just in case
            setShowModifierModal(product);
        } finally {
            setCheckingProducts(prev => {
                const next = new Set(prev);
                next.delete(product.id);
                return next;
            });
        }
    };

    const handleModifierConfirm = async (product: Product, selectedModifiers: any[], notes: string, quantity: number) => {
        // Generar un ID local único para el item si no estamos editando
        const localId = editingItemId || `i-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Formatear notas usando JSON para separar modificadores de la nota manual (comentario)
        const modifierText = selectedModifiers
            .map(m => m.item_quantity > 1 ? `${m.item_quantity} ${m.name}` : m.name)
            .join(' | ');
        const finalNotes = JSON.stringify({ mods: modifierText, obs: notes });

        // Determinar el precio base segn la rama y tipo de orden
        const currentOrder = tableOrders.find(o => o.id === activeOrderId) || (activeOrderId === initialOrder.id ? initialOrder : null);
        const orderType = currentOrder?.order_type || initialOrder.order_type || 'DINE_IN';
        const platformId = currentOrder?.platform_id || initialOrder.platform_id;

        // Buscar precios para esta sucursal (usando branch_id del usuario)
        const myBranchId = currentUser?.branch_id;
        const prodPriceInfo = branchPrices.find(bp => bp.product_id === product.id && bp.branch_id === myBranchId);

        let basePrice = Number(product.price);
        if (prodPriceInfo) {
            if (platformId) {
                basePrice = Number(prodPriceInfo.platform_price || prodPriceInfo.delivery_price || prodPriceInfo.price);
            } else if (orderType === 'DELIVERY' || orderType === 'TAKEOUT') {
                basePrice = Number(prodPriceInfo.delivery_price || prodPriceInfo.price);
            } else {
                basePrice = Number(prodPriceInfo.price);
            }
        }

        // Calcular extras
        const extras = selectedModifiers.reduce((acc, m) => acc + ((m.extra_price || 0) * (m.item_quantity || 1)), 0);
        const finalPrice = basePrice + extras;

        if (editingItemId) {
            setItems(prev => prev.map(i => i.id === editingItemId ? {
                ...i,
                price: finalPrice,
                notes: finalNotes,
                quantity: quantity // Preserve or update quantity
            } : i));
            setEditingItemId(null);
        } else {
            const newItem: OrderItem = {
                id: localId,
                product_id: product.id,
                product_name: product.name,
                price: finalPrice,
                quantity: quantity,
                notes: finalNotes,
                status: 'pending',
                is_sent: false,
                created_at: DateUtils.nowISO(),
            };
            setItems(prev => [...prev, newItem]);
        }
        setShowModifierModal(null);
    };

    const handlePrintKitchen = async () => {
        if (settings && settings.enable_kitchen_printing === false) {
            showAlert('La impresión de cocina está desactivada en la configuración del sistema.', 'Configuración');
            return;
        }

        const unsentItems = items.filter(i => !i.is_sent);
        if (unsentItems.length === 0) return;

        const currentOrder = tableOrders.find(o => o.id === activeOrderId) ||
            (activeOrderId === initialOrder.id ? initialOrder : null);

        const ticketData: TicketData = {
            orderId: activeOrderId || 'NEW',
            orderNumber: currentOrder?.order_number,
            tableNumber: table?.number,
            tableName: table?.section,
            waiterName: currentUser?.name || (currentUser as any)?.full_name,
            items: unsentItems
                .filter(i => {
                    const parsed = parseNotes(i.notes);
                    return !parsed.noPrint;
                })
                .map(i => ({ name: i.product_name, quantity: i.quantity, notes: formatNotesForDisplay(i.notes) })),
            createdAt: DateUtils.nowISO()
        };
        if (ticketData.items.length > 0) {
            await printService.printKitchenTicket(ticketData);
        }
    };

    const handlePrintPreAccount = async () => {
        if (checkoutItems.length === 0) return;

        // FETCH LATEST ORDER DATA to ensure payment_method is up to date
        // Sometimes the local state 'tableOrders' might be slightly stale if we just updated it.
        let orderToPrint: any = tableOrders.find(o => o.id === activeOrderId);
        const effectivePrintOrderId = activeOrderId || (tableOrders.length === 1 ? tableOrders[0]?.id : null);

        if (effectivePrintOrderId) {
            const { data: latestOrder } = await supabase.from('orders').select('*').eq('id', effectivePrintOrderId).single();
            if (latestOrder) {
                orderToPrint = latestOrder;
            } else if (tableOrders.length === 1) {
                orderToPrint = tableOrders[0];
            }
        } else if (tableOrders.length === 0) {
            orderToPrint = {
                ...initialOrder,
                customer_name: 'CUENTA 1'
            };
        } else {
            // Aggregate mode: Create a virtual order for the ticket
            orderToPrint = {
                order_number: 'MULTIPLE',
                customer_name: 'CUENTA COMPLETA',
                order_type: initialOrder.order_type || 'DINE_IN',
                created_at: DateUtils.nowISO()
            };
        }

        const orderType = orderToPrint?.order_type || initialOrder.order_type || 'DINE_IN';

        const currentSubtotal = checkoutItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        const accumulatedItemDiscounts = checkoutItems.reduce((acc, i) => acc + (i.discount_amount || 0), 0);
        let printGlobalDiscount = 0;
        if (discount) {
            if (discount.type === 'AMOUNT') {
                printGlobalDiscount = discount.value || 0;
            } else {
                printGlobalDiscount = currentSubtotal * discount.percentage / 100;
            }
        }
        const printTotalSavings = accumulatedItemDiscounts + printGlobalDiscount;
        const subtotalAfterDiscount = Math.max(0, currentSubtotal - printTotalSavings);

        const taxRate = parseFloat(settings?.tax_percentage || '12') / 100;
        const currentTaxAmount = subtotalAfterDiscount * taxRate; // Using simplified pre-account tax logic here or the standard subtotalAfterDiscount - (subtotalAfterDiscount / 1.12)? Pre-account historically used simple multiplication here, let's keep it to avoid changing unrelated logic. Wait, no, UI tax logic uses `subtotal - (subtotal / 1.12)`. Let's use UI logic.
        const uiTaxAmount = subtotalAfterDiscount - (subtotalAfterDiscount / (1 + taxRate));

        const tipRate = (orderType === 'TAKEOUT' || orderType === 'DELIVERY') ? 0 : (parseFloat(settings?.suggested_tip || '10') / 100);
        const currentTipAmount = subtotalAfterDiscount * tipRate;

        const ticketData: any = { // Cast to any to accept extended props
            orderId: activeOrderId || 'VIRTUAL',
            orderNumber: orderToPrint?.order_number,
            orderType: orderType,
            customerName: getOrderDisplayName(orderToPrint?.id || activeOrderId),
            tableNumber: table?.number,
            tableName: table?.section,
            waiterName: currentUser?.name || (currentUser as any)?.full_name,
            items: checkoutItems.map(i => ({
                name: i.product_name || (i as any).product?.name || 'Producto',
                quantity: i.quantity,
                price: i.price,
                notes: formatNotesForDisplay(i.notes),
                discount_percentage: i.discount_percentage,
                discount_amount: i.discount_amount
            })),
            subtotal: subtotalAfterDiscount,
            totalSavings: printTotalSavings,
            taxAmount: uiTaxAmount,
            tipAmount: currentTipAmount,
            total: subtotalAfterDiscount + currentTipAmount,
            createdAt: orderToPrint?.created_at || DateUtils.nowISO(),
            paymentMethod: orderToPrint?.payment_method, // NOW FETCHED FRESH
            customerPhone: orderToPrint?.customer_phone,
            deliveryAddress: orderToPrint?.delivery_address
        };

        // HYBRID PRINTING LOGIC:
        // If Electron (Cashier/Server) -> Print Directly
        // If Tablet/Mobile -> Request Print via DB
        const isElectron = !!((window as any).electronAPI || (window as any).electron);
        if (isElectron) {
            try {
                await printService.printPreAccountTicket(ticketData);
                notify.success('Pre-cuenta enviada a impresión');
            } catch (err: any) {
                console.error('Error printing pre-account:', err);
                notify.error('Error al imprimir pre-cuenta: ' + (err.message || 'Fallo de driver'));
            }
        } else {
            // Request Remote Print
            if (ticketData.orderId && ticketData.orderId !== 'NEW') {
                await printService.requestPreCheckPrint(ticketData.orderId);
            } else if (!activeOrderId && tableOrders.length > 0) {
                // We're in aggregate view on a tablet. We CANNOT use DB trigger easily because it requires an orderId.
                // But typically pre-account aggregate print is done at the cashier (electron).
                // Let's alert them if on tablet.
                showAlert('La pre-cuenta agregada (Todas las cuentas) debe imprimirse desde la caja principal.');
            } else {
                showAlert('Guarde la orden antes de imprimir la pre-cuenta.');
            }
        }
    };

    const handlePaxConfirm = async (pax: number) => {
        if (activeOrderId) {
            await supabase.from('orders').update({ pax_count: pax }).eq('id', activeOrderId);
        }
    };

    const [discount, setDiscount] = useState<{ id: string, name: string, percentage: number, value?: number, type?: 'PERCENT' | 'AMOUNT' } | null>(null);
    const [discountReason, setDiscountReason] = useState<string>('');

    const handleDiscountApply = async (newDiscount: any, reason: string) => {
        console.log('Applying discount:', newDiscount, reason);

        if (discountingItem) {
            // ITEM LEVEL DISCOUNT
            const itemSubtotal = discountingItem.price * discountingItem.quantity;
            let itemDiscountAmount = 0;
            if (newDiscount) {
                if (newDiscount.type === 'AMOUNT') {
                    itemDiscountAmount = newDiscount.value;
                } else {
                    // Fallback or PERCENT
                    itemDiscountAmount = (itemSubtotal * (newDiscount.value || newDiscount.percentage) / 100);
                }
            }

            setItems(prev => prev.map(i => i.id === discountingItem.id ? {
                ...i,
                discount_type: newDiscount?.type || 'PERCENT',
                discount_percentage: newDiscount?.type === 'PERCENT' ? (newDiscount.value || newDiscount.percentage) : 0,
                discount_amount: itemDiscountAmount,
                discount_id: newDiscount?.id || null,
                discount_reason: reason || null
            } : i));

            // Sync with DB if saved
            if (!discountingItem.id.startsWith('i-')) {
                setProcessing(true);
                try {
                    await supabase.from('order_items').update({
                        discount_id: newDiscount?.id || null,
                        discount_percentage: newDiscount?.type === 'PERCENT' ? (newDiscount.value || newDiscount.percentage) : 0,
                        discount_amount: itemDiscountAmount,
                        discount_reason: reason || null
                    }).eq('id', discountingItem.id);
                } catch (e) { console.error('Error applying item discount', e); }
                setProcessing(false);
            }

            // Logging action
            if (currentUser) {
                activityLogService.logFinancial({
                    user: currentUser,
                    module: 'VENTAS',
                    action: 'DESCUENTO_APLICADO',
                    entity_id: activeOrderId || undefined,
                    entity_type: 'ORDER',
                    details: {
                        productId: discountingItem.product_id,
                        productName: discountingItem.product_name,
                        quantity: discountingItem.quantity,
                        price_unitario: discountingItem.price,
                        subtotal_item: discountingItem.price * discountingItem.quantity,
                        descuento_tipo: newDiscount?.type || 'PERCENT',
                        descuento_valor: newDiscount?.value || newDiscount?.percentage,
                        descuento_nombre: newDiscount?.name,
                        monto_descontado: itemDiscountAmount,
                        motivo: reason || 'Sin motivo'
                    }
                }, {
                    amount: itemDiscountAmount,
                    type: 'DESCUENTO',
                    currency: 'GTQ'
                });
            }

            setDiscountingItem(null);
            setShowDiscountModal(false);
            return;
        }

        // ORDER LEVEL DISCOUNT (Global)
        const currentSubtotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        let globalDiscountAmount = 0;
        if (newDiscount) {
            if (newDiscount.type === 'AMOUNT') {
                globalDiscountAmount = newDiscount.value;
            } else {
                globalDiscountAmount = (currentSubtotal * (newDiscount.value || newDiscount.percentage) / 100);
            }
        }

        // Update Local State
        setDiscount(newDiscount);
        setDiscountReason(reason);
        setShowDiscountModal(false);

        // Update Database if order exists
        if (activeOrderId) {
            setProcessing(true);
            try {
                await supabase.from('orders').update({
                    discount_id: newDiscount?.id || null,
                    discount_percentage: newDiscount?.type === 'PERCENT' ? (newDiscount.value || newDiscount.percentage) : 0,
                    discount_amount: globalDiscountAmount,
                    discount_reason: reason || null
                }).eq('id', activeOrderId);

                // Logging action (Global Discount)
                if (currentUser) {
                    activityLogService.logFinancial({
                        user: currentUser,
                        module: 'VENTAS',
                        action: 'DESCUENTO_GLOBAL',
                        entity_id: activeOrderId || undefined,
                        entity_type: 'ORDER',
                        details: {
                            orderId: activeOrderId,
                            descuento_nombre: newDiscount?.name,
                            descuento_tipo: newDiscount?.type || 'PERCENT',
                            descuento_valor: newDiscount?.value || newDiscount?.percentage,
                            monto_descontado: globalDiscountAmount,
                            subtotal_antes_descuento: currentSubtotal,
                            subtotal_despues_descuento: currentSubtotal - globalDiscountAmount,
                            motivo: reason || 'Sin motivo',
                            items_count: items.length
                        }
                    }, {
                        amount: globalDiscountAmount,
                        type: 'DESCUENTO',
                        currency: 'GTQ'
                    });
                }
            } catch (e) {
                console.error(e);
            }
            setProcessing(false);
        }
    };

    const handleTableTransfer = async (targetTableId: string) => {
        if (!activeOrderId || !table) return;
        setProcessing(true);
        try {
            await supabase.from('orders').update({ table_id: targetTableId }).eq('id', activeOrderId);
            await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);
            await supabase.from('tables').update({ status: 'occupied' }).eq('id', targetTableId);

            // Logging action
            if (currentUser) {
                const targetTable = (window as any).allTables?.find((t: any) => t.id === targetTableId);
                activityLogService.log({
                    user: currentUser,
                    module: 'SALA',
                    action: 'TRASLADO_MESA',
                    severity: 'WARNING',
                    entity_id: activeOrderId || undefined,
                    entity_type: 'ORDER',
                    changes: [
                        { field: 'mesa', label: 'Mesa', before: `${table.section} #${table.number}`, after: `${targetTable?.section || '?'} #${targetTable?.number || '?'}` }
                    ],
                    details: {
                        orderId: activeOrderId,
                        mesa_origen: { id: table.id, numero: table.number, seccion: table.section },
                        mesa_destino: { id: targetTableId, numero: targetTable?.number || '?', seccion: targetTable?.section || '?' }
                    }
                });
            }

            onClose?.();
        } catch (e) { console.error(e); }
        setProcessing(false);
    };

    const handleInvoiceSubmit = async (customer: CustomerData, paymentMethod: string, cardProcessor?: string) => {
        setShowInvoiceModal(false);
        setProcessing(true);
        try {
            const currentOrder = tableOrders.find(o => o.id === activeOrderId) ||
                (activeOrderId === initialOrder.id ? initialOrder : null);
            const orderType = currentOrder?.order_type || initialOrder.order_type || 'DINE_IN';

            // Recalculate based on active discounts exactly like the UI
            const currentSubtotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
            const accumulatedItemDiscounts = items.reduce((acc, i) => acc + (i.discount_amount || 0), 0);
            let invoiceGlobalDiscount = 0;
            if (discount) {
                if (discount.type === 'AMOUNT') {
                    invoiceGlobalDiscount = discount.value || 0;
                } else {
                    invoiceGlobalDiscount = currentSubtotal * discount.percentage / 100;
                }
            }
            const localTotalSavings = accumulatedItemDiscounts + invoiceGlobalDiscount;
            const subtotalAfterDiscount = Math.max(0, currentSubtotal - localTotalSavings);

            const currentTaxAmount = subtotalAfterDiscount - (subtotalAfterDiscount / 1.12);
            const tipRate = (orderType === 'TAKEOUT' || orderType === 'DELIVERY') ? 0 : 0.10;
            const currentTipAmount = subtotalAfterDiscount * tipRate;

            // Distribute global discount proportionally across items for the invoice (simplification: deduct item discount, then global proportionally)
            const invoiceItems = billingService.buildInvoiceItems(
                checkoutItems.map(i => {
                    const lineTotal = i.price * i.quantity;
                    const itemDiscountShare = i.discount_amount || 0;
                    const globalDiscountShare = currentSubtotal > 0 ? (lineTotal / currentSubtotal) * invoiceGlobalDiscount : 0;
                    const finalLineTotal = Math.max(0, lineTotal - itemDiscountShare - globalDiscountShare);
                    return { name: i.product_name, quantity: i.quantity, unit_price: finalLineTotal / i.quantity };
                })
            );

            const billingMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT' =
                paymentMethod === 'EFECTIVO' ? 'CASH' :
                    (paymentMethod === 'TARJETA' ? 'CARD' :
                        (paymentMethod === 'TRANSFERENCIA' ? 'TRANSFER' : 'CREDIT'));

            let result: any = { success: true, series: 'CONT', document_number: 'PENDIENTE' };

            if (!customer.is_contingency) {
                result = await billingService.processInvoice({
                    customer,
                    items: invoiceItems,
                    subtotal: subtotalAfterDiscount - currentTaxAmount,
                    tax_total: currentTaxAmount,
                    discount_total: 0, // already deducted from unit_prices above
                    grand_total: subtotalAfterDiscount,
                    payment_method: billingMethod,
                    order_id: activeOrderId || undefined
                }, JSON.parse(localStorage.getItem('currentUser') || '{}')?.branch_id);
            }

            if (result.success) {
                const ordersToComplete = activeOrderId ? [activeOrderId] : tableOrders.map(o => o.id);

                if (ordersToComplete.length > 0) {
                    // Update all included orders
                    for (const oid of ordersToComplete) {
                        const orderItems = checkoutItems.filter((i: any) => i.order_id === oid);
                        const oSubtotal = orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                        const oAccDiscounts = orderItems.reduce((acc, i) => acc + (i.discount_amount || 0), 0);
                        const oGlobalDisc = currentSubtotal > 0 ? (oSubtotal / currentSubtotal) * invoiceGlobalDiscount : 0;
                        const oSubtotalAfterDisc = Math.max(0, oSubtotal - (oAccDiscounts + oGlobalDisc));
                        const oTax = oSubtotalAfterDisc - (oSubtotalAfterDisc / 1.12);
                        const oTip = oSubtotalAfterDisc * tipRate;

                        const orderTotalWithTip = oSubtotalAfterDisc + oTip;
                        const isCash = paymentMethod === 'EFECTIVO';
                        const isCard = paymentMethod === 'TARJETA';
                        const isCredit = paymentMethod.includes('CREDIT') || paymentMethod.includes('CRÉDITO') || paymentMethod.includes('CREDITO');
                        const isOther = !isCash && !isCard && !isCredit;

                        const { error: updateError } = await supabase.from('orders').update({
                            status: 'completed',
                            payment_method: paymentMethod,
                            card_processor: cardProcessor,
                            total: orderTotalWithTip,
                            tip_amount: oTip,
                            subtotal: oSubtotalAfterDisc - oTax,
                            tax_amount: oTax,
                            cash_amount: isCash ? orderTotalWithTip : 0,
                            card_amount: isCard ? orderTotalWithTip : 0,
                            credit_amount: isCredit ? orderTotalWithTip : 0,
                            other_amount: isOther ? orderTotalWithTip : 0,
                            total_paid: orderTotalWithTip,
                            change_amount: 0
                        }).eq('id', oid);

                        if (updateError) throw updateError;
                    }

                    // LOG: Sale Completion
                    if (currentUser) {
                        activityLogService.logFinancial({
                            user: currentUser,
                            module: 'VENTAS',
                            action: 'ORDEN_CERRADA',
                            entity_id: ordersToComplete[0],
                            entity_type: 'ORDER',
                            details: {
                                orderIds: ordersToComplete,
                                ordenes_cerradas: ordersToComplete.length,
                                subtotal: subtotalAfterDiscount,
                                impuesto: currentTaxAmount,
                                propina: currentTipAmount,
                                descuento_total: localTotalSavings,
                                total_final: subtotalAfterDiscount + currentTipAmount,
                                forma_pago: paymentMethod,
                                procesador_tarjeta: cardProcessor || null,
                                factura_serie: result.series,
                                factura_numero: result.document_number,
                                factura_uuid: result.uuid,
                                cliente_nit: customer.nit,
                                cliente_nombre: customer.name,
                                es_contingencia: !!customer.is_contingency,
                                mesa: table?.number,
                                seccion: table?.section,
                                items_count: checkoutItems.length,
                                items: checkoutItems.map(i => ({ nombre: i.product_name, cantidad: i.quantity, precio: i.price }))
                            }
                        }, {
                            amount: subtotalAfterDiscount + currentTipAmount,
                            type: 'INGRESO',
                            currency: 'GTQ',
                            tax_amount: currentTaxAmount,
                            tip_amount: currentTipAmount
                        });
                    }

                    if (table?.id) await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);

                    if (customer.is_contingency) {
                        showAlert('Pedido Finalizado (MODO CONTINGENCIA)', 'Éxito');
                    } else {
                        // Print single consolidated invoice
                        const ticketData = {
                            orderId: activeOrderId || 'VIRTUAL',
                            orderNumber: currentOrder?.order_number || 'MESA',
                            tableNumber: table?.number,
                            tableName: table?.section,
                            waiterName: currentUser?.name || (currentUser as any)?.full_name,
                            items: checkoutItems.map(i => ({
                                name: i.product_name,
                                quantity: i.quantity,
                                price: i.price,
                                notes: formatNotesForDisplay(i.notes)
                            })),
                            subtotal: subtotalAfterDiscount - currentTaxAmount,
                            taxAmount: currentTaxAmount,
                            tipAmount: currentTipAmount,
                            total: subtotalAfterDiscount + currentTipAmount,
                            createdAt: new Date().toISOString(),
                            paymentMethod: paymentMethod,
                            customerNit: customer.nit,
                            customerName: customer.name,
                            dteInfo: {
                                serie: result.series,
                                numero: result.document_number,
                                fechaCertificacion: result.certification_date || new Date().toISOString(),
                                autorizacion: result.uuid
                            }
                        };
                        await printService.printInvoiceTicket(ticketData as any);
                    }
                    onClose?.();
                }
            } else {
                console.error(`❌ Error: ${result.error}`);
            }
        } catch (e: any) {
            console.error(`Error inesperado: ${e.message}`);
        } finally {
            setProcessing(false);
        }
    };


    const handleAddEmptyAccount = async () => {
        setProcessing(true);
        try {
            // Find next available name like "CUENTA X"
            const usedNames = new Set<string>();
            tableOrders.forEach((o, index) => {
                const name = o.customer_name?.trim().toUpperCase();
                if (!name || name === 'CUENTA PRINCIPAL') {
                    usedNames.add(`CUENTA ${index + 1}`);
                } else {
                    usedNames.add(name);
                }
            });

            let nextNum = 1;
            while (usedNames.has(`CUENTA ${nextNum}`)) {
                nextNum++;
            }
            const nextName = `CUENTA ${nextNum}`;

            const { data: newOrder, error } = await supabase.from('orders').insert({
                table_id: table?.id,
                status: 'pending',
                order_type: 'DINE_IN',
                waiter_id: currentUser?.id,
                customer_name: nextName,
                pax_count: 1,
                branch_id: currentUser?.branch_id,
                created_at: DateUtils.toGuatemalaISO(new Date(Date.now() + serverOffset))
            }).select().single();

            if (error) throw error;
            if (newOrder) {
                await fetchData(false, newOrder.id);
                setActiveOrderId(newOrder.id);
                notify.success('Cuenta añadida');
            }
        } catch (e: any) {
            console.error(e);
            notify.error('Error al añadir cuenta');
        } finally {
            setProcessing(false);
        }
    };

    const getOrderDisplayName = (orderId: string | null): string => {
        if (tableOrders.length <= 1) {
            const singleOrder = tableOrders[0] || (orderId === initialOrder?.id ? initialOrder : null) || initialOrder;
            const name = singleOrder?.customer_name?.trim();
            if (!name || name.toUpperCase() === 'CUENTA PRINCIPAL' || name.toUpperCase() === 'CUENTA COMPLETA' || name.toUpperCase() === 'TODAS LAS CUENTAS') {
                return 'CUENTA 1';
            }
            return name.toUpperCase();
        }

        if (orderId === null) return 'TODAS LAS CUENTAS';

        const currentOrder = tableOrders.find(o => o.id === orderId) || (orderId === initialOrder?.id ? initialOrder : null);
        if (!currentOrder) return 'CUENTA 1';

        const usedNames = new Set<string>();
        let targetName = '';

        tableOrders.forEach((order, index) => {
            let name = order.customer_name?.trim();
            if (!name || name.toUpperCase() === 'CUENTA PRINCIPAL') {
                name = `CUENTA ${index + 1}`;
            }

            let finalName = name.toUpperCase();
            if (usedNames.has(finalName)) {
                let nextNum = index + 1;
                while (usedNames.has(`CUENTA ${nextNum}`)) {
                    nextNum++;
                }
                finalName = `CUENTA ${nextNum}`;
            }
            usedNames.add(finalName);

            if (order.id === orderId) {
                targetName = finalName;
            }
        });

        if (targetName) return targetName;

        let name = currentOrder.customer_name?.trim();
        if (!name || name.toUpperCase() === 'CUENTA PRINCIPAL') {
            const index = tableOrders.findIndex(o => o.id === orderId);
            return `CUENTA ${index >= 0 ? index + 1 : 1}`;
        }
        return name.toUpperCase();
    };

    const handleAccountDivision = async (accounts: any[]) => {
        setProcessing(true);
        try {
            const newOrderIds = new Set<string>(); // Track newly created order IDs

            for (const acc of accounts) {
                let targetOrderId = acc.originalOrderId;

                // 1. Create Order if New (only if it has items)
                if (!targetOrderId && acc.items.length > 0) {
                    const { data: newOrder, error: createErr } = await supabase.from('orders').insert({
                        table_id: table?.id,
                        status: 'pending',
                        order_type: 'DINE_IN',
                        waiter_id: currentUser?.id,
                        customer_name: acc.name,
                        pax_count: 1,
                        branch_id: currentUser?.branch_id,
                        created_at: DateUtils.toGuatemalaISO(new Date(Date.now() + serverOffset))
                    }).select().single();

                    if (createErr) {
                        console.error('❌ Error creando nueva cuenta:', createErr);
                        showAlert(`Error al crear la cuenta "${acc.name}": ${createErr.message}`, 'Error');
                        setProcessing(false);
                        return;
                    }

                    if (newOrder) {
                        targetOrderId = newOrder.id;
                        newOrderIds.add(newOrder.id); // Track for cleanup protection
                        console.log(`✅ Nueva cuenta creada: "${acc.name}" → OrderID: ${targetOrderId}`);
                    }
                }

                // 2. Move Items (Update order_id)
                if (targetOrderId && acc.items.length > 0) {
                    const itemIds = acc.items
                        .map((i: any) => i.id)
                        .filter((id: string) => !id.toString().startsWith('i-'));

                    console.log(`🔄 Procesando cuenta ${acc.name} (OrderID: ${targetOrderId}). Items a mover:`, itemIds);

                    if (itemIds.length > 0) {
                        const { data: moveData, error: moveError } = await supabase
                            .from('order_items')
                            .update({ order_id: targetOrderId })
                            .in('id', itemIds)
                            .select();

                        if (moveError) {
                            console.error('❌ Error crítico al mover items:', moveError);
                            showAlert(`Error al mover items a ${acc.name}: ${moveError.message}`, 'Error');
                        } else {
                            if (!moveData || moveData.length === 0) {
                                showAlert(`Advertencia: No se pudieron mover los productos a ${acc.name}. Verifique permisos o si la orden está bloqueada.`, 'Advertencia');
                            } else {
                                // Log item movement within split
                                if (currentUser) {
                                    activityLogService.log({
                                        user: currentUser,
                                        module: 'SALA',
                                        action: 'DIVISION_CUENTA',
                                        severity: 'WARNING',
                                        entity_id: activeOrderId || undefined,
                                        entity_type: 'ORDER',
                                        details: {
                                            cuenta_destino: acc.name,
                                            orden_destino_id: targetOrderId,
                                            orden_origen_id: activeOrderId,
                                            items_movidos: itemIds.length,
                                            mesa: table?.number,
                                            seccion: table?.section
                                        }
                                    });
                                }
                            }
                        }
                    }

                    // Update Account Name
                    await supabase
                        .from('orders')
                        .update({ customer_name: acc.name })
                        .eq('id', targetOrderId);
                }
            }

            // 3. Cleanup — Only delete orders that are truly orphaned (not in valid set, not active, no items)
            // Build validOrderIds from ALL account order IDs: original + newly created
            const validOrderIds = new Set<string>([
                ...accounts.map((acc: any) => acc.originalOrderId).filter(Boolean),
                ...Array.from(newOrderIds)
            ]);
            if (activeOrderId) validOrderIds.add(activeOrderId); // Always protect active order

            if (table?.id) {
                const { data: currentOrders } = await supabase
                    .from('orders')
                    .select('id, items:order_items(id)')
                    .eq('table_id', table.id)
                    .in('status', ['pending', 'preparing', 'ready', 'served']);

                if (currentOrders) {
                    for (const order of currentOrders) {
                        const itemCount = order.items && Array.isArray(order.items) ? order.items.length : 0;
                        const isOrphaned = !validOrderIds.has(order.id);

                        // Only delete if orphaned AND has no items
                        if (isOrphaned && itemCount === 0) {
                            console.log(`🧹 Eliminando cuenta vacía huérfana: ${order.id}`);
                            await supabase.from('orders').delete().eq('id', order.id);
                        }
                    }
                }
            }

            // 4. Switch to first account so the user sees the split result
            const firstAccountOrderId = accounts[0]?.originalOrderId || Array.from(newOrderIds)[0];
            if (firstAccountOrderId) {
                setActiveOrderId(firstAccountOrderId);
            }

            setShowAccountsModal(false);
            await fetchData(false, firstAccountOrderId || activeOrderId);

        } catch (e: any) {
            console.error('Error dividing accounts:', e);
            showAlert('Error al dividir cuentas: ' + e.message, 'Error');
        }
        setProcessing(false);
    };

    const fetchData = async (silent = false, overrideActiveOrderId?: string | null) => {
        // 1. HYBRID LOAD: Try Cache First (Catalogues)
        let hasCache = false;

        try {
            const { masterDataDB } = await import('../services/MasterDataDB');

            // Try loading from IndexedDB first (Primary offline source)
            let masterCats = await masterDataDB.getAll('categories');
            let masterProds = await masterDataDB.getAll('products');

            // Fallback to localStorage if IndexedDB is empty (Legacy compat)
            if (masterCats.length === 0) {
                const cachedCatsStr = localStorage.getItem('cached_categories');
                if (cachedCatsStr) masterCats = JSON.parse(cachedCatsStr);
            }
            if (masterProds.length === 0) {
                const cachedProdsStr = localStorage.getItem('cached_products');
                if (cachedProdsStr) masterProds = JSON.parse(cachedProdsStr);
            }

            // Only update from cache if we don't have data already to prevent flicker during background reloads
            if (masterCats?.length > 0 && categories.length === 0) {
                setCategories(masterCats);
                hasCache = true;
            }
            if (masterProds?.length > 0 && products.length === 0) {
                setProducts(masterProds);
                hasCache = true;
            }
        } catch (e) {
            console.error('Master data cache load error', e);
        }

        // Only show full loader if we have absolutely no data and it's not a silent reload
        // Only show full loader on initial load (when no items/tableOrders exist)
        const isInitialLoad = items.length === 0 && tableOrders.length === 0;
        if (!silent && isInitialLoad && !hasCache) {
            setLoading(true);
        }

        // ----------------------------------------------------------
        // OFFLINE MODE: Load Order from Deep Cache
        // ----------------------------------------------------------
        if (!navigator.onLine && table?.id) {
            console.log('🔌 Offline Mode: Loading from deep cache for table:', table.id);
            try {
                const cachedOrdersStr = localStorage.getItem('cached_active_orders');
                if (cachedOrdersStr) {
                    const cachedOrdersMap = JSON.parse(cachedOrdersStr);
                    const cachedOrder = cachedOrdersMap[table.id];

                    if (cachedOrder) {
                        console.log('📦 Offline Order Found:', cachedOrder);
                        const itemsMapped = (cachedOrder.order_items || []).map((oi: any) => ({
                            id: oi.id,
                            product_id: oi.product_id,
                            product_name: oi.products?.name || oi.product_name || 'Producto',
                            price: oi.unit_price || oi.price,
                            quantity: oi.quantity,
                            notes: oi.notes,
                            status: oi.status || 'pending',
                            is_sent: true, // Loaded from "server cache", so it's sent
                            created_at: oi.created_at,
                            preparing_at: oi.preparing_at,
                            ready_at: oi.ready_at,
                            discount_id: oi.discount_id,
                            discount_percentage: oi.discount_percentage,
                            discount_amount: oi.discount_amount
                        }));

                        setTableOrders([cachedOrder]);
                        setActiveOrderId(cachedOrder.id);
                        setItems(itemsMapped);

                        // Set discount local state if present
                        if (cachedOrder.discount_percentage > 0 || cachedOrder.discount_amount > 0 || cachedOrder.discount_id) {
                            setDiscount({
                                id: cachedOrder.discount_id || 'manual',
                                name: 'Descuento',
                                percentage: cachedOrder.discount_percentage,
                                value: cachedOrder.discount_percentage > 0 ? cachedOrder.discount_percentage : cachedOrder.discount_amount,
                                type: cachedOrder.discount_percentage > 0 ? 'PERCENT' : 'AMOUNT'
                            });
                        }
                    } else {
                        // Table is empty offline
                        console.log('Table is empty in offline cache');
                        setTableOrders([]);
                        setItems([]);
                        setActiveOrderId(null);
                    }
                }
            } catch (e) { console.error('Offline cache load error:', e); }

            setLoading(false);
            return; // STOP HERE if offline
        }

        try {
            const myBranchId = currentUser?.branch_id;

            // RELOAD MASTER DATA FROM IndexedDB ONLY IF LOCAL STATE IS EMPTY (Failsafe)
            if (categories.length === 0 || products.length === 0) {
                try {
                    const { masterDataDB } = await import('../services/MasterDataDB');
                    const [masterCats, masterProds] = await Promise.all([
                        masterDataDB.getAll('categories'),
                        masterDataDB.getAll('products')
                    ]);

                    if (masterCats?.length > 0) {
                        setCategories(masterCats);
                    } else if (navigator.onLine) {
                        // EMERGENCY FALLBACK: If DB is empty and we are online, fetch from Supabase
                        console.log('⚡ Emergency categories fetch triggered...');
                        const { data } = await supabase.from('categories').select('*').order('order_index');
                        if (data && data.length > 0) {
                            setCategories(data);
                            localStorage.setItem('cached_categories', JSON.stringify(data));
                        }
                    }

                    if (masterProds?.length > 0) {
                        setProducts(masterProds);
                    } else if (navigator.onLine) {
                        console.log('⚡ Emergency products fetch triggered...');
                        const { data } = await supabase.from('products').select('*').eq('is_enabled', true);
                        if (data && data.length > 0) {
                            setProducts(data);
                            localStorage.setItem('cached_products', JSON.stringify(data));
                        }
                    }
                } catch (e) {
                    console.error('Failsafe master data load failed', e);
                }
            }

            if (!table?.id && !activeOrderId) {
                console.warn('⚠️ OrderView: No context (Table/ID), skipping fetch.');
                setLoading(false);
                return;
            }

            if (table?.id || activeOrderId) {
                console.log('🔍 Buscando órdenes. ID:', activeOrderId, 'Mesa:', table?.id);

                let query = supabase
                    .from('orders')
                    .select('*, waiter:profiles!orders_waiter_id_fkey(name)')
                    .neq('status', 'completed')
                    .neq('status', 'cancelled');

                if (myBranchId) query = query.eq('branch_id', myBranchId);

                if (table?.id) {
                    query = query.eq('table_id', table.id);
                } else if (activeOrderId) {
                    query = query.eq('id', activeOrderId);
                }

                const { data: existingOrders, error: ordersError } = await query.order('created_at', { ascending: true });

                if (ordersError) {
                    console.error('❌ Error fetching orders:', ordersError);
                    setTableOrders([]);
                    // Keep local items, only clear database items
                    setItems(prev => prev.filter(i => !i.is_sent));
                    setActiveOrderId(null);
                } else if (existingOrders && existingOrders.length > 0) {
                    // ... (rest of the logic identical)
                    console.log('📦 Órdenes encontradas:', existingOrders.length);

                    const orderIds = existingOrders.map(o => o.id);
                    const { data: allOrderItems } = await supabase
                        .from('order_items')
                        .select('*, products:products!product_id(*)')
                        .in('order_id', orderIds);

                    const ordersWithItems = existingOrders.map(order => ({
                        ...order,
                        order_items: (allOrderItems || []).filter(item => item.order_id === order.id)
                    }));

                    setTableOrders(ordersWithItems);

                    // --- UNIFIED VIEW LOGIC ---
                    // Union of all items from all active orders of this table
                    const allTableItems = (allOrderItems || [])
                        .filter((oi: any) => oi.status !== 'voided')
                        .map((oi: any) => ({
                            id: oi.id,
                            order_id: oi.order_id,
                            product_id: oi.product_id,
                            product_name: oi.products?.name || 'Producto',
                            price: oi.unit_price,
                            quantity: oi.quantity,
                            notes: oi.notes,
                            status: oi.status || 'pending',
                            is_sent: true,
                            created_at: oi.created_at,
                            preparing_at: oi.preparing_at,
                            ready_at: oi.ready_at,
                            discount_id: oi.discount_id,
                            discount_percentage: oi.discount_percentage,
                            discount_amount: oi.discount_amount
                        }));

                    // Preserve local unsent items and ENSURE strict deduplication to avoid ghost duplicates
                    setItems(prevItems => {
                        const localItems = prevItems.filter(i => !i.is_sent);
                        const merged = [...allTableItems, ...localItems];

                        // Strict Deduplication based on ID
                        const uniqueMap = new Map();
                        merged.forEach(item => {
                            // Local items shouldn't overwrite remote items if somehow IDs match
                            if (!uniqueMap.has(item.id)) {
                                uniqueMap.set(item.id, item);
                            }
                        });
                        return Array.from(uniqueMap.values());
                    });

                    // Set activeOrderId only if the current one is entirely invalid (e.g. deleted order).
                    // We shouldn't force one if it's intentionally null (Todas las cuentas).
                    const effectiveActiveOrderId = overrideActiveOrderId !== undefined ? overrideActiveOrderId : activeOrderId;
                    if (effectiveActiveOrderId !== null && !ordersWithItems.some(o => o.id === effectiveActiveOrderId)) {
                        setActiveOrderId(ordersWithItems[ordersWithItems.length - 1].id);
                    } else if (overrideActiveOrderId !== undefined && overrideActiveOrderId !== activeOrderId) {
                        // Apply the override if it's different from current state
                        setActiveOrderId(overrideActiveOrderId);
                    }

                    // For totals/discounts, we might want to stick to the "Current" order context 
                    // or the first one. Let's pick the one matches activeOrderId.
                    const currentOrder = ordersWithItems.find(o => o.id === activeOrderId) || ordersWithItems[0];

                    if (currentOrder.discount_id || currentOrder.discount_percentage > 0 || currentOrder.discount_amount > 0) {
                        setDiscount({
                            id: currentOrder.discount_id || 'manual',
                            name: 'Descuento Aplicado',
                            percentage: currentOrder.discount_percentage,
                            value: currentOrder.discount_percentage > 0 ? currentOrder.discount_percentage : currentOrder.discount_amount,
                            type: currentOrder.discount_percentage > 0 ? 'PERCENT' : 'AMOUNT'
                        });
                        setDiscountReason(currentOrder.discount_reason || '');
                    } else {
                        setDiscount(null);
                        setDiscountReason('');
                    }

                    console.log('✅ Base de Datos Reflejada: ', allTableItems.length, 'ítems totales en mesa.');
                } else {
                    console.log('📭 No hay órdenes pendientes para esta mesa');
                    setTableOrders([]);
                    // Keep local items
                    setItems(prev => prev.filter(i => !i.is_sent));
                    setActiveOrderId(null);
                }
            }
        } catch (error) { console.error(error); }
        setLoading(false);
    };


    useEffect(() => {
        if (tableOrders.length === 0) return;

        const orderIds = tableOrders.map(o => o.id);
        console.log('🔌 Suscribiendo a cambios en tiempo real para las órdenes de la mesa:', orderIds);

        const channel = supabase
            .channel(`table_items_${table?.id || 'any'}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'order_items'
                },
                (payload) => {
                    const newItem = payload.new as any;
                    // Only process if it belongs to one of the active orders on this table
                    if (!orderIds.includes(newItem.order_id)) return;

                    console.log('🔔 Cambio en item detectado:', newItem);
                    setItems(prevItems => {
                        const exists = prevItems.find(i => i.id === newItem.id);
                        if (!exists) return prevItems;

                        // If voided, remove it
                        if (newItem.status === 'voided') {
                            return prevItems.filter(i => i.id !== newItem.id);
                        }

                        // Otherwise update securely
                        const updatedArray = prevItems.map(item =>
                            item.id === newItem.id
                                ? { ...item, ...newItem }
                                : item
                        );

                        // Strict deduplication safety check
                        const uniqueMap = new Map();
                        updatedArray.forEach(item => uniqueMap.set(item.id, item));
                        return Array.from(uniqueMap.values());
                    });
                }
            )
            .subscribe();

        return () => {
            console.log('🔌 Desuscribiendo canal de mesa...');
            supabase.removeChannel(channel);
        };
    }, [tableOrders]);

    // POLLING FALLBACK: Refresh order data periodically  
    // Paused when AccountsModal is open to prevent state conflicts
    useEffect(() => {
        if (!activeOrderId) return;
        const interval = setInterval(() => {
            // Only fetch if tab is visible AND accounts modal is NOT open
            if (document.visibilityState === 'visible' && !showAccountsModal && !processing) {
                fetchData(true);
            }
        }, 15000); // 15s instead of 5s to reduce interference
        return () => clearInterval(interval);
    }, [activeOrderId, showAccountsModal, processing]);

    useEffect(() => {
        const syncTime = async () => {
            const { data, error } = await supabase.rpc('get_server_time');
            if (data && !error) {
                const serverTime = new Date(data).getTime();
                const clientTime = new Date().getTime();
                setServerOffset(serverTime - clientTime);
            }
        };
        syncTime();
    }, []);

    useEffect(() => { fetchData(true); }, [table, activeOrderId]);

    const updateQty = (id: string, d: number) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + d) } : i));
    };

    const removeItem = (id: string) => {
        const item = items.find(i => i.id === id);
        if (!item) return;

        // Si el item NO ha sido enviado (es nuevo en esta sesión), cualquiera puede quitarlo
        if (id.startsWith('i-') || !item.is_sent) {
            setItems(prev => prev.filter(i => i.id !== id));
            return;
        }

        // Si el item YA está en base de datos, solo ADMIN o CAJERO pueden anularlo directamente.
        // Los meseros pueden iniciar el flujo pero requerirán PIN de administrador.
        // v1.6.2 - FLUJO UNIFICADO: Siempre pedir motivo ANTES que el PIN
        setItemToVoid(item);
        setVoidReason('');
        setPendingAction('delete');
        setShowVoidModal(true);
    };

    const handleVoidItem = async (adminPin?: string) => {
        // v1.6.1 - Si es autorización remota o admin pin, permitimos motivo vacío con fallback
        const effectiveReason = (voidReason.trim().length < 5 && (adminPin === 'REMOTE' || adminPin))
            ? (voidReason.trim() || 'Autorización Remota')
            : voidReason;

        if (!itemToVoid || effectiveReason.trim().length < 5) {
            console.warn('⚠️ Intento de anulación sin motivo suficiente:', { itemToVoid, voidReason });
            return;
        }

        setProcessing(true);
        const nowGuate = DateUtils.toGuatemalaISO(new Date());

        try {
            // Update UI immediately (Optimistic UI)
            const itemToRemove = itemToVoid; // Lock the reference
            setItems(prev => prev.filter(i => i.id !== itemToRemove.id));

            if (!isOnline) {
                console.log('🔌 Offline: Queuing void reason for later...');
                const pending = JSON.parse(localStorage.getItem('pending_voids') || '[]');
                pending.push({ id: itemToRemove.id, reason: effectiveReason, at: nowGuate });
                localStorage.setItem('pending_voids', JSON.stringify(pending));
            } else {
                const { data: rpcResult, error: voidError } = await supabase.rpc('void_item_with_pin', {
                    p_item_id: itemToRemove.id,
                    p_admin_pin: adminPin || '',
                    p_void_reason: effectiveReason,
                    p_voided_at: nowGuate
                });

                if (voidError || (rpcResult && rpcResult.success === false)) {
                    throw voidError || new Error(rpcResult?.error || 'Error al anular item');
                }
            }

            // v1.5.5 - RESTORE STOCK LOCALLY for immediate feedback (Handles both Online & Offline UI)
            const voidQty = itemToVoid.quantity;
            setProducts(prev => prev.map(p => {
                if (p.id === itemToVoid.product_id) {
                    return {
                        ...p,
                        stock_actual: (p.stock_actual || 0) + voidQty,
                        stock_quantity: (p.stock_quantity || 0) + voidQty
                    };
                }
                return p;
            }));

            setBranchInventory(prev => prev.map(inv => {
                if (inv.product_id === itemToVoid.product_id && inv.branch_id === currentUser?.branch_id) {
                    return { ...inv, quantity: (inv.quantity || 0) + voidQty };
                }
                return inv;
            }));

            // v1.6.0 - REVERT Item Inventory (Insumos) by name
            setItemInventory(prev => {
                const updated = prev.map(inv => {
                    if (inv.branch_id !== currentUser?.branch_id) return inv;
                    const itemProduct = products.find((p: any) => p.id === inv.item_id || p.id === inv.product_id);
                    const itemName = (itemProduct?.name || '').trim().toUpperCase();
                    if (itemName === (itemToVoid.product_name || '').trim().toUpperCase()) {
                        console.log(`📦 Reverting ItemInv: ${itemName} ${inv.quantity} → ${inv.quantity + voidQty}`);
                        return { ...inv, quantity: (inv.quantity || 0) + voidQty };
                    }
                    return inv;
                });
                localStorage.setItem('cached_inventory_item_branches', JSON.stringify(updated));
                return updated;
            });

            // v1.6.0 - REVERT Insumos in DB (Sync Shadow Stock)
            const revertItemInventoryInDB = async () => {
                if (!isOnline) return;
                const nameKey = (itemToVoid.product_name || '').trim().toUpperCase();
                const invProduct = products.find((p: any) => (p.name || '').trim().toUpperCase() === nameKey && !p.es_platillo);
                if (invProduct) {
                    try {
                        const { data: currentStock } = await supabase
                            .from('inventory_item_branches')
                            .select('quantity')
                            .eq('item_id', invProduct.id)
                            .eq('branch_id', currentUser?.branch_id)
                            .single();

                        if (currentStock) {
                            await supabase.from('inventory_item_branches')
                                .update({ quantity: currentStock.quantity + voidQty })
                                .eq('item_id', invProduct.id)
                                .eq('branch_id', currentUser?.branch_id);
                        }
                    } catch (e) { console.error('Error reverting shadow stock in DB:', e); }
                }
            };
            revertItemInventoryInDB();

            // Sync with localStorage
            const cachedProdsStr = localStorage.getItem('cached_products');
            if (cachedProdsStr) {
                try {
                    const parsed = JSON.parse(cachedProdsStr).map((p: any) => {
                        if (p.id === itemToVoid.product_id) {
                            return {
                                ...p,
                                stock_actual: (p.stock_actual || 0) + voidQty,
                                stock_quantity: (p.stock_quantity || 0) + voidQty
                            };
                        }
                        return p;
                    });
                    localStorage.setItem('cached_products', JSON.stringify(parsed));
                } catch (e) { console.error('Error updating cached products on void:', e); }
            }

            const cachedItemInvStr = localStorage.getItem('cached_inventory_item_branches');
            if (cachedItemInvStr) {
                try {
                    const parsed = JSON.parse(cachedItemInvStr).map((inv: any) => {
                        const itemProduct = products.find((p: any) => p.id === inv.item_id || p.id === inv.product_id);
                        const itemName = (itemProduct?.name || '').trim().toUpperCase();
                        if (itemName === (itemToVoid.product_name || '').trim().toUpperCase() && inv.branch_id === currentUser?.branch_id) {
                            return { ...inv, quantity: (inv.quantity || 0) + voidQty };
                        }
                        return inv;
                    });
                    localStorage.setItem('cached_inventory_item_branches', JSON.stringify(parsed));
                } catch (e) { console.error('Error updating cached items on void:', e); }
            }

            // Trigger UI refresh event
            window.dispatchEvent(new CustomEvent('inventory-state-updated'));

            // Logging action
            if (currentUser) {
                activityLogService.logFinancial({
                    user: currentUser,
                    module: 'VENTAS',
                    action: 'ITEM_ANULADO',
                    severity: 'CRITICAL',
                    entity_id: activeOrderId || undefined,
                    entity_type: 'ORDER',
                    details: {
                        productId: itemToVoid.product_id,
                        productName: itemToVoid.product_name,
                        orderId: activeOrderId,
                        cantidad: itemToVoid.quantity,
                        precio_unitario: itemToVoid.price,
                        monto_anulado: itemToVoid.price * itemToVoid.quantity,
                        motivo: voidReason,
                        mesa: table?.number,
                        seccion: table?.section,
                        mesero: currentUser.name
                    }
                }, {
                    amount: itemToVoid.price * itemToVoid.quantity,
                    type: 'ANULACION',
                    currency: 'GTQ'
                });
            }

            // v1.7.2 - Find the specific order number for this voided item
            const currentOrder = tableOrders.find(o => o.id === activeOrderId) || initialOrder;
            const currentOrderNumber = currentOrder?.order_number;
            const orderType = currentOrder?.order_type || 'DINE_IN';
            const displayTable = (orderType === 'TAKEOUT' || orderType === 'DELIVERY')
                ? 'PARA LLEVAR'
                : (table?.number || '--');
            const sectionName = table?.section || 'SALA';
            const waiterName = (itemToVoid as any).waiter_name || currentOrder?.waiter?.name || currentOrder?.profiles?.name || currentUser?.name || 'MESERO';

            // Audit Print (Always try local print if Electron)
            await printService.printVoidTicket({
                waiterName: waiterName,
                cashierName: currentUser?.name || 'SISTEMA',
                sectionName: sectionName,
                tableNumber: displayTable,
                productName: itemToVoid.product_name,
                quantity: itemToVoid.quantity,
                voidReason: voidReason,
                voidedAt: DateUtils.formatDisplay(new Date()),
                orderNumber: currentOrderNumber
            });

        } catch (e) {
            console.error('❌ Error anular:', e);
            showAlert('No se pudo procesar la anulación en el servidor.', 'Error de Servidor');
        } finally {
            setProcessing(false);
            setShowVoidModal(false);
            setItemToVoid(null);
            setVoidReason('');
        }
    };
    // --- FIX FOR SUBTOTAL/TOTAL CALCULATIONS ---
    // If an activeOrderId is explicitly selected, calculate only for that order!
    // Otherwise calculate for the entire table view.
    // Dedup at source: Supabase Realtime can re-insert items causing duplicate IDs
    const checkoutItems = (() => {
        const filtered = items.filter(i => {
            if (!activeOrderId) return true;
            if (!i.is_sent) return true;
            return (i as any).order_id === activeOrderId;
        });
        // Remove duplicates by id, keeping the last seen (most up-to-date)
        const seen = new Map<string, typeof filtered[0]>();
        filtered.forEach(i => { if (i.id) seen.set(i.id, i); });
        return Array.from(seen.values());
    })();

    const subtotal = checkoutItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const accumulatedItemDiscounts = checkoutItems.reduce((acc, i) => acc + (i.discount_amount || 0), 0);

    let globalDiscountAmount2 = 0;
    if (discount) {
        if (discount.type === 'AMOUNT') {
            globalDiscountAmount2 = discount.value || 0;
        } else {
            globalDiscountAmount2 = (subtotal * discount.percentage / 100);
        }
    }
    const totalSavings = accumulatedItemDiscounts + globalDiscountAmount2;

    const subtotalAfterDiscount = Math.max(0, subtotal - totalSavings);

    const taxRate = parseFloat(settings?.tax_percentage || '12') / 100;
    const taxAmount = subtotalAfterDiscount - (subtotalAfterDiscount / (1 + taxRate));

    const orderType = tableOrders.find(o => o.id === activeOrderId)?.order_type || initialOrder.order_type || 'DINE_IN';
    const tipRate = (orderType === 'TAKEOUT' || orderType === 'DELIVERY') ? 0 : (parseFloat(settings?.suggested_tip || '10') / 100);
    const rawTip = subtotalAfterDiscount * tipRate;
    const tipAmount = settings?.round_tip ? Math.round(rawTip) : parseFloat(rawTip.toFixed(2));

    const currency = (settings?.currency === 'GTQ' || settings?.currency === 'Q') ? 'Q.' : (settings?.currency || 'Q.');
    const total = subtotalAfterDiscount;

    const handleTransferWaiter = async (newWaiterId: string) => {
        if (!activeOrderId && tableOrders.length === 0) return;

        setProcessing(true);
        try {
            const orderIdsToUpdate = activeOrderId ? [activeOrderId] : tableOrders.map(o => o.id);
            if (orderIdsToUpdate.length > 0) {
                const { error } = await supabase.from('orders').update({ waiter_id: newWaiterId }).in('id', orderIdsToUpdate);
                if (error) throw error;

                // Log waiter transfer
                if (currentUser) {
                    activityLogService.log({
                        user: currentUser,
                        module: 'VENTAS',
                        action: 'CAMBIO_MESERO',
                        severity: 'WARNING',
                        entity_id: orderIdsToUpdate[0],
                        entity_type: 'ORDER',
                        changes: [
                            { field: 'mesero', label: 'Mesero Responsable', before: currentUser.name, after: newWaiterId }
                        ],
                        details: {
                            orderIds: orderIdsToUpdate,
                            ordenes_afectadas: orderIdsToUpdate.length,
                            mesero_anterior_id: currentUser.id,
                            mesero_anterior_nombre: currentUser.name,
                            mesero_nuevo_id: newWaiterId,
                            mesa: table?.number,
                            seccion: table?.section
                        }
                    });
                }
            }
            setShowTransferWaiterModal(false);
            await fetchData();
        } catch (e: any) {
            console.error('Error transferring waiter:', e);
            showAlert('Error al transferir responsable: ' + e.message, 'Error');
        }
        setProcessing(false);
    };

    const handleOrderSubmission = async (paymentMethod?: string, customerInfo?: { name: string, phone: string }): Promise<string | undefined> => {
        const unsentItems = items.filter(i => !i.is_sent);
        if (processing || items.length === 0 || (activeOrderId && unsentItems.length === 0)) return;

        // 1. GENERATE OR RETRIEVE UUID (Mandatory for Offline Resilience)
        const finalOrderId = activeOrderId || generateUUID();

        const nowWithOffset = new Date(Date.now() + serverOffset);

        // Update initialOrder if customerInfo provided
        if (customerInfo) {
            initialOrder.customer_name = customerInfo.name;
            initialOrder.customer_phone = customerInfo.phone;
        }

        // Prepare Data Bundle for Offline Storage/Sync
        const orderData = {
            id: finalOrderId,
            order: {
                table_id: table?.id,
                status: 'pending',
                order_type: initialOrder.order_type || 'DINE_IN',
                customer_phone: customerInfo?.phone || initialOrder.customer_phone,
                customer_name: customerInfo?.name || initialOrder.customer_name,
                delivery_address: initialOrder.delivery_address,
                customer_id: initialOrder.customer_id,
                platform_id: initialOrder.platform_id,
                is_platform_driver: initialOrder.is_platform_driver,
                payment_method: paymentMethod || null,
                subtotal,
                tax_amount: taxAmount,
                tip_amount: tipAmount,
                total: total + tipAmount,
                waiter_id: currentUser?.id,
                pax_count: initialOrder.pax_count || (initialOrder as any).pax_count || 1,
                branch_id: currentUser?.branch_id,
                created_at: DateUtils.toGuatemalaISO(nowWithOffset)
            },
            items: unsentItems.map(i => {
                return {
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.price,
                    notes: i.notes,
                    status: (i as any).status || 'pending',
                    created_at: DateUtils.toGuatemalaISO(nowWithOffset),
                    discount_id: i.discount_id,
                    discount_percentage: i.discount_percentage,
                    discount_amount: i.discount_amount,
                    discount_reason: i.discount_reason
                };
            })
        };

        // 2. CHECK OFFLINE STATUS (ping real — no confiar en navigator.onLine)
        let isReallyOffline = !navigator.onLine;
        if (!isReallyOffline) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const { error: pingErr } = await supabase
                    .from('system_settings').select('id').limit(1).abortSignal(controller.signal);
                clearTimeout(timeout);
                if (pingErr) isReallyOffline = true;
            } catch {
                isReallyOffline = true;
            }
        }
        if (isReallyOffline) {
            try {
                await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('ORDER', orderData));
                console.log('📦 Orden guardada en IndexedDB (Offline):', finalOrderId);

                // v1.7.0 - MARCAR MESA COMO OCUPADA LOCALMENTE para que TableGrid la muestre correctamente
                if (table?.id) {
                    try {
                        const offlineTables = JSON.parse(localStorage.getItem('offline_occupied_tables') || '{}');
                        offlineTables[table.id] = {
                            order_id: finalOrderId,
                            table_id: table.id,
                            table_number: table.number,
                            waiter_id: currentUser?.id,
                            waiter_name: currentUser?.name,
                            created_at: new Date().toISOString()
                        };
                        localStorage.setItem('offline_occupied_tables', JSON.stringify(offlineTables));
                        console.log('🏷️ Mesa marcada como ocupada localmente:', table.number);
                    } catch (lsErr) {
                        console.warn('Error guardando estado de mesa offline:', lsErr);
                    }
                }

                // v1.4.6 - NO CLEARING of state allowed for resilience
                setItems(current => current.map(item => {
                    if (!item.is_sent) return { ...item, is_offline: true };
                    return item;
                }));

                notify.offline('🔌 Sin Conexión: El pedido se guardó localmente. NO cierres la mesa hasta que se sincronice.');

                // Dispatch events to update status
                window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
                window.dispatchEvent(new CustomEvent('refresh-inventory'));
                setProcessing(false);
                return finalOrderId;
            } catch (e) {
                console.error('Error saving to IndexedDB:', e);
            }
        }

        setProcessing(true);
        try {
            const isElectron = !!(window as any).electron;

            // Optimization: Set is_sent locally before the heavy network call
            setItems(prev => prev.map(i => ({ ...i, is_sent: true })));

            // 3. ONLINE SYNC (Direct to Supabase)
            if (!activeOrderId) {
                // New Order using our UUID
                const { error: insertError } = await supabase.from('orders').insert({
                    id: finalOrderId,
                    ...orderData.order
                });
                if (insertError) throw insertError;

                if (table?.id) {
                    await supabase.from('tables').update({
                        status: 'occupied',
                        locked_by: null
                    }).eq('id', table.id);
                }
            } else {
                // Update Existing
                const { error: updateError } = await supabase.from('orders').update(orderData.order).eq('id', finalOrderId);
                if (updateError) throw updateError;
            }

            // Sync Items — v1.5.1: Use SECURITY DEFINER RPC to bypass RLS for anon (PIN) users
            if (unsentItems.length > 0) {
                const itemsPayload = orderData.items.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    product_name: unsentItems.find(u => u.product_id === i.product_id)?.product_name || '',
                    status: i.status || 'pending',
                    notes: i.notes || null,
                    discount_id: i.discount_id || null,
                    discount_percentage: i.discount_percentage || null,
                    discount_amount: i.discount_amount || null,
                    discount_reason: i.discount_reason || null
                }));

                // Try RPC first (works for anon/PIN users, handles inventory deduction)
                console.log('🚀 INTENTANDO RPC PARA ENVIAR ORDEN. ITEMS PAYLOAD:', JSON.stringify(itemsPayload, null, 2));
                const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_order_items', {
                    p_order_id: finalOrderId,
                    p_branch_id: currentUser?.branch_id,
                    p_items: itemsPayload
                });

                if (rpcError) {
                    console.warn('RPC submit_order_items failed, trying direct insert:', rpcError.message);
                    // Fallback: direct insert (for users with full auth session)
                    const { error: itemsError } = await supabase.from('order_items').insert(orderData.items.map(i => ({
                        order_id: finalOrderId,
                        ...i
                    })));
                    if (itemsError) throw itemsError;
                } else if (rpcResult?.success === false) {
                    // RPC ran but returned an internal error
                    throw new Error(rpcResult.error || 'Error en RPC submit_order_items');
                } else {
                    // RPC success: immediately decrement local stock
                    // v1.5.3 - Match by NAME (not ID) because menu product_id ≠ inventory product_id
                    const products = (() => {
                        try { return JSON.parse(localStorage.getItem('cached_products') || '[]'); } catch { return []; }
                    })();

                    // v1.6.0 - SYNC SHADOW STOCK TO DATABASE (inventory_item_branches)
                    // This ensures the Admin panel sees the decrement even without recipes
                    const syncItemInventory = async () => {
                        for (const item of unsentItems) {
                            const nameKey = (item.product_name || '').trim().toUpperCase();
                            // Find the inventory item ID by matching name in the products list
                            const invProduct = products.find((p: any) => (p.name || '').trim().toUpperCase() === nameKey && !p.es_platillo);
                            if (invProduct) {
                                try {
                                    // Decrement in DB
                                    const { error: decError } = await supabase.rpc('decrement_inventory_item', {
                                        p_item_id: invProduct.id,
                                        p_branch_id: currentUser?.branch_id,
                                        p_quantity: item.quantity
                                    });
                                    if (decError) {
                                        // Fallback to direct update if RPC doesn't exist
                                        console.warn('RPC decrement_inventory_item failed, trying direct update:', decError);
                                        const { data: currentStock } = await supabase
                                            .from('inventory_item_branches')
                                            .select('quantity')
                                            .eq('item_id', invProduct.id)
                                            .eq('branch_id', currentUser?.branch_id)
                                            .single();

                                        if (currentStock) {
                                            await supabase.from('inventory_item_branches')
                                                .update({ quantity: currentStock.quantity - item.quantity })
                                                .eq('item_id', invProduct.id)
                                                .eq('branch_id', currentUser?.branch_id);
                                        }
                                    }
                                } catch (e) { console.error('Error syncing shadow stock:', e); }
                            }
                        }
                    };
                    syncItemInventory();

                    setBranchInventory(prev => {
                        const updated = prev.map(inv => {
                            if (inv.branch_id !== currentUser?.branch_id) return inv;
                            // Find the product name for this inventory record
                            const invProduct = products.find((p: any) => p.id === inv.product_id);
                            const invName = (invProduct?.name || '').trim().toUpperCase();
                            // Find a sold item with the same name
                            const soldItem = unsentItems.find(u =>
                                (u.product_name || '').trim().toUpperCase() === invName
                            );
                            if (soldItem) {
                                console.log(`📦 Badge update (ProdInv): ${invName} ${inv.quantity} → ${inv.quantity - soldItem.quantity}`);
                                return { ...inv, quantity: inv.quantity - soldItem.quantity };
                            }
                            return inv;
                        });
                        localStorage.setItem('cached_branch_inventory', JSON.stringify(updated));
                        return updated;
                    });

                    // v1.6.0 - ALSO decrement Item Inventory (Insumos) by name
                    setItemInventory(prev => {
                        const updated = prev.map(inv => {
                            if (inv.branch_id !== currentUser?.branch_id) return inv;
                            // In itemInventory, the product_id is the item_id. 
                            // But we match by name for maximum safety across tables.
                            const itemProduct = products.find((p: any) => p.id === inv.item_id || p.id === inv.product_id);
                            const itemName = (itemProduct?.name || '').trim().toUpperCase();
                            const soldItem = unsentItems.find(u => (u.product_name || '').trim().toUpperCase() === itemName);

                            if (soldItem) {
                                console.log(`📦 Badge update (ItemInv): ${itemName} ${inv.quantity} → ${inv.quantity - soldItem.quantity}`);
                                return { ...inv, quantity: inv.quantity - soldItem.quantity };
                            }
                            return inv;
                        });
                        localStorage.setItem('cached_inventory_item_branches', JSON.stringify(updated));
                        return updated;
                    });

                    // v1.5.4 Update cached products directly so the UI recalculates Math.max immediately
                    const cachedProductsStr = localStorage.getItem('cached_products');
                    if (cachedProductsStr) {
                        try {
                            const cProds = JSON.parse(cachedProductsStr).map((p: any) => {
                                const pName = (p.name || '').trim().toUpperCase();
                                const soldItem = unsentItems.find(u => (u.product_name || '').trim().toUpperCase() === pName);
                                if (soldItem) {
                                    return {
                                        ...p,
                                        stock_quantity: (p.stock_quantity || 0) - soldItem.quantity,
                                        stock_actual: (p.stock_actual || 0) - soldItem.quantity
                                    };
                                }
                                return p;
                            });
                            localStorage.setItem('cached_products', JSON.stringify(cProds));
                            // Force trigger order view products to re-eval max stock
                            window.dispatchEvent(new CustomEvent('inventory-state-updated'));
                        } catch (e) {
                            console.error('Error updating cached products immediately:', e);
                        }
                    }

                    // Clear local items so fetchData brings definitive DB version
                    setItems([]);
                    window.dispatchEvent(new CustomEvent('refresh-inventory'));
                    console.log('✅ Items enviados + inventario descontado. Ítems procesados:', rpcResult?.processed);
                }
            }

            if (table?.id && !table.id.toString().startsWith('t-')) {
                await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id);
            }

            // LOG: Order Sent to Kitchen/Created
            activityLogService.logFinancial({
                user: currentUser!,
                module: 'VENTAS',
                action: activeOrderId ? 'ORDEN_MODIFICADA' : 'ORDEN_CREADA',
                entity_id: finalOrderId,
                entity_type: 'ORDER',
                details: {
                    orderId: finalOrderId,
                    numero_orden: (initialOrder as any).order_number,
                    mesa: table?.number,
                    seccion: table?.section,
                    mesero: currentUser!.name,
                    tipo_orden: initialOrder.order_type || 'DINE_IN',
                    items_nuevos: unsentItems.length,
                    items_total: items.length,
                    items: unsentItems.map(i => ({ nombre: i.product_name, cantidad: i.quantity, precio: i.price, notas: i.notes })),
                    total_estimado: total + tipAmount,
                    subtotal: subtotalAfterDiscount,
                    propina_estimada: tipAmount,
                    descuento_aplicado: totalSavings > 0,
                    descuento_monto: totalSavings
                }
            }, {
                amount: total + tipAmount,
                type: 'INGRESO',
                currency: 'GTQ',
                tip_amount: tipAmount
            });

            setActiveOrderId(finalOrderId);

            // v1.5.2 - Correct success notification
            const itemCount = unsentItems.length;
            notify.success(`👨‍🍳 ¡Orden enviada a cocina! ${itemCount} platillo${itemCount !== 1 ? 's' : ''} comandado${itemCount !== 1 ? 's' : ''}.`);

            await fetchData();

            // ----------------------------------------------------------------------
            // DUAL SEND: LOCAL KDS BRIDGE
            // Broadcasts the order to the local network master PC directly over Wi-Fi
            // ----------------------------------------------------------------------
            if (settings?.local_kds_ip && unsentItems.length > 0) {
                try {
                    const localIp = settings.local_kds_ip.replace(/https?:\/\//, '').split(':')[0];
                    const nowWithOffset = new Date(Date.now() + serverOffset);
                    const currentOrder = tableOrders.find(o => o.id === finalOrderId) ||
                        (finalOrderId === initialOrder.id ? initialOrder : null);

                    const kdsItems = unsentItems
                        .filter(i => {
                            const parsed = parseNotes(i.notes);
                            return !parsed.noPrint;
                        })
                        .map(i => ({
                            id: i.id,
                            product_id: i.product_id,
                            product_name: i.product_name,
                            quantity: i.quantity,
                            notes: formatNotesForDisplay(i.notes),
                            price: i.price
                        }));

                    if (kdsItems.length > 0) {
                        fetch(`http://${localIp}:3001/api/kds-order`, {
                            method: 'POST',
                            mode: 'no-cors', // Allow broadcast across different ports/security contexts
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                orderId: finalOrderId,
                                orderNumber: currentOrder?.order_number || initialOrder.order_number,
                                tableName: table?.section || 'SALA',
                                tableNumber: table?.number,
                                waiterName: currentUser?.name || currentUser?.full_name,
                                items: kdsItems,
                                createdAt: nowWithOffset.toISOString()
                            })
                        }).then(() => console.log('📡 Orden enviada a KDS Local exitosamente'))
                            .catch(e => console.warn('📡 Falló envío a KDS Local (puede estar apagado o IP incorrecta):', e.message));
                    }
                } catch (e) {
                    console.error('KDS Bridge Error:', e);
                }
            }
            // ----------------------------------------------------------------------

            if (isElectron && settings?.enable_kitchen_printing !== false) {
                try {
                    await handlePrintKitchen();
                } catch (printErr) {
                    console.error("Kitchen printing error:", printErr);
                }
            }

            // AUTO-REFRESH INVENTORY IN BACKGROUND
            window.dispatchEvent(new CustomEvent('refresh-inventory'));

        } catch (e: any) {
            console.error('Core Submission/Sync Error:', e);

            // Fallback to OfflineDB if network fails during the process
            await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('ORDER', orderData));

            // v1.4.4 - Mark items as offline pending so the UI shows the new blue badge
            setItems(current => current.map(item => {
                if (!item.is_sent) {
                    return { ...item, is_offline: true };
                }
                return item;
            }));

            if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
                notify.error('🔒 SESIÓN EXPIRADA: Por favor, salga y vuelva a ingresar con su PIN.');
            } else {
                notify.offline('⚠️ ORDEN GUARDADA LOCALMENTE: Verifique conexión o permisos en Supabase.');
            }

            // Trigger offline sync background process
            window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
            setProcessing(false); // Ensure button unlocks
        }
        setProcessing(false);
        return finalOrderId;
    };

    const nowServer = new Date(Date.now() + serverOffset);
    const timeDisplay = nowServer.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateDisplay = nowServer.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

    return (
        <div className={`fixed inset-0 w-full h-full text-white font-sans flex flex-col overflow-hidden z-40 animate-fade-in bg-[#2d2e3d]`}>
            {/* TOP HEADER BAR */}
            <div className={`h-12 bg-[#3a3b4d] border-b border-white/5 flex items-center pl-4 shrink-0 relative ${isTablet ? 'pr-[calc(280px+1rem)]' : 'pr-[calc(10.5cm+1rem)]'}`}>
                <button onClick={handleClose} className="w-[2.5cm] h-[1.3cm] flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-400 hover:text-white transition-colors absolute left-4 z-10">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 flex items-center justify-center gap-3 text-xs md:text-sm lg:text-xs font-medium uppercase tracking-wider text-gray-300">
                    <span>Orden: #{tableOrders.find(o => o.id === activeOrderId)?.order_number || initialOrder.order_number || '...'}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-white/60">
                        {initialOrder.order_type === 'TAKEOUT' ? 'PARA LLEVAR' :
                            initialOrder.order_type === 'DELIVERY' ? 'DOMICILIO' :
                                (table?.section || 'SALA')}
                    </span>
                    {table?.number && (
                        <>
                            <span className="text-gray-600">|</span>
                            <span>Mesa: {table.number}</span>
                        </>
                    )}
                    <span className="text-gray-600 mx-1">|</span>
                    <span className="hidden sm:inline">Atiende: {tableOrders.find(o => o.id === activeOrderId)?.waiter?.name || currentUser?.name || 'Mesero'}</span>
                </div>

                {(selectedCat || selectedSubCat) && (
                    <button
                        onClick={() => selectedSubCat ? setSelectedSubCat(null) : setSelectedCat(null)}
                        className={`w-[2.5cm] h-[1.3cm] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-md text-emerald-400 hover:text-emerald-300 transition-colors absolute z-10 border border-white/5 ${isTablet ? 'right-[calc(280px+1rem)]' : 'right-[calc(10.5cm+1rem)]'}`}
                        title="Regresar al Menú"
                    >
                        <CornerUpLeft size={20} />
                    </button>
                )}

                <div className="absolute right-4 flex items-center gap-3">
                    {/* Clock & Date */}
                    <div className="hidden lg:flex flex-col items-center leading-none mr-1 bg-black/20 px-2 py-1 rounded-none border border-white/5">
                        <span className="text-[11px] font-semibold tracking-widest text-white/40 tabular-nums">{timeDisplay}</span>
                        <span className="text-[8px] font-medium text-gray-500 uppercase tracking-tighter">{dateDisplay}</span>
                    </div>

                    <div className="flex flex-col items-center lg:hidden leading-none mr-1">
                        <span className="text-[10px] font-semibold text-white/40 tabular-nums">{timeDisplay.substring(0, 5)}</span>
                    </div>

                    {/* Network Status Indicator */}
                    <div
                        className={`w-3 h-3 rounded-full ring-2 transition-all duration-500 ${isOnline
                            ? 'bg-emerald-400 ring-emerald-400/30  -400/50'
                            : 'bg-red-500 ring-red-500/30 animate-pulse  -500/50'
                            }`}
                        title={isOnline ? "En Línea" : "Sin Conexión al Servidor"}
                    />

                    <button
                        onClick={() => onToggleWaiterVoice?.()}
                        className={`p-2 rounded-lg transition-all border ${waiterVoiceEnabled
                            ? 'bg-white/15 border-white/25 text-white '
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                            }`}
                        title={waiterVoiceEnabled ? "Desactivar avisos de cocina" : "Activar avisos de cocina"}
                    >
                        {waiterVoiceEnabled ? <Bell size={18} className="animate-pulse" /> : <BellOff size={18} />}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className={`flex-[1.5] lg:flex-1 flex flex-col border-r border-white/5 relative bg-[#2d2e3d]`}>

                    <div className="flex-1 overflow-y-auto py-4 content-start px-2 sm:px-4">
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-white/20" /></div>
                        ) : (
                            <div className="bg-[#2d2e3d]">
                                {!selectedCat && (
                                    <div className={`grid gap-3 sm:gap-4 w-full no-scrollbar content-start ${isTablet || isCaja ? 'grid-cols-4' : 'grid-cols-7'} auto-rows-[155px]`}>
                                        {(() => {
                                            const seen = new Set();
                                            return categories
                                                .filter(c => !c.parent_id && c.section !== 'INVENTARIO')
                                                .sort((a, b) => {
                                                    // 1. Prioridad por Sección (MENU > otros)
                                                    const scoreA = a.section === 'MENU' ? 0 : 1;
                                                    const scoreB = b.section === 'MENU' ? 0 : 1;
                                                    if (scoreA !== scoreB) return scoreA - scoreB;

                                                    // 2. Alfabético estricto
                                                    return (a.name || '').localeCompare(b.name || '');
                                                })
                                                .filter(c => {
                                                    // v1.6.18 - Normalize accents and plurals for better de-duplication
                                                    const rawName = (c.name || '').trim().toUpperCase();
                                                    const normalized = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                                    const key = normalized
                                                        .replace(/\bDE\b/g, '')
                                                        .replace(/\bDEL\b/g, '')
                                                        .replace(/S\b/g, '') // Singularize
                                                        .replace(/\s+/g, ' ')
                                                        .trim();

                                                    if (!key || seen.has(key)) return false;
                                                    seen.add(key);
                                                    return true;
                                                })
                                                .map((cat, catIdx) => (
                                                    <button key={cat.id || `cat-${catIdx}`} onClick={() => setSelectedCat(cat)} className="overflow-hidden mx-auto bg-[#3a3b4d] rounded-t-none rounded-b-2xl p-2 flex flex-col items-center justify-between border-2 border-white/5 hover:border-white/20 hover:bg-[#45465e] active:scale-95 transition-all group w-full h-full">
                                                        <div className="flex-1 flex flex-col items-center justify-center w-full mb-3">
                                                            {cat.image_url ? (
                                                                <img src={getImageUrl(cat.image_url)} alt={cat.name} className="w-full h-full object-contain rounded-xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                                            ) : (
                                                                <PlaceholderLogo />
                                                            )}
                                                        </div>
                                                        <span className="w-full text-center text-[11px] sm:text-[12px] font-semibold uppercase tracking-wide text-white leading-tight pt-1 pb-1">{cat.name}</span>
                                                    </button>
                                                ));
                                        })()}
                                    </div>
                                )}
                                {selectedCat && !selectedSubCat && (
                                    <div className={`grid gap-3 sm:gap-4 w-full no-scrollbar content-start ${isTablet || isCaja ? 'grid-cols-4' : 'grid-cols-7'} auto-rows-[155px]`}>
                                        {categories
                                            .filter(c => c.parent_id === selectedCat.id && c.section !== 'INVENTARIO')
                                            .sort((a, b) => {
                                                return (a.name || '').localeCompare(b.name || '');
                                            })
                                            .map((sub, subIdx) => (
                                                <button key={sub.id || `sub-cat-${subIdx}`} onClick={() => setSelectedSubCat(sub)} className="overflow-hidden mx-auto bg-white/10 rounded-t-none rounded-b-2xl p-2 flex flex-col items-center justify-between border-2 border-transparent hover:border-white/10 active:scale-95 transition-all group w-full h-full">
                                                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                                                        {sub.image_url ? (
                                                            <img src={getImageUrl(sub.image_url)} alt={sub.name} className="w-full h-full object-cover rounded-md opacity-50 group-hover:opacity-100 transition-opacity" />
                                                        ) : (
                                                            <PlaceholderLogo />
                                                        )}
                                                    </div>
                                                    <span className="w-full text-center text-[11px] sm:text-[12px] font-semibold uppercase tracking-wide text-white leading-tight pt-1 pb-1">{sub.name}</span>
                                                </button>
                                            ))}
                                        {categories.filter(c => c.parent_id === selectedCat.id && c.section !== 'INVENTARIO').length === 0 && (() => {
                                            // SENIOR BRIDGE FIX: Collect all IDs for categories with this NAME to handle duplicates
                                            // v1.6.15 - STRICT SECTION FILTERING: Only match within the same section (MENU vs INVENTORY)
                                            const relatedCatIds = categories
                                                .filter(c =>
                                                    c.name?.toUpperCase() === selectedCat.name?.toUpperCase() &&
                                                    (c.section || 'MENU') === (selectedCat.section || 'MENU')
                                                )
                                                .map(c => c.id);

                                            // v1.4.1 - STRICT CATEGORY FILTERING & GLOBAL SHADOW STOCK
                                            // Determine if we are in an "Inventory" section or "Menu" section
                                            const isInventorySection = selectedCat.section === 'INVENTARIO' ||
                                                (selectedCat as any).category_type === 'INVENTORY';

                                            const filteredProds = products.filter(p => {
                                                // If we are in the Menu, ONLY show items specifically linked to Menu Categories
                                                // If we are in Inventory, ONLY show items specifically linked to Product/Inventory Categories
                                                const matchesMenu = relatedCatIds.includes(p.menu_category_id);
                                                const matchesInventory = relatedCatIds.includes(p.product_category_id) || relatedCatIds.includes(p.category_id);

                                                if (isInventorySection) return matchesInventory;

                                                // v1.6.16 - FIXED: Allow matchesInventory in Menu section too
                                                // Since relatedCatIds is now strictly filtered by section (MENU), 
                                                // matchesInventory will only be true for products in a Menu category.
                                                const isMatch = matchesMenu || matchesInventory;

                                                // v1.6.15 - Extra safety: Don't show technical inventory items in Menu even if IDs match
                                                const isTechnicalItem = p.classification === 'INSUMO' || (p.name || '').toUpperCase().includes('MERMA');
                                                const isNotPlatillo = (p as any).es_platillo === false && p.classification !== 'PRODUCTO';

                                                return isMatch && !isTechnicalItem && !isNotPlatillo;
                                            });

                                            // 1. Build a GLOBAL Map for Stock AND Images by Name
                                            const globalDataMap = new Map<string, { stock: number, image?: string }>();
                                            products.forEach(p => {
                                                const nameKey = (p.name || '').trim().toUpperCase();
                                                if (!nameKey) return;

                                                // a) Search in Product Branch Inventory (Ventas)
                                                const bInv = branchInventory.find(bi => bi.product_id === p.id && bi.branch_id === currentUser?.branch_id);

                                                // b) Search in Item Inventory (Insumos - v1.6.0 Unification)
                                                // We match by name because a Platillo might not have the same ID as its Insumo equivalent
                                                const iInv = itemInventory.find(ii => {
                                                    if (ii.branch_id !== currentUser?.branch_id) return false;
                                                    // Find the name of the item in the inventory list to compare
                                                    // Note: products state here contains all items (platillos + potentially cached others)
                                                    const iProd = products.find(prod => prod.id === ii.item_id || prod.id === ii.product_id);
                                                    return (iProd?.name || '').trim().toUpperCase() === nameKey;
                                                });

                                                // Priority: itemInventory (Insumos) > branchInventory > stock_actual > stock_quantity
                                                // We use MAX to ensure if one table says 14 and other says 0, we show 14.
                                                const invStock = bInv ? bInv.quantity : (p.stock_actual ?? p.stock_quantity ?? 0);
                                                const itemStock = iInv ? iInv.quantity : -999999; // Sentinel to check if exists

                                                const finalStock = itemStock !== -999999 ? Math.max(invStock, itemStock) : invStock;

                                                const existing = globalDataMap.get(nameKey);
                                                if (!existing) {
                                                    globalDataMap.set(nameKey, { stock: finalStock, image: p.image_url });
                                                } else {
                                                    // v1.5.3: Use MAX stock (not sum) to avoid positive+negative cancel-out
                                                    globalDataMap.set(nameKey, {
                                                        stock: Math.max(existing.stock, finalStock),
                                                        image: existing.image || p.image_url
                                                    });
                                                }
                                            });

                                            // 2. Map the filtered products while resolving prices and shadows
                                            const prodMap = new Map();
                                            filteredProds.forEach(p => {
                                                const bPrice = branchPrices.find(bp => bp.product_id === p.id && bp.branch_id === currentUser?.branch_id);
                                                const finalPrice = bPrice ? bPrice.price : p.price;
                                                const key = (p.name || '').trim().toUpperCase();

                                                // Initial stock for this specific record (just to be safe)
                                                const bInv = branchInventory.find(bi => bi.product_id === p.id && bi.branch_id === currentUser?.branch_id);
                                                const localStock = bInv ? bInv.quantity : (p.stock_actual || p.stock_quantity || 0);

                                                if (!prodMap.has(key)) {
                                                    const gData = globalDataMap.get(key);
                                                    const shadowStock = gData?.stock ?? localStock;
                                                    prodMap.set(key, { ...p, image_url: p.image_url || gData?.image, price: finalPrice > 0 ? finalPrice : p.price, finalPrice, consolidatedStock: shadowStock });
                                                } else {
                                                    const existing = prodMap.get(key);
                                                    const gData = globalDataMap.get(key);
                                                    existing.image_url = existing.image_url || p.image_url || gData?.image;
                                                    if (finalPrice > 0) {
                                                        existing.finalPrice = finalPrice;
                                                        existing.price = finalPrice;
                                                        existing.id = p.id;
                                                        existing.menu_category_id = p.menu_category_id;
                                                    }
                                                }
                                            });

                                            return Array.from(prodMap.values())
                                                .sort((a: any, b: any) => {
                                                    return (a.name || '').localeCompare(b.name || '');
                                                })
                                                .map((product, prodIdx) => {
                                                    return (
                                                        <ProductCard
                                                            key={product.id ? `cat-${product.id}` : `cat-prod-${prodIdx}`}
                                                            product={{ ...product, price: product.finalPrice }}
                                                            stockOverride={product.consolidatedStock}
                                                            currency={currency}
                                                            onClick={() => handleProductClick(product)}
                                                            isChecking={checkingProducts.has(product.id)}
                                                            isTablet={isTablet || isCaja}
                                                        />
                                                    );
                                                });
                                        })()}
                                    </div>
                                )}
                                {selectedSubCat && (
                                    <div className={`grid gap-3 sm:gap-4 w-full no-scrollbar content-start ${isTablet || isCaja ? 'grid-cols-4' : 'grid-cols-7'} auto-rows-[155px]`}>
                                        {(() => {
                                            const relatedSubCatIds = categories
                                                .filter(c => c.name?.toUpperCase() === selectedSubCat.name?.toUpperCase())
                                                .map(c => c.id);

                                            const filteredSubProds = products.filter(p => {
                                                const matchesAny = relatedSubCatIds.includes(p.category_id) ||
                                                    relatedSubCatIds.includes(p.product_category_id) ||
                                                    relatedSubCatIds.includes(p.menu_category_id);

                                                // v1.6.17 - STRICT FILTERING for Sub-Categories too
                                                const isTechnicalItem = p.classification === 'INSUMO' || (p.name || '').toUpperCase().includes('MERMA');
                                                const isNotPlatillo = (p as any).es_platillo === false && p.classification !== 'PRODUCTO';

                                                return matchesAny && !isTechnicalItem && !isNotPlatillo;
                                            });

                                            // v1.4.1 - Shadow Stock for Sub-Categories
                                            const globalDataMap = new Map<string, { stock: number, image?: string }>();
                                            products.forEach(p => {
                                                const nameKey = (p.name || '').trim().toUpperCase();
                                                if (!nameKey) return;
                                                const bInv = branchInventory.find(bi => bi.product_id === p.id && bi.branch_id === currentUser?.branch_id);
                                                // Priority: branch_inventory > products.stock_actual > products.stock_quantity
                                                const pStock = bInv ? bInv.quantity : (p.stock_actual ?? p.stock_quantity ?? 0);

                                                const existing = globalDataMap.get(nameKey);
                                                if (!existing) {
                                                    globalDataMap.set(nameKey, { stock: pStock, image: p.image_url });
                                                } else {
                                                    // v1.5.3: Use MAX stock (not sum) to avoid positive+negative cancel-out
                                                    globalDataMap.set(nameKey, {
                                                        stock: Math.max(existing.stock, pStock),
                                                        image: existing.image || p.image_url
                                                    });
                                                }
                                            });

                                            const subProdMap = new Map();
                                            filteredSubProds.forEach(p => {
                                                const branchPrice = branchPrices.find(bp => bp.product_id === p.id && bp.branch_id === currentUser?.branch_id);
                                                const finalPrice = branchPrice ? branchPrice.price : p.price;
                                                const key = (p.name || '').trim().toUpperCase();
                                                const bInv = branchInventory.find(bi => bi.product_id === p.id && bi.branch_id === currentUser?.branch_id);
                                                const localStock = bInv ? bInv.quantity : (p.stock_actual || p.stock_quantity || 0);

                                                if (!subProdMap.has(key)) {
                                                    const gData = globalDataMap.get(key);
                                                    const shadowStock = gData?.stock ?? localStock;
                                                    subProdMap.set(key, { ...p, image_url: p.image_url || gData?.image, price: finalPrice > 0 ? finalPrice : p.price, finalPrice, consolidatedStock: shadowStock });
                                                } else {
                                                    const existing = subProdMap.get(key);
                                                    const gData = globalDataMap.get(key);
                                                    existing.image_url = existing.image_url || p.image_url || gData?.image;
                                                    if (finalPrice > 0) {
                                                        existing.finalPrice = finalPrice;
                                                        existing.price = finalPrice;
                                                        existing.id = p.id;
                                                        existing.menu_category_id = p.menu_category_id;
                                                    }
                                                }
                                            });

                                            return Array.from(subProdMap.values())
                                                .sort((a: any, b: any) => {
                                                    return (a.name || '').localeCompare(b.name || '');
                                                })
                                                .map((product, prodIdx) => {
                                                    return (
                                                        <ProductCard
                                                            key={product.id ? `sub-${product.id}` : `sub-prod-${prodIdx}`}
                                                            product={{ ...product, price: product.finalPrice }}
                                                            stockOverride={product.consolidatedStock}
                                                            currency={currency}
                                                            onClick={() => handleProductClick(product)}
                                                            isChecking={checkingProducts.has(product.id)}
                                                            isTablet={isTablet || isCaja}
                                                        />
                                                    );
                                                });
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="h-20 lg:h-16 bg-black/20 border-t border-white/5 flex items-center justify-center gap-4 lg:gap-4 px-4 shrink-0 z-10">
                        <button onClick={() => setShowPaxModal(true)} className="w-[85px] h-12 bg-[#3f4251] border border-white/5 rounded-lg flex flex-col items-center justify-center text-white transition-all active:scale-95 ">
                            <Users size={18} />
                            <span className="text-[9px] font-medium mt-0.5 uppercase tracking-tighter">Personas</span>
                        </button>
                        {table && (
                            <button
                                onClick={() => setShowTransferModal(true)}
                                className="w-[85px] h-12 bg-[#3f4251] border border-white/5 rounded-lg flex flex-col items-center justify-center text-white transition-all active:scale-95 "
                                title="Cambiar a otra Mesa (Trasladar Cuenta)"
                            >
                                <ArrowRightLeft size={18} />
                                <span className="text-[9px] font-medium mt-0.5 uppercase tracking-tighter">Traslado</span>
                            </button>
                        )}
                        {(canCajero('Trasladar Orden a Mesero/Cajero') || currentUser?.role === 'CAJERO' || currentUser?.role === 'ADMIN') && (
                            <button
                                onClick={() => setShowTransferWaiterModal(true)}
                                className="w-[85px] h-12 bg-[#3f4251] border border-white/5 rounded-lg flex flex-col items-center justify-center text-white transition-all active:scale-95 "
                                title="Transferir Responsable"
                            >
                                <UsersRound size={18} />
                                <span className="text-[9px] font-medium mt-0.5 uppercase tracking-tighter">Mesero</span>
                            </button>
                        )}
                        {(canCajero('Anular Orden') || currentUser?.role === 'CAJERO' || currentUser?.role === 'ADMIN') && (
                            <button
                                onClick={() => {
                                    // v1.6.2 - Limpiar motivo y pedir comentario antes que el PIN
                                    setVoidReason('');
                                    setPendingAction('cancel');
                                    setShowVoidModal(true);
                                }}
                                disabled={!activeOrderId}
                                className={`h-[50px] px-8 rounded-lg text-sm font-medium transition-all ${activeOrderId
                                    ? 'bg-[#3f4251] text-white hover:bg-white/10 active:scale-95 border border-white/5 '
                                    : 'bg-[#2a2d37] text-gray-500 opacity-40 cursor-not-allowed border border-white/5'}`}
                                title="Anular Orden Completa"
                            >
                                Anular Orden
                            </button>
                        )}
                    </div>
                </div>

                <div className={`${isTablet ? 'w-[280px]' : 'w-[10.5cm]'} shrink-0 border-l border-white/5 flex flex-col relative z-20 ${(currentUser?.role?.toUpperCase() === 'MESERO' || currentUser?.role?.toUpperCase() === 'CAJERO') ? 'bg-transparent' : 'bg-[#222630]'}`}>
                    <div className="p-3 lg:p-3 border-b border-white/5 flex flex-col gap-3 shrink-0">
                        <div className="pt-1 space-y-1">
                            <button
                                onClick={() => setShowAccountsOverviewModal(true)}
                                className="w-full bg-[#1e212b] border border-white/10 rounded-xl px-4 py-3 text-[11px] font-semibold text-white uppercase tracking-widest flex items-center justify-center relative group hover:border-white/20 transition-all  active:scale-95"
                            >
                                <span>
                                    {activeOrderId === null && tableOrders.length > 1
                                        ? 'TODAS LAS CUENTAS'
                                        : getOrderDisplayName(activeOrderId)
                                    }
                                </span>
                                <ChevronDown size={14} className="absolute right-4 text-gray-600 group-hover:text-white transition-colors" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-white/40 animate-pulse">
                                <Loader2 className="animate-spin mb-2" size={32} />
                                <span className="text-[10px] font-medium uppercase tracking-widest">Sincronizando...</span>
                            </div>
                        ) : checkoutItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-10 text-gray-500">
                                <ShoppingCartIcon size={48} />
                                <span className="text-[10px] font-medium uppercase tracking-widest mt-2">Sin Productos</span>
                            </div>
                        ) : (
                            [...checkoutItems]
                                .sort((a, b) => {
                                    if (!activeOrderId) {
                                        const aOrderIdx = tableOrders.findIndex(o => o.id === (a as any).order_id);
                                        const bOrderIdx = tableOrders.findIndex(o => o.id === (b as any).order_id);

                                        // Sort by Account index, then by internal ID/Name to keep them grouped nicely
                                        if (aOrderIdx !== bOrderIdx) return aOrderIdx - bOrderIdx;
                                        return a.product_name.localeCompare(b.product_name);
                                    }
                                    return 0;
                                })
                                .map((item, index) => {
                                    const itemOrderNum = tableOrders.findIndex(o => o.id === (item as any).order_id) + 1;
                                    const uniqueKey = item.id ? `${item.id}-${index}` : `cart-item-${index}`;
                                    return (
                                        <div key={uniqueKey} className="relative overflow-hidden rounded-lg group">
                                            {/* Trash button behind (right side) */}
                                            <div className={`absolute right-0 top-0 bottom-0 w-[80px] bg-red-500/90 flex items-center justify-center transition-opacity duration-300 ${swipedItem?.id === item.id && swipedItem?.action === 'delete' ? 'opacity-100 z-10' : 'opacity-0 -z-10'}`}>
                                                <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); setSwipedItem(null); }} className="w-full h-full flex items-center justify-center text-white active:scale-95 transition-transform">
                                                    <Trash2 size={24} />
                                                </button>
                                            </div>
                                            {/* Note button behind (left side) */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-[80px] bg-yellow-500/90 flex items-center justify-center transition-opacity duration-300 ${swipedItem?.id === item.id && swipedItem?.action === 'note' ? 'opacity-100 z-10' : 'opacity-0 -z-10'}`}>
                                                <button onClick={(e) => { e.stopPropagation(); setTabletItemActionModal(item); setSwipedItem(null); }} className="w-full h-full flex items-center justify-center text-white active:scale-95 transition-transform">
                                                    <FileText size={24} />
                                                </button>
                                            </div>
                                            <div
                                                onTouchStart={(e) => {
                                                    if (swipedItem?.id && swipedItem?.id !== item.id) {
                                                        setSwipedItem(null);
                                                    }
                                                    (e.currentTarget as any).touchStartX = e.touches[0].clientX;
                                                    (e.currentTarget as any).touchStartY = e.touches[0].clientY;
                                                }}
                                                onTouchEnd={(e) => {
                                                    const startX = (e.currentTarget as any).touchStartX;
                                                    const startY = (e.currentTarget as any).touchStartY;
                                                    if (!startX || !startY) return;
                                                    const endX = e.changedTouches[0].clientX;
                                                    const endY = e.changedTouches[0].clientY;
                                                    const deltaX = endX - startX;
                                                    const deltaY = endY - startY;

                                                    // Swipe de Derecha a Izquierda para Eliminar
                                                    if (deltaX < -50 && Math.abs(deltaY) < 40) {
                                                        const canDelete = !item.is_sent || currentUser?.role === 'ADMIN' || currentUser?.role === 'CAJERO';
                                                        if (canDelete) {
                                                            setSwipedItem({ id: item.id, action: 'delete' });
                                                        }
                                                    }
                                                    // Swipe de Izquierda a Derecha para Mostrar Nota
                                                    else if (deltaX > 50 && Math.abs(deltaY) < 40) {
                                                        setSwipedItem({ id: item.id, action: 'note' });
                                                    }
                                                    (e.currentTarget as any).touchStartX = 0;
                                                    (e.currentTarget as any).touchStartY = 0;
                                                }}
                                                onClick={(e) => {
                                                    if (swipedItem?.id === item.id) {
                                                        setSwipedItem(null);
                                                        return;
                                                    }

                                                    if ((e.currentTarget as any).clickTimeout) {
                                                        clearTimeout((e.currentTarget as any).clickTimeout);
                                                        (e.currentTarget as any).clickTimeout = null;
                                                    }

                                                    if (e.detail === 1) {
                                                        (e.currentTarget as any).clickTimeout = setTimeout(() => {
                                                            setSelectedItemIds(prev => {
                                                                const newSet = new Set(prev);
                                                                if (newSet.has(item.id)) {
                                                                    newSet.delete(item.id);
                                                                } else {
                                                                    newSet.add(item.id);
                                                                }
                                                                return newSet;
                                                            });
                                                        }, 250);
                                                    } else if (e.detail === 2) {
                                                        setTabletItemActionModal(item);
                                                    }
                                                }}
                                                className={`flex justify-between transition-all duration-300 border select-none relative cursor-pointer ${isTablet ? 'p-1.5' : 'p-3'} ${swipedItem?.id === item.id ? (swipedItem.action === 'delete' ? 'translate-x-[-80px]' : 'translate-x-[80px]') : 'translate-x-0'} ${selectedItemIds.has(item.id) ? 'border-gray-400 bg-gray-500/20' : 'border-white/5 bg-[#2a2d37]'}`}
                                            >
                                                {/* Account Badge for Unified View */}
                                                {!activeOrderId && (item as any).order_id && tableOrders.length > 1 && (
                                                    <span className="absolute top-1 right-1 px-1 bg-white/10 text-white/60 text-[8px] font-semibold rounded uppercase">C{itemOrderNum}</span>
                                                )}
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className={`font-medium text-gray-200 leading-tight flex items-start gap-1.5 ${isTablet ? 'text-[10px] truncate max-w-[150px]' : 'text-sm lg:text-xs'}`}>
                                                                <span className="text-white font-semibold">{item.quantity}</span>
                                                                <span>{item.product_name}</span>
                                                            </span>
                                                            {item.is_sent && <ItemStatusBadge item={item} serverOffset={serverOffset} tick={tick} />}
                                                            {((item.discount_percentage || 0) > 0 || (item.discount_amount || 0) > 0) && (
                                                                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest leading-none mt-0.5">
                                                                    {item.discount_type === 'AMOUNT' ? `-Q${item.discount_amount?.toFixed(2)}` : `-${item.discount_percentage}%`} Desc.
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={`font-medium tabular-nums text-white shrink-0 ml-1 ${isTablet ? 'text-[10px]' : 'text-sm lg:text-xs'}`}>{currency}{((item.price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                                                    </div>
                                                    {item.notes && formatNotesForDisplay(item.notes) && (
                                                        <div className="flex items-center gap-1 mt-0.5" onClick={(e) => { e.stopPropagation(); setTabletItemActionModal(item); }}>
                                                            <span className={`text-gray-500 truncate ${isTablet ? 'text-[9px] max-w-[100px]' : 'text-xs lg:text-[10px] max-w-[150px]'}`}>{formatNotesForDisplay(item.notes)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })
                        )}
                    </div>

                    <div className="bg-black/20 p-3 border-t border-white/5">
                        <div className={`grid ${(currentUser?.role === 'ADMIN' || currentUser?.role === 'CAJERO' || currentUser?.permissions?.includes('Aplicar Descuentos') || currentUser?.permissions?.includes('Cajero:Aplicar Descuentos')) ? 'grid-cols-5' : 'grid-cols-4'} gap-2 mb-4 h-12`}>
                            <button onClick={handlePrintPreAccount} className="bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/60 transition-all active:scale-95 hover:bg-white/10">
                                <Printer size={20} />
                            </button>
                            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'CAJERO' || currentUser?.permissions?.includes('Aplicar Descuentos') || currentUser?.permissions?.includes('Cajero:Aplicar Descuentos')) && (
                                <button onClick={() => {
                                    if (selectedItemIds.size === 1) {
                                        const item = checkoutItems.find(i => i.id === Array.from(selectedItemIds)[0]);
                                        if (item) setDiscountingItem(item as OrderItem);
                                    } else {
                                        setDiscountingItem(null);
                                    }
                                    setShowDiscountModal(true);
                                }} className={`rounded-xl flex items-center justify-center transition-all active:scale-95 ${selectedItemIds.size > 0 ? 'bg-amber-500/20 border border-amber-500/50 text-amber-500 hover:bg-amber-500/30' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'}`}>
                                    <Percent size={20} />
                                </button>
                            )}
                            <button onClick={() => setShowAccountsModal(true)} className="bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/60 transition-all active:scale-95 hover:bg-white/10">
                                <Users size={20} />
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedItemIds.size > 0) {
                                        selectedItemIds.forEach(id => {
                                            const item = checkoutItems.find(i => i.id === id);
                                            if (item && !item.is_sent) updateQty(item.id, -1);
                                        });
                                    } else {
                                        const unsentItems = checkoutItems.filter(i => !i.is_sent);
                                        if (unsentItems.length > 0) {
                                            updateQty(unsentItems[unsentItems.length - 1].id, -1);
                                        }
                                    }
                                }}
                                className="rounded-xl flex items-center justify-center transition-all active:scale-95 bg-white/10 border border-white/20 text-white hover:bg-white/20">
                                <Minus size={18} />
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedItemIds.size > 0) {
                                        selectedItemIds.forEach(id => {
                                            const item = checkoutItems.find(i => i.id === id);
                                            if (item && !item.is_sent) updateQty(item.id, 1);
                                        });
                                    } else {
                                        const unsentItems = checkoutItems.filter(i => !i.is_sent);
                                        if (unsentItems.length > 0) {
                                            updateQty(unsentItems[unsentItems.length - 1].id, 1);
                                        }
                                    }
                                }}
                                className="rounded-xl flex items-center justify-center transition-all active:scale-95 bg-white/10 border border-white/20 text-white hover:bg-white/20">
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="bg-[#2a2d3a] rounded-xl p-2 flex items-center w-full border border-white/5 shadow-lg mt-1">
                            <div className="flex-none">
                                <button
                                    onClick={async () => {
                                        const unsentItems = checkoutItems.filter(i => !i.is_sent);
                                        if (processing || checkoutItems.length === 0 || (activeOrderId && unsentItems.length === 0) || (!activeOrderId && tableOrders.length > 0)) return;

                                        // CHECK FOR DELIVERY ORDER TYPE
                                        const currentOrderType = tableOrders.find(o => o.id === activeOrderId)?.order_type || initialOrder.order_type;

                                        if (currentOrderType === 'DELIVERY') {
                                            console.log('Is Delivery Order, showing Modal');
                                            setShowDeliveryPaymentModal(true);
                                            return;
                                        }

                                        // v1.6.5 - For TAKEOUT, ask for client data before submission if missing
                                        if (currentOrderType === 'TAKEOUT' && !initialOrder.customer_name) {
                                            setShowTakeoutClientModal(true);
                                            return;
                                        }

                                        const finalId = await handleOrderSubmission();
                                        const isCashierOrAdmin = currentUser?.role?.toUpperCase() === 'CAJERO' || currentUser?.role?.toUpperCase() === 'ADMIN';
                                        if (isCashierOrAdmin && currentOrderType === 'TAKEOUT' && finalId) {
                                            const updatedOrder = {
                                                ...initialOrder,
                                                id: finalId,
                                                customer_name: initialOrder.customer_name || 'PARA LLEVAR',
                                                customer_phone: initialOrder.customer_phone,
                                                subtotal,
                                                tax_amount: taxAmount,
                                                tip_amount: tipAmount,
                                                total: total + tipAmount,
                                                items: checkoutItems.map(i => ({
                                                    ...i,
                                                    product_name: i.product_name,
                                                    unit_price: (i as any).unit_price || i.price || 0,
                                                    quantity: i.quantity,
                                                    is_sent: true
                                                }))
                                            };
                                            onCheckout?.(updatedOrder as any);
                                        }
                                    }}
                                    id="main-submit-btn"
                                    className="flex-shrink-0 min-w-[88px] w-[88px] h-[80px] rounded-lg flex flex-col items-center justify-center gap-1 active:scale-95 transition-all bg-[#6366f1] hover:bg-indigo-400 text-white shadow-md"
                                >
                                    {checkoutItems.some(i => i.is_sent) ? (
                                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 relative">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="9" y1="13" x2="15" y2="13"></line>
                                            <line x1="9" y1="17" x2="12" y2="17"></line>
                                            <circle cx="18" cy="18" r="5" fill="#6366f1" stroke="currentColor" strokeWidth="1.2" />
                                            <svg x="14.5" y="14.5" width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                <path d="M3 3v5h5" />
                                            </svg>
                                        </svg>
                                    ) : (
                                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 relative">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="9" y1="13" x2="15" y2="13"></line>
                                            <line x1="9" y1="17" x2="12" y2="17"></line>
                                            <circle cx="18" cy="18" r="5" fill="#6366f1" stroke="currentColor" strokeWidth="1.2" />
                                            <line x1="18" y1="15.5" x2="18" y2="20.5" stroke="currentColor" strokeWidth="1.2" />
                                            <line x1="15.5" y1="18" x2="20.5" y2="18" stroke="currentColor" strokeWidth="1.2" />
                                        </svg>
                                    )}
                                    <span className="text-[9px] font-medium tracking-wide leading-none text-center whitespace-nowrap w-full">
                                        {checkoutItems.some(i => i.is_sent) ? 'Actualizar Orden' : 'Crear Orden'}
                                    </span>
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col justify-center space-y-2 text-left text-[12px] text-gray-200 pl-4 pr-3 font-medium">
                                <div className="flex justify-between"><span>Sub-Total</span><span className="text-white">{currency}{(subtotal || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between">
                                    <span>Descuento</span>
                                    <span className="text-white">{currency}{(totalSavings || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between"><span>Propina</span><span className="text-white">{currency}{(tipAmount || 0).toFixed(2)}</span></div>
                                <div className="border-t border-dashed border-white/20 pt-2 mt-1 flex justify-between text-[13px] text-white font-medium"><span>Total</span><span>{currency}{((total || 0) + (tipAmount || 0)).toFixed(2)}</span></div>
                            </div>
                        </div>

                        {currentUser?.role?.toUpperCase() !== 'MESERO' && activeOrderId && (
                            <button
                                onClick={async () => {
                                    if (processing) return;

                                    let finalOrderId = activeOrderId;
                                    const unsentItems = checkoutItems.filter(i => !i.is_sent);

                                    if (unsentItems.length > 0 || (!activeOrderId && checkoutItems.length === 0)) {
                                        finalOrderId = await handleOrderSubmission();
                                        if (!finalOrderId) return;
                                    }

                                    const currentOrderData = activeOrderId
                                        ? (tableOrders.find(o => o.id === activeOrderId) || initialOrder)
                                        : initialOrder;

                                    const isAggregate = activeOrderId === null && tableOrders.length > 1;
                                    const updatedOrder = !isAggregate ? {
                                        ...currentOrderData,
                                        id: finalOrderId || 'VIRTUAL',
                                        customer_name: getOrderDisplayName(activeOrderId),
                                        subtotal,
                                        tax_amount: taxAmount,
                                        tip_amount: tipAmount,
                                        total: total + tipAmount,
                                        items: checkoutItems.map(i => ({
                                            ...i,
                                            product_name: i.product_name,
                                            unit_price: (i as any).unit_price || i.price || 0,
                                            quantity: i.quantity,
                                            is_sent: true
                                        }))
                                    } : {
                                        ...initialOrder,
                                        id: 'VIRTUAL',
                                        customer_name: 'TODAS LAS CUENTAS',
                                        subtotal: subtotal,
                                        tax_amount: taxAmount,
                                        total: total + tipAmount,
                                        items: checkoutItems.map(i => ({
                                            ...i,
                                            product_name: i.product_name,
                                            unit_price: (i as any).unit_price || i.price || 0,
                                            quantity: i.quantity,
                                            is_sent: true
                                        }))
                                    };
                                    onCheckout?.(updatedOrder as any);
                                }}
                                disabled={checkoutItems.length === 0}
                                className="w-full bg-[#3b82f6] hover:bg-blue-400 text-white font-medium py-2.5 px-4 rounded-lg shadow-md active:scale-95 transition-all -mt-1"
                            >
                                Cobrar Cuenta
                            </button>
                        )}
                    </div>
                </div>

                <ModifierModal
                    isOpen={!!showModifierModal}
                    onClose={() => setShowModifierModal(null)}
                    product={showModifierModal!}
                    onConfirm={handleModifierConfirm}
                    orderNumber={tableOrders.find(o => o.id === activeOrderId)?.order_number || initialOrder?.order_number}
                    tableName={table?.section ? `${table.section} ${table.number}` : (table?.number ? `Mesa ${table.number}` : undefined)}
                    waiterName={currentUser?.name || (currentUser as any)?.full_name}
                />
                <PaxModal isOpen={showPaxModal} onClose={() => setShowPaxModal(false)} initialPax={(initialOrder as any).pax_count || 1} onConfirm={handlePaxConfirm} />
                <PinModal
                    isOpen={showPinModal}
                    onClose={() => setShowPinModal(false)}
                    validateFn={validatePin}
                    requiredRole="CAJERO"
                    title="Autorización Requerida"
                    subtitle={pendingAction === 'cancel' ? "Anular Orden Completa" : "Eliminar Item"}
                    remoteAuthEnabled={true}
                    authPayload={{
                        action_type: pendingAction === 'cancel' ? 'VOID_ORDER' : (pendingAction === 'edit' ? 'EDIT_ITEM' : 'VOID_ITEM'),
                        action_details: pendingAction === 'cancel'
                            ? `Anular Orden Completa - Mesa ${table?.number || '?'}`
                            : `${pendingAction === 'edit' ? 'Editar' : 'Eliminar'}: ${itemToVoid?.product_name || (itemToVoid as any)?.products?.name || itemToVoid?.name || 'Producto'} (Cant: ${itemToVoid?.quantity || 1}) - Mesa ${table?.number || '?'}`,
                        metadata: {
                            order_id: activeOrderId,
                            table_id: table?.id,
                            table_number: table?.number,
                            waiter_name: currentUser?.name,
                            item_id: itemToVoid?.id,
                            item_name: itemToVoid?.product_name || (itemToVoid as any)?.products?.name || itemToVoid?.name,
                            quantity: itemToVoid?.quantity || 1,
                            reason: voidReason
                        }
                    }}
                    onSuccess={async (authorizedUser: any, pin: string) => {
                        // El PIN de administrador es absoluto y permite cualquier acción de anulación
                        // v1.6.2 - Si hay itemToVoid y la acción es delete (o vino de un doble clic),
                        //          siempre ejecutar la anulación del item.
                        if ((pendingAction === 'delete') && itemToVoid) {
                            // Ejecutar la anulación real del item en DB pasando el PIN para el RPC
                            handleVoidItem(pin);
                        } else if (pendingAction === 'cancel' && activeOrderId) {
                            setProcessing(true);
                            try {
                                const nowGuate = DateUtils.toGuatemalaISO(new Date(Date.now() + serverOffset));

                                // v1.6.0 - Use RPC to cancel order with PIN validation (bypasses RLS)
                                const { data: rpcResult, error: rpcError } = await supabase.rpc('cancel_order_with_pin', {
                                    p_order_id: activeOrderId,
                                    p_admin_pin: pin,
                                    p_reason: voidReason || 'Sin motivo especificado',
                                    p_cancelled_at: nowGuate
                                });

                                if (rpcError || (rpcResult && rpcResult.success === false)) {
                                    throw rpcError || new Error(rpcResult?.error || 'Error al anular orden');
                                }

                                // LOG: Order Cancelled
                                const cancelledOrder = tableOrders.find(o => o.id === activeOrderId);
                                activityLogService.logFinancial({
                                    user: authorizedUser || currentUser!, // Atribuir al que puso el PIN
                                    module: 'VENTAS',
                                    action: 'ORDEN_ANULADA',
                                    severity: 'CRITICAL',
                                    entity_id: activeOrderId || undefined,
                                    entity_type: 'ORDER',
                                    details: {
                                        orderId: activeOrderId,
                                        numero_orden: cancelledOrder?.order_number,
                                        total_anulado: cancelledOrder?.total || items.reduce((a, i) => a + (i.price * i.quantity), 0),
                                        motivo_anulacion: voidReason || 'Sin motivo especificado',
                                        autorizado_por: authorizedUser?.name || authorizedUser?.full_name,
                                        autorizado_por_id: authorizedUser?.id,
                                        mesa: table?.number,
                                        seccion: table?.section,
                                        mesero_original: cancelledOrder?.waiter_id,
                                        items_anulados: items.length,
                                        items: items.map(i => ({ nombre: i.product_name, cantidad: i.quantity, precio: i.price }))
                                    }
                                }, {
                                    amount: cancelledOrder?.total || items.reduce((a, i) => a + (i.price * i.quantity), 0),
                                    type: 'ANULACION',
                                    currency: 'GTQ'
                                });

                                if (table?.id) await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);

                                // v1.7.2 - Print Cancellation Receipt for Audit
                                if (cancelledOrder) {
                                    await printService.printCancelledTicket({
                                        orderNumber: cancelledOrder.order_number,
                                        createdAt: cancelledOrder.created_at,
                                        items: items,
                                        tableNumber: table?.number,
                                        orderType: cancelledOrder.order_type,
                                        customerName: cancelledOrder.customer_name,
                                        customerPhone: cancelledOrder.customer_phone,
                                        deliveryAddress: cancelledOrder.delivery_address
                                    }, voidReason || 'Sin motivo especificado');
                                }

                                onClose?.();
                            } catch (error: any) {
                                console.error(error);
                                showAlert(`Error: ${error.message}`, 'Error');
                            }
                            setProcessing(false);
                        }
                        setShowPinModal(false);
                        setPendingAction(null);
                    }}
                />
                <DiscountModal
                    isOpen={showDiscountModal}
                    onClose={() => {
                        setShowDiscountModal(false);
                        setDiscountingItem(null);
                    }}
                    subtotal={discountingItem ? (discountingItem.price * discountingItem.quantity) : subtotal}
                    onApply={handleDiscountApply}
                    currentDiscount={discountingItem ? (discountingItem.discount_id ? { id: discountingItem.discount_id, percentage: discountingItem.discount_percentage || 0, value: discountingItem.discount_type === 'AMOUNT' ? (discountingItem.discount_amount || 0) : (discountingItem.discount_percentage || 0), type: discountingItem.discount_type || 'PERCENT', name: '' } : null) as any : discount}
                    title={discountingItem ? `Descuento: ${discountingItem.product_name}` : "Descuento de la Mesa"}
                    itemContext={discountingItem ? "Producto" : "Mesa"}
                />
                <InvoiceModal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} onSubmit={handleInvoiceSubmit} total={total + tipAmount} />

                {/* Modal para capturar datos de cliente en Para Llevar */}
                <AnimatePresence>
                    {showTakeoutClientModal && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-6 no-scrollbar overflow-hidden">
                            <motion.div
                                drag
                                dragMomentum={false}
                                className="w-full max-w-[400px] bg-[#2b2d3d] rounded-[32px] border border-white/10  overflow-hidden cursor-default"
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ duration: 0.1 }}
                            >
                                {/* Drag Handle */}
                                <div className="h-2 w-12 bg-white/10 rounded-full mx-auto mt-4 mb-2 touch-none cursor-grab active:cursor-grabbing" />

                                <div className="bg-[#1e1f2b] p-6 border-b border-white/5 flex flex-col items-center">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-3">
                                        <Package className="text-white" size={24} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white uppercase tracking-tighter">Datos para Llevar</h3>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mt-1">Nombre y teléfono requeridos</p>
                                </div>

                                <div className="p-8 space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Nombre del Cliente</label>
                                        <div className="relative">
                                            <input
                                                id="hidden-takeout-name"
                                                type="text"
                                                value={takeoutData.name}
                                                onChange={(e) => setTakeoutData(prev => ({ ...prev, name: e.target.value }))}
                                                inputMode="none"
                                                className="absolute inset-0 opacity-0 pointer-events-none z-0"
                                                data-virtual-input
                                            />
                                            <div
                                                data-virtual-input
                                                data-keyboard="text"
                                                tabIndex={0}
                                                onClick={() => document.getElementById('hidden-takeout-name')?.focus()}
                                                className={`w-full bg-black/20 border rounded-2xl p-4 text-white outline-none transition-all font-medium text-sm min-h-[56px] flex items-center cursor-text relative z-10 ${focusedField === 'name' ? 'border-white/40  virtual-input-focused' : 'border-white/10'}`}
                                            >
                                                {takeoutData.name}
                                            </div>
                                            {!takeoutData.name && (
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 opacity-50 font-medium text-sm pointer-events-none z-20">
                                                    EJ: JUAN PEREZ
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                                        <div className="relative">
                                            <input
                                                id="hidden-takeout-phone"
                                                type="text"
                                                value={takeoutData.phone}
                                                onChange={(e) => setTakeoutData(prev => ({ ...prev, phone: e.target.value }))}
                                                inputMode="none"
                                                className="absolute inset-0 opacity-0 pointer-events-none z-0"
                                                data-virtual-input
                                                data-keyboard="numeric"
                                            />
                                            <div
                                                data-virtual-input
                                                data-keyboard="numeric"
                                                tabIndex={0}
                                                onClick={() => document.getElementById('hidden-takeout-phone')?.focus()}
                                                className={`w-full bg-black/20 border rounded-2xl p-4 text-white outline-none transition-all font-medium text-sm min-h-[56px] flex items-center cursor-text relative z-10 ${focusedField === 'phone' ? 'border-white/40  virtual-input-focused' : 'border-white/10'}`}
                                            >
                                                {takeoutData.phone}
                                            </div>
                                            {!takeoutData.phone && (
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 opacity-50 font-medium text-sm pointer-events-none z-20">
                                                    0000-0000
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={() => setShowTakeoutClientModal(false)}
                                            className="flex-1 py-4 border border-white/10 rounded-2xl font-semibold text-[10px] text-gray-400 uppercase tracking-widest hover:bg-white/5 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!takeoutData.name.trim()) return;
                                                setShowTakeoutClientModal(false);
                                                const finalId = await handleOrderSubmission(undefined, takeoutData);
                                                const isCashierOrAdmin = currentUser?.role?.toUpperCase() === 'CAJERO' || currentUser?.role?.toUpperCase() === 'ADMIN';
                                                if (isCashierOrAdmin && finalId) {
                                                    const updatedOrder = {
                                                        ...initialOrder,
                                                        id: finalId,
                                                        customer_name: takeoutData.name,
                                                        customer_phone: takeoutData.phone,
                                                        subtotal,
                                                        tax_amount: taxAmount,
                                                        tip_amount: tipAmount,
                                                        total: total + tipAmount,
                                                        items: checkoutItems.map(i => ({
                                                            ...i,
                                                            product_name: i.product_name,
                                                            unit_price: (i as any).unit_price || i.price || 0,
                                                            quantity: i.quantity,
                                                            is_sent: true
                                                        }))
                                                    };
                                                    onCheckout?.(updatedOrder as any);
                                                }
                                            }}
                                            disabled={!takeoutData.name.trim() || processing}
                                            className="flex-1 py-4 bg-white hover:bg-white/90 disabled:opacity-50 text-black rounded-2xl font-semibold text-[10px] uppercase tracking-[0.2em]  active:scale-95 transition-all"
                                        >
                                            {processing ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'CONFIRMAR ORDEN'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {table && <TransferTableModal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} currentTable={table} onTransfer={handleTableTransfer} />}
                <TransferWaiterModal
                    isOpen={showTransferWaiterModal}
                    onClose={() => setShowTransferWaiterModal(false)}
                    currentWaiterName={tableOrders.find(o => o.id === activeOrderId)?.waiter?.name || currentUser?.name}
                    onTransfer={handleTransferWaiter}
                />
                <AccountsManagementModal
                    isOpen={showAccountsModal}
                    onClose={() => setShowAccountsModal(false)}
                    orders={tableOrders}
                    onConfirm={handleAccountDivision}
                    onOpenOverview={() => {
                        setShowAccountsModal(false);
                        setShowAccountsOverviewModal(true);
                    }}
                />
                <AccountsOverviewModal
                    isOpen={showAccountsOverviewModal}
                    onClose={() => setShowAccountsOverviewModal(false)}
                    tableOrders={tableOrders}
                    activeOrderId={activeOrderId}
                    onSelectAccount={(id) => {
                        setActiveOrderId(id);
                        setShowAccountsOverviewModal(false);
                    }}
                    onAddAccount={handleAddEmptyAccount}
                    onEditAccount={handleRenameAccount}
                    onDeleteAccount={handleDeleteEmptyAccount}
                    onSplitAccount={() => {
                        setShowAccountsOverviewModal(false);
                        setShowAccountsModal(true);
                    }}
                    onPrintAccount={(id) => {
                        if (id !== activeOrderId) {
                            setActiveOrderId(id);
                        }
                        handlePrintPreAccount();
                    }}
                    initialOrder={initialOrder}
                />

                <DeliveryPaymentModal
                    isOpen={showDeliveryPaymentModal}
                    onClose={() => setShowDeliveryPaymentModal(false)}
                    isLoading={processing}
                    total={total + tipAmount}
                    onConfirm={async (paymentData) => {
                        setShowDeliveryPaymentModal(false);

                        let methodString = paymentData.method as string;
                        if (paymentData.method === 'EFECTIVO' && paymentData.cashAmount) {
                            const change = paymentData.cashAmount - (total + tipAmount);
                            // Format: EFECTIVO
                            // Paga con: Q200.00
                            // CAMBIO: Q57.00
                            methodString = `EFECTIVO\nPAGA CON: Q${paymentData.cashAmount.toFixed(2)}\nCAMBIO/SENCILLO: Q${change.toFixed(2)}`;
                        }

                        await handleOrderSubmission(methodString);
                    }}
                />

                <AccountsOverviewModal
                    isOpen={!!singleItemToTransfer}
                    onClose={() => setSingleItemToTransfer(null)}
                    tableOrders={tableOrders.filter(o => o.id !== (singleItemToTransfer as any)?.order_id)}
                    activeOrderId={activeOrderId}
                    onSelectAccount={() => { }}
                    onAddAccount={() => { }}
                    onEditAccount={() => { }}
                    onDeleteAccount={() => { }}
                    onSplitAccount={() => { }}
                    onPrintAccount={() => { }}
                    initialOrder={initialOrder}
                    transferMode={true}
                    itemToTransferName={singleItemToTransfer?.product_name || 'Platillo'}
                    onTransferConfirm={async (targetOrderId) => {
                        if (!singleItemToTransfer) return;
                        if (singleItemToTransfer.id.startsWith('i-')) {
                            showAlert('Debe enviar la orden (botón Guardar/Enviar) antes de trasladar el platillo.');
                            setSingleItemToTransfer(null);
                            return;
                        }

                        try {
                            const { error } = await supabase.from('order_items').update({ order_id: targetOrderId }).eq('id', singleItemToTransfer.id);
                            if (error) throw error;

                            if (currentUser) {
                                activityLogService.log({
                                    user: currentUser,
                                    module: 'SALA',
                                    action: 'TRASLADO_ITEM',
                                    severity: 'INFO',
                                    details: {
                                        item: singleItemToTransfer.product_name,
                                        from_order: activeOrderId || (singleItemToTransfer as any).order_id,
                                        to_order: targetOrderId
                                    }
                                });
                            }
                            notify.success('Platillo trasladado');
                        } catch (e) {
                            showAlert('Error al trasladar platillo');
                        }
                        setSingleItemToTransfer(null);
                    }}
                />

                {showVoidModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-6 animate-fade-in">
                        <div className="w-full max-w-[420px] bg-[#2b2d3d] rounded-xl border border-white/10  overflow-hidden">
                            {/* HEADER */}
                            <div className="bg-[#1e1f2b] py-3 px-4 border-b border-white/5">
                                <h3 className="text-sm font-medium text-white text-center">Motivo Anulación</h3>
                            </div>

                            <div className="p-6">
                                <textarea
                                    autoFocus
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    placeholder="Describa el motivo..."
                                    className="w-full h-40 bg-[#1e1f2b] border border-white/10 rounded-lg p-4 text-white focus:border-white/40 outline-none transition-all resize-none text-sm placeholder:text-gray-500"
                                />

                                <div className="flex gap-4 mt-6">
                                    <button
                                        onClick={() => { setShowVoidModal(false); setItemToVoid(null); setVoidReason(''); }}
                                        className="flex-1 py-3 border border-white/20 rounded-lg font-medium text-xs text-white uppercase tracking-wider hover:bg-white/5 transition-all"
                                    >
                                        CANCELAR
                                    </button>
                                    <button
                                        onClick={() => {
                                            // v1.6.2 - Al aceptar el motivo, cerramos este modal y abrimos el del PIN
                                            // para proceder con la validación física o remota.
                                            setShowVoidModal(false);
                                            setShowPinModal(true);
                                        }}
                                        disabled={voidReason.trim().length < 5 || processing}
                                        className="flex-1 py-3 bg-white disabled:bg-gray-700 disabled:opacity-50 text-black rounded-lg font-medium text-xs uppercase tracking-wider  /5 active:scale-95 transition-all"
                                    >
                                        {processing ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'ACEPTAR'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {customDialog && (
                        <WindowsConfirmModal
                            key="windows-confirm-dialog"
                            title={customDialog.title}
                            message={customDialog.message}
                            type={customDialog.type}
                            onConfirm={customDialog.onConfirm}
                            onDeny={customDialog.onDeny}
                            onCancel={customDialog.onCancel}
                        />
                    )}
                    {customInput && (
                        <WindowsInputModal
                            key="windows-input-dialog"
                            title={customInput.title}
                            message={customInput.message}
                            defaultValue={customInput.defaultValue}
                            placeholder={customInput.placeholder}
                            onConfirm={customInput.onConfirm}
                            onCancel={() => setCustomInput(null)}
                        />
                    )}

                    <TabletItemActionModal
                        key="tablet-item-action"
                        isOpen={!!tabletItemActionModal}
                        onClose={() => setTabletItemActionModal(null)}
                        item={tabletItemActionModal}
                        onUpdateQuantity={(id, qty) => setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))}
                        onUpdateNotes={(id, notes) => setItems(prev => prev.map(i => i.id === id ? { ...i, notes } : i))}
                        onEditItem={(item) => handleEditItem(item)}
                        onDeleteItem={(item) => removeItem(item.id)}
                        onTransferItem={(item) => {
                            if (tableOrders.length <= 1) {
                                showAlert('Esta mesa solo tiene una cuenta. Cree otra cuenta para poder trasladar platillos.');
                                return;
                            }
                            setSingleItemToTransfer(item);
                        }}
                        onSendWithoutPrinting={(item) => {
                            setItems(prev => prev.map(i => (i.id === item.id || i.cart_id === item.cart_id) ? { ...i, notes: item.notes } : i));
                            setTabletItemActionModal(null);
                            setTimeout(() => {
                                document.getElementById('main-submit-btn')?.click();
                            }, 100);
                        }}
                    />

                    <AccountsOverviewModal
                        key="accounts-overview-transfer"
                        isOpen={!!singleItemToTransfer}
                        onClose={() => setSingleItemToTransfer(null)}
                        tableOrders={tableOrders}
                        activeOrderId={activeOrderId}
                        onSelectAccount={() => { }}
                        onAddAccount={handleAddEmptyAccount}
                        onEditAccount={handleRenameAccount}
                        onDeleteAccount={handleDeleteEmptyAccount}
                        onSplitAccount={() => { }}
                        onPrintAccount={(id) => {
                            if (id !== activeOrderId) {
                                setActiveOrderId(id);
                            }
                            handlePrintPreAccount();
                        }}
                        initialOrder={initialOrder}
                        transferMode={true}
                        itemToTransferName={singleItemToTransfer?.product_name || 'Platillo'}
                        sourceOrderId={(singleItemToTransfer as any)?.order_id || activeOrderId}
                        onTransferConfirm={async (targetOrderId) => {
                            if (!singleItemToTransfer) return;
                            if (singleItemToTransfer.id.startsWith('i-')) {
                                showAlert('Debe enviar la orden (botón Guardar/Enviar) antes de trasladar el platillo.');
                                setSingleItemToTransfer(null);
                                return;
                            }

                            try {
                                const { error } = await supabase.from('order_items').update({ order_id: targetOrderId }).eq('id', singleItemToTransfer.id);
                                if (error) throw error;

                                if (currentUser) {
                                    activityLogService.log({
                                        user: currentUser,
                                        module: 'SALA',
                                        action: 'TRASLADO_ITEM',
                                        severity: 'INFO',
                                        details: {
                                            item: singleItemToTransfer.product_name,
                                            from_order: activeOrderId || (singleItemToTransfer as any).order_id,
                                            to_order: targetOrderId
                                        }
                                    });
                                }
                                notify.success('Platillo trasladado');
                            } catch (e) {
                                showAlert('Error al trasladar platillo');
                            }
                            setSingleItemToTransfer(null);
                        }}
                    />
                </AnimatePresence>
            </div>
        </div >
    );
};
