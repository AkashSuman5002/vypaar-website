import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, MessageSquare, Send, Paperclip, User, FileText, Headphones, CheckCircle, Loader2, X, ChevronRight, Clock, AlertCircle, Download, ArrowLeft, Image } from 'lucide-react';
import { supportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { validateMobile, validateEmail, formatMobile } from '../utils/validation';

const HELP_GUIDES = [
  {
    q: 'How to create an invoice?',
    steps: [
      { text: 'Go to Sale from the left sidebar and click "New Sale" or use Quick Sale.' },
      { text: 'Select a customer from the dropdown, or create a new customer by typing the name and clicking "Add New".' },
      { text: 'Add items by searching or scanning barcodes. Set quantity, discount, and tax for each item.' },
      { text: 'Review totals — subtotal, tax, discount, and grand total are calculated automatically.' },
      { text: 'Choose payment method (Cash, UPI, Bank Transfer, Credit) and enter the amount paid.' },
      { text: 'Click "Save & Print" to generate the invoice PDF, or "Save" to save as draft.' },
    ],
    route: '/sales/quick',
    routeLabel: 'Go to Quick Sale',
  },
  {
    q: 'How to add items?',
    steps: [
      { text: 'Go to Items from the left sidebar and click "Add Item" button.' },
      { text: 'Enter the item name, selling price, and cost price (for profit tracking).' },
      { text: 'Set the unit (Pcs, Kg, Ltr, Box, etc.) and opening stock quantity.' },
      { text: 'Add GST rate if applicable — choose from 0%, 5%, 12%, 18%, or 28%.' },
      { text: 'Enter HSN code for GST compliance (required for GST-registered businesses).' },
      { text: 'Optionally set a barcode, minimum stock alert level, and item description.' },
      { text: 'Click "Save" to add the item to your inventory.' },
    ],
    route: '/products',
    routeLabel: 'Go to Items',
  },
  {
    q: 'How to view reports?',
    steps: [
      { text: 'Click "Reports" in the left sidebar to see all available reports.' },
      { text: 'Use the date range picker at the top to filter reports by period.' },
      { text: 'Profit & Loss shows your income vs expenses and net profit.' },
      { text: 'Party Statement shows outstanding balances for each customer/supplier.' },
      { text: 'Day Book shows all transactions for a selected date.' },
      { text: 'GSTR reports help you file GST returns — GSTR-1, GSTR-3B, and HSN summary.' },
      { text: 'Click the Excel or Print buttons to export or print any report.' },
    ],
    route: '/reports',
    routeLabel: 'Go to Reports',
  },
];

const STATUS_CONFIG = {
  open: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400', label: 'Open' },
  in_progress: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', label: 'In Progress' },
  resolved: { color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400', label: 'Resolved' },
  closed: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400', label: 'Closed' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState('form'); // form | list | detail
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    subject: '',
    message: '',
  });
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeGuide, setActiveGuide] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAttachment, setReplyAttachment] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const repliesEndRef = useRef(null);

  useEffect(() => {
    if (view === 'list') fetchTickets();
  }, [view]);

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.replies]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await supportAPI.getMyTickets();
      setTickets(res.data.tickets || []);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchTicketDetail = async (id) => {
    setLoadingTicket(true);
    try {
      const res = await supportAPI.getById(id);
      setSelectedTicket(res.data.ticket);
      setView('detail');
    } catch (err) {
      toast.error('Failed to load ticket');
    } finally {
      setLoadingTicket(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const formData = new FormData();
      formData.append('message', replyText);
      if (replyAttachment) formData.append('attachment', replyAttachment);
      const res = await supportAPI.userReply(selectedTicket._id, formData);
      setSelectedTicket(res.data.ticket);
      setReplyText('');
      setReplyAttachment(null);
      toast.success('Reply sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'phone' ? formatMobile(value) : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    const newErrors = {};
    const emailResult = validateEmail(form.email);
    if (!emailResult.valid) newErrors.email = emailResult.error;
    if (form.phone.trim()) {
      const phoneResult = validateMobile(form.phone);
      if (!phoneResult.valid) newErrors.phone = phoneResult.error;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('email', form.email);
      formData.append('phone', form.phone);
      formData.append('subject', form.subject);
      formData.append('message', form.message);
      if (attachment) formData.append('attachment', attachment);
      await supportAPI.create(formData);
      setSubmitted(true);
      setErrors({});
      toast.success('Your request has been submitted!');
      setTimeout(() => {
        setSubmitted(false);
        setView('list');
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({ name: user?.name || '', email: user?.email || '', phone: '', subject: '', message: '' });
    setAttachment(null);
    setSubmitted(false);
    setErrors({});
  };

  const getFileIcon = (filename) => {
    if (!filename) return FileText;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return Image;
    return FileText;
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6 max-w-5xl mx-auto">
      {/* Top Support Bar */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Customer Support</p>
            <p className="text-xs text-blue-100">We're here to help you</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-white">
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            +91-9333911911
          </span>
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            +91-6364444752
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Cards */}
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Contact Us</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Phone</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">+91-9333911911</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">+91-6364444752</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Email</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">support@vyaparapp.in</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Live Chat</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Available 9AM - 6PM IST</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Quick Help</h3>
            <div className="space-y-2">
              {HELP_GUIDES.map((item, i) => (
                <button key={i} onClick={() => setActiveGuide(item)} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  {item.q}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-500 ml-auto flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* My Tickets Button */}
          <button onClick={() => setView(view === 'list' ? 'form' : 'list')}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 flex items-center gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">My Tickets</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">View your support requests</p>
            </div>
          </button>
        </motion.div>

        {/* Guide Modal */}
        <AnimatePresence>
          {activeGuide && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setActiveGuide(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 w-full max-w-lg max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{activeGuide.q}</h3>
                  <button onClick={() => setActiveGuide(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                <div className="px-5 py-4 overflow-y-auto max-h-[55vh]">
                  <ol className="space-y-3">
                    {activeGuide.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300 pt-0.5 leading-relaxed">{step.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="px-5 py-3 border-t border-slate-200 dark:border-gray-700 flex justify-end">
                  <button onClick={() => { setActiveGuide(null); navigate(activeGuide.route); }} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                    {activeGuide.routeLabel}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6">

            {/* TICKET LIST VIEW */}
            {view === 'list' && (
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">My Support Tickets</h3>
                {loadingTickets ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No tickets yet. Submit your first request!</p>
                    <button onClick={() => setView('form')} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">New Request</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map(ticket => {
                      const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                      return (
                        <button key={ticket._id} onClick={() => fetchTicketDetail(ticket._id)}
                          className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{ticket.subject || 'General Inquiry'}</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{ticket.message}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {ticket.replies?.length > 0 && (
                                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                  <MessageSquare className="w-3 h-3" /> {ticket.replies.length}
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TICKET DETAIL / CONVERSATION VIEW */}
            {view === 'detail' && selectedTicket && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => { setView('list'); setSelectedTicket(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{selectedTicket.subject || 'General Inquiry'}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ticket #{selectedTicket._id?.slice(-6).toUpperCase()}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedTicket.status]?.color}`}>
                    {STATUS_CONFIG[selectedTicket.status]?.label}
                  </span>
                </div>

                {/* Original Message */}
                <div className="mb-4 p-4 bg-slate-50 dark:bg-gray-700/30 rounded-xl border border-slate-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedTicket.name}</span>
                    <span className="text-xs text-slate-400">{new Date(selectedTicket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedTicket.message}</p>
                  {selectedTicket.attachment && (
                    <a href={selectedTicket.attachment} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      <Paperclip className="w-3 h-3" /> Attachment
                    </a>
                  )}
                </div>

                {/* Replies Thread */}
                <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
                  {selectedTicket.replies?.map((reply, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border ${reply.sender === 'admin' ? 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20 ml-4' : 'bg-slate-50 dark:bg-gray-700/30 border-slate-200 dark:border-gray-700 mr-4'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${reply.sender === 'admin' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-200 dark:bg-gray-600'}`}>
                          {reply.sender === 'admin' ? <Headphones className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <User className="w-3 h-3 text-slate-600 dark:text-slate-400" />}
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{reply.senderName || (reply.sender === 'admin' ? 'Support Team' : 'You')}</span>
                        <span className="text-xs text-slate-400">{new Date(reply.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{reply.message}</p>
                      {reply.attachment && (
                        <a href={reply.attachment} target="_blank" rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                          <Paperclip className="w-3 h-3" /> Attachment
                        </a>
                      )}
                    </div>
                  ))}
                  <div ref={repliesEndRef} />
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <form onSubmit={handleReply} className="border-t border-slate-200 dark:border-gray-700 pt-4">
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} required
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder="Type your reply..." />
                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <Paperclip className="w-3.5 h-3.5" />
                        {replyAttachment ? replyAttachment.name : 'Attach file'}
                        <input type="file" className="hidden" onChange={(e) => setReplyAttachment(e.target.files[0])} />
                      </label>
                      <button type="submit" disabled={sendingReply || !replyText.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Reply
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* SUBMIT REQUEST FORM */}
            {view === 'form' && (
              <>
                {submitted ? (
                  <div className="text-center py-12">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }}
                      className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Request Submitted!</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">We'll get back to you within 24 hours.</p>
                    <div className="flex gap-3 justify-center">
                      <button onClick={resetForm} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                        Submit Another Request
                      </button>
                      <button onClick={() => setView('list')} className="px-6 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                        View My Tickets
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Submit a Request</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Describe your issue and we'll get back to you</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name *</label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" name="name" value={form.name} onChange={handleChange} required
                              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              placeholder="Your name" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email *</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="email" name="email" value={form.email} onChange={handleChange} required
                              className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${errors.email ? 'border-red-500' : 'border-slate-200 dark:border-gray-700'}`}
                              placeholder="your@email.com" />
                          </div>
                          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                              className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${errors.phone ? 'border-red-500' : 'border-slate-200 dark:border-gray-700'}`}
                              placeholder="+91-XXXXXXXXXX" />
                          </div>
                          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject</label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" name="subject" value={form.subject} onChange={handleChange}
                              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              placeholder="Brief subject" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Message *</label>
                        <textarea name="message" value={form.message} onChange={handleChange} required rows={5}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                          placeholder="Describe your issue in detail..." />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Attachment</label>
                        <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-dashed border-slate-300 dark:border-gray-600 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors">
                          <Paperclip className="w-4 h-4" />
                          {attachment ? attachment.name : 'Click to attach a file'}
                          <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files[0])} />
                        </label>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button type="submit" disabled={submitting}
                          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
                          {submitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                          ) : (
                            <><Send className="w-4 h-4" /> Submit Request</>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Support;
