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

  // 1. Add Context (Knowledge Base & Answer Key)
  for (const file of [...knowledgeBase, ...answerKey]) {
    const base64 = await getBase64(file);
    parts.push({
      inlineData: {
        data: base64,
        mimeType: file.type
      }
    });
  }

  // 2. Add Student Exam Images
  for (const file of student.examFiles) {
    const base64 = await getBase64(file);
    parts.push({
      inlineData: {
        data: base64,
        mimeType: file.type
      }
    });
  }

  // 3. Add Prompt
  const prompt = `
    Analise a prova do aluno abaixo com base nos documentos de contexto (Base de Conhecimento e Gabarito).
    
    Nome do Aluno: ${student.name}
    Matrícula: ${student.matricula}
    
    Identifique as questões, compare com o gabarito, aplique a lógica de crédito parcial e gere o relatório JSON seguindo estritamente o schema fornecido.
    Se não houver identificação clara do número da questão, infira pelo contexto.
  `;

  parts.push({ text: prompt });

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