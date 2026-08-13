'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const handleComplete = async (taskId: string) => {
    try {
      await api.tasks.update(taskId, { status: 'hecho' });
      onTaskUpdate();
    } catch (error) {
      console.error('Error completando tarea:', error);
    }
  };
  
  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'border-red-500';
      case 2: return 'border-orange-500';
      case 3: return 'border-blue-500';
      case 4: return 'border-slate-500';
      default: return 'border-slate-500';
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
  
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg text-slate-100">
          {title} ({tasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400">No hay tareas</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3 rounded-lg bg-slate-900 border-l-4 ${getPriorityColor(task.priority)} ${
                variant === 'overdue' ? 'bg-red-900/10' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={task.id}
                  onCheckedChange={() => handleComplete(task.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={task.id}
                    className="text-sm font-medium text-slate-100 cursor-pointer block"
                  >
                    {task.title}
                  </label>
                  {task.detail && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {task.detail}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {task.project_name && (
                      <span className="text-xs text-blue-400">
                        {task.project_name}
                      </span>
                    )}
                    {task.due_at && (
                      <span className={`text-xs ${
                        variant === 'overdue' ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {formatDate(task.due_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
