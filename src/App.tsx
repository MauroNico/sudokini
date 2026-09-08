import { useState, useRef } from 'react';
import { generatePDF } from './pdf/pdf';
import { Download, Loader2, Settings, FileText } from 'lucide-react';

function App() {
  const [difficulty, setDifficulty] = useState<'Hard' | 'Very Hard' | 'Mixed'>('Hard');
  const [amount, setAmount] = useState<number>(20);
  const [includeSolutions, setIncludeSolutions] = useState<boolean>(true);
  
  const [generating, setGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  
  const workerRef = useRef<Worker | null>(null);

  const handleGenerate = () => {
    if (amount < 20) {
      alert("Por favor, selecciona al menos 20 sudokus.");
      return;
    }
    if (amount > 100) {
      const confirmLarge = window.confirm(`Estás a punto de generar ${amount} sudokus de nivel ${difficulty}. Esto puede tardar varios minutos. ¿Deseas continuar?`);
      if (!confirmLarge) return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: amount });

    workerRef.current = new Worker(new URL('./logic/worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setProgress({ current: e.data.current, total: e.data.total });
      } else if (e.data.type === 'done') {
        generatePDF(e.data.results, includeSolutions, difficulty);
        setGenerating(false);
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    };

    workerRef.current.postMessage({ amount, difficulty });
  };

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setGenerating(false);
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <FileText size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Generador de Sudokus</h1>
        </div>

        <div className="space-y-6">
          {/* Dificultad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Settings size={16} /> Nivel de Dificultad
            </label>
            <select
              disabled={generating}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value="Hard">Difícil (Lógica Avanzada)</option>
              <option value="Very Hard">Muy Difícil (Requiere ensayo/error)</option>
              <option value="Mixed">Mixto (Alternado)</option>
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de Sudokus
            </label>
            <input
              type="number"
              min={20}
              disabled={generating}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 20)}
              className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo sugerido: 20 para un PDF completo de 4 páginas.</p>
          </div>

          {/* Soluciones */}
          <div className="flex items-center">
            <input
              id="solutions"
              type="checkbox"
              disabled={generating}
              checked={includeSolutions}
              onChange={(e) => setIncludeSolutions(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="solutions" className="ml-2 block text-sm text-gray-700 select-none">
              Incluir soluciones al final del PDF
            </label>
          </div>

          {/* Progreso / Botones */}
          {!generating ? (
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition shadow-md hover:shadow-lg"
            >
              <Download size={20} />
              Generar y Descargar PDF
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                <Loader2 className="animate-spin text-blue-600 mx-auto mb-2" size={28} />
                <p className="text-sm font-medium text-blue-800">Generando sudoku {progress.current + 1} de {progress.total}...</p>
                <div className="w-full bg-blue-200 rounded-full h-2 mt-3 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                  ></div>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2 px-4 rounded-lg transition"
              >
                Cancelar Generación
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

