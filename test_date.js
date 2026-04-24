const DateUtils = {
    nowISO: () => {
        return DateUtils.toGuatemalaISO(new Date());
    },
    toGuatemalaISO: (date) => {
        const guateOffsetMs = -6 * 60 * 60 * 1000;
        const guateDate = new Date(date.getTime() + guateOffsetMs);
        const pad = (n) => n.toString().padStart(2, '0');
        const y = guateDate.getUTCFullYear();
        const m = pad(guateDate.getUTCMonth() + 1);
        const d = pad(guateDate.getUTCDate());
        const h = pad(guateDate.getUTCHours());
        const min = pad(guateDate.getUTCMinutes());
        const s = pad(guateDate.getUTCSeconds());
        const ms = guateDate.getUTCMilliseconds().toString().padStart(3, '0');
        return `${y}-${m}-${d}T${h}:${min}:${s}.${ms}-06:00`;
    }
};

const now = new Date();
const iso = DateUtils.toGuatemalaISO(now);
const parsed = new Date(iso);

console.log('Original (Local/UTC):', now.toISOString());
console.log('Generated ISO:', iso);
console.log('Parsed ISO to UTC:', parsed.toISOString());
console.log('Original Time:', now.getTime());
console.log('Parsed Time:  ', parsed.getTime());
console.log('Difference (ms):', now.getTime() - parsed.getTime());
