import React, { useState } from 'react';
import { Lock, User, LogIn, AlertCircle, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { db } from '../services/db';

const Login = ({ onLogin }: { onLogin: (token: string) => void }) => {
    const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [tempToken, setTempToken] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmitCredentials = async (e: React.FormEvent) => {
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
                if (data.require2FA) {
                    setTempToken(data.tempToken);
                    setStep('2fa');
                    setTotpCode('');
                    setError('');
                } else {
                    localStorage.setItem('auth_token', data.token);
                    if (data.username) localStorage.setItem('auth_username', data.username);
                    if (data.role) localStorage.setItem('auth_role', data.role);
                    onLogin(data.token);
                }
            } else {
                setError(data.error || 'Giriş başarısız.');
            }
        } catch (err) {
            setError('Sunucuya bağlanılamadı.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!totpCode || totpCode.trim().length !== 6) {
            setError('Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const data = await db.loginWith2FA(tempToken, totpCode.trim());
            localStorage.setItem('auth_token', data.token);
            if (data.username) localStorage.setItem('auth_username', data.username);
            if (data.role) localStorage.setItem('auth_role', data.role);
            onLogin(data.token);
        } catch (err: any) {
            setError(err.message || 'Doğrulama kodu hatalı.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToLogin = () => {
        setStep('credentials');
        setTotpCode('');
        setError('');
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                {step === 'credentials' ? (
                    <>
                        <div className="p-8 text-center bg-slate-800/50 border-b border-slate-800">
                            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                                <Lock className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">OSGB ProFinans</h2>
                            <p className="text-slate-400 mt-2 text-sm">Devam etmek için giriş yapın</p>
                        </div>
                        
                        <form onSubmit={handleSubmitCredentials} className="p-8 space-y-6">
                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div className="relative">
                                    <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
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
                                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
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
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                    </>
                ) : (
                    <>
                        <div className="p-8 text-center bg-slate-800/50 border-b border-slate-800">
                            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                                <ShieldCheck className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">İki Adımlı Doğrulama</h2>
                            <p className="text-slate-400 mt-2 text-sm">
                                <strong>{username}</strong> hesabı Google Authenticator ile korunmaktadır.
                            </p>
                        </div>
                        
                        <form onSubmit={handleSubmit2FA} className="p-8 space-y-6">
                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
                                    Google Authenticator 6 Haneli Kodu
                                </label>
                                <div className="relative">
                                    <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        autoFocus
                                        required
                                        placeholder="000000" 
                                        value={totpCode}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                            setTotpCode(val);
                                        }}
                                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl pl-12 pr-4 py-3.5 text-center text-2xl font-mono tracking-widest text-emerald-400 outline-none focus:border-emerald-400 transition-colors"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 text-center mt-2">
                                    Telefonunuzdaki Google Authenticator uygulamasını açıp 6 haneli kodu girin.
                                </p>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isLoading || totpCode.length !== 6}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <ShieldCheck className="w-5 h-5" />
                                        Doğrula ve Giriş Yap
                                    </>
                                )}
                            </button>

                            <button 
                                type="button" 
                                onClick={handleBackToLogin}
                                className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Farklı kullanıcı ile giriş yap
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default Login;
