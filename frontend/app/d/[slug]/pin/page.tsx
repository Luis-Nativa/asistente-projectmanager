'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export default function PinPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  
  useEffect(() => {
    // Verificar si ya hay token válido
    const token = localStorage.getItem('token');
    const share = localStorage.getItem('share');
    
    if (token && share) {
      const shareData = JSON.parse(share);
      if (shareData.id) {
        // Ya autenticado, redirigir al dashboard
        router.push(`/d/${slug}`);
      }
    }
  }, [router, slug]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await api.auth.login(slug, pin);
      router.push(`/d/${slug}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al autenticar';
      setError(message);
      setAttempts(attempts + 1);
      setPin('');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-slate-100">Sistema de Pendientes</CardTitle>
          <CardDescription className="text-slate-400">
            Ingresa tu PIN para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-slate-300">PIN de 6 dígitos</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                pattern="[0-9]{6}"
                className="bg-slate-900 border-slate-700 text-slate-100 text-center text-2xl tracking-widest"
                autoFocus
                disabled={loading}
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50">
                <p className="text-sm text-red-400">{error}</p>
                {attempts >= 3 && (
                  <p className="text-xs text-red-400 mt-1">
                    Demasiados intentos. Espera 15 minutos.
                  </p>
                )}
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading || pin.length !== 6 || attempts >= 5}
            >
              {loading ? 'Autenticando...' : 'Acceder'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
