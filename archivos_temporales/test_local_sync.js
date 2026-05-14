const fetch = require('node-fetch');

async function testSync() {
    console.log("Testing POST to http://localhost:3000/api/sat-sync");
    try {
        const response = await fetch('http://localhost:3000/api/sat-sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: "91887666",
                password: "Laspalmas2015",
                dateStart: "2026-04-01",
                dateEnd: "2026-04-05",
                tipo: "emitida",
                supabaseUrl: "https://cofdsbczmrkriohlgyct.supabase.co",
                supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY"
            }),
            timeout: 120000 // 2 minutes
        });
        
        console.log(`Status: ${response.status}`);
        const data = await response.text();
        console.log(`Response length: ${data.length}`);
        try {
            const json = JSON.parse(data);
            console.log("Success:", json.success);
            if (json.error) console.log("Error:", json.error);
        } catch(e) {
            console.log("Body snippet:", data.substring(0, 500));
        }
        
    } catch(err) {
        console.error("Fetch failed:", err);
    }
}

testSync();
