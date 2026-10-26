import React, { useState } from 'react';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';

const Login = ({ onLogin }: { onLogin: (token: string) => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('auth_token', data.token);
                onLogin(data.token);
            } else {
                setError(data.error || 'Giriş başarısız.');
            }
        } catch (err) {
            setError('Sunucuya bağlanılamadı.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                <div className="p-8 text-center bg-slate-800/50 border-b border-slate-800">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">OSGB ProFinans</h2>
                    <p className="text-slate-400 mt-2 text-sm">Devam etmek için giriş yapın</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input 
                                type="text" 
                                required
                                placeholder="Kullanıcı Adı" 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input 
                                type="password" 
                                required
                                placeholder="Şifre" 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <LogIn className="w-5 h-5" />
                                Giriş Yap
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
