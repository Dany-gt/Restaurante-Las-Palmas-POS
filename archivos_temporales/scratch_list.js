const apiKey = "AQ.Ab8RN6IyflYjmPl7DWYx1s1wUHFXYNQtTLq3eIGkz3ZM9xmuJQ";
async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
    } catch (e) {
        console.error(e);
    }
}
listModels();
