'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg text-slate-100">{project.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tareas */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Tareas pendientes</span>
          <span className="text-slate-100 font-medium">
            {project.tasks_pending} / {project.tasks_count}
          </span>
        </div>
        
        {/* Presupuesto (solo si puede ver dinero) */}
        {canSeeMoney && project.budget_amount && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Presupuesto</span>
                <span className="text-slate-100 font-medium">
                  {formatMoney(project.spent || 0)} / {formatMoney(project.budget_amount)}
                </span>
              </div>
              <Progress value={budgetPercentage} className="h-2" />
              {project.remaining !== undefined && (
                <div className="text-xs text-slate-400">
                  Restante: {formatMoney(project.remaining)}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Botón para ver detalle */}
        <button className="w-full text-sm text-blue-400 hover:text-blue-300 text-left">
          Ver detalle →
        </button>
      </CardContent>
    </Card>
  );
}
