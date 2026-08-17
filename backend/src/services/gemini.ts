import { GoogleGenerativeAI } from '@google/generative-ai';
import { PARSER_PROMPT, PARSER_SCHEMA } from '../prompts/parser.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ParserContext {
  ahora_iso: string;
  proyectos_existentes: Array<{ id: string; name: string; client: string | null }>;
  tareas_abiertas_recientes: Array<{ id: string; title: string }>;
}

export interface Accion {
  tipo: 'crear_tarea' | 'crear_subtareas' | 'crear_gasto' | 'crear_nota' | 'crear_proyecto' | 'completar_tarea' | 'consulta' | 'renombrar_proyecto' | 'archivar_proyecto' | 'unir_proyectos';
  title?: string;
  detail?: string;
  project_id?: string;
  project_name?: string;
  person?: string;
  assigned_to?: string;
  priority?: number;
  starts_at?: string;
  due_at?: string;
  remind_at?: string;
  tags?: string[];
  blocked_by?: string;
  recurrence?: string;
  amount?: number;
  currency?: string;
  kind?: 'gasto' | 'ingreso';
  subtasks?: string[];
  target_task_id?: string;
  target_project_id?: string;
  merge_into_project_id?: string;
  content?: string;
  budget_amount?: number;
  question?: string;
  duda?: string;
  ts?: string;
  private?: boolean;
}

export interface ParserResult {
  acciones: Accion[];
}

export async function parseMessage(text: string, context: ParserContext): Promise<ParserResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      systemInstruction: PARSER_PROMPT
    });

    const prompt = `
CONTEXTO:
${JSON.stringify(context, null, 2)}

MENSAJE DEL USUARIO:
"${text}"

Extrae las acciones estructuradas del mensaje.
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PARSER_SCHEMA as any
      }
    });

    const response = await result.response;
    const responseText = response.text();
    const parsed = JSON.parse(responseText);
    
    return parsed as ParserResult;
  } catch (error) {
    console.error('❌ Error en parseMessage:', error);
    throw error;
  }
}
