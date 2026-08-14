import Link from "next/link";

export default function Home() {
  const dashboardSlug = "d23e11533588a47c8c434f72228837b3";
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
      <main className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-slate-100">
            Sistema de Pendientes
          </h1>
          <p className="text-slate-400">
            Gestión de tareas por Telegram con IA
          </p>
        </div>
        
        <div className="space-y-4">
          <Link
            href={`/d/${dashboardSlug}`}
            className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Acceder al Dashboard
          </Link>
          
          <Link
            href={`/d/${dashboardSlug}/pin`}
            className="block w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors"
          >
            Iniciar Sesión con PIN
          </Link>
        </div>
        
        <div className="pt-8 border-t border-slate-700">
          <p className="text-sm text-slate-500">
            Envía mensajes a tu bot de Telegram para crear tareas automáticamente
          </p>
        </div>
      </main>
    </div>
  );
}
