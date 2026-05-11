import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, AlertCircle, Leaf, CheckCircle2, Star, RefreshCw, Share2, Download, ChevronDown, History } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { toPng } from 'html-to-image';

type AnalysisResult = {
  type: string;
  predominance: string;
  thc: number;
  cbd: number;
  terpenes: number;
  quality: number; // 1 to 5
  traits: {
    trichomes: string;
    texture: string;
    curing: string;
  };
  interpretation: string;
} | null;

type HistoryItem = {
  id: string;
  date: string;
  thumbnail: string;
  result: Exclude<AnalysisResult, null>;
};

const translations = {
  es: {
    hero_title: "Analizador Inteligente de Derivados del Cannabis",
    hero_subtitle: "Sube una imagen de tu flor o extracción y deja que nuestra IA analice la pureza, el tipo de producto y estime los niveles de cannabinoides.",
    drop_title: "Arrastra y suelta tu imagen aquí",
    drop_subtitle: "Soporta JPG, PNG, WEBP",
    browse_files: "Examinar archivos",
    use_camera: "Usar Cámara",
    recent_analysis: "Análisis Recientes",
    cancel: "Cancelar",
    analyze_sample: "Analizar Muestra",
    scanning_sample: "ESCANEANDO MUESTRA",
    scanning_subtitle: "Detectando tricomas y perfil de terpenos...",
    analysis_completed: "Análisis Completado",
    thc_estimated: "THC Estimado",
    cbd_estimated: "CBD Estimado",
    terpenes_estimated: "Perfil de Terpenos",
    visual_quality: "Calidad Visual",
    show_details: "Ver análisis completo",
    hide_details: "Ocultar detalles",
    detected_traits: "Rasgos Detectados",
    trichomes: "Tricomas",
    texture: "Textura",
    curing: "Curación",
    interpretation: "Interpretación",
    share: "Compartir",
    download: "Descargar",
    new_sample: "Nueva Muestra",
    poster_title: "Tu Póster de Análisis",
    error_format: "Formato no válido. Sube JPG, PNG o WEBP.",
    error_api_key: "Falta la API Key de Gemini. Por favor, añádela en el archivo .env de la raíz del proyecto.",
    error_cannabis: "Parece ser que nuestro sistema no detecta bien la imagen. Por favor, sube una foto clara de una flor o extracción.",
    disclaimer: "Disclaimer: Este análisis es puramente informativo y basado en inteligencia visual; no sustituye un análisis de laboratorio profesional. Las estimaciones mostradas pueden variar significativamente de los valores reales.",
    ai_prompt: "Eres un experto catador y botánico especializado en cannabis. Analiza la imagen minuciosamente. Si no es cannabis o un extracto derivado, pon isCannabis en false. Si lo es, ponlo en true y devuelve estimaciones realistas basadas en el aspecto, los tricomas, el color y la textura. RESPONDE TODO EN ESPAÑOL."
  },
  en: {
    hero_title: "Intelligent Cannabis Derivative Analyzer",
    hero_subtitle: "Upload an image of your flower or extraction and let our AI analyze purity, product type, and estimate cannabinoid levels.",
    drop_title: "Drag and drop your image here",
    drop_subtitle: "Supports JPG, PNG, WEBP",
    browse_files: "Browse files",
    use_camera: "Use Camera",
    recent_analysis: "Recent Analysis",
    cancel: "Cancel",
    analyze_sample: "Analyze Sample",
    scanning_sample: "SCANNING SAMPLE",
    scanning_subtitle: "Detecting trichomes and terpene profile...",
    analysis_completed: "Analysis Completed",
    thc_estimated: "Estimated THC",
    cbd_estimated: "Estimated CBD",
    terpenes_estimated: "Terpene Profile",
    visual_quality: "Visual Quality",
    show_details: "View full analysis",
    hide_details: "Hide details",
    detected_traits: "Detected Traits",
    trichomes: "Trichomes",
    texture: "Texture",
    curing: "Curing",
    interpretation: "Interpretation",
    share: "Share",
    download: "Download",
    new_sample: "New Sample",
    poster_title: "Your Analysis Poster",
    error_format: "Invalid format. Upload JPG, PNG or WEBP.",
    error_api_key: "Gemini API Key missing. Please add it to the .env file in the project root.",
    error_cannabis: "It seems our system doesn't detect the image well. Please upload a clear photo of a flower or extraction.",
    disclaimer: "Disclaimer: This analysis is purely informative and based on visual intelligence; it does not replace a professional laboratory analysis. Shown estimates may vary significantly from actual values.",
    ai_prompt: "You are an expert taster and botanist specializing in cannabis. Analyze the image thoroughly. If it's not cannabis or a derivative extract, set isCannabis to false. If it is, set it to true and return realistic estimates based on appearance, trichomes, color, and texture. RESPOND EVERYTHING IN ENGLISH."
  }
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult>(null);
  const [lang, setLang] = useState<'es' | 'en'>(() => {
    const saved = localStorage.getItem('trichai_lang');
    return (saved as 'es' | 'en') || 'es';
  });

  const t = (key: keyof typeof translations.es) => translations[lang][key];

  const changeLang = (l: 'es' | 'en') => {
    setLang(l);
    localStorage.setItem('trichai_lang', l);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('trichai_history');
    return saved ? JSON.parse(saved) : [];
  });

  const addToHistory = async (res: Exclude<AnalysisResult, null>, imgDataUrl: string) => {
    try {
      const imgEl = new Image();
      imgEl.src = imgDataUrl;
      await new Promise(r => { imgEl.onload = r; });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 150;
      canvas.width = size;
      canvas.height = size;
      const minDim = Math.min(imgEl.width, imgEl.height);
      const sx = (imgEl.width - minDim) / 2;
      const sy = (imgEl.height - minDim) / 2;
      ctx?.drawImage(imgEl, sx, sy, minDim, minDim, 0, 0, size, size);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.5);

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        thumbnail,
        result: res
      };

      setHistory(prev => {
        const newHistory = [newItem, ...prev].slice(0, 12);
        localStorage.setItem('trichai_history', JSON.stringify(newHistory));
        return newHistory;
      });
    } catch (e) {
      console.error("No se pudo guardar el historial", e);
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setImage(item.thumbnail);
    setResult(item.result);
    setError(null);
    setShowDetails(false);
  };

  const generatePreview = async () => {
    if (!posterRef.current) return;
    setIsSharing(true);
    try {
      const imageData = await toPng(posterRef.current, {
        backgroundColor: '#0A0A0A',
        pixelRatio: 1, // 1080x1080 is large enough
      });
      setGeneratedImage(imageData);
    } catch (err) {
      console.error('Error generando imagen:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleNativeShare = async () => {
    if (!generatedImage || !navigator.share) return;
    try {
      const blob = await (await fetch(generatedImage)).blob();
      const file = new File([blob], 'trichai_analysis.png', { type: 'image/png' });
      await navigator.share({
        title: lang === 'es' ? 'Mi análisis en TrichAi 🌱' : 'My TrichAi Analysis 🌱',
        text: lang === 'es' ? 'Mira los resultados de mi análisis en TrichAi.' : 'Check out my analysis results on TrichAi.',
        files: [file],
      });
    } catch (e) {
      console.log("Error al compartir nativo", e);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'trichai_analysis.png';
    link.click();
  };

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
      setError(t('error_format'));
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

    try {
      // Llamada al backend proxy en lugar de llamar a Google directamente
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          prompt: t('ai_prompt')
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error en el servidor de análisis');
      }

      const data = await response.json();

      if (!data.isCannabis) {
        setError(t('error_cannabis'));
      } else {
        const resObj = {
          type: data.type || 'Flor',
          predominance: data.predominance || 'Desconocida',
          thc: data.thc || 15,
          cbd: data.cbd || 1,
          terpenes: data.terpenes || 2,
          quality: data.quality || 3,
          traits: {
            trichomes: data.traits?.trichomes || 'Media · 20% cobertura',
            texture: data.traits?.texture || 'Estándar · rugosidad 50/100',
            curing: data.traits?.curing || 'Óptima · brillo 40%',
          },
          interpretation: data.interpretation || 'La muestra presenta características estándar sin rasgos destacables a simple vista.',
        };
        setResult(resObj);
        addToHistory(resObj, image);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al comunicarse con el servidor. Revisa la consola.');
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

        <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
          <button 
            onClick={() => changeLang('es')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'es' ? 'bg-neon-green text-black' : 'text-gray-400 hover:text-white'}`}
          >
            ES
          </button>
          <button 
            onClick={() => changeLang('en')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-neon-green text-black' : 'text-gray-400 hover:text-white'}`}
          >
            EN
          </button>
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
                {t('hero_title')}
              </h2>
              <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
                {t('hero_subtitle')}
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
                  <h3 className="text-xl font-semibold">{t('drop_title')}</h3>
                  <p className="text-sm text-gray-500">{t('drop_subtitle')}</p>

                  <div className="flex items-center gap-4 mt-6">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-medium transition-colors flex items-center gap-2"
                    >
                      {t('browse_files')}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-neon-green text-black hover:bg-emerald rounded-full font-bold transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:shadow-[0_0_30px_rgba(57,255,20,0.5)]"
                    >
                      <Camera className="w-5 h-5" />
                      {t('use_camera')}
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

          {/* History Section */}
          {!image && !isAnalyzing && history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl mt-8"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-300">
                <History className="w-5 h-5" /> {t('recent_analysis')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {history.map(item => (
                  <div
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="glass-panel p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-colors border border-white/5 hover:border-neon-green/30 group"
                  >
                    <img src={item.thumbnail} alt={item.result.type} className="w-14 h-14 rounded-xl object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div>
                      <p className="font-bold text-sm text-white truncate">{item.result.type}</p>
                      <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString()}</p>
                      <p className="text-neon-green text-xs font-bold mt-0.5">THC {item.result.thc}%</p>
                    </div>
                  </div>
                ))}
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl m-2 overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10" />
                    
                    {/* Laser Scan Line */}
                    <motion.div
                      initial={{ top: '-10%' }}
                      animate={{ top: '110%' }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      className="absolute left-0 w-full h-1 bg-neon-green shadow-[0_0_20px_#39FF14,0_0_40px_#39FF14] z-20"
                    />
                    
                    <div className="relative z-30 flex flex-col items-center">
                      <div className="relative mb-4">
                        <RefreshCw className="w-12 h-12 text-neon-green animate-spin" />
                        <motion.div 
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 bg-neon-green/20 blur-xl rounded-full"
                        />
                      </div>
                      <p className="text-lg font-bold text-neon-green tracking-widest uppercase animate-pulse">{t('scanning_sample')}</p>
                      <p className="text-xs text-gray-400 mt-1 uppercase tracking-tighter text-center px-4">{t('scanning_subtitle')}</p>
                    </div>
                  </div>
                )}
              </div>

              {!isAnalyzing && (
                <div className="flex gap-4">
                  <button
                    onClick={() => setImage(null)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-medium transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={analyzeImage}
                    className="px-8 py-3 bg-neon-green text-black hover:bg-emerald rounded-full font-bold transition-all shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:shadow-[0_0_30px_rgba(57,255,20,0.5)] text-lg"
                  >
                    {t('analyze_sample')}
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
              className="w-full max-w-3xl flex flex-col gap-6"
            >
              <div className="glass-panel rounded-3xl p-8 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green to-emerald"></div>

                <div className="flex flex-col md:flex-row gap-8">
                  <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <img src={image!} alt="Analyzed Sample" className="w-full aspect-square object-cover rounded-2xl shadow-lg border border-white/10" />

                    <div className="flex flex-col gap-3 mt-2" data-html2canvas-ignore="true">
                      <button
                        onClick={generatePreview}
                        disabled={isSharing}
                        className="w-full px-6 py-3 bg-neon-green text-black hover:bg-emerald rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(57,255,20,0.2)] flex items-center justify-center gap-2"
                      >
                        {isSharing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                        {isSharing ? (lang === 'es' ? 'Generando...' : 'Generating...') : t('share')}
                      </button>

                      <button
                        onClick={resetAnalysis}
                        className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('new_sample')}
                      </button>
                    </div>
                  </div>

                  <div className="w-full md:w-2/3 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2 text-neon-green">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold uppercase tracking-wider text-sm">{t('analysis_completed')}</span>
                    </div>

                    <h3 className="text-3xl font-bold mb-4">{result.type} <span className="text-gray-500 font-light">| {result.predominance}</span></h3>

                    {/* Compact Summary Pills */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="bg-neon-green/10 border border-neon-green/20 px-4 py-2 rounded-full">
                        <span className="text-xs text-gray-400 mr-1">THC</span>
                        <span className="font-bold text-neon-green">{result.thc}%</span>
                      </div>
                      <div className="bg-emerald/10 border border-emerald/20 px-4 py-2 rounded-full">
                        <span className="text-xs text-gray-400 mr-1">CBD</span>
                        <span className="font-bold text-emerald">{result.cbd}%</span>
                      </div>
                      <div className="bg-yellow-400/10 border border-yellow-400/20 px-4 py-2 rounded-full">
                        <span className="text-xs text-gray-400 mr-1">Terpenos</span>
                        <span className="font-bold text-yellow-400">{result.terpenes}%</span>
                      </div>
                    </div>

                    {/* Quality Stars */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${i < result.quality ? 'text-neon-green fill-neon-green' : 'text-gray-700'}`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">{t('visual_quality')}</span>
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="flex items-center gap-2 text-neon-green/80 hover:text-neon-green transition-colors text-sm font-medium mt-2 group"
                    >
                      <span>{showDetails ? t('hide_details') : t('show_details')}</span>
                      <motion.div animate={{ rotate: showDetails ? 180 : 0 }} transition={{ duration: 0.3 }}>
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </button>
                  </div>
                </div>

                {/* Expandable Detail Section */}
                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 pt-6 border-t border-white/10 space-y-6">
                        {/* Progress Bars */}
                        <div className="space-y-5">
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="font-medium text-gray-300">{t('thc_estimated')}</span>
                              <span className="font-bold text-neon-green">{result.thc}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2.5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(result.thc / 35) * 100}%` }}
                                transition={{ duration: 1, delay: 0.1 }}
                                className="bg-neon-green h-2.5 rounded-full"
                              ></motion.div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="font-medium text-gray-300">{t('cbd_estimated')}</span>
                              <span className="font-bold text-emerald">{result.cbd}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2.5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(result.cbd / 15) * 100}%` }}
                                transition={{ duration: 1, delay: 0.2 }}
                                className="bg-emerald h-2.5 rounded-full"
                              ></motion.div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="font-medium text-gray-300">{t('terpenes_estimated')}</span>
                              <span className="font-bold text-yellow-400">{result.terpenes}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2.5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(result.terpenes / 10) * 100}%` }}
                                transition={{ duration: 1, delay: 0.3 }}
                                className="bg-yellow-400 h-2.5 rounded-full"
                              ></motion.div>
                            </div>
                          </div>
                        </div>

                        {/* Traits Grid */}
                        <div>
                          <h4 className="text-sm font-bold text-gray-400 tracking-wider mb-4 uppercase">{t('detected_traits')}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                              <span className="block text-xs text-gray-500 mb-1">{t('trichomes')}</span>
                              <span className="text-sm font-medium">{result.traits.trichomes}</span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                              <span className="block text-xs text-gray-500 mb-1">{t('texture')}</span>
                              <span className="text-sm font-medium">{result.traits.texture}</span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                              <span className="block text-xs text-gray-500 mb-1">{t('curing')}</span>
                              <span className="text-sm font-medium">{result.traits.curing}</span>
                            </div>
                          </div>
                        </div>

                        {/* Interpretation */}
                        <div>
                          <h4 className="text-sm font-bold text-gray-400 tracking-wider mb-3 uppercase">{t('interpretation')}</h4>
                          <div className="bg-charcoal/50 p-4 rounded-xl border border-white/10 text-gray-300 text-sm leading-relaxed">
                            {result.interpretation}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center border-t border-white/10 glass-panel mt-auto">
        <p className="text-sm text-gray-500 max-w-3xl mx-auto">
          {t('disclaimer')}
        </p>
      </footer>

      {/* Hidden Poster for Sharing */}
      {result && image && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <div ref={posterRef} className="w-[1080px] h-[1080px] relative bg-[#0A0A0A] flex overflow-hidden font-sans">
            <img src={image} className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
            
            <div className="absolute bottom-0 left-0 w-full p-16 flex flex-col gap-8 z-10">
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Leaf className="w-10 h-10 text-neon-green" />
                    <span className="text-neon-green font-bold tracking-[0.2em] text-2xl">TRICHAI</span>
                  </div>
                  <h1 className="text-7xl font-extrabold text-white mb-3 tracking-tight">{result.type}</h1>
                  <p className="text-3xl text-gray-300 font-light tracking-wide">{result.predominance}</p>
                </div>
                <div className="flex gap-3 bg-black/40 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-10 h-10 ${i < result.quality ? 'text-neon-green fill-neon-green' : 'text-gray-600'}`} />
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mt-4">
                <div className="bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-3xl">
                  <span className="text-gray-400 text-xl font-medium tracking-wider uppercase block mb-2">{t('thc_estimated')}</span>
                  <span className="text-6xl font-black text-neon-green">{result.thc}%</span>
                </div>
                <div className="bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-3xl">
                  <span className="text-gray-400 text-xl font-medium tracking-wider uppercase block mb-2">{t('cbd_estimated')}</span>
                  <span className="text-6xl font-black text-emerald">{result.cbd}%</span>
                </div>
                <div className="bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-3xl">
                  <span className="text-gray-400 text-xl font-medium tracking-wider uppercase block mb-2">{t('terpenes_estimated')}</span>
                  <span className="text-6xl font-black text-yellow-400">{result.terpenes}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Preview Modal */}
      <AnimatePresence>
        {generatedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-charcoal border border-white/10 p-6 rounded-3xl max-w-md w-full flex flex-col gap-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{t('poster_title')}</h3>
                <button onClick={() => setGeneratedImage(null)} className="text-gray-400 hover:text-white transition-colors text-2xl font-light">×</button>
              </div>

              <div className="rounded-2xl overflow-hidden shadow-lg border border-white/5">
                <img src={generatedImage} alt="Poster Preview" className="w-full aspect-square object-contain bg-black" />
              </div>

              <div className="flex gap-4">
                <button onClick={handleNativeShare} className="flex-1 px-4 py-3 bg-neon-green text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald transition-colors">
                  <Share2 className="w-5 h-5" /> {t('share')}
                </button>
                <button onClick={handleDownload} className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <Download className="w-5 h-5" /> {t('download')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
