'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Trash2 } from 'lucide-react';

interface Comment {
  id: string;
  task_id: string;
  share_id: string;
  author_label?: string;
  body: string;
  created_at: string;
}

interface CommentsPanelProps {
  taskId: string;
  currentShareId: string;
  currentShareLabel: string;
}

export function CommentsPanel({ taskId, currentShareId, currentShareLabel }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const loadComments = async () => {
    try {
      const data = await api.comments.list(taskId);
      setComments(data.comments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await api.comments.create(taskId, newComment);
      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Error creating comment:', error);
      alert('Error al crear comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('¿Eliminar este comentario?')) return;

    try {
      await api.comments.delete(commentId);
      loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Error al eliminar comentario');
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Cargando comentarios...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="w-5 h-5" />
          Comentarios ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No hay comentarios aún
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.author_label || 'Usuario'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {comment.share_id === currentShareId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm">{comment.body}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario..."
            rows={3}
            disabled={submitting}
          />
          <Button type="submit" disabled={submitting || !newComment.trim()} className="w-full">
            {submitting ? 'Enviando...' : 'Enviar comentario'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
