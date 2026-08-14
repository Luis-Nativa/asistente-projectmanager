'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { StickyNote, Tag } from 'lucide-react';

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
      <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-yellow-400" />
            Notas e Ideas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-700/30 rounded-xl animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-slate-800/30 backdrop-blur-sm border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-yellow-400" />
            Notas e Ideas
          </CardTitle>
          <span className="px-2 py-1 text-xs font-medium bg-slate-700/50 text-slate-300 rounded-full">
            {notes.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-700/30 flex items-center justify-center mx-auto mb-3">
              <StickyNote className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400">No hay notas</p>
            <p className="text-xs text-slate-500 mt-1">
              Envía ideas por Telegram
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="group p-4 rounded-xl bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900/70 hover:border-slate-600/50 transition-all duration-200"
            >
              <p className="text-sm text-white leading-relaxed">{note.content}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {note.project_name && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {note.project_name}
                  </span>
                )}
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/50 group-hover:bg-slate-700/70 transition-colors"
                  >
                    <Tag className="w-3 h-3" />
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
