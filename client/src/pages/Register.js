import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { UserPlus, User, Mail, Phone, ShieldCheck, ArrowLeft } from 'lucide-react';
import { validateEmail, validateName } from '../utils/validation';

const Register = () => {
  const [step, setStep] = useState('details'); // 'details' | 'otp'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerStart, registerVerify } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const nameValidation = validateName(name, 'Name', true);
    if (!nameValidation.valid) return toast.error(nameValidation.error);
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) return toast.error(emailValidation.error);
    if (phone.replace(/\D/g, '').length < 7) return toast.error('Enter a valid phone number');
    setLoading(true);
    try {
      const res = await registerStart({ name, email, phone });
      setStep('otp');
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
        setOtp(res.devOtp);
        toast.info(`Dev mode: your OTP is ${res.devOtp}`);
      } else {
        toast.success('Verification code sent to your email and phone');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send verification code');
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 4) return toast.error('Enter the verification code');
    setLoading(true);
    try {
      await registerVerify({ email, otp });
      toast.success('Account created');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          {step === 'details' ? <UserPlus className="w-6 h-6 text-white" /> : <ShieldCheck className="w-6 h-6 text-white" />}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{step === 'details' ? 'Create account' : 'Verify your account'}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
          {step === 'details' ? 'Get started with Vyapar' : `Enter the code sent to ${email} and ${phone}`}
        </p>
      </div>

      {step === 'details' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="9876543210" className={inputCls} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 shadow-sm">
            {loading ? 'Sending code...' : 'Send Verification Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          {devOtp && (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">
              Dev mode (no SMS gateway): your code is <strong>{devOtp}</strong>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Verification Code</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required placeholder="6-digit code" maxLength={6} className={inputCls + ' tracking-widest'} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 shadow-sm">
            {loading ? 'Verifying...' : 'Verify & Create Account'}
          </button>
          <button type="button" onClick={() => { setStep('details'); setOtp(''); setDevOtp(''); }} className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <ArrowLeft className="w-3.5 h-3.5" /> Change details
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign In</Link>
      </p>
    </motion.div>
  );
};

export default Register;
