export interface QuestionResult {
  numero: number;
  nota_atribuida: number;
  nota_maxima: number;
  comentario_ia: string;
}

export interface GradingResult {
  aluno_nome: string;
  matricula: string;
  questoes: QuestionResult[];
  nota_final_total: number;
}

export interface StudentData {
  id: string; // Internal UUID
  name: string;
  matricula: string;
  examFiles: File[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: GradingResult;
}

export interface AppState {
  step: 1 | 2 | 3 | 4;
  knowledgeBaseFiles: File[];
  answerKeyFiles: File[];
  batchSize: number;
  currentStudentIndex: number; // 0-based index for the ingestion loop
  students: StudentData[];
  processingLog: string[];
}

export enum AppColors {
  BLACK = '#000000',
  WHITE = '#E6E6E6',
  CYAN = '#00E5FF',
  GREEN = '#39FF14',
  RED = '#FF3333'
}
