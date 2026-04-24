import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ModalStatus = 'open' | 'minimized';

export interface ModalWindow {
    id: string;
    title: string;
    icon?: React.ReactNode;
    component: React.ReactNode;
    status: ModalStatus;
    zIndex: number;
    lastActiveAt: number;
}

interface WindowsModalContextType {
    modals: ModalWindow[];
    openModal: (id: string, title: string, component: React.ReactNode, icon?: React.ReactNode) => void;
    minimizeModal: (id: string) => void;
    restoreModal: (id: string) => void;
    closeModal: (id: string) => void;
    focusModal: (id: string) => void;
}

const WindowsModalContext = createContext<WindowsModalContextType | undefined>(undefined);

let globalZIndex = 100000;

export const WindowsModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [modals, setModals] = useState<ModalWindow[]>([]);

    const focusModal = useCallback((id: string) => {
        setModals(prev => prev.map(m => 
            m.id === id ? { ...m, zIndex: ++globalZIndex, lastActiveAt: Date.now(), status: 'open' as const } : m
        ));
    }, []);

    const openModal = useCallback((id: string, title: string, component: React.ReactNode, icon?: React.ReactNode) => {
        setModals(prev => {
            const existing = prev.find(m => m.id === id);
            if (existing) {
                // Focus existing
                return prev.map(m => m.id === id ? { ...m, zIndex: ++globalZIndex, lastActiveAt: Date.now(), status: 'open' as const } : m);
            }
            // Add new
            return [...prev, {
                id, title, icon, component,
                status: 'open',
                zIndex: ++globalZIndex,
                lastActiveAt: Date.now()
            }];
        });
    }, []);

    const minimizeModal = useCallback((id: string) => {
        setModals(prev => prev.map(m => m.id === id ? { ...m, status: 'minimized' as const } : m));
    }, []);

    const restoreModal = useCallback((id: string) => {
        setModals(prev => prev.map(m => m.id === id ? { ...m, status: 'open', zIndex: ++globalZIndex, lastActiveAt: Date.now() } : m));
    }, []);

    const closeModal = useCallback((id: string) => {
        setModals(prev => prev.filter(m => m.id !== id));
    }, []);

    return (
        <WindowsModalContext.Provider value={{ modals, openModal, minimizeModal, restoreModal, closeModal, focusModal }}>
            {children}
            {/* Renderizar modales abiertos en un portal global */}
            <div id="global-windows-container">
                {modals.map(modal => (
                    <div 
                        key={modal.id} 
                        style={{ display: modal.status === 'minimized' ? 'none' : 'block', zIndex: modal.zIndex }}
                        className="fixed inset-0 pointer-events-none"
                    >
                        {modal.component}
                    </div>
                ))}
            </div>
        </WindowsModalContext.Provider>
    );
};

export const useWindows = () => {
    const context = useContext(WindowsModalContext);
    if (!context) throw new Error('useWindows must be used within a WindowsModalProvider');
    return context;
};
