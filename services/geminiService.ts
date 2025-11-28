import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudentData, GradingResult } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const getBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const gradeStudent = async (
  student: StudentData,
  knowledgeBase: File[],
  answerKey: File[]
): Promise<GradingResult> => {
  
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare parts
  const parts: any[] = [];

  // 1. Add Knowledge Base (Study Material/Reference Content)
  if (knowledgeBase.length > 0) {
    parts.push({ 
      text: "=== INÍCIO DA BASE DE CONHECIMENTO (MATERIAL DE REFERÊNCIA PARA ESTUDO) ===" 
    });
    
    for (const file of knowledgeBase) {
      const base64 = await getBase64(file);
      parts.push({
        inlineData: {
          data: base64,
          mimeType: file.type
        }
      });
    }
    
    parts.push({ 
      text: "=== FIM DA BASE DE CONHECIMENTO ===\n\n" 
    });
  }

  // 2. Add Answer Key (Official Grading Rubric)
  if (answerKey.length > 0) {
    parts.push({ 
      text: "=== INÍCIO DO GABARITO OFICIAL (CRITÉRIOS DE CORREÇÃO) ===" 
    });
    
    for (const file of answerKey) {
      const base64 = await getBase64(file);
      parts.push({
        inlineData: {
          data: base64,
          mimeType: file.type
        }
      });
    }
    
    parts.push({ 
      text: "=== FIM DO GABARITO OFICIAL ===\n\n" 
    });
  }

  // 3. Add Student Exam (To Be Graded)
  parts.push({ 
    text: "=== INÍCIO DA PROVA DO ALUNO (RESPOSTAS A SEREM CORRIGIDAS) ===" 
  });
  
  for (const file of student.examFiles) {
    const base64 = await getBase64(file);
    parts.push({
      inlineData: {
        data: base64,
        mimeType: file.type
      }
    });
  }
  
  parts.push({ 
    text: "=== FIM DA PROVA DO ALUNO ===\n\n" 
  });

  // 4. Add Detailed Prompt
  const prompt = `
INSTRUÇÕES DE CORREÇÃO:

📚 DOCUMENTOS FORNECIDOS (NESTA ORDEM):
1. BASE DE CONHECIMENTO: Material de referência/estudo (NÃO É A PROVA)
2. GABARITO OFICIAL: Respostas corretas e critérios de pontuação (NÃO É A PROVA)
3. PROVA DO ALUNO: Respostas escritas pelo aluno (ESTE É O DOCUMENTO A SER CORRIGIDO)

⚠️ ATENÇÃO: Você deve corrigir APENAS as respostas da PROVA DO ALUNO comparando com o GABARITO OFICIAL.
A Base de Conhecimento serve apenas como contexto adicional para entender o conteúdo.

👤 DADOS DO ALUNO:
- Nome: ${student.name}
- Matrícula: ${student.matricula}

📋 PROCESSO DE CORREÇÃO:

1. IDENTIFICAÇÃO DAS QUESTÕES:
   - Localize cada questão na prova do aluno pela numeração (ex: "Q1", "1)", "Questão 2")
   - Se não houver numeração explícita, use a ordem sequencial
   - Identifique onde começa e termina cada resposta

2. CORREÇÃO E PONTUAÇÃO:
   - Para cada questão, encontre a resposta correspondente no GABARITO OFICIAL
   - Compare a resposta DO ALUNO com o gabarito
   - Aplique os critérios de crédito parcial definidos no gabarito
   - Atribua a nota conforme os critérios estabelecidos
   - NÃO confunda o gabarito com a prova do aluno

3. COMENTÁRIO DETALHADO:
   - Explique por que a nota foi atribuída
   - Aponte erros específicos ou acertos parciais
   - Seja objetivo e construtivo

4. GERAÇÃO DO RELATÓRIO:
   - Estruture o JSON exatamente conforme o schema
   - Inclua TODAS as questões identificadas
   - Calcule a nota final somando todas as notas atribuídas

📤 SAÍDA ESPERADA:
Relatório JSON completo seguindo rigorosamente o schema definido.
  `;

  parts.push({ text: prompt });

  console.log("Prompt parts prepared:", parts);

  // Define schema strictly using Type enum
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      aluno_nome: { type: Type.STRING },
      matricula: { type: Type.STRING },
      questoes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            numero: { type: Type.NUMBER },
            nota_atribuida: { type: Type.NUMBER },
            nota_maxima: { type: Type.NUMBER },
            comentario_ia: { type: Type.STRING },
          },
          required: ["numero", "nota_atribuida", "nota_maxima", "comentario_ia"]
        },
      },
      nota_final_total: { type: Type.NUMBER },
    },
    required: ["aluno_nome", "matricula", "questoes", "nota_final_total"],
  };

  try {
    // Upgraded to gemini-3-pro-preview for larger context window (2M tokens) and better reasoning capabilities
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: {
        role: 'user',
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response text from AI");

    // Clean up potential Markdown formatting (```json ... ```) that might bypass JSON mode in edge cases
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    const result = JSON.parse(text) as GradingResult;


    return result;

  } catch (error: any) {
    console.error("Error grading student:", error);
    // Extract meaningful message from GoogleGenAIError if possible
    let errorMessage = error.message;
    if (errorMessage.includes("token count exceeds")) {
      errorMessage = "Contexto muito grande (limite de tokens excedido). Reduza o tamanho da Base de Conhecimento.";
    }
    throw new Error(errorMessage);
  }
};