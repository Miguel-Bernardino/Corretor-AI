import { GoogleGenAI, Type } from "@google/genai";
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
  // Note: For this implementation, we treat PDFs as image/document data if supported, 
  // or rely on the model's ability to ingest PDF mime types.
  for (const file of [...knowledgeBase, ...answerKey]) {
    const base64 = await getBase64(file);
    parts.push({
      inlineData: {
        data: base64,
        mimeType: file.type // 'application/pdf' works with Gemini 1.5/2.5
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
    Analise a prova do aluno abaixo com base nos documentos de contexto (Base de Conhecimento e Gabarito) fornecidos anteriormente.
    
    Nome do Aluno: ${student.name}
    Matrícula: ${student.matricula}
    
    Identifique as questões, compare com o gabarito, aplique a lógica de crédito parcial e gere o relatório JSON.
    Se não houver identificação clara do número da questão, infira pelo contexto.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // Using loose schema definition compatible with standard JSON object expectation
        // Strict schema usage can sometimes be tricky with partial matching, so we rely on system prompt + mimeType
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI");

    const result = JSON.parse(text) as GradingResult;
    return result;

  } catch (error) {
    console.error("Error grading student:", error);
    throw error;
  }
};
