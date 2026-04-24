import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * DynamicIcon Component
 * Handles 5 themes: classic, modern, isometric, neomorphic, sketch, popart
 */

interface DynamicIconProps {
    iconName: string; // Ej: 'Users', 'Printer', 'Utensils' (Matches Lucide names)
    theme: string;    // Ej: 'classic', 'isometric', 'neomorphic', etc.
    size?: number;
    className?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({
    iconName,
    theme,
    size = 24,
    className = ""
}) => {
    // 1. Get the base Lucide Icon for fallback and classic themes
    const LucideIcon = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;

    // 2. Mapping for themes that use image assets (Isometric, Modern)
    const assetMapping: Record<string, Record<string, string>> = {
        isometric: {
            'Users': 'https://vclshvwhasymhsyfsmps.supabase.co/storage/v1/object/public/pos-assets/modern_icon_config_gray.png',
            'Printer': 'https://vclshvwhasymhsyfsmps.supabase.co/storage/v1/object/public/pos-assets/pos_icons_payments_set_1773598285511.png',
            'Utensils': 'https://vclshvwhasymhsyfsmps.supabase.co/storage/v1/object/public/pos-assets/modern_icon_menu_orange.png'
        },
        modern: {
            'Users': 'https://vclshvwhasymhsyfsmps.supabase.co/storage/v1/object/public/pos-assets/modern_icon_config_gray.png',
            'Printer': 'https://vclshvwhasymhsyfsmps.supabase.co/storage/v1/object/public/pos-assets/pos_icons_payments_set_1773598285511.png',
            'Utensils': 'https://vclshvwhasymhsyfsmps.supabase.co/storage/v1/object/public/pos-assets/modern_icon_menu_orange.png'
        }
    };

    // Logical rendering based on theme
    const renderContent = () => {
        // Themes that use external image assets
        if ((theme === 'isometric' || theme === 'modern') && assetMapping[theme]?.[iconName]) {
            return (
                <div className={`relative flex items-center justify-center ${theme === 'isometric' ? 'drop-shadow-lg' : ''}`}>
                    <img
                        src={assetMapping[theme][iconName]}
                        alt={iconName}
                        style={{ width: size * 1.5, height: size * 1.5 }}
                        className="object-contain transition-transform group-hover:scale-110"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const fallback = (e.target as HTMLElement).nextSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                        }}
                    />
                    <div className="hidden items-center justify-center">
                        <LucideIcon size={size} strokeWidth={1.5} />
                    </div>
                </div>
            );
        }

        // Themes that use CSS transformations on SVG (Neomorphic, PopArt, Sketch)
        let themeClasses = "";
        let strokeWidth = 1.5;

        switch (theme) {
            case 'neomorphic':
                themeClasses = "p-2 rounded-xl shadow-[4px_4px_10px_#A3B1C6,-4px_-4px_10px_#FFFFFF] bg-[#F0F2F5] text-slate-500";
                break;
            case 'popart':
                themeClasses = "p-1.5 bg-yellow-400 border-2 border-black shadow-[4px_4px_0px_#000] rounded-none text-black";
                strokeWidth = 2.5;
                break;
            case 'sketch':
                themeClasses = "p-1.5 border-2 border-slate-900 rounded-sm shadow-[2px_2px_0px_#000] bg-white text-slate-900";
                strokeWidth = 2.5;
                break;
            case 'flat':
                themeClasses = "p-2 rounded-lg bg-slate-100 border border-slate-200 text-[#2d2e3d]";
                break;
            default: // classic
                themeClasses = "text-current";
        }

        return (
            <div className={`${themeClasses} flex items-center justify-center transition-all ${className}`}>
                <LucideIcon size={size} strokeWidth={strokeWidth} />
            </div>
        );
    };

    return renderContent();
};
