'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  budget_amount?: number;
  spent?: number;
  remaining?: number;
  tasks_count: number;
  tasks_pending: number;
}

interface ProjectCardProps {
  project: Project;
  canSeeMoney: boolean;
}

export function ProjectCard({ project, canSeeMoney }: ProjectCardProps) {
  const budgetPercentage = project.budget_amount && project.spent
    ? (project.spent / project.budget_amount) * 100
    : 0;
  
  const tasksPercentage = project.tasks_count > 0
    ? ((project.tasks_count - project.tasks_pending) / project.tasks_count) * 100
    : 0;
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  return (
    <Card className="group bg-slate-800/30 backdrop-blur-sm border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600/50 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">
            {project.name}
          </CardTitle>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tasks Progress */}
        {project.tasks_count !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Tareas completadas
              </span>
              <span className="text-white font-medium">
                {project.tasks_count - project.tasks_pending}/{project.tasks_count}
              </span>
            </div>
            <Progress value={tasksPercentage} className="h-2" />
          </div>
        )}

        {/* Budget (solo si puede ver dinero) */}
        {canSeeMoney && project.budget_amount && (
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Presupuesto
              </span>
              <span className="text-white font-medium">
                {formatMoney(project.spent || 0)} / {formatMoney(project.budget_amount)}
              </span>
            </div>
            <Progress value={budgetPercentage} className="h-2" />
            {project.remaining !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Restante</span>
                <span className="text-green-400 font-medium">
                  {formatMoney(project.remaining)}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Action Button */}
        <button className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 hover:border-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium">
          Ver detalle
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </CardContent>
    </Card>
  );
}
