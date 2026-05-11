import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, AlertCircle, Leaf, CheckCircle2, Star, RefreshCw } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

type AnalysisResult = {
  type: string;
  predominance: string;
  thc: number;
  cbd: number;
  terpenes: number;
  quality: number; // 1 to 5
} | null;

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    setError(null);
    setResult(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Formato no válido. Sube JPG, PNG o WEBP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'pon_aqui_tu_api_key_de_gemini') {
      setError('Falta la API Key de Gemini. Por favor, añádela en el archivo .env de la raíz del proyecto.');
      setIsAnalyzing(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const base64Data = image.split(',')[1];
      const mimeType = image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg';

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          isCannabis: {
            type: Type.BOOLEAN,
            description: "True solo si la imagen contiene clara e inequívocamente cannabis o un derivado (flor, rosin, hachís, extracto)."
          },
          type: {
            type: Type.STRING,
            description: "Tipo de producto (Ej: Flor, Dry Sift, Ice-o-Lator, Rosin, BHO)."
          },
          predominance: {
            type: Type.STRING,
            description: "Predominancia basada en el aspecto (Ej: Indica, Sativa, Híbrida)."
          },
          thc: {
            type: Type.INTEGER,
            description: "Estimación visual del % de THC basándote en la densidad de tricomas (0-35)."
          },
          cbd: {
            type: Type.INTEGER,
            description: "Estimación visual del % de CBD (0-15)."
          },
          terpenes: {
            type: Type.INTEGER,
            description: "Estimación visual del % de terpenos (1-10)."
          },
          quality: {
            type: Type.INTEGER,
            description: "Calidad visual general del 1 al 5 estrellas."
          }
        },
        required: ["isCannabis"]
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          "Eres un experto catador y botánico especializado en cannabis. Analiza la imagen minuciosamente. Si no es cannabis o un extracto derivado, pon isCannabis en false. Si lo es, ponlo en true y devuelve estimaciones realistas basadas en el aspecto, los tricomas, el color y la textura.",
          { inlineData: { data: base64Data, mimeType } }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });

      const textResponse = response.text;
      if (!textResponse) throw new Error("Respuesta vacía de la API");

      const data = JSON.parse(textResponse);

      if (!data.isCannabis) {
        setError('Parece ser que nuestro sistema no detecta bien la imagen. Por favor, sube una foto clara de una flor o extracción.');
      } else {
        setResult({
          type: data.type || 'Flor',
          predominance: data.predominance || 'Híbrida',
          thc: data.thc || 15,
          cbd: data.cbd || 1,
          terpenes: data.terpenes || 2,
          quality: data.quality || 3,
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al comunicarse con Gemini. Revisa la consola.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-deep-black text-white flex flex-col font-sans selection:bg-neon-green selection:text-black">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/10 glass-panel sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Leaf className="w-8 h-8 text-neon-green" />
          <h1 className="text-2xl font-bold tracking-tight">Trich<span className="text-neon-green">Ai</span></h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {!image && !result && !isAnalyzing && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center w-full"
            >
              <h2 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-neon-green to-emerald bg-clip-text text-transparent">
                Analizador Inteligente de Derivados del Cannabis
              </h2>
              <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
                Sube una imagen de tu flor o extracción y deja que nuestra IA analice la pureza, el tipo de producto y estime los niveles de cannabinoides.
              </p>

              <div
                className={`relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300 ${isDragging ? 'border-neon-green bg-neon-green/5 scale-105' : 'border-gray-700 bg-charcoal hover:border-gray-500'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="p-4 bg-white/5 rounded-full backdrop-blur-sm">
                    <Upload className="w-10 h-10 text-neon-green" />
                  </div>
                  <h3 className="text-xl font-semibold">Arrastra y suelta tu imagen aquí</h3>
                  <p className="text-sm text-gray-500">Soporta JPG, PNG, WEBP</p>

                  <div className="flex items-center gap-4 mt-6">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-medium transition-colors flex items-center gap-2"
                    >
                      Examinar archivos
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-neon-green text-black hover:bg-emerald rounded-full font-bold transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:shadow-[0_0_30px_rgba(57,255,20,0.5)]"
                    >
                      <Camera className="w-5 h-5" />
                      Usar Cámara
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {image && !result && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex flex-col items-center"
            >
              <div className="relative w-full max-w-md rounded-3xl overflow-hidden glass-panel p-2 mb-8">
                <img src={image} alt="Preview" className="w-full h-auto rounded-2xl object-cover aspect-square" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm rounded-2xl m-2">
                    <RefreshCw className="w-12 h-12 text-neon-green animate-spin mb-4" />
                    <p className="text-lg font-medium text-neon-green animate-pulse">Analizando tricomas...</p>
                  </div>
                )}
              </div>

              {!isAnalyzing && (
                <div className="flex gap-4">
                  <button
                    onClick={() => setImage(null)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={analyzeImage}
                    className="px-8 py-3 bg-neon-green text-black hover:bg-emerald rounded-full font-bold transition-all shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:shadow-[0_0_30px_rgba(57,255,20,0.5)] text-lg"
                  >
                    Analizar Muestra
                  </button>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3 max-w-md"
                >
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-200">{error}</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl glass-panel rounded-3xl p-8 overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green to-emerald"></div>

              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-1/3">
                  <img src={image!} alt="Analyzed Sample" className="w-full aspect-square object-cover rounded-2xl shadow-lg border border-white/10" />

                  <button
                    onClick={resetAnalysis}
                    className="w-full mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Nueva Muestra
                  </button>
                </div>

                <div className="w-full md:w-2/3 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2 text-neon-green">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold uppercase tracking-wider text-sm">Análisis Completado</span>
                  </div>

                  <h3 className="text-3xl font-bold mb-6">{result.type} <span className="text-gray-500 font-light">| {result.predominance}</span></h3>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-gray-300">THC Estimado</span>
                        <span className="font-bold text-neon-green">{result.thc}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(result.thc / 35) * 100}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className="bg-neon-green h-2.5 rounded-full"
                        ></motion.div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-gray-300">CBD Estimado</span>
                        <span className="font-bold text-emerald">{result.cbd}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(result.cbd / 15) * 100}%` }}
                          transition={{ duration: 1, delay: 0.4 }}
                          className="bg-emerald h-2.5 rounded-full"
                        ></motion.div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-gray-300">Perfil de Terpenos</span>
                        <span className="font-bold text-yellow-400">{result.terpenes}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(result.terpenes / 10) * 100}%` }}
                          transition={{ duration: 1, delay: 0.6 }}
                          className="bg-yellow-400 h-2.5 rounded-full"
                        ></motion.div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium">Calidad Visual</span>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-6 h-6 ${i < result.quality ? 'text-neon-green fill-neon-green' : 'text-gray-700'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center border-t border-white/10 glass-panel mt-auto">
        <p className="text-sm text-gray-500 max-w-3xl mx-auto">
          <strong className="text-gray-400">Disclaimer:</strong> Este análisis es puramente informativo y basado en inteligencia visual; no sustituye un análisis de laboratorio profesional. Las estimaciones mostradas pueden variar significativamente de los valores reales.
        </p>
      </footer>
    </div>
  );
}
