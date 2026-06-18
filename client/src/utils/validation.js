// Centralized Validation System for Vyapar Application
// All validation rules, formatters, and error messages

// ============================================================
// INDIAN STATES & UT (for dropdowns)
// ============================================================
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman and Diu' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

export const INDIAN_STATE_NAMES = INDIAN_STATES.map(s => s.name);

export const getStateCodeByName = (name) => {
  const state = INDIAN_STATES.find(s => s.name.toLowerCase() === name?.toLowerCase());
  return state?.code || '';
};

export const getStateNameByCode = (code) => {
  const state = INDIAN_STATES.find(s => s.code === code);
  return state?.name || '';
};

// ============================================================
// MOBILE NUMBER VALIDATION
// ============================================================
export const validateMobile = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.length === 0) return { valid: false, error: 'Enter a valid 10-digit mobile number' };
  if (cleaned.length !== 10) return { valid: false, error: 'Enter a valid 10-digit mobile number' };
  if (!/^[6-9]\d{9}$/.test(cleaned)) return { valid: false, error: 'Enter a valid 10-digit mobile number' };
  return { valid: true, error: '' };
};

export const formatMobile = (value) => {
  return value.replace(/[^0-9]/g, '').slice(0, 10);
};

// ============================================================
// GENERAL PHONE VALIDATION (permissive)
// Accepts 10-digit mobiles, toll-free (e.g. 1800-102-8080 / 1860-xxx-xxxx),
// landlines with STD codes, and optional +country code. Keeps separators
// (dashes/spaces/parentheses/+) so numbers like "1800-102-8080" display as typed.
// ============================================================
export const formatPhone = (value) => {
  return value.replace(/[^0-9+\-() ]/g, '').slice(0, 18);
};

export const validatePhone = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const cleaned = value.replace(/[^0-9]/g, '');
  // 8–12 digits covers landlines, mobiles (10), toll-free (11), and +91-prefixed (12).
  if (cleaned.length < 8 || cleaned.length > 12) {
    return { valid: false, error: 'Enter a valid phone number' };
  }
  return { valid: true, error: '' };
};

// ============================================================
// EMAIL VALIDATION
// ============================================================
export const validateEmail = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(value.trim())) return { valid: false, error: 'Enter a valid email address' };
  return { valid: true, error: '' };
};

// ============================================================
// GST NUMBER VALIDATION (GSTIN - 15 characters)
// ============================================================
export const validateGST = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const gst = value.toUpperCase().trim();
  if (gst.length === 0) return { valid: true, error: '' };
  if (gst.length !== 15) return { valid: false, error: 'Enter a valid GSTIN (15 characters)' };
  // GSTIN format: 22AAAAA0000A1Z5
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstRegex.test(gst)) return { valid: false, error: 'Enter a valid GSTIN' };
  return { valid: true, error: '' };
};

export const formatGST = (value) => {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
};

// ============================================================
// PAN NUMBER VALIDATION (10 characters: ABCDE1234F)
// ============================================================
export const validatePAN = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const pan = value.toUpperCase().trim();
  if (pan.length === 0) return { valid: true, error: '' };
  if (pan.length !== 10) return { valid: false, error: 'Enter a valid PAN number (10 characters)' };
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(pan)) return { valid: false, error: 'Enter a valid PAN number' };
  return { valid: true, error: '' };
};

export const formatPAN = (value) => {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
};

// ============================================================
// BANK ACCOUNT NUMBER VALIDATION (9-18 digits)
// ============================================================
export const validateBankAccount = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.length === 0) return { valid: true, error: '' };
  if (cleaned.length < 9 || cleaned.length > 18) return { valid: false, error: 'Enter a valid bank account number (9-18 digits)' };
  return { valid: true, error: '' };
};

export const formatBankAccount = (value) => {
  return value.replace(/[^0-9]/g, '').slice(0, 18);
};

// ============================================================
// IFSC CODE VALIDATION (11 characters: SBIN0001234)
// ============================================================
export const validateIFSC = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const ifsc = value.toUpperCase().trim();
  if (ifsc.length === 0) return { valid: true, error: '' };
  if (ifsc.length !== 11) return { valid: false, error: 'Enter a valid IFSC code (11 characters)' };
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifsc)) return { valid: false, error: 'Enter a valid IFSC code' };
  return { valid: true, error: '' };
};

export const formatIFSC = (value) => {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
};

// ============================================================
// PINCODE VALIDATION (6 digits)
// ============================================================
export const validatePincode = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.length === 0) return { valid: true, error: '' };
  if (cleaned.length !== 6) return { valid: false, error: 'Enter a valid PIN code (6 digits)' };
  return { valid: true, error: '' };
};

export const formatPincode = (value) => {
  return value.replace(/[^0-9]/g, '').slice(0, 6);
};

// ============================================================
// AADHAAR VALIDATION (12 digits)
// ============================================================
export const validateAadhaar = (value) => {
  if (!value || !value.trim()) return { valid: true, error: '' };
  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.length === 0) return { valid: true, error: '' };
  if (cleaned.length !== 12) return { valid: false, error: 'Enter a valid Aadhaar number (12 digits)' };
  return { valid: true, error: '' };
};

export const formatAadhaar = (value) => {
  return value.replace(/[^0-9]/g, '').slice(0, 12);
};

// ============================================================
// PASSWORD VALIDATION
// ============================================================
export const validatePassword = (value, options = {}) => {
  const { minLength = 8 } = options;
  if (!value) return { valid: false, error: 'Password is required' };
  if (value.length < minLength) return { valid: false, error: `Password must be at least ${minLength} characters` };
  return { valid: true, error: '' };
};

// ============================================================
// NAME VALIDATION
// ============================================================
export const validateName = (value, fieldName = 'Name', required = false) => {
  if (!value || !value.trim()) {
    if (required) return { valid: false, error: `${fieldName} is required` };
    return { valid: true, error: '' };
  }
  if (value.trim().length < 2) return { valid: false, error: `${fieldName} must be at least 2 characters` };
  if (/^\s+$/.test(value)) return { valid: false, error: `${fieldName} cannot be only spaces` };
  return { valid: true, error: '' };
};

// ============================================================
// AMOUNT VALIDATION
// ============================================================
export const validateAmount = (value, options = {}) => {
  const { min = 0, max = Infinity, allowNegative = false, required = false } = options;
  if (value === '' || value === null || value === undefined) {
    if (required) return { valid: false, error: 'Amount is required' };
    return { valid: true, error: '' };
  }
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, error: 'Enter a valid amount' };
  if (!allowNegative && num < 0) return { valid: false, error: 'Amount cannot be negative' };
  if (num < min) return { valid: false, error: `Amount must be at least ${min}` };
  if (num > max) return { valid: false, error: `Amount cannot exceed ${max}` };
  return { valid: true, error: '' };
};

// ============================================================
// DATE VALIDATION
// ============================================================
export const validateDate = (value, options = {}) => {
  const { required = false, futureAllowed = true, pastAllowed = true } = options;
  if (!value) {
    if (required) return { valid: false, error: 'Date is required' };
    return { valid: true, error: '' };
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) return { valid: false, error: 'Enter a valid date' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!futureAllowed && date > today) return { valid: false, error: 'Date cannot be in the future' };
  if (!pastAllowed && date < today) return { valid: false, error: 'Date cannot be in the past' };
  return { valid: true, error: '' };
};

// ============================================================
// GENERIC VALIDATOR
// ============================================================
export const validateField = (value, rules = {}) => {
  const { type, required, min, max, pattern, custom } = rules;
  if (custom) return custom(value);
  if (required && (!value || !String(value).trim())) return { valid: false, error: `${rules.label || 'Field'} is required` };
  if (!value || !String(value).trim()) return { valid: true, error: '' };
  switch (type) {
    case 'mobile': return validateMobile(value);
    case 'email': return validateEmail(value);
    case 'gst': return validateGST(value);
    case 'pan': return validatePAN(value);
    case 'bankAccount': return validateBankAccount(value);
    case 'ifsc': return validateIFSC(value);
    case 'pincode': return validatePincode(value);
    case 'aadhaar': return validateAadhaar(value);
    case 'amount': return validateAmount(value, { min, max, ...rules });
    case 'name': return validateName(value, rules.label, required);
    case 'date': return validateDate(value, rules);
    default:
      if (pattern && !pattern.test(String(value))) return { valid: false, error: rules.patternError || 'Invalid format' };
      return { valid: true, error: '' };
  }
};

// ============================================================
// FORM VALIDATOR (validate multiple fields at once)
// ============================================================
export const validateForm = (data, schema) => {
  const errors = {};
  let firstErrorField = null;
  for (const [field, rules] of Object.entries(schema)) {
    const result = validateField(data[field], rules);
    if (!result.valid) {
      errors[field] = result.error;
      if (!firstErrorField) firstErrorField = field;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors, firstErrorField };
};

// ============================================================
// COMMON FORM SCHEMAS
// ============================================================
export const customerSchema = {
  name: { type: 'name', label: 'Customer Name', required: true },
  phone: { type: 'mobile', label: 'Phone' },
  email: { type: 'email', label: 'Email' },
};

export const supplierSchema = {
  name: { type: 'name', label: 'Supplier Name', required: true },
  phone: { type: 'mobile', label: 'Phone' },
  email: { type: 'email', label: 'Email' },
};

export const staffSchema = {
  name: { type: 'name', label: 'Staff Name', required: true },
  phone: { type: 'mobile', label: 'Phone' },
  email: { type: 'email', label: 'Email' },
};

export const companySchema = {
  companyName: { type: 'name', label: 'Company Name', required: true },
  phone: { type: 'mobile', label: 'Phone' },
  email: { type: 'email', label: 'Email' },
  gstNumber: { type: 'gst', label: 'GSTIN' },
  panNumber: { type: 'pan', label: 'PAN' },
  pincode: { type: 'pincode', label: 'Pincode' },
};

export const bankAccountSchema = {
  displayName: { type: 'name', label: 'Account Name', required: true },
  accountNumber: { type: 'bankAccount', label: 'Account Number' },
  ifscCode: { type: 'ifsc', label: 'IFSC Code' },
};

export const partySchema = {
  name: { type: 'name', label: 'Party Name', required: true },
  mobile: { type: 'mobile', label: 'Mobile' },
  email: { type: 'email', label: 'Email' },
  gst: { type: 'gst', label: 'GSTIN' },
  pincode: { type: 'pincode', label: 'Pincode' },
};

export const businessSetupSchema = {
  businessName: { type: 'name', label: 'Business Name', required: true },
  mobile: { type: 'mobile', label: 'Mobile' },
  email: { type: 'email', label: 'Email' },
  gstNumber: { type: 'gst', label: 'GSTIN' },
};

export const userProfileSchema = {
  businessName: { type: 'name', label: 'Business Name', required: true },
  phone: { type: 'mobile', label: 'Phone' },
  email: { type: 'email', label: 'Email' },
  gstNumber: { type: 'gst', label: 'GSTIN' },
  pincode: { type: 'pincode', label: 'Pincode' },
};

export const userManagementSchema = {
  name: { type: 'name', label: 'Name', required: true },
  email: { type: 'email', label: 'Email', required: true },
  phone: { type: 'mobile', label: 'Phone' },
};

// ============================================================
// HOOKS: useValidation
// ============================================================
import { useState, useCallback } from 'react';

export const useValidation = (schema) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validate = useCallback((data) => {
    const result = validateForm(data, schema);
    setErrors(result.errors);
    return result;
  }, [schema]);

  const validateFieldByName = useCallback((name, value) => {
    const rules = schema[name];
    if (!rules) return { valid: true, error: '' };
    const result = validateField(value, rules);
    setErrors(prev => {
      const next = { ...prev };
      if (result.valid) delete next[name];
      else next[name] = result.error;
      return next;
    });
    return result;
  }, [schema]);

  const touchField = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);

  const resetErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  return { errors, touched, validate, validateFieldByName, touchField, resetErrors, setErrors };
};

export default {
  INDIAN_STATES,
  INDIAN_STATE_NAMES,
  getStateCodeByName,
  getStateNameByCode,
  validateMobile,
  formatMobile,
  validateEmail,
  validatePassword,
  validateGST,
  formatGST,
  validatePAN,
  formatPAN,
  validateBankAccount,
  formatBankAccount,
  validateIFSC,
  formatIFSC,
  validatePincode,
  formatPincode,
  validateAadhaar,
  formatAadhaar,
  validateName,
  validateAmount,
  validateDate,
  validateField,
  validateForm,
  useValidation,
};
