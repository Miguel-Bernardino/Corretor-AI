import React, { useState, useEffect, useRef } from 'react';
import { TerminalContainer, TerminalButton, TerminalInput, TerminalLabel, FileUpload } from './components/TerminalUI';
import { AppState, StudentData } from './types';
import { gradeStudent } from './services/geminiService';
import { Download, Play, Save, ChevronRight, Terminal, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

const INITIAL_STATE: AppState = {
  step: 1,
  knowledgeBaseFiles: [],
  answerKeyFiles: [],
  batchSize: 0,
  currentStudentIndex: 0,
  students: [],
  processingLog: [],
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  
  // Local state for the current student ingestion form
  const [currentName, setCurrentName] = useState('');
  const [currentId, setCurrentId] = useState('');
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  
  // State for processing phase
  const [isProcessing, setIsProcessing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.processingLog]);

  const addLog = (msg: string) => {
    setState(prev => ({
      ...prev,
      processingLog: [...prev.processingLog, `[${new Date().toLocaleTimeString()}] ${msg}`]
    }));
  };

  // --- Handlers ---

  const handleSetupComplete = () => {
    if (state.knowledgeBaseFiles.length === 0 || state.answerKeyFiles.length === 0) {
      alert("ERRO: Carregue a Base de Conhecimento e o Gabarito.");
      return;
    }
    setState(prev => ({ ...prev, step: 2 }));
  };

  const handleBatchConfig = () => {
    if (state.batchSize <= 0) {
      alert("ERRO: O lote deve ser maior que 0.");
      return;
    }
    setState(prev => ({ ...prev, step: 3, currentStudentIndex: 0, students: [] }));
  };

  const handleSaveStudent = () => {
    if (!currentName || !currentId || currentFiles.length === 0) {
      alert("ERRO: Preencha todos os dados do aluno.");
      return;
    }

    const newStudent: StudentData = {
      id: crypto.randomUUID(),
      name: currentName,
      matricula: currentId,
      examFiles: currentFiles,
      status: 'pending'
    };

    setState(prev => {
      const nextIndex = prev.currentStudentIndex + 1;
      const isFinished = nextIndex >= prev.batchSize;
      return {
        ...prev,
        students: [...prev.students, newStudent],
        currentStudentIndex: nextIndex,
        step: isFinished ? 4 : 3
      };
    });

    // Reset Form
    setCurrentName('');
    setCurrentId('');
    setCurrentFiles([]);
  };

  const runGradingProcess = async () => {
    setIsProcessing(true);
    addLog("INICIANDO PROCESSO DE CORREÇÃO EM LOTE...");
    addLog(`CARREGADO CONTEXTO: ${state.knowledgeBaseFiles.length} docs, ${state.answerKeyFiles.length} gabaritos.`);

    const updatedStudents = [...state.students];

    for (let i = 0; i < updatedStudents.length; i++) {
      const student = updatedStudents[i];
      addLog(`> PROCESSANDO ALUNO ${i + 1}/${state.students.length}: ${student.name} (${student.matricula})...`);
      
      // Update status to processing UI
      updatedStudents[i].status = 'processing';
      setState(prev => ({ ...prev, students: [...updatedStudents] }));

      try {
        const result = await gradeStudent(student, state.knowledgeBaseFiles, state.answerKeyFiles);
        updatedStudents[i].result = result;
        updatedStudents[i].status = 'completed';
        addLog(`>> SUCESSO: Nota Calculada: ${result.nota_final_total}`);
      } catch (e) {
        console.error(e);
        updatedStudents[i].status = 'error';
        addLog(`>> ERRO CRÍTICO NO ALUNO ${student.matricula}: Falha na inferência.`);
      }

      setState(prev => ({ ...prev, students: [...updatedStudents] }));
    }

    addLog("PROCESSO FINALIZADO.");
    setIsProcessing(false);
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify(state.students.map(s => s.result), null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_correcao_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Render Steps ---

  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-[#E6E6E6] mb-4 font-light">
        Carregue os arquivos de referência para o modelo aprender o contexto da prova.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FileUpload 
          label="Base de Conhecimento (Livros, Slides)" 
          onChange={(files) => setState(prev => ({ ...prev, knowledgeBaseFiles: files }))}
        />
        <FileUpload 
          label="Gabarito Oficial (Resoluções)" 
          onChange={(files) => setState(prev => ({ ...prev, answerKeyFiles: files }))}
        />
      </div>
      <div className="flex justify-end pt-4">
        <TerminalButton onClick={handleSetupComplete}>
          Inicializar Contexto <ChevronRight />
        </TerminalButton>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 max-w-md mx-auto animate-fadeIn">
      <div className="text-[#E6E6E6] mb-4">
        Defina o tamanho do lote de provas para correção.
      </div>
      <TerminalLabel>Variável N (Total de Provas)</TerminalLabel>
      <TerminalInput 
        type="number" 
        min="1"
        value={state.batchSize || ''} 
        onChange={(e) => setState(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 0 }))}
        placeholder="Ex: 30"
      />
      <div className="flex justify-end pt-4">
        <TerminalButton onClick={handleBatchConfig}>
          Configurar Lote <ChevronRight />
        </TerminalButton>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-end border-b border-[#00E5FF] pb-2 mb-6">
        <span className="text-[#00E5FF] font-bold">ALUNO ATUAL: {state.currentStudentIndex + 1} / {state.batchSize}</span>
        <span className="text-xs text-gray-500">INGESTÃO DE DADOS</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <TerminalLabel>Nome do Aluno</TerminalLabel>
          <TerminalInput 
            value={currentName} 
            onChange={(e) => setCurrentName(e.target.value)} 
            placeholder="Nome Completo"
          />
        </div>
        <div>
          <TerminalLabel>Matrícula</TerminalLabel>
          <TerminalInput 
            value={currentId} 
            onChange={(e) => setCurrentId(e.target.value)} 
            placeholder="ID Acadêmico"
          />
        </div>
      </div>

      <FileUpload 
        label={`Imagens da Prova (Aluno ${state.currentStudentIndex + 1})`} 
        onChange={setCurrentFiles}
        accept="image/*,.pdf"
      />

      <div className="flex justify-end pt-8">
        <TerminalButton onClick={handleSaveStudent} variant="success">
          Salvar e Próximo <Save className="w-4 h-4" />
        </TerminalButton>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8 animate-fadeIn h-full flex flex-col">
      {!isProcessing && state.students[0]?.status === 'pending' && (
        <div className="text-center py-10 border border-dashed border-[#00E5FF]">
          <h3 className="text-[#00E5FF] text-xl mb-4">INGESTÃO CONCLUÍDA</h3>
          <p className="text-[#E6E6E6] mb-6">Pronto para processar {state.students.length} provas.</p>
          <TerminalButton onClick={runGradingProcess} variant="primary" className="mx-auto">
            GERAR RELATÓRIO COMPLETO <Play className="w-4 h-4" />
          </TerminalButton>
        </div>
      )}

      {/* Terminal Log Output */}
      <div className="bg-black border border-[#39FF14] p-4 font-mono text-xs h-64 overflow-y-auto shadow-[0_0_15px_rgba(57,255,20,0.2)]">
        {state.processingLog.map((log, idx) => (
          <div key={idx} className="mb-1 text-[#39FF14]">{'>'} {log}</div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Results Table */}
      {state.students.some(s => s.status === 'completed') && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#00E5FF] text-[#00E5FF]">
                <th className="p-2">ALUNO</th>
                <th className="p-2">MATRÍCULA</th>
                <th className="p-2 text-right">NOTA FINAL</th>
                <th className="p-2 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {state.students.map((s) => (
                <tr key={s.id} className="border-b border-gray-800 hover:bg-[#001100]">
                  <td className="p-2 text-[#E6E6E6]">{s.name}</td>
                  <td className="p-2 font-mono text-sm text-gray-400">{s.matricula}</td>
                  <td className="p-2 text-right font-bold text-[#39FF14]">
                    {s.result ? s.result.nota_final_total.toFixed(2) : '-'}
                  </td>
                  <td className="p-2 text-center">
                    {s.status === 'completed' ? <CheckCircle className="inline w-4 h-4 text-[#39FF14]" /> : 
                     s.status === 'error' ? <AlertTriangle className="inline w-4 h-4 text-red-500" /> : 
                     <span className="animate-pulse">...</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-8 flex justify-end">
             <TerminalButton onClick={exportJSON} variant="secondary">
                Exportar JSON <Download className="w-4 h-4" />
             </TerminalButton>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 font-mono relative z-10">
      <header className="mb-12 border-b border-[#00E5FF] pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#E6E6E6] neon-text tracking-tighter">
            PROBABILIDADE<span className="text-[#00E5FF]">.AI</span>
          </h1>
          <p className="text-xs text-[#00E5FF] mt-1 tracking-[0.2em]">AUTO EXAM GRADER V1.0</p>
        </div>
        <div className="text-right hidden md:block">
          <div className="text-[#39FF14] text-xs">SYSTEM: ONLINE</div>
          <div className="text-[#E6E6E6] text-xs opacity-50">MODE: PROFESSOR</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        <div className="flex gap-2 mb-8 text-xs uppercase tracking-widest text-gray-600">
          <span className={state.step === 1 ? "text-[#00E5FF]" : ""}>1. SETUP</span>
          <span>//</span>
          <span className={state.step === 2 ? "text-[#00E5FF]" : ""}>2. CONFIG</span>
          <span>//</span>
          <span className={state.step === 3 ? "text-[#00E5FF]" : ""}>3. INGESTÃO</span>
          <span>//</span>
          <span className={state.step === 4 ? "text-[#00E5FF]" : ""}>4. RELATÓRIO</span>
        </div>

        <TerminalContainer 
          title={
            state.step === 1 ? "CONTEXT_LOADER" : 
            state.step === 2 ? "BATCH_CONFIG" :
            state.step === 3 ? "DATA_ENTRY" : "INFERENCE_ENGINE"
          }
          className="min-h-[400px]"
        >
          {state.step === 1 && renderStep1()}
          {state.step === 2 && renderStep2()}
          {state.step === 3 && renderStep3()}
          {state.step === 4 && renderStep4()}
        </TerminalContainer>
      </main>
      
      <footer className="fixed bottom-4 right-4 text-[10px] text-gray-700 font-mono">
        POWERED BY GEMINI 2.5 FLASH
      </footer>
    </div>
  );
}
