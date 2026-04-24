import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    parent_id: string | null;
    [key: string]: any;
}

interface CategorySidebarProps {
    categories: Category[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    width: number;
    onResizeStart: (e: React.MouseEvent) => void;
    isResizing: boolean;
    title?: string;
    showSearch?: boolean;
    onContextMenuCategory?: (e: React.MouseEvent, cat: Category) => void;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
    categories,
    selectedId,
    onSelect,
    width,
    title = "CATEGORÍA",
    showSearch = false,
    onContextMenuCategory
}) => {
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (categories.length > 0 && expanded.size === 0) {
            // Auto-expand all root categories by default
            const rootIds = categories.filter(c => {
                const parentId = c.parent_id === null || c.parent_id === undefined ? '' : String(c.parent_id);
                return parentId === '';
            }).map(c => String(c.id));
            setExpanded(new Set(rootIds));
        }
    }, [categories]);

    const toggleExpand = (id: string, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpanded(next);
    };

    const renderTree = (parentId: string | null = null, depth = 0): React.ReactNode[] => {
        const parentStr = parentId === null ? '' : String(parentId);

        return categories
            .filter(c => {
                const cParent = c.parent_id === null || c.parent_id === undefined ? '' : String(c.parent_id);
                return cParent === parentStr;
            })
            .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
            .map(cat => {
                const hasChildren = categories.some(c => {
                    const cParent = c.parent_id === null || c.parent_id === undefined ? '' : String(c.parent_id);
                    return cParent === String(cat.id);
                });
                const isExpanded = expanded.has(String(cat.id));
                const isSelected = selectedId !== null && String(selectedId) === String(cat.id);

                return (
                    <div key={cat.id} className="flex flex-col w-full">
                        <button
                            onClick={() => {
                                onSelect(isSelected ? null : cat.id);
                                if (hasChildren) toggleExpand(String(cat.id));
                            }}
                            onContextMenu={(e) => {
                                if (onContextMenuCategory) {
                                    e.preventDefault();
                                    onContextMenuCategory(e, cat);
                                }
                            }}
                            className="flex items-stretch w-full transition-none text-left select-none outline-none"
                            style={{ minHeight: '22px' }}
                        >
                            {/* Columna Izquierda: flecha indicadora, siempre blanca con borde */}
                            <div className="w-5 shrink-0 flex items-center justify-center bg-white border-r border-gray-300">
                                {hasChildren && (
                                    <Play
                                        size={7}
                                        className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''} ${isSelected ? 'fill-[#106ebe] text-[#106ebe]' : 'fill-[#106ebe] text-[#106ebe]'}`}
                                    />
                                )}
                            </div>

                            {/* Columna Derecha: texto, azul si seleccionado */}
                            <div
                                className={`flex-1 min-w-0 flex items-center px-2 ${
                                    isSelected
                                        ? 'bg-[#106ebe]'
                                        : 'bg-white hover:bg-[#e8f0fb]'
                                }`}
                            >
                                <span
                                    style={{ paddingLeft: `${depth * 10}px` }}
                                    className={`truncate leading-none uppercase pr-1 ${
                                        isSelected 
                                            ? 'text-white font-bold text-[10px]' 
                                            : depth === 0 
                                                ? 'text-slate-800 font-black text-[11px] tracking-wide' 
                                                : 'text-slate-600 text-[10px]'
                                    }`}
                                >
                                    {cat.name}
                                </span>
                            </div>
                        </button>

                        {hasChildren && isExpanded && (
                            <div className="flex flex-col w-full">
                                {renderTree(cat.id, depth + 1)}
                            </div>
                        )}
                    </div>
                );
            });
    };

    return (
        <aside
            className="flex flex-col shrink-0 bg-white border-r border-gray-300"
            style={{ width: `${width}px` }}
        >
            {/* Cabecera gris */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 px-2 py-1 shrink-0">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{title}</span>
            </div>

            {showSearch && (
                <div className="p-1.5 border-b border-gray-200 bg-white">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar..."
                        className="w-full bg-white border border-gray-300 px-2 py-0.5 text-[10px] outline-none uppercase"
                    />
                </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {renderTree(null, 0)}
            </div>
        </aside>
    );
};
