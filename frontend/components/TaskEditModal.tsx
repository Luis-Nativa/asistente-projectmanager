'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api';

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  detail?: string;
  project_id?: string;
  project_name?: string;
  priority: number;
  due_at?: string;
  status: string;
  tags?: string[];
}

interface TaskEditModalProps {
  task: Task;
  projects: Project[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function TaskEditModal({ task, projects, open, onOpenChange, onSave }: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail || '');
  const [projectId, setProjectId] = useState(task.project_id || '');
  const [priority, setPriority] = useState(task.priority.toString());
  const [dueAt, setDueAt] = useState('');
  const [status, setStatus] = useState(task.status);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDetail(task.detail || '');
    setProjectId(task.project_id || '');
    setPriority(task.priority.toString());
    setStatus(task.status);
    
    if (task.due_at) {
      const date = new Date(task.due_at);
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      setDueAt(localDate.toISOString().slice(0, 16));
    } else {
      setDueAt('');
    }
  }, [task]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates: any = {
        title,
        detail: detail || null,
        project_id: projectId || null,
        priority: parseInt(priority),
        status,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      };

      await api.tasks.update(task.id, updates);
      toast.add({ title: 'Tarea actualizada', type: 'success' });
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      toast.add({
        title: 'Error al actualizar',
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const priorityOptions = [
    { value: '1', label: 'Urgente' },
    { value: '2', label: 'Alta' },
    { value: '3', label: 'Normal' },
    { value: '4', label: 'Baja' },
  ];

  const statusOptions = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'hecho', label: 'Completada' },
    { value: 'cancelado', label: 'Cancelada' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Editar Tarea</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Detalle</label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
              placeholder="Descripción opcional..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Proyecto</label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v || '')}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Sin proyecto" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="">Sin proyecto</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Prioridad</label>
              <Select value={priority} onValueChange={(v) => setPriority(v || '3')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">Estado</label>
              <Select value={status} onValueChange={(v) => setStatus(v || 'pendiente')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Fecha límite</label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
