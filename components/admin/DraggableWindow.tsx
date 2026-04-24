import React, { useState, useEffect, useCallback } from 'react';
import { useWindows } from './WindowsModalContext';
import { Minus, X } from 'lucide-react';

let maxZIndex = 99999;

interface DraggableWindowProps {
    children: React.ReactNode;
    disabled?: boolean;
    id?: string;
    title?: string;
    onClose?: () => void;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({ children, disabled = false, id, title, onClose }) => {
    const windowRef = React.useRef<HTMLDivElement>(null);
    const [zIndex, setZIndex] = useState(() => ++maxZIndex);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    const isDragging = React.useRef(false);
    const startPos = React.useRef({ x: 0, y: 0 });
    const currentPos = React.useRef({ x: 0, y: 0 });
    const { focusModal, openModal, modals, minimizeModal, closeModal } = useWindows();

    const isMinimized = modals.find(m => m.id === id)?.status === 'minimized';

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Registration for multitasking 
    useEffect(() => {
        if (id && title) {
            // Register as a "bridge" window
            openModal(id, title, null); // null component since it's rendered locally
            
            return () => {
                closeModal(id);
            };
        }
    }, [id, title, openModal, closeModal]);

    const handleFocus = useCallback(() => {
        const nextZ = ++maxZIndex;
        setZIndex(nextZ);
        if (id) {
            focusModal(id);
        }
    }, [id, focusModal]);

    const onMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const isInteractive = ['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || target.closest('button');
        
        if (!isInteractive) {
            handleFocus();
        }
        if (isMobile || disabled) return;
        
        if (target.closest('.modal-header')) {
            // Clicked header but not buttons
            if (target.closest('button')) return;

            isDragging.current = true;

            if (windowRef.current) {
                windowRef.current.style.transition = 'none';
                windowRef.current.style.willChange = 'transform';
            }

            startPos.current = {
                x: e.pageX - currentPos.current.x,
                y: e.pageY - currentPos.current.y
            };
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
            e.stopPropagation();
        }
    };

    useEffect(() => {
        let animationFrameId: number;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || isMobile || disabled) return;

            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                const newX = e.pageX - startPos.current.x;
                const newY = e.pageY - startPos.current.y;
                currentPos.current = { x: newX, y: newY };

                if (windowRef.current) {
                    windowRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
                }
            });
        };

        const handleMouseUp = () => {
            if (!isDragging.current) return;

            isDragging.current = false;
            cancelAnimationFrame(animationFrameId);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';

            if (windowRef.current) {
                windowRef.current.style.willChange = 'auto';
                windowRef.current.style.transition = 'none';
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isMobile, disabled]);

    if (isMinimized) return null;

    return (
        <div
            ref={windowRef}
            onMouseDown={onMouseDown}
            onClick={handleFocus}
            className="draggable-window-container"
            style={isMobile ? {
                zIndex: zIndex,
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100dvh',
                pointerEvents: 'auto',
                display: 'flex',
                background: 'white'
            } : {
                zIndex: zIndex,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transformStyle: 'preserve-3d',
                pointerEvents: 'auto',
                position: 'relative'
            }}
        >
            {/* Si detectamos que es un modal clásico y tiene header, inyectamos el botón de minimizar */}
            {children}
        </div>
    );
};
