'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  detail?: string;
  priority: number;
  due_at?: string;
  status: string;
  project_name?: string;
}

interface TaskListProps {
  title: string;
  tasks: Task[];
  onTaskUpdate: () => void;
  variant?: 'default' | 'overdue';
}

export function TaskList({ title, tasks, onTaskUpdate, variant = 'default' }: TaskListProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const handleComplete = async (taskId: string) => {
    setCheckedIds((prev) => new Set(prev).add(taskId));
    setPendingIds((prev) => new Set(prev).add(taskId));

    try {
      await api.tasks.update(taskId, { status: 'hecho' });
      toast.add({ title: 'Tarea completada', type: 'success' });
      onTaskUpdate();
    } catch (error) {
      console.error('Error completando tarea:', error);
      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      toast.add({
        title: 'No se pudo completar la tarea',
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const getPriorityConfig = (priority: number) => {
    switch (priority) {
      case 1: return { 
        color: 'border-red-500', 
        badge: 'bg-red-500/20 text-red-400',
        label: 'Urgente'
      };
      case 2: return { 
        color: 'border-orange-500', 
        badge: 'bg-orange-500/20 text-orange-400',
        label: 'Alta'
      };
      case 3: return { 
        color: 'border-blue-500', 
        badge: 'bg-blue-500/20 text-blue-400',
        label: 'Normal'
      };
      case 4: return { 
        color: 'border-slate-500', 
        badge: 'bg-slate-500/20 text-slate-400',
        label: 'Baja'
      };
      default: return { 
        color: 'border-slate-500', 
        badge: 'bg-slate-500/20 text-slate-400',
        label: 'Normal'
      };
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'mañana';
    if (diffDays === -1) return 'ayer';
    if (diffDays > 1 && diffDays <= 7) return `en ${diffDays} días`;
    if (diffDays < -1 && diffDays >= -7) return `hace ${Math.abs(diffDays)} días`;
    
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  };
  
  const Icon = variant === 'overdue' ? AlertCircle : CheckCircle2;
  const iconColor = variant === 'overdue' ? 'text-red-400' : 'text-green-400';
  
  return (
    <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            {title}
          </CardTitle>
          <span className="px-2 py-1 text-xs font-medium bg-slate-700/50 text-slate-300 rounded-full">
            {tasks.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-700/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400">No hay tareas</p>
          </div>
        ) : (
          tasks.map((task) => {
            const priorityConfig = getPriorityConfig(task.priority);
            return (
              <div
                key={task.id}
                className={`group relative p-4 rounded-xl bg-slate-900/50 border-l-4 ${priorityConfig.color} hover:bg-slate-900/70 transition-all duration-200`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={task.id}
                    checked={checkedIds.has(task.id)}
                    disabled={pendingIds.has(task.id)}
                    onCheckedChange={(checked) => {
                      if (checked) handleComplete(task.id);
                    }}
                    className="mt-1 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={task.id}
                      className="text-sm font-medium text-white cursor-pointer block hover:text-blue-300 transition-colors"
                    >
                      {task.title}
                    </label>
                    {task.detail && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {task.detail}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {task.project_name && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {task.project_name}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${priorityConfig.badge}`}>
                        {priorityConfig.label}
                      </span>
                      {task.due_at && (
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          variant === 'overdue' ? 'text-red-400' : 'text-slate-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {formatDate(task.due_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
