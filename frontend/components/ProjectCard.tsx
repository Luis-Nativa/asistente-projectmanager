'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { TrendingUp, DollarSign, CheckCircle2, Building2, History, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Project {
  id: string;
  name: string;
  client?: string;
  status?: string;
  notes?: string;
  budget_amount?: number;
  spent?: number;
  remaining?: number;
  tasks_count: number;
  tasks_pending: number;
}

interface HistoryTask {
  id: string;
  title: string;
  detail?: string;
  completed_at: string;
  completed_by?: string;
  tags?: string[];
  priority: number;
  due_at?: string;
}

interface ProjectCardProps {
  project: Project;
  canSeeMoney: boolean;
}

export function ProjectCard({ project, canSeeMoney }: ProjectCardProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryTask[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (open && showHistory && history.length === 0) {
      loadHistory();
    }
  }, [open, showHistory]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.projects.getHistory(project.id);
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatCompletedDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  };

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
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 hover:border-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer"
        >
          Ver detalle
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{project.name}</SheetTitle>
            {project.client && (
              <SheetDescription className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {project.client}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4">
            {project.status && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estado</span>
                <span className="capitalize font-medium">{project.status}</span>
              </div>
            )}

            {project.tasks_count !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Tareas completadas
                  </span>
                  <span className="font-medium">
                    {project.tasks_count - project.tasks_pending}/{project.tasks_count}
                  </span>
                </div>
                <Progress value={tasksPercentage} className="h-2" />
              </div>
            )}

            {canSeeMoney && project.budget_amount && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    Presupuesto
                  </span>
                  <span className="font-medium">
                    {formatMoney(project.spent || 0)} / {formatMoney(project.budget_amount)}
                  </span>
                </div>
                <Progress value={budgetPercentage} className="h-2" />
                {project.remaining !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Restante</span>
                    <span className="text-green-500 font-medium">
                      {formatMoney(project.remaining)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {project.notes && (
              <div className="space-y-1 pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Notas</span>
                <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Historial de completadas
                </span>
                <span className="text-xs">{showHistory ? '▲' : '▼'}</span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {historyLoading ? (
                    <p className="text-xs text-slate-500 text-center py-4">Cargando...</p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No hay tareas completadas</p>
                  ) : (
                    history.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30"
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white line-through opacity-70">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span className="text-xs text-slate-500">
                                Completada {formatCompletedDate(task.completed_at)}
                              </span>
                            </div>
                            {task.completed_by && (
                              <p className="text-xs text-slate-600 mt-1">por {task.completed_by}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
