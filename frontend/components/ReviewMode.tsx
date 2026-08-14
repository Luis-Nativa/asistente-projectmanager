'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Clock, Calendar } from 'lucide-react';

interface ReviewData {
  project: {
    id: string;
    name: string;
    last_review_at: string | null;
  };
  closed_since_last_review: any[];
  overdue: any[];
  stalled: any[];
  upcoming_7_days: any[];
}

interface ReviewModeProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function ReviewMode({ projectId, projectName, onClose }: ReviewModeProps) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviewData();
  }, [projectId]);

  const loadReviewData = async () => {
    try {
      const result = await api.review.get(projectId);
      setData(result);
    } catch (error) {
      console.error('Error loading review data:', error);
      alert('Error al cargar datos de revisión');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando datos de revisión...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl my-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Modo Revisión: {projectName}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.project.last_review_at
                  ? `Última revisión: ${new Date(data.project.last_review_at).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`
                  : 'Primera revisión'}
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tareas cerradas desde la última revisión */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Cerradas desde la última revisión ({data.closed_since_last_review.length})
            </h3>
            {data.closed_since_last_review.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay tareas cerradas en este período</p>
            ) : (
              <div className="space-y-2">
                {data.closed_since_last_review.map((task) => (
                  <div key={task.id} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.completed_by && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Completada por: {task.completed_by}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {task.completed_at && new Date(task.completed_at).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tareas vencidas */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Vencidas ({data.overdue.length})
            </h3>
            {data.overdue.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay tareas vencidas</p>
            ) : (
              <div className="space-y-2">
                {data.overdue.map((task) => (
                  <div key={task.id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex justify-between items-start">
                      <p className="font-medium">{task.title}</p>
                      <span className="text-xs text-red-500 font-semibold">
                        {Math.floor(task.days_overdue)} días de retraso
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tareas estancadas */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Estancadas ({data.stalled.length})
            </h3>
            {data.stalled.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay tareas estancadas</p>
            ) : (
              <div className="space-y-2">
                {data.stalled.map((task) => (
                  <div key={task.id} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Creada hace {Math.floor(task.days_since_created)} días
                        </p>
                      </div>
                      <span className="text-xs text-yellow-600 font-semibold">
                        Sin actividad reciente
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Próximos 7 días */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Próximos 7 días ({data.upcoming_7_days.length})
            </h3>
            {data.upcoming_7_days.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay tareas programadas para los próximos 7 días</p>
            ) : (
              <div className="space-y-2">
                {data.upcoming_7_days.map((task) => (
                  <div key={task.id} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex justify-between items-start">
                      <p className="font-medium">{task.title}</p>
                      <span className="text-xs text-blue-600 font-semibold">
                        {task.due_at && new Date(task.due_at).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
