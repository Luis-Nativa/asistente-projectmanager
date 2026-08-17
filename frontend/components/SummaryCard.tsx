'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { ChevronDown, Clock, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  detail?: string;
  priority: number;
  due_at?: string;
  status: string;
  project_name?: string;
}

interface Project {
  id: string;
  name: string;
  tasks_count: number;
  tasks_pending: number;
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  items: Task[] | Project[];
  type: 'tasks' | 'projects';
  onTaskUpdate: () => void;
}

export function SummaryCard({ label, value, icon: Icon, color, bgColor, items, type, onTaskUpdate }: SummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
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
      case 1: return { color: 'border-red-500', badge: 'bg-red-500/20 text-red-400', label: 'Urgente' };
      case 2: return { color: 'border-orange-500', badge: 'bg-orange-500/20 text-orange-400', label: 'Alta' };
      case 3: return { color: 'border-blue-500', badge: 'bg-blue-500/20 text-blue-400', label: 'Normal' };
      case 4: return { color: 'border-slate-500', badge: 'bg-slate-500/20 text-slate-400', label: 'Baja' };
      default: return { color: 'border-slate-500', badge: 'bg-slate-500/20 text-slate-400', label: 'Normal' };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'mañana';
    if (diffDays === -1) return 'ayer';
    if (diffDays > 1 && diffDays <= 7) return `en ${diffDays} días`;
    if (diffDays < -1 && diffDays >= -7) return `hace ${Math.abs(diffDays)} días`;
    
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="group p-6 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl hover:bg-slate-800/50 hover:border-slate-600/50 transition-all duration-300">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer"
      >
        <div>
          <p className="text-sm text-slate-400 mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 max-h-96 overflow-y-auto">
          {type === 'tasks' ? (
            (items as Task[]).map((task) => {
              const priorityConfig = getPriorityConfig(task.priority);
              return (
                <div
                  key={task.id}
                  className={`group/item relative p-3 rounded-lg bg-slate-900/50 border-l-4 ${priorityConfig.color} hover:bg-slate-900/70 transition-all duration-200`}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={`summary-${task.id}`}
                      checked={checkedIds.has(task.id)}
                      disabled={pendingIds.has(task.id)}
                      onCheckedChange={(checked) => {
                        if (checked) handleComplete(task.id);
                      }}
                      className="mt-0.5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`summary-${task.id}`}
                        className="text-sm font-medium text-white cursor-pointer block hover:text-blue-300 transition-colors"
                      >
                        {task.title}
                      </label>
                      {task.detail && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.detail}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {task.project_name && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {task.project_name}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${priorityConfig.badge}`}>
                          {priorityConfig.label}
                        </span>
                        {task.due_at && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
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
          ) : (
            (items as Project[]).map((project) => (
              <div
                key={project.id}
                className="p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900/70 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">{project.name}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span>{project.tasks_pending} pendientes</span>
                  <span>•</span>
                  <span>{project.tasks_count} total</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {expanded && items.length === 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 text-center py-4">
          <p className="text-sm text-slate-400">No hay elementos</p>
        </div>
      )}
    </div>
  );
}
