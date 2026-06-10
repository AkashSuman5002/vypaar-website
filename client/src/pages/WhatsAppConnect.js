import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { MessageCircle, CheckCircle, XCircle, RefreshCw, Send, Loader2, Wifi, WifiOff, Phone, History, Trash2 } from 'lucide-react';
import { whatsappAPI } from '../services/api';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const WhatsAppConnect = () => {
  const [status, setStatus] = useState({ connected: false, status: 'disconnected', phoneNumber: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendMsg, setSendMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgStats, setMsgStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [tab, setTab] = useState('connection');
  const eventSourceRef = useRef(null);
  const connectingRef = useRef(false);

  const checkStatus = useCallback(async () => {
    try {
      const { data } = await whatsappAPI.getStatus();
      setStatus(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    checkStatus();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [checkStatus]);

  useEffect(() => {
    if (tab === 'history') {
      loadMessages();
      loadStats();
    }
  }, [tab]);

  const loadMessages = async () => {
    try {
      const { data } = await whatsappAPI.getMessages({ limit: 50 });
      setMessages(data.messages || []);
    } catch {}
  };

  const loadStats = async () => {
    try {
      const { data } = await whatsappAPI.getMessageStats();
      setMsgStats(data);
    } catch {}
  };

  const handleConnect = async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnecting(true);
    setQrImage('');

    try {
      const es = new EventSource(whatsappAPI.getQRStream());
      eventSourceRef.current = es;
      let sessionStarted = false;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === 'qr' && parsed.data) {
            setQrImage(parsed.data);
          }

          if (parsed.type === 'status') {
            if (parsed.data?.status === 'connected') {
              setStatus({ connected: true, status: 'connected', phoneNumber: parsed.data.phoneNumber || '', name: parsed.data.name || '' });
              setQrImage('');
              setConnecting(false);
              connectingRef.current = false;
              toast.success('WhatsApp connected!');
              es.close();
              eventSourceRef.current = null;
            }
            // Ignore 'disconnected' status here — it's the initial status push from qrStream
            // Only handle it if we previously started a session and were waiting for QR
            if (parsed.data?.status === 'disconnected' && sessionStarted) {
              setConnecting(false);
              connectingRef.current = false;
              es.close();
              eventSourceRef.current = null;
            }
          }
        } catch {}
      };

      es.onerror = () => {
        // EventSource has built-in reconnection — only close if we're no longer connecting
        if (!connectingRef.current) {
          es.close();
          eventSourceRef.current = null;
        }
      };

      // Now start the Baileys session (EventSource is already listening)
      const result = await whatsappAPI.connect();
      sessionStarted = true;

      // If already connected, the status event from qrStream already handled it
      if (result.data?.status === 'already_connected') {
        const statusRes = await whatsappAPI.getStatus();
        setStatus(statusRes.data);
        setConnecting(false);
        connectingRef.current = false;
        es.close();
        eventSourceRef.current = null;
        toast.info('Already connected');
      }

      // Timeout safety: close after 120s if nothing happened
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          es.close();
          eventSourceRef.current = null;
          checkStatus();
          setConnecting(false);
          connectingRef.current = false;
        }
      }, 120000);
    } catch (err) {
      toast.error('Failed to connect');
      setConnecting(false);
      connectingRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await whatsappAPI.disconnect();
      setStatus({ connected: false, status: 'disconnected', phoneNumber: '', name: '' });
      setQrImage('');
      toast.success('WhatsApp disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleSend = async () => {
    if (!sendPhone || !sendMsg) return toast.error('Phone and message required');
    setSending(true);
    try {
      await whatsappAPI.send({ phone: sendPhone, message: sendMsg });
      toast.success('Message sent!');
      setSendMsg('');
      if (tab === 'history') loadMessages();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    }
    setSending(false);
  };

  const renderQR = (qr) => {
    if (!qr) return null;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`;
    return <img src={qrUrl} alt="WhatsApp QR Code" className="w-64 h-64 rounded-lg border" />;
  };

  const statusColor = {
    connected: 'text-emerald-500',
    qr_pending: 'text-amber-500',
    disconnected: 'text-red-500',
    failed: 'text-red-500',
  };

  const statusIcon = {
    connected: CheckCircle,
    qr_pending: Loader2,
    disconnected: XCircle,
    failed: XCircle,
  };

  const StatusIcon = statusIcon[status.status] || XCircle;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">WhatsApp Connect</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Connect your WhatsApp to send invoices automatically</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('connection')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'connection' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Connection
          </button>
          <button onClick={() => setTab('send')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'send' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Send Message
          </button>
          <button onClick={() => setTab('history')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            History
          </button>
        </div>
      </motion.div>

      {tab === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${status.connected ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                {status.connected ? <Wifi className="w-8 h-8 text-emerald-500" /> : <WifiOff className="w-8 h-8 text-amber-500" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {status.connected ? 'Connected' : qrImage ? 'Scan QR Code' : 'Not Connected'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <StatusIcon className={`w-4 h-4 ${statusColor[status.status]}`} />
                  {status.status === 'connected' ? `${status.name || status.phoneNumber}` : status.status.replace('_', ' ')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : qrImage ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  {renderQR(qrImage)}
                  <p className="text-sm text-slate-500 dark:text-slate-400">Scan this QR code with WhatsApp on your phone</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Open WhatsApp Settings > Linked Devices > Link a Device</p>
                </div>
              ) : status.connected ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{status.name || 'WhatsApp Connected'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Phone: {status.phoneNumber}</p>
                    {status.lastConnected && (
                      <p className="text-xs text-slate-400 mt-1">Last connected: {new Date(status.lastConnected).toLocaleString()}</p>
                    )}
                  </div>
                  <button onClick={handleDisconnect}
                    className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Disconnect
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                    <MessageCircle className="w-10 h-10 text-blue-500" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Click connect to generate a QR code and link your WhatsApp</p>
                  <button onClick={handleConnect} disabled={connecting}
                    className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                    {connecting ? 'Connecting...' : 'Connect WhatsApp'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 uppercase tracking-wider">How It Works</h3>
              <div className="space-y-3">
                {[
                  'Click Connect and scan the QR code with your phone',
                  'Your WhatsApp account links to the app',
                  'Go to Settings > Transaction Messages to enable auto-sending',
                  'Invoices, payments, and estimates are sent automatically',
                  'You can also send manual messages from the Send tab',
                ].map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-600 flex-shrink-0 mt-0.5">{idx + 1}</span>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 text-white shadow-lg">
              <h3 className="text-base font-semibold mb-3">Auto-Message Features</h3>
              <ul className="space-y-2">
                {['Invoice sharing via WhatsApp', 'Payment receipt confirmation', 'Estimate/quotation delivery', 'Credit note notifications', 'Custom message templates'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-green-100">
                    <CheckCircle className="w-4 h-4 text-green-200 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      )}

      {tab === 'send' && (
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Send WhatsApp Message</h3>
          {!status.connected ? (
            <div className="text-center py-8">
              <WifiOff className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Connect to WhatsApp first from the Connection tab</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recipient Phone</label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <input type="tel" value={sendPhone} onChange={e => setSendPhone(e.target.value)}
                    placeholder="9876543210"
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <p className="text-xs text-slate-400 mt-1">Enter 10-digit mobile number with country code (e.g., 919876543210)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
                <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)} rows={5}
                  placeholder="Type your message..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>
              <button onClick={handleSend} disabled={sending || !sendPhone || !sendMsg}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {tab === 'history' && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total', value: msgStats.total, color: 'bg-blue-50 text-blue-700' },
              { label: 'Sent', value: msgStats.sent, color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Failed', value: msgStats.failed, color: 'bg-red-50 text-red-700' },
              { label: 'Pending', value: msgStats.pending, color: 'bg-amber-50 text-amber-700' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Message History</span>
            </div>
            {messages.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No messages sent yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-gray-700">
                {messages.map(msg => (
                  <div key={msg._id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-700/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{msg.to}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          msg.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                          msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{msg.status}</span>
                        {msg.transactionType && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">{msg.transactionType}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{msg.message}</p>
                    </div>
                    <span className="text-xs text-slate-400 ml-4 flex-shrink-0">{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default WhatsAppConnect;
