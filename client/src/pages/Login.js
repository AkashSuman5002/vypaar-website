import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success('Login successful');
      // Build a temporary permission context from the login data to determine redirect
      const userRole = data.role || 'admin';
      const isOwner = data.isOwner === true;
      const userPerms = data.permissions || [];
      const ROLE_PERMISSIONS = {
        admin: ['*'], Admin: ['*'],
        Manager: ['sales:view','sales:create','sales:manage','purchases:view','purchases:create','purchases:manage','products:view','products:manage','customers:view','customers:manage','suppliers:view','suppliers:manage','reports:view','reports:export','accounting:view','accounting:manage','cashbank:view','cashbank:manage','expenses:view','expenses:create','expenses:manage','settings:view','settings:manage'],
        Accountant: ['sales:view','purchases:view','products:view','customers:view','suppliers:view','reports:view','reports:export','accounting:view','accounting:manage','cashbank:view','expenses:view'],
        Staff: ['sales:view','sales:create','products:view','customers:view'],
      };
      const has = (perm) => {
        if (isOwner) return true;
        if (userPerms.includes('*')) return true;
        if (userPerms.includes(perm)) return true;
        const rp = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['Staff'];
        if (rp.includes('*')) return true;
        return rp.includes(perm);
      };
      const hasAny = (perms) => perms.some(p => has(p));

      let target = '/';
      if (isOwner || userRole === 'admin' || userRole === 'Admin') target = '/';
      else if (hasAny(['users:view', 'users:manage'])) target = '/user-management';
      else if (hasAny(['accounting:view', 'accounting:manage'])) target = '/journal-entry';
      else if (hasAny(['sales:view', 'sales:create', 'sales:manage'])) target = '/sales';
      else if (hasAny(['purchases:view', 'purchases:create', 'purchases:manage'])) target = '/purchases';
      else if (hasAny(['products:view', 'products:manage'])) target = '/products';
      else if (hasAny(['customers:view', 'customers:manage'])) target = '/customers';
      else if (hasAny(['reports:view', 'reports:export'])) target = '/reports';

      navigate(target);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          <LogIn className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">Sign in to your Vyapar account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 shadow-sm">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <div className="mt-4 text-right">
        <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline font-medium">Forgot password?</Link>
      </div>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-blue-600 hover:underline font-medium">Register</Link>
      </p>
    </motion.div>
  );
};

export default Login;
