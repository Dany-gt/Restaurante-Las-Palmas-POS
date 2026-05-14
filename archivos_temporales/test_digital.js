const axios = require('axios');
async function test() {
    const url = 'https://cofdsbczmrkriohlgyct.supabase.co/storage/v1/object/public/kds-sounds/digital-alert.mp3';
    try {
        const resp = await axios.head(url);
        console.log(`URL: ${url} | Status: ${resp.status}`);
    } catch (e) {
        console.log(`URL: ${url} | FAILED: ${e.message}`);
    }
}
test();
