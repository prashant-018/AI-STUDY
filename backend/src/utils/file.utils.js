import path from 'path';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
export const STORAGE_LIMIT_BYTES = 15 * 1024 * 1024 * 1024; // 15GB

const documentTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'txt',
]);

export const categorizeMime = (mimeOrExt = '') => {
  if (!mimeOrExt) return 'other';
  const value = mimeOrExt.toLowerCase();
  if (value.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(value)) {
    return 'images';
  }
  if (documentTypes.has(value)) {
    return 'documents';
  }
  return 'other';
};

export const getFileExtension = (filename = '') => {
  const ext = path.extname(filename || '').replace('.', '');
  return ext ? ext.toLowerCase() : '';
};

export const formatFileSize = (bytes = 0, fractionDigits = 1) => {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(fractionDigits)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(fractionDigits)} GB`;
};

export const formatRelativeTime = (date) => {
  if (!date) return 'Never';
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `Today, ${new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const diffHours = diffMinutes / 60;
  if (diffHours < 24) return `Today, ${new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const diffDays = diffHours / 24;
  if (diffDays < 2) {
    return `Yesterday, ${new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return `${Math.floor(diffDays)} days ago`;
  }
  return new Date(date).toLocaleDateString();
};

export const normalizeTags = (tagsInput) => {
  if (!tagsInput) return [];
  if (Array.isArray(tagsInput)) {
    return tagsInput.map((t) => String(t).trim()).filter(Boolean);
  }
  return String(tagsInput)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
};


