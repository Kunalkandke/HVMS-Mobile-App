import { format, formatDistanceToNow, parseISO } from 'date-fns';

export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, fmt);
  } catch {
    return '—';
  }
};

export const formatDateTime = (date) => formatDate(date, 'dd MMM yyyy, hh:mm a');

export const formatTime = (date) => formatDate(date, 'hh:mm a');

export const timeAgo = (date) => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '—';
  }
};

export const formatDuration = (minutes) => {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const getPurposeLabel = (purpose) => {
  const labels = {
    inspection: 'Inspection',
    student_meeting: 'Student Meeting',
    routine_check: 'Routine Check',
    emergency: 'Emergency',
    other: 'Other',
  };
  return labels[purpose] || purpose;
};

export const getRoleLabel = (role) => {
  const labels = { admin: 'Administrator', faculty: 'Faculty', warden: 'Warden' };
  return labels[role] || role;
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const truncate = (str, max = 50) => {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '…' : str;
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
};

export const PURPOSE_OPTIONS = [
  { label: 'Inspection', value: 'inspection' },
  { label: 'Student Meeting', value: 'student_meeting' },
  { label: 'Routine Check', value: 'routine_check' },
  { label: 'Emergency', value: 'emergency' },
  { label: 'Other', value: 'other' },
];

export const ROLE_OPTIONS = [
  { label: 'Faculty', value: 'faculty' },
  { label: 'Warden', value: 'warden' },
];
