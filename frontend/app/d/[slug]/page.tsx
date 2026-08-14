'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ProjectCarousel } from '@/components/ProjectCarousel';
import { UrgentOverdueBoard } from '@/components/UrgentOverdueBoard';
import { NotesPanel } from '@/components/NotesPanel';
import { ShareManagement } from '@/components/ShareManagement';
import { LogOut, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';

interface DashboardData {
  projects: any[];
  tasks_pending: any[];
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400">Cargando dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <p className="text-red-400 text-lg">Error cargando datos</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  
  const stats = [
    {
      label: 'Tareas Pendientes',
      value: data.tasks_pending.length,
      icon: CheckCircle2,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Vencidas',
      value: data.tasks_overdue.length,
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    },
    {
      label: 'Proyectos',
      value: data.projects.length,
      icon: TrendingUp,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    }
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {share?.label || 'Dashboard'}
                </h1>
                {share?.role && (
                  <p className="text-xs text-slate-400 capitalize">{share.role}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Stats Cards */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="group p-6 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl hover:bg-slate-800/50 hover:border-slate-600/50 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Jerarquía vertical: proyectos → tareas accionables → notas/ideas aisladas */}
        <div className="flex flex-col gap-10">
          <ProjectCarousel projects={data.projects} canSeeMoney={share?.can_see_money} />

          <UrgentOverdueBoard
            tasksPending={data.tasks_pending}
            tasksOverdue={data.tasks_overdue}
            onTaskUpdate={loadDashboard}
          />

          <div className="pt-8 border-t border-slate-800">
            <NotesPanel />
          </div>

          {share?.role === 'owner' && (
            <div className="pt-8 border-t border-slate-800">
              <ShareManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
