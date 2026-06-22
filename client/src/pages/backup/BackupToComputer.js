import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HardDriveDownload, Download, Loader2, Archive, RefreshCw, FileArchive, Inbox } from 'lucide-react';
import { toast } from 'react-toastify';
import { backupAPI } from '../../services/api';

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const formatSize = (bytes) => {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '-';
  }
};

const BackupToComputer = () => {
  const [creating, setCreating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await backupAPI.getHistory();
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : (raw?.history || raw?.backups || []);
      setHistory(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load backup history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDownload = async (filename) => {
    if (!filename) return;
    setDownloading(filename);
    try {
      const res = await backupAPI.download(filename);
      const blob = res?.data ?? res;
      downloadBlob(blob, filename);
      toast.success('Backup downloaded');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to download backup');
    } finally {
      setDownloading(null);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await backupAPI.create();
      const data = res?.data ?? res;
      const filename = data?.filename;
      toast.success(data?.message || 'Backup created');
      if (filename) {
        await handleDownload(filename);
      }
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="p-6 space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                <HardDriveDownload className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Backup To Computer</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create a backup of your current business data and save it to your computer.</p>
            </div>

            {/* Create Backup */}
            <div className="max-w-xl mx-auto">
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-6 flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                  <Archive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create a new backup</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A backup file of all current business data will be generated and downloaded.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-soft"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Backup'}
                </button>
              </div>
            </div>

            {/* History */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Backup History</h3>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Inbox className="w-10 h-10 text-slate-300 dark:text-gray-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No backups yet. Create your first backup above.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">File</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Size</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                      {history.map((h, i) => (
                        <motion.tr
                          key={h.filename || i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-slate-50 dark:hover:bg-gray-700/30"
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                              <FileArchive className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                              <span className="truncate max-w-xs">{h.filename || 'backup'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(h.createdAt)}</td>
                          <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{formatSize(h.size)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDownload(h.filename)}
                              disabled={downloading === h.filename}
                              className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium disabled:opacity-50"
                            >
                              {downloading === h.filename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              Download
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupToComputer;
