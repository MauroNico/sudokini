import { useState, useRef, useEffect, FormEvent } from 'react';
import { generatePDF } from './pdf/pdf';
import { Download, Loader2, Settings, FileText, Minus, Plus, LayoutGrid } from 'lucide-react';

type Difficulty = 'Hard' | 'Very Hard';
type PerPage = 4 | 6;

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 200;
const AMOUNT_ERROR_TEXT = `Ingresa una cantidad entre ${MIN_AMOUNT} y ${MAX_AMOUNT}.`;

function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < MIN_AMOUNT || num > MAX_AMOUNT) return null;
  return num;
}

function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('Hard');
  const [perPage, setPerPage] = useState<PerPage>(6);
  const [amountInput, setAmountInput] = useState<string>('24');
  const [amountError, setAmountError] = useState<string>('');
  const [hasEditedAmount, setHasEditedAmount] = useState<boolean>(false);
  const [includeSolutions, setIncludeSolutions] = useState<boolean>(true);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  const [generating, setGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0
  });

  const workerRef = useRef<Worker | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const announceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (announceTimerRef.current !== null) {
        window.clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  const announcePolite = (message: string) => {
    if (announceTimerRef.current !== null) {
      window.clearTimeout(announceTimerRef.current);
    }
    setLiveAnnouncement('');
    announceTimerRef.current = window.setTimeout(() => {
      setLiveAnnouncement(message);
    }, 300);
  };

  const applyAmountValue = (nextVal: number) => {
    const clamped = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, nextVal));
    setAmountInput(String(clamped));
    setAmountError('');
    setLiveAnnouncement('');
  };

  const handleAmountChange = (value: string) => {
    if (!/^\d{0,3}$/.test(value)) return;
    setHasEditedAmount(true);
    setAmountInput(value);
    if (amountError) {
      setAmountError('');
      setLiveAnnouncement('');
    }
  };

  const handleAmountBlur = () => {
    if (!hasEditedAmount && amountInput.trim() !== '') return;
    const parsed = parseAmount(amountInput);
    if (parsed === null) {
      setAmountError(AMOUNT_ERROR_TEXT);
      announcePolite(`Cantidad de Sudokus: Error. ${AMOUNT_ERROR_TEXT}`);
      return;
    }
    setAmountInput(String(parsed));
    setAmountError('');
  };

  const handleStepAmount = (delta: number) => {
    const rawNum = /^\d+$/.test(amountInput.trim()) ? Number(amountInput.trim()) : 0;
    const base = rawNum > 0 ? rawNum : delta > 0 ? 0 : 2;
    applyAmountValue(base + delta);
  };

  const handleGenerate = (e: FormEvent) => {
    e.preventDefault();

    const parsed = parseAmount(amountInput);
    if (parsed === null) {
      setAmountError(AMOUNT_ERROR_TEXT);
      setLiveAnnouncement('');
      amountInputRef.current?.focus();
      return;
    }

    setAmountInput(String(parsed));
    setAmountError('');

    const selectedDifficulty = difficulty;
    const selectedIncludeSolutions = includeSolutions;
    const selectedPerPage = perPage;

    if (parsed > 100) {
      const diffLabel = selectedDifficulty === 'Hard' ? 'Difícil' : 'Muy Difícil';
      const confirmLarge = window.confirm(
        `Estás a punto de generar ${parsed} sudokus de nivel ${diffLabel}. Esto puede tardar unos minutos. ¿Deseas continuar?`
      );
      if (!confirmLarge) return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: parsed });
    setLiveAnnouncement(`Generando ${parsed} sudokus.`);

    workerRef.current?.terminate();
    workerRef.current = new Worker(new URL('./logic/worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'progress') {
        setProgress({ current: event.data.current, total: event.data.total });
      } else if (event.data.type === 'done') {
        generatePDF(
          event.data.results,
          selectedIncludeSolutions,
          selectedDifficulty,
          selectedPerPage
        );
        setGenerating(false);
        setLiveAnnouncement(`PDF generado con ${event.data.results.length} sudokus.`);
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    };

    workerRef.current.onerror = () => {
      setGenerating(false);
      setLiveAnnouncement('Ocurrió un error al generar los sudokus.');
      workerRef.current?.terminate();
      workerRef.current = null;
    };

    workerRef.current.postMessage({ amount: parsed, difficulty: selectedDifficulty });
  };

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setGenerating(false);
    setProgress({ current: 0, total: 0 });
    setLiveAnnouncement('Generación cancelada.');
  };

  const currentNumeric = parseAmount(amountInput);
  const presetAmounts = perPage === 4 ? [4, 8, 16, 24, 40] : [6, 12, 24, 36, 60];
  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600" aria-hidden="true">
            <FileText size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Generador de Sudokus</h1>
        </div>

        <form onSubmit={handleGenerate} noValidate className="space-y-6">
          {/* Dificultad */}
          <div className="flex flex-col">
            <label
              htmlFor="difficulty"
              className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"
            >
              <Settings size={16} aria-hidden="true" />
              Nivel de Dificultad
            </label>
            <select
              id="difficulty"
              name="difficulty"
              disabled={generating}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="sudoku-input sudoku-control w-full min-h-[48px] border-gray-400 rounded-lg shadow-sm px-3 py-2.5 bg-gray-50 border transition"
            >
              <option value="Hard">Difícil</option>
              <option value="Very Hard">Muy Difícil</option>
            </select>
          </div>

          {/* Densidad por página */}
          <div className="flex flex-col">
            <label
              htmlFor="perPage"
              className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"
            >
              <LayoutGrid size={16} aria-hidden="true" />
              Sudokus por Página
            </label>
            <select
              id="perPage"
              name="perPage"
              disabled={generating}
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value) as PerPage)}
              className="sudoku-input sudoku-control w-full min-h-[48px] border-gray-400 rounded-lg shadow-sm px-3 py-2.5 bg-gray-50 border transition"
            >
              <option value={6}>6 por página</option>
              <option value={4}>4 por página</option>
            </select>
          </div>

          {/* Cantidad */}
          <div className="flex flex-col">
            <label htmlFor="amount" className="text-sm font-medium text-gray-700 mb-1.5">
              Cantidad de Sudokus
            </label>

            <div className="flex items-stretch gap-2">
              <button
                type="button"
                disabled={generating || (currentNumeric !== null && currentNumeric <= MIN_AMOUNT)}
                onClick={() => handleStepAmount(-1)}
                aria-label="Disminuir cantidad"
                className="sudoku-control min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg border border-gray-400 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Minus size={18} aria-hidden="true" />
              </button>

              <input
                ref={amountInputRef}
                id="amount"
                name="amount"
                type="text"
                inputMode="numeric"
                pattern="^(?:[1-9]|[1-9][0-9]|1[0-9]{2}|200)$"
                required
                autoComplete="off"
                enterKeyHint="done"
                disabled={generating}
                value={amountInput}
                onChange={(e) => handleAmountChange(e.target.value)}
                onBlur={handleAmountBlur}
                aria-invalid={amountError ? 'true' : 'false'}
                aria-describedby={amountError ? 'amount-error' : undefined}
                className="sudoku-input w-full min-h-[48px] text-center font-semibold text-gray-800 border-gray-400 rounded-lg shadow-sm px-3 py-2.5 bg-gray-50 border transition"
              />

              <button
                type="button"
                disabled={generating || (currentNumeric !== null && currentNumeric >= MAX_AMOUNT)}
                onClick={() => handleStepAmount(1)}
                aria-label="Aumentar cantidad"
                className="sudoku-control min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg border border-gray-400 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>

            {amountError && (
              <p id="amount-error" className="text-sm text-red-700 mt-1.5 flex items-center gap-1.5">
                <span role="img" aria-label="Error">
                  ❌
                </span>
                <span>{amountError}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-2.5" role="group" aria-label="Cantidades rápidas">
              {presetAmounts.map((preset) => {
                const isActive = currentNumeric === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={generating}
                    onClick={() => applyAmountValue(preset)}
                    aria-pressed={isActive}
                    className={`sudoku-control min-h-[48px] min-w-[48px] px-3.5 py-2 rounded-lg text-sm font-medium border transition ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Soluciones */}
          <div className="flex items-center min-h-[48px]">
            <input
              id="solutions"
              name="includeSolutions"
              type="checkbox"
              disabled={generating}
              checked={includeSolutions}
              onChange={(e) => setIncludeSolutions(e.target.checked)}
              className="sudoku-control h-5 w-5 accent-blue-600 border-gray-400 rounded cursor-pointer"
            />
            <label
              htmlFor="solutions"
              className="ml-3 block text-sm text-gray-700 select-none cursor-pointer py-2"
            >
              Incluir soluciones al final del PDF
            </label>
          </div>

          {/* Progreso / Botones */}
          {!generating ? (
            <button
              type="submit"
              className="sudoku-control w-full min-h-[48px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition shadow-md hover:shadow-lg"
            >
              <Download size={20} aria-hidden="true" />
              Generar y Descargar PDF
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                <Loader2 className="animate-spin text-blue-600 mx-auto mb-2" size={28} aria-hidden="true" />
                <p className="text-sm font-medium text-blue-800">
                  Generando sudoku {Math.min(progress.current + 1, progress.total)} de {progress.total}{' '}
                  ({progressPercent}%)...
                </p>
                <div className="w-full bg-blue-200 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="sudoku-control w-full min-h-[48px] bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2.5 px-4 rounded-lg transition"
              >
                Cancelar Generación
              </button>
            </div>
          )}
        </form>

        <div aria-live="polite" className="visually-hidden">
          {liveAnnouncement}
        </div>
      </div>
    </div>
  );
}

export default App;
