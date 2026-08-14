'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PinPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const share = localStorage.getItem('share');
    
    if (token && share) {
      const shareData = JSON.parse(share);
      if (shareData.id) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold text-white">
              Acceso al Dashboard
            </CardTitle>
            <CardDescription className="text-slate-400">
              Ingresa tu PIN de 6 dígitos para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="pin" className="text-slate-300 font-medium">
                  PIN de acceso
                </Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="bg-slate-900/50 border-slate-700/50 text-white text-center text-2xl tracking-widest h-14 focus:border-blue-500 focus:ring-blue-500/20"
                  autoFocus
                  disabled={loading}
                />
              </div>
              
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-400 font-medium">{error}</p>
                      {attempts >= 3 && (
                        <p className="text-xs text-red-400/80 mt-1">
                          Demasiados intentos. Espera 15 minutos.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200"
                disabled={loading || pin.length !== 6 || attempts >= 5}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </span>
                ) : (
                  'Acceder'
                )}
              </Button>
              
              <div className="pt-4 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 text-center">
                  ¿Olvidaste tu PIN? Contacta al administrador del sistema.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
