'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { TaskList } from '@/components/TaskList';
import { ProjectCard } from '@/components/ProjectCard';
import { NotesPanel } from '@/components/NotesPanel';

interface DashboardData {
  projects: any[];
  tasks_today: any[];
  tasks_overdue: any[];
  expenses_pending: any[];
}

export default function DashboardPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<any>(null);
  
  useEffect(() => {
    // Verificar autenticación
    const token = localStorage.getItem('token');
    const shareData = localStorage.getItem('share');
    
    if (!token || !shareData) {
      router.push(`/d/${slug}/pin`);
      return;
    }
    
    setShare(JSON.parse(shareData));
    loadDashboard();
  }, [router, slug]);
  
  const loadDashboard = async () => {
    try {
      const dashboardData = await api.dashboard.get();
      setData(dashboardData);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    api.auth.logout();
    router.push(`/d/${slug}/pin`);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Cargando...</div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400">Error cargando datos</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {share?.label || 'Dashboard'}
            </h1>
            {share?.role && (
              <p className="text-xs text-slate-400 capitalize">{share.role}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      
      {/* Main Content - 3 Columnas en desktop, 1 columna en móvil */}
      <main className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna 1: Hoy y Vencidas */}
          <div className="space-y-4">
            <TaskList
              title="Hoy"
              tasks={data.tasks_today}
              onTaskUpdate={loadDashboard}
            />
            <TaskList
              title="Vencidas"
              tasks={data.tasks_overdue}
              onTaskUpdate={loadDashboard}
              variant="overdue"
            />
          </div>
          
          {/* Columna 2: Proyectos */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Proyectos</h2>
            {data.projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                canSeeMoney={share?.can_see_money}
              />
            ))}
          </div>
          
          {/* Columna 3: Notas */}
          <div>
            <NotesPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
