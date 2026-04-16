// Helper utility for Guatemala Timezone (UTC-6)
// Using native Intl to avoid external dependencies if possible, or manual offset.

export const DateUtils = {
    /**
     * Returns current time in Guatemala as ISO string (e.g. 2023-10-27T10:00:00.000-06:00)
     * or a simplified ISO-like string if full timezone support is tricky without libs.
     * We will use a safe manual construction.
     */
    nowISO: (): string => {
        return new Date().toISOString();
    },

    /**
     * Converts a date to Guatemala ISO string.
     */
    toGuatemalaISO: (date: Date): string => {
        // Guatemala is UTC-6 fixed (No DST)
        const guateOffsetMs = -6 * 60 * 60 * 1000;

        // Create a date object shifted by the offset. 
        // We will read this using UTC methods to get the "Guatemala Wall Time".
        const guateDate = new Date(date.getTime() + guateOffsetMs);

        // Format manually using UTC methods to extract the shifted time
        const pad = (n: number) => n.toString().padStart(2, '0');
        const y = guateDate.getUTCFullYear();
        const m = pad(guateDate.getUTCMonth() + 1);
        const d = pad(guateDate.getUTCDate());
        const h = pad(guateDate.getUTCHours());
        const min = pad(guateDate.getUTCMinutes());
        const s = pad(guateDate.getUTCSeconds());
        const ms = guateDate.getUTCMilliseconds().toString().padStart(3, '0');

        return `${y}-${m}-${d}T${h}:${min}:${s}.${ms}-06:00`;
    },

    /**
     * Formats a date for display in Guatemala locale
     */
    formatDisplay: (dateStr: string | Date): string => {
        if (!dateStr) return '---';
        const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        try {
            return d.toLocaleDateString('es-GT', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Guatemala' // Browser support is good for this
            });
        } catch (e) {
            return d.toLocaleString();
        }
    },

    /**
     * Returns the current date in Guatemala as YYYY-MM-DD
     */
    getLocalDate: (date: Date = new Date()): string => {
        // Shift date by -6 hours
        const guateDate = new Date(date.getTime() - (6 * 60 * 60 * 1000));
        return guateDate.toISOString().split('T')[0];
    },

    /**
     * Returns a ISO string for start of the day in Guatemala for a specific YYYY-MM-DD
     */
    getStartOfDay: (dateStr: string): string => {
        return `${dateStr}T00:00:00.000-06:00`;
    },

    /**
     * Returns a ISO string for end of the day in Guatemala for a specific YYYY-MM-DD
     */
    getEndOfDay: (dateStr: string): string => {
        return `${dateStr}T23:59:59.999-06:00`;
    },

    /**
     * Returns a ISO string for start of the day in Guatemala
     */
    startOfDay: (): string => {
        return DateUtils.getStartOfDay(DateUtils.getLocalDate());
    },

    /**
     * Returns a ISO string for end of the day in Guatemala
     */
    endOfDay: (): string => {
        return DateUtils.getEndOfDay(DateUtils.getLocalDate());
    }
};
