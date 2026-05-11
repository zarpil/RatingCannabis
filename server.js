import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Necesario para obtener la IP real del usuario detrás de Cloudflare
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Límite de peticiones para proteger la cuota de la IA
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Límite de 5 peticiones por IP cada 15 minutos
  message: { error: 'Too many requests, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// La API Key se lee del entorno (Docker / .env) y nunca llega al navegador
const apiKey = process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ ERROR: VITE_GEMINI_API_KEY no está configurada en el servidor.');
}

const ai = new GoogleGenAI({ apiKey });

const responseSchema = {
  type: "object",
  properties: {
    isCannabis: {
      type: "boolean",
      description: "True solo si la imagen contiene clara e inequívocamente cannabis o un derivado (flor, rosin, hachís, extracto)."
    },
    type: {
      type: "string",
      description: "Tipo de producto (Ej: Flor, Dry Sift, Ice-o-Lator, Rosin, BHO)."
    },
    predominance: {
      type: "string",
      description: "Predominancia basada en el aspecto (Ej: Indica, Sativa, Híbrida)."
    },
    thc: {
      type: "integer",
      description: "Estimación visual del % de THC basándote en la densidad de tricomas (0-35)."
    },
    cbd: {
      type: "integer",
      description: "Estimación visual del % de CBD (0-15)."
    },
    terpenes: {
      type: "integer",
      description: "Estimación visual del % de terpenos (1-10)."
    },
    quality: {
      type: "integer",
      description: "Calidad visual general del 1 al 5 estrellas."
    },
    traits: {
      type: "object",
      properties: {
        trichomes: { type: "string", description: "Descripción detallada de la densidad de tricomas. Ej: Alta · 39.2% cobertura" },
        texture: { type: "string", description: "Descripción de textura y densidad física. Ej: Cristalina · rugosidad 54/100" },
        curing: { type: "string", description: "Estado aparente de curación/humedad. Ej: Fresca · brillo 56%" }
      },
      required: ["trichomes", "texture", "curing"]
    },
    interpretation: {
      type: "string",
      description: "Un párrafo profesional, muy específico y técnico interpretando la muestra. NO te limites a decir 'Es una flor híbrida'. Describe los matices de color, estructura del cogollo o extracción, signos de oxidación en tricomas y lo que eso indica sobre los efectos o el estado de curación."
    }
  },
  required: ["isCannabis", "type", "predominance", "thc", "cbd", "terpenes", "quality", "traits", "interpretation"]
};

app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });
    if (!apiKey) return res.status(500).json({ error: 'API Key not configured on server' });

    const base64Data = image.split(',')[1];
    const mimeType = image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg';

    // Nueva sintaxis del SDK @google/genai
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        prompt,
        { inlineData: { data: base64Data, mimeType } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error('Error en el análisis:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Servir archivos estáticos de la app React (después de hacer npm run build)
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`🚀 TrichAi Server running on port ${PORT}`);
});
