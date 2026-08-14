import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from './db.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Prompt del sistema para el agente de consultas
 */
const CONSULTA_PROMPT = `Eres el asistente de un emprendedor. Responde SOLO con base en el JSON de datos que recibes. 
Si el dato no está en el JSON, di "no tengo ese dato registrado".
Nunca calcules a ojo: si te piden sumas, súmalas exactamente de los números del JSON.
Responde en español mexicano, en máximo 6 líneas, con cifras concretas.
Formato de dinero: $8,000 MXN. Si la respuesta es una lista, usa viñetas cortas.`;

/**
 * Procesar consulta en lenguaje natural
 * 
 * @param question - Pregunta del usuario
 * @returns Respuesta generada por Gemini
 */
export async function procesarConsulta(question: string): Promise<string> {
  try {
    console.log(`🤔 Procesando consulta: "${question}"`);
    
    // 1. Construir snapshot compacto de datos
    const snapshot = await construirSnapshot();
    
    // 2. Enviar pregunta + snapshot a Gemini
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      systemInstruction: CONSULTA_PROMPT
    });
    
    const prompt = `
DATOS DISPONIBLES:
${JSON.stringify(snapshot, null, 2)}

PREGUNTA DEL USUARIO:
"${question}"

Responde basándote únicamente en los datos proporcionados.
`;
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    
    const response = await result.response;
    const answer = response.text();
    
    console.log(`✅ Respuesta generada: ${answer.substring(0, 100)}...`);
    
    return answer;
  } catch (error) {
    console.error('❌ Error en procesarConsulta:', error);
    return 'Error procesando tu consulta. Intenta de nuevo.';
  }
}

/**
 * Construir snapshot compacto de datos para el agente de consultas
 */
async function construirSnapshot() {
  try {
    // 1. Proyectos con presupuesto y ejercido
    const projectsResult = await query(
      `SELECT 
        p.id,
        p.name,
        p.budget_amount,
        COALESCE(SUM(e.amount), 0) as spent
       FROM projects p
       LEFT JOIN expenses e ON e.project_id = p.id AND e.status = 'pagado' AND e.kind = 'gasto'
       WHERE p.archived_at IS NULL
       GROUP BY p.id, p.name, p.budget_amount`,
      []
    );
    
    // 2. Tareas abiertas (últimas 30)
    const tasksResult = await query(
      `SELECT 
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_at,
        p.name as project_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.status IN ('pendiente', 'en_proceso')
       ORDER BY t.created_at DESC
       LIMIT 30`,
      []
    );
    
    // 3. Gastos pendientes
    const expensesResult = await query(
      `SELECT 
        e.id,
        e.concept,
        e.amount,
        e.currency,
        e.status,
        e.due_at,
        p.name as project_name
       FROM expenses e
       LEFT JOIN projects p ON p.id = e.project_id
       WHERE e.status = 'pendiente'
       ORDER BY e.due_at NULLS LAST
       LIMIT 20`,
      []
    );
    
    // 4. Totales por proyecto
    const totalsResult = await query(
      `SELECT 
        p.name as project_name,
        COUNT(t.id) as total_tareas,
        COUNT(CASE WHEN t.status = 'pendiente' THEN 1 END) as tareas_pendientes,
        COUNT(CASE WHEN t.status = 'hecho' THEN 1 END) as tareas_completadas
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.archived_at IS NULL
       GROUP BY p.id, p.name`,
      []
    );
    
    return {
      proyectos: projectsResult.rows.map(p => ({
        nombre: p.name,
        presupuesto: p.budget_amount ? parseFloat(p.budget_amount) : null,
        ejercido: parseFloat(p.spent),
        restante: p.budget_amount ? parseFloat(p.budget_amount) - parseFloat(p.spent) : null
      })),
      tareas: tasksResult.rows.map(t => ({
        titulo: t.title,
        estado: t.status,
        prioridad: t.priority,
        fecha: t.due_at,
        proyecto: t.project_name
      })),
      gastos_pendientes: expensesResult.rows.map(e => ({
        concepto: e.concept,
        monto: parseFloat(e.amount),
        moneda: e.currency,
        fecha: e.due_at,
        proyecto: e.project_name
      })),
      totales_por_proyecto: totalsResult.rows.map(t => ({
        proyecto: t.project_name,
        total_tareas: parseInt(t.total_tareas),
        tareas_pendientes: parseInt(t.tareas_pendientes),
        tareas_completadas: parseInt(t.tareas_completadas)
      }))
    };
  } catch (error) {
    console.error('❌ Error construyendo snapshot:', error);
    return {
      proyectos: [],
      tareas: [],
      gastos_pendientes: [],
      totales_por_proyecto: []
    };
  }
}

/**
 * Detectar si un mensaje es una consulta
 * 
 * @param text - Texto del mensaje
 * @returns true si parece una consulta
 */
export function esConsulta(text: string): boolean {
  const patrones = [
    /^cu[aá]nto/i,
    /^cu[aá]les/i,
    /^qu[eé]/i,
    /^c[oó]mo/i,
    /^d[oó]nde/i,
    /^cu[aá]ndo/i,
    /^por qu[eé]/i,
    /\?$/,
    /cu[aá]nto llevo/i,
    /cu[aá]nto tengo/i,
    /cu[aá]nto falta/i,
    /qu[eé] tengo/i,
    /qu[eé] hay/i,
    /qu[eé] sigue/i,
    /c[oó]mo va/i,
    /dame un resumen/i,
    /resumen de/i
  ];
  
  return patrones.some(patron => patron.test(text.trim()));
}
