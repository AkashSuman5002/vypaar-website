import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Info, LogIn, Users, CheckCircle, Trash2, Send } from 'lucide-react';
import useSettings from '../../hooks/useSettings';
import { utilityAPI } from '../../services/api';
import { validateEmail } from '../../utils/validation';

const AccountantAccess = () => {
  const { business } = useSettings();
  const [loggedIn, setLoggedIn] = useState(false);
  const [accessList, setAccessList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'accountant' });

  const loadAccess = useCallback(async () => {
    setLoading(true);
    try {
      const res = await utilityAPI.getAccountantAccess();
      setAccessList(res.data || []);
    } catch { toast.error('Failed to load access list'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (loggedIn) loadAccess(); }, [loggedIn, loadAccess]);

  const handleLogin = () => { setLoggedIn(true); toast.success('Logged in successfully!'); };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.name) { toast.error('Please fill in all fields'); return; }
    const emailValidation = validateEmail(inviteForm.email);
    if (!emailValidation.valid) {
      toast.error(emailValidation.error);
      return;
    }
    try {
      await utilityAPI.inviteAccountant(inviteForm);
      setInviteForm({ email: '', name: '', role: 'accountant' });
      setShowInvite(false);
      toast.success('Invitation sent successfully!');
      loadAccess();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send invite'); }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this access?')) return;
    try {
      await utilityAPI.removeAccountantAccess(id);
      toast.success('Access removed');
      loadAccess();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove'); }
  };

  if (!loggedIn) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2 mb-6">Accountant Access <Info className="w-5 h-5 text-slate-400 dark:text-[#64748B]" /></h1>
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-4 mb-4">
          <p className="text-sm text-slate-500 dark:text-[#64748B]">Current Company</p>
          <p className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">{business?.phone || business?.name || 'Not set'}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mb-6"><Users className="w-12 h-12 text-amber-500" /></div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mb-2">Sync Logged out!</h2>
          <p className="text-sm text-slate-500 dark:text-[#64748B] text-center max-w-md mb-6">You have not logged in Sync. Data sharing is not possible without logging in. Please log in and return to this screen.</p>
          <button onClick={handleLogin} className="px-6 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors inline-flex items-center gap-2"><LogIn className="w-4 h-4" /> Log in</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">Accountant Access <Info className="w-5 h-5 text-slate-400 dark:text-[#64748B]" /></h1>
          <p className="text-sm text-slate-400 dark:text-[#64748B] mt-0.5">Manage who can access your business data.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
          <Users className="w-4 h-4" /> Invite Accountant
        </button>
      </div>
      {showInvite && (
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-6 mb-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] mb-4">Invite Accountant</h3>
          <form onSubmit={handleInvite} className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Name</label>
              <input type="text" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Accountant name" required />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Email</label>
              <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="accountant@email.com" required />
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Role</label>
              <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"><Send className="w-4 h-4" /> Send Invite</button>
            <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2.5 border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-[#94A3B8] text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors">Cancel</button>
          </form>
        </div>
      )}
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#334155]">
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B] uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B] uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B] uppercase">Role</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B] uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-[#64748B] uppercase">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center text-sm text-slate-400 dark:text-[#64748B]">Loading...</td></tr>
            ) : accessList.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center text-sm text-slate-400 dark:text-[#64748B]">No accountant access configured. Click "Invite Accountant" to get started.</td></tr>
            ) : accessList.map((a) => (
              <tr key={a._id || a.id} className="border-b border-slate-100 dark:border-[#334155] hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/70 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">{a.name}</td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-[#64748B]">{a.email}</td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-[#64748B] capitalize">{a.role}</td>
                <td className="px-6 py-4"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><CheckCircle className="w-3 h-3" /> {a.status || 'Active'}</span></td>
                <td className="px-6 py-4 text-right"><button onClick={() => handleRemove(a._id || a.id)} className="p-1.5 text-slate-400 dark:text-[#64748B] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default AccountantAccess;
