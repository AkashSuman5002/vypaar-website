import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { Mail, Lock, ShieldCheck, LogIn, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const ROLE_PERMISSIONS = {
  admin: ['*'], Admin: ['*'],
  Manager: ['sales:view','sales:create','sales:manage','purchases:view','purchases:create','purchases:manage','products:view','products:manage','customers:view','customers:manage','suppliers:view','suppliers:manage','reports:view','reports:export','accounting:view','accounting:manage','cashbank:view','cashbank:manage','expenses:view','expenses:create','expenses:manage','settings:view','settings:manage'],
  Accountant: ['sales:view','purchases:view','products:view','customers:view','suppliers:view','reports:view','reports:export','accounting:view','accounting:manage','cashbank:view','expenses:view'],
  Staff: ['sales:view','sales:create','products:view','customers:view'],
};

const redirectFor = (data) => {
  const userRole = data.role || 'admin';
  const isOwner = data.isOwner === true;
  const userPerms = data.permissions || [];
  const has = (perm) => {
    if (isOwner || userPerms.includes('*') || userPerms.includes(perm)) return true;
    const rp = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.Staff;
    return rp.includes('*') || rp.includes(perm);
  };
  const hasAny = (perms) => perms.some((p) => has(p));
  if (isOwner || userRole === 'admin' || userRole === 'Admin') return '/';
  if (hasAny(['users:view', 'users:manage'])) return '/user-management';
  if (hasAny(['accounting:view', 'accounting:manage'])) return '/journal-entry';
  if (hasAny(['sales:view', 'sales:create', 'sales:manage'])) return '/sales';
  if (hasAny(['purchases:view', 'purchases:create', 'purchases:manage'])) return '/purchases';
  if (hasAny(['products:view', 'products:manage'])) return '/products';
  if (hasAny(['customers:view', 'customers:manage'])) return '/customers';
  if (hasAny(['reports:view', 'reports:export'])) return '/reports';
  return '/';
};

const Login = () => {
  const [step, setStep] = useState('login'); // 'login' | '2fa'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Set when password login succeeds but the account has 2FA enabled.
  const [twoFactorUserId, setTwoFactorUserId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { login, loginTwoFactor } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast.error('Enter your email and password');
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      // Account has 2FA enabled: no session yet — prompt for the authenticator code.
      if (data?.twoFactorRequired) {
        setTwoFactorUserId(data.userId);
        setStep('2fa');
        toast.info('Enter the code from your authenticator app');
        return;
      }
      toast.success('Login successful');
      navigate(redirectFor(data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  const handleVerifyTwoFactor = async (e) => {
    e.preventDefault();
    if (!twoFactorCode || twoFactorCode.length !== 6) return toast.error('Enter the 6-digit code');
    setLoading(true);
    try {
      const data = await loginTwoFactor({ userId: twoFactorUserId, token: twoFactorCode });
      toast.success('Login successful');
      navigate(redirectFor(data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid authentication code');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          {step === '2fa' ? <ShieldCheck className="w-6 h-6 text-white" /> : <LogIn className="w-6 h-6 text-white" />}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {step === '2fa' ? 'Two-factor authentication' : 'Welcome back'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
          {step === '2fa' ? 'Enter the 6-digit code from your authenticator app' : 'Sign in with your email and password'}
        </p>
      </div>

      {step === '2fa' ? (
        <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Authentication Code</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input type="text" inputMode="numeric" value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                required placeholder="6-digit code" maxLength={6} className={inputCls + ' tracking-widest'} autoFocus />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 shadow-sm">
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>
          <button type="button" onClick={() => { setStep('login'); setTwoFactorCode(''); setTwoFactorUserId(''); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className={inputCls} autoFocus />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Your password" className={inputCls + ' pr-10'} />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline font-medium">Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 shadow-sm">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-blue-600 hover:underline font-medium">Register</Link>
      </p>
    </motion.div>
  );
};

export default Login;
