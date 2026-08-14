import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from './db.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Prompt para transcripción de audio
 */
const TRANSCRIPTION_PROMPT = `Transcribe este audio literalmente. Es español de México, registro coloquial, 
grabado por un emprendedor dictando pendientes de trabajo, a veces manejando o caminando (habrá ruido de fondo).

REGLAS:
- Transcribe lo que se dice, sin corregir la gramática ni pulir el estilo.
- Elimina muletillas puras (este, o sea, mmm) pero NO reescribas frases.
- Marca el inicio de cada tema o idea nueva con [mm:ss] al principio de línea.
  El hablante salta de tema sin avisar; una idea nueva empieza cuando cambia el asunto, no cuando hace una pausa.
- Nombres propios de personas, negocios y lugares: transcríbelos como suenen y márcalos con (?) si no estás seguro.
  Ejemplo: Karla(?), Casa Nativa(?).
- Cantidades de dinero: escríbelas en dígitos. "ocho mil" → 8000.
- Si un fragmento es inaudible, escribe [inaudible] y sigue. NUNCA inventes lo que crees que dijo.
- No resumas, no agrupes, no reordenes. Salida en texto plano.`;

/**
 * Transcribir audio a texto usando Gemini
 * 
 * @param audioBuffer - Buffer del audio en base64
 * @param mimeType - Tipo MIME del audio (ej: 'audio/ogg', 'audio/mp4')
 * @returns Transcripción del audio
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    console.log(`🎤 Transcribiendo audio (${mimeType}, ${audioBuffer.length} bytes)...`);
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      systemInstruction: TRANSCRIPTION_PROMPT
    });
    
    // Convertir buffer a base64
    const audioBase64 = audioBuffer.toString('base64');
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          {
            text: 'Transcribe este audio siguiendo las instrucciones del sistema.'
          }
        ]
      }]
    });
    
    const response = await result.response;
    const transcription = response.text();
    
    console.log(`✅ Transcripción completada (${transcription.length} caracteres)`);
    
    return transcription;
  } catch (error) {
    console.error('❌ Error en transcribeAudio:', error);
    throw new Error('Error al transcribir el audio');
  }
}

/**
 * Descargar archivo de audio desde Telegram
 * 
 * @param fileId - ID del archivo en Telegram
 * @returns Buffer del audio y tipo MIME
 */
export async function downloadTelegramAudio(fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    // 1. Obtener información del archivo
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    
    if (!fileInfoResponse.ok) {
      throw new Error('Error al obtener información del archivo');
    }
    
    const fileInfo: any = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error('Archivo no encontrado');
    }
    
    const filePath = fileInfo.result.file_path;
    const fileSize = fileInfo.result.file_size;
    
    // Validar tamaño (máximo 20 MB)
    if (fileSize > 20 * 1024 * 1024) {
      throw new Error('El archivo es demasiado grande (máximo 20 MB)');
    }
    
    // 2. Descargar el archivo
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      throw new Error('Error al descargar el archivo');
    }
    
    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Determinar tipo MIME según extensión
    const extension = filePath.split('.').pop()?.toLowerCase();
    let mimeType = 'audio/ogg';
    
    if (extension === 'mp4' || extension === 'm4a') {
      mimeType = 'audio/mp4';
    } else if (extension === 'mp3') {
      mimeType = 'audio/mp3';
    } else if (extension === 'ogg') {
      mimeType = 'audio/ogg';
    }
    
    console.log(`✅ Audio descargado (${fileSize} bytes, ${mimeType})`);
    
    return { buffer, mimeType };
  } catch (error) {
    console.error('❌ Error en downloadTelegramAudio:', error);
    throw error;
  }
}

/**
 * Procesar nota de voz completa
 * 
 * @param fileId - ID del archivo de audio en Telegram
 * @param inboxMessageId - ID del mensaje en inbox_messages
 * @returns Transcripción del audio
 */
export async function processVoiceNote(fileId: string, inboxMessageId: number): Promise<string> {
  try {
    // 1. Descargar audio
    const { buffer, mimeType } = await downloadTelegramAudio(fileId);
    
    // 2. Transcribir
    const transcription = await transcribeAudio(buffer, mimeType);
    
    // 3. Guardar transcripción en inbox_messages
    await query(
      `UPDATE inbox_messages 
       SET transcript = $1, kind = 'voz', tg_file_id = $2
       WHERE id = $3`,
      [transcription, fileId, inboxMessageId]
    );
    
    console.log(`✅ Nota de voz procesada (inbox ${inboxMessageId})`);
    
    return transcription;
  } catch (error) {
    console.error('❌ Error en processVoiceNote:', error);
    throw error;
  }
}
