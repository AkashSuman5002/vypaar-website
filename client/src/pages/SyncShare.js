import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  Share2, Building2, CheckCircle, ArrowRight, Users, UserCog,
  MessageCircle, Wifi, WifiOff, Loader2, Send, Mail, ExternalLink,
} from 'lucide-react';
import { businessAPI, whatsappAPI, utilityAPI } from '../services/api';
import { validateEmail } from '../utils/validation';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const SyncShare = () => {
  const navigate = useNavigate();

  const [businesses, setBusinesses] = useState([]);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [switchingId, setSwitchingId] = useState(null);

  const [waStatus, setWaStatus] = useState({ connected: false, status: 'disconnected' });
  const [loadingWa, setLoadingWa] = useState(true);

  const [invite, setInvite] = useState({ name: '', email: '', role: 'accountant' });
  const [inviting, setInviting] = useState(false);

  const loadBusinesses = useCallback(async () => {
    setLoadingBiz(true);
    try {
      const res = await businessAPI.getAll();
      setBusinesses(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoadingBiz(false);
    }
  }, []);

  const loadWaStatus = useCallback(async () => {
    setLoadingWa(true);
    try {
      const { data } = await whatsappAPI.getStatus();
      setWaStatus(data || { connected: false, status: 'disconnected' });
    } catch {
      setWaStatus({ connected: false, status: 'disconnected' });
    } finally {
      setLoadingWa(false);
    }
  }, []);

  useEffect(() => {
    loadBusinesses();
    loadWaStatus();
  }, [loadBusinesses, loadWaStatus]);

  const handleSwitch = async (biz) => {
    if (biz.isActive) return;
    setSwitchingId(biz._id);
    try {
      await businessAPI.switch(biz._id);
      localStorage.setItem('activeBusiness', biz._id);
      window.dispatchEvent(new Event('business-switched'));
      toast.success(`Switched to ${biz.name}`);
      loadBusinesses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to switch company');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!invite.name.trim() || !invite.email.trim()) {
      toast.error('Please fill in name and email');
      return;
    }
    const emailValidation = validateEmail(invite.email);
    if (!emailValidation.valid) {
      toast.error(emailValidation.error);
      return;
    }
    setInviting(true);
    try {
      await utilityAPI.inviteAccountant(invite);
      toast.success('Invitation sent successfully!');
      setInvite({ name: '', email: '', role: 'accountant' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10">
          <Share2 className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sync &amp; Share</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Share company access with your team and send updates over WhatsApp
          </p>
        </div>
      </motion.div>

      {/* Company / team access */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
              <Building2 className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Share your company / team access</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Switch the active company, then invite and manage who can access it</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => navigate('/user-management')}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Users className="w-4 h-4" /> User Management
            </button>
            <button
              onClick={() => navigate('/staff')}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <UserCog className="w-4 h-4" /> Staff
            </button>
          </div>
        </div>

        {loadingBiz ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">No companies found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {businesses.map((biz) => (
              <div
                key={biz._id}
                className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-colors ${
                  biz.isActive
                    ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5'
                    : 'border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{biz.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{biz.phone || biz.email || '—'}</p>
                </div>
                {biz.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" /> Active
                  </span>
                ) : (
                  <button
                    onClick={() => handleSwitch(biz)}
                    disabled={switchingId === biz._id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {switchingId === biz._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    Switch
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mobile nav buttons */}
        <div className="flex sm:hidden items-center gap-2 mt-4">
          <button
            onClick={() => navigate('/user-management')}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Users className="w-4 h-4" /> Users
          </button>
          <button
            onClick={() => navigate('/staff')}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <UserCog className="w-4 h-4" /> Staff
          </button>
        </div>

        {/* Accountant invite */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" /> Invite an accountant
          </h3>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={invite.name}
                onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                placeholder="Accountant name"
                className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                placeholder="accountant@email.com"
                className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Role</label>
              <select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
        </div>
      </motion.div>

      {/* WhatsApp sharing */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-green-50 dark:bg-green-500/10">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Share via WhatsApp</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Send invoices, estimates and receipts to your customers</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-gray-700/40 border border-slate-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {loadingWa ? (
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            ) : waStatus.connected ? (
              <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
                <Wifi className="w-6 h-6 text-emerald-500" />
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10">
                <WifiOff className="w-6 h-6 text-amber-500" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {loadingWa ? 'Checking connection...' : waStatus.connected ? 'WhatsApp Connected' : 'WhatsApp Not Connected'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {waStatus.connected
                  ? (waStatus.name || waStatus.phoneNumber || 'Ready to send messages')
                  : 'Connect your WhatsApp to start sharing'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/parties/whatsapp')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            {waStatus.connected ? 'Manage WhatsApp' : 'Connect WhatsApp'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SyncShare;
