import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  HardDrive, CheckCircle, XCircle, Loader2, Link2, Unlink,
  UploadCloud, AlertTriangle, Clock, Mail,
} from 'lucide-react';
import { driveAPI } from '../../services/api';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const formatDate = (iso) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString();
};

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

const BackupToDrive = () => {
  const [status, setStatus] = useState({ configured: false, connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  // Guards against React 18 StrictMode double-invoking the OAuth callback effect.
  const handledCodeRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await driveAPI.getStatus();
      setStatus(data || { configured: false, connected: false });
    } catch (err) {
      toast.error(errMsg(err, 'Failed to load Google Drive status'));
      setStatus({ configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error');

    const cleanUrl = () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    };

    if (oauthError) {
      cleanUrl();
      toast.error('Google authorization was cancelled');
      refreshStatus();
      return;
    }

    if (code) {
      if (handledCodeRef.current) return;
      handledCodeRef.current = true;
      cleanUrl();
      (async () => {
        setLoading(true);
        try {
          const { data } = await driveAPI.connect(code);
          if (data?.connected) {
            toast.success(`Google Drive connected${data.email ? ` (${data.email})` : ''}`);
          } else {
            toast.error('Could not connect Google Drive');
          }
        } catch (err) {
          toast.error(errMsg(err, 'Failed to connect Google Drive'));
        } finally {
          await refreshStatus();
        }
      })();
      return;
    }

    refreshStatus();
  }, [refreshStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await driveAPI.getAuthUrl();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Could not start Google authorization');
        setConnecting(false);
      }
    } catch (err) {
      toast.error(errMsg(err, 'Failed to start Google authorization'));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Automatic backups will stop.')) return;
    setDisconnecting(true);
    try {
      await driveAPI.disconnect();
      toast.success('Google Drive disconnected');
      await refreshStatus();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to disconnect'));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      const { data } = await driveAPI.backupNow();
      toast.success(data?.message || 'Backup uploaded to Google Drive');
      // Reflect the new lastBackup time if the server returned one.
      if (data?.lastBackup) {
        setStatus((prev) => ({ ...prev, lastBackup: data.lastBackup }));
      } else {
        await refreshStatus();
      }
    } catch (err) {
      toast.error(errMsg(err, 'Backup failed'));
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10">
          <HardDrive className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Back up to Google Drive</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Keep an off-site copy of your business data in your Google Drive
          </p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : !status.configured ? (
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="bg-white dark:bg-gray-800 rounded-2xl border border-amber-200 dark:border-amber-500/30 shadow-soft p-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Google Drive is not configured</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
                Google Drive backup requires server-side Google API credentials. An administrator
                must set the following environment variables in the server's <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-xs font-mono">.env</code> file
                and restart the server:
              </p>
              <ul className="mt-3 space-y-1.5">
                {['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'].map((v) => (
                  <li key={v} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-xs font-mono">{v}</code>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                The redirect URI should point back to this page (/backup/drive).
              </p>
              <button
                disabled
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed"
              >
                <Link2 className="w-4 h-4" /> Connect Google Drive
              </button>
            </div>
          </div>
        </motion.div>
      ) : !status.connected ? (
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6">
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <HardDrive className="w-10 h-10 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-2">
                <XCircle className="w-5 h-5 text-amber-500" /> Not connected
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Connect your Google account to securely store backups of your data on Google Drive.
              </p>
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {connecting ? 'Redirecting...' : 'Connect Google Drive'}
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Connected</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {status.email || 'Google account'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-gray-700/40 border border-slate-100 dark:border-gray-700">
              <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Last backup</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatDate(status.lastBackup)}</p>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>

          {/* Backup action card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 uppercase tracking-wider">Backup now</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Create a fresh backup of your business data and upload it to your connected Google Drive.
            </p>
            <button
              onClick={handleBackupNow}
              disabled={backingUp}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {backingUp ? 'Backing up...' : 'Back up now to Drive'}
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default BackupToDrive;
