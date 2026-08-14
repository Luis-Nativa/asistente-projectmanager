'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Share2, Plus, Trash2, RefreshCw } from 'lucide-react';

interface Share {
  id: string;
  slug: string;
  label: string;
  project_id: string | null;
  project_name?: string;
  role: string;
  can_complete: boolean;
  can_create: boolean;
  can_see_money: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

export function ShareManagement() {
  const [shares, setShares] = useState<Share[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newShare, setNewShare] = useState({
    label: '',
    project_id: '',
    can_complete: true,
    can_create: false,
    can_see_money: false,
    expires_in_days: 90,
  });
  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sharesData, projectsData] = await Promise.all([
        api.shares.list(),
        api.projects.list(),
      ]);
      setShares(sharesData.shares);
      setProjects(projectsData.projects);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const result = await api.shares.create({
        ...newShare,
        project_id: newShare.project_id || null,
      });
      
      setCreatedPin(result.pin);
      setCreatedSlug(result.slug);
      setCreateDialogOpen(false);
      setNewShare({
        label: '',
        project_id: '',
        can_complete: true,
        can_create: false,
        can_see_money: false,
        expires_in_days: 90,
      });
      loadData();
    } catch (error) {
      console.error('Error creating share:', error);
      alert('Error al crear el share');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de revocar este acceso?')) return;
    
    try {
      await api.shares.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting share:', error);
      alert('Error al revocar el acceso');
    }
  };

  const handleRegeneratePin = async (id: string) => {
    if (!confirm('¿Generar un nuevo PIN? El PIN anterior dejará de funcionar.')) return;
    
    try {
      const result = await api.shares.regeneratePin(id);
      alert(`Nuevo PIN generado: ${result.pin}`);
    } catch (error) {
      console.error('Error regenerating PIN:', error);
      alert('Error al regenerar el PIN');
    }
  };

  const handleTogglePermission = async (id: string, permission: string, value: boolean) => {
    try {
      await api.shares.update(id, { [permission]: value });
      loadData();
    } catch (error) {
      console.error('Error updating share:', error);
      alert('Error al actualizar permisos');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Accesos Compartidos</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger
            render={<Button />}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Acceso
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Acceso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="label">Nombre del Colaborador</Label>
                <Input
                  id="label"
                  value={newShare.label}
                  onChange={(e) => setNewShare({ ...newShare, label: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              
              <div>
                <Label htmlFor="project">Proyecto (opcional)</Label>
                <select
                  id="project"
                  value={newShare.project_id}
                  onChange={(e) => setNewShare({ ...newShare, project_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Todos los proyectos</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Permisos</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_complete"
                    checked={newShare.can_complete}
                    onCheckedChange={(checked) =>
                      setNewShare({ ...newShare, can_complete: checked as boolean })
                    }
                  />
                  <Label htmlFor="can_complete">Puede completar tareas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_create"
                    checked={newShare.can_create}
                    onCheckedChange={(checked) =>
                      setNewShare({ ...newShare, can_create: checked as boolean })
                    }
                  />
                  <Label htmlFor="can_create">Puede crear tareas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_see_money"
                    checked={newShare.can_see_money}
                    onCheckedChange={(checked) =>
                      setNewShare({ ...newShare, can_see_money: checked as boolean })
                    }
                  />
                  <Label htmlFor="can_see_money">Puede ver gastos</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="expires">Expira en (días)</Label>
                <Input
                  id="expires"
                  type="number"
                  value={newShare.expires_in_days}
                  onChange={(e) =>
                    setNewShare({ ...newShare, expires_in_days: parseInt(e.target.value) })
                  }
                />
              </div>

              <Button onClick={handleCreate} className="w-full">
                Crear Acceso
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {createdPin && createdSlug && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="font-semibold text-green-800">¡Acceso creado exitosamente!</p>
              <p className="text-sm text-green-700">
                URL: <code className="bg-green-100 px-2 py-1 rounded">{`${window.location.origin}/d/${createdSlug}`}</code>
              </p>
              <p className="text-sm text-green-700">
                PIN: <code className="bg-green-100 px-2 py-1 rounded text-lg font-mono">{createdPin}</code>
              </p>
              <p className="text-xs text-green-600">
                ⚠️ Guarda este PIN. No podrás verlo de nuevo.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatedPin(null);
                  setCreatedSlug(null);
                }}
              >
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {shares.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No hay accesos compartidos
            </CardContent>
          </Card>
        ) : (
          shares.map((share) => (
            <Card key={share.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="w-5 h-5" />
                      {share.label}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {share.project_name || 'Todos los proyectos'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegeneratePin(share.id)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(share.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={share.can_complete}
                        onCheckedChange={(checked) =>
                          handleTogglePermission(share.id, 'can_complete', checked as boolean)
                        }
                      />
                      <span>Completar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={share.can_create}
                        onCheckedChange={(checked) =>
                          handleTogglePermission(share.id, 'can_create', checked as boolean)
                        }
                      />
                      <span>Crear</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={share.can_see_money}
                        onCheckedChange={(checked) =>
                          handleTogglePermission(share.id, 'can_see_money', checked as boolean)
                        }
                      />
                      <span>Ver gastos</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    {share.expires_at && (
                      <p>
                        Expira: {new Date(share.expires_at).toLocaleDateString('es-MX')}
                      </p>
                    )}
                    {share.last_seen_at && (
                      <p>
                        Último acceso: {new Date(share.last_seen_at).toLocaleDateString('es-MX')}
                      </p>
                    )}
                    <p>
                      Creado: {new Date(share.created_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
