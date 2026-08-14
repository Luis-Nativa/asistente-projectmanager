import Link from "next/link";
import { MessageSquare, Zap, Brain, Calendar } from "lucide-react";

export default function Home() {
  const dashboardSlug = "d23e11533588a47c8c434f72228837b3";
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex flex-col items-center text-center space-y-8">
          {/* Logo/Icon */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Brain className="w-10 h-10 text-white" />
          </div>
          
          {/* Title */}
          <div className="space-y-4 max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
              Sistema de Pendientes
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 font-light">
              Gestiona tus tareas con IA desde Telegram
            </p>
          </div>
          
          {/* CTA Button */}
          <Link
            href={`/d/${dashboardSlug}`}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-2xl shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50"
          >
            <span>Acceder al Dashboard</span>
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-16 w-full">
            {/* Feature 1 */}
            <div className="group p-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl hover:bg-slate-800/70 hover:border-slate-600/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Captura por Telegram</h3>
              <p className="text-slate-400 text-sm">
                Envía mensajes de voz o texto y la IA los convierte en tareas estructuradas
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="group p-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl hover:bg-slate-800/70 hover:border-slate-600/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">IA Inteligente</h3>
              <p className="text-slate-400 text-sm">
                Gemini Flash interpreta tus mensajes y extrae fechas, prioridades y proyectos
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="group p-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl hover:bg-slate-800/70 hover:border-slate-600/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Recordatorios</h3>
              <p className="text-slate-400 text-sm">
                Recibe notificaciones automáticas y briefings matutinos por Telegram
              </p>
            </div>
          </div>
          
          {/* Footer Info */}
          <div className="pt-8 mt-16 border-t border-slate-800 max-w-2xl">
            <p className="text-slate-500 text-sm">
              Diseñado para emprendedores que necesitan capturar pendientes rápidamente sin interrumpir su flujo de trabajo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
