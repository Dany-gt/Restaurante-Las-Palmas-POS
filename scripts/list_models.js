
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Usamos la clave que nos dio el usuario (la segudna, que es la nueva)
const apiKey = "AIzaSyDMMkHXj1dBGKHVIdS3Pd0zWM0yP5GJTFg";

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        // Para listar modelos, necesitamos acceder al modelManager si estuviera expuesto, 
        // pero el SDK actual lo hace via getGenerativeModel para generar.
        // La forma standard de listar modelos en v1beta con REST es GET /v1beta/models
        // Pero el SDK de node tiene un metodo getGenerativeModel.
        // Vamos a hacer un fetch raw porque el SDK a veces es opaco.

        console.log("Fetching available models via REST API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        console.log("\n✅ Modelos Disponibles:");
        if (data.models) {
            data.models.forEach(m => {
                if (m.name.includes("gemini")) {
                    console.log(`- ${m.name} | Supported methods: ${m.supportedGenerationMethods}`);
                }
            });
        } else {
            console.log("No se encontraron modelos. Respuesta raw:", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
