'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface Note {
  id: string;
  content: string;
  tags: string[];
  project_name?: string;
  created_at: string;
}

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadNotes();
  }, []);
  
  const loadNotes = async () => {
    try {
      const data = await api.notes.list();
      setNotes(data.notes);
    } catch (error) {
      console.error('Error cargando notas:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-slate-100">Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">Cargando...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg text-slate-100">
          Notas e Ideas ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-400">No hay notas</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-lg bg-slate-900 border border-slate-700"
            >
              <p className="text-sm text-slate-100">{note.content}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {note.project_name && (
                  <span className="text-xs text-blue-400">
                    {note.project_name}
                  </span>
                )}
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
