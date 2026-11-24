const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_DATAURL_CHARS = 72000;
const MAX_TEXT_PREVIEW_CHARS = 8000;

const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export function classifyAttachmentKind(name = '', mimeType = '') {
  const lowerName = String(name || '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();
  if (ALLOWED_IMAGE_MIME.has(lowerMime) || /\.(png|jpe?g|webp)$/i.test(lowerName)) {
    return 'image';
  }
  if (lowerName.endsWith('.log') || lowerName.endsWith('.txt') || lowerName.endsWith('.json') || lowerName.endsWith('.csv') || lowerMime.startsWith('text/')) {
    return 'log';
  }
  return 'file';
}

export function isSafeImageDataUrl(url) {
  if (typeof url !== 'string' || url.length > MAX_IMAGE_DATAURL_CHARS) return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(url.trim());
}

export function sanitizeAttachmentItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || 'attachment').replace(/[\r\n\t<>]/g, ' ').trim().slice(0, 120);
  if (!name) return null;

  const mimeType = String(raw.mimeType || '').trim().slice(0, 80);
  const kind = classifyAttachmentKind(name, mimeType);
  const size = Math.max(0, Math.min(Number(raw.size) || 0, 50 * 1024 * 1024));
  const uploadedAt = String(raw.uploadedAt || new Date().toISOString()).slice(0, 40);

  const sanitized = {
    id: String(raw.id || `att_${Date.now()}_${Math.floor(Math.random() * 999)}`).slice(0, 64),
    name,
    kind,
    mimeType: mimeType || (kind === 'image' ? 'image/jpeg' : 'text/plain'),
    size,
    uploadedAt
  };

  if (kind === 'image' && isSafeImageDataUrl(raw.dataUrl)) {
    sanitized.dataUrl = raw.dataUrl.trim();
  }
  if (raw.textPreview && typeof raw.textPreview === 'string') {
    sanitized.textPreview = raw.textPreview.slice(0, MAX_TEXT_PREVIEW_CHARS);
  }

  return sanitized;
}

export function validateAndSanitizeAttachments(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (out.length >= MAX_ATTACHMENTS) break;
    const clean = sanitizeAttachmentItem(item);
    if (clean) out.push(clean);
  }
  return out;
}

export function formatBytesCompact(bytes = 0) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImageDataUrl(rawDataUrl) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return isSafeImageDataUrl(rawDataUrl) ? rawDataUrl : '';
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let compressed = canvas.toDataURL('image/jpeg', 0.65);
        if (compressed.length > MAX_IMAGE_DATAURL_CHARS) {
          compressed = canvas.toDataURL('image/jpeg', 0.42);
        }
        resolve(isSafeImageDataUrl(compressed) ? compressed : '');
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = rawDataUrl;
  });
}

export async function readFileAsSafeAttachment(file) {
  if (!file) throw new Error('ملف غير صالح');
  const kind = classifyAttachmentKind(file.name, file.type);

  if (kind === 'image') {
    const lowerMime = String(file.type || '').toLowerCase();
    if (lowerMime.includes('svg')) {
      throw new Error('ملفات SVG غير مسموح بها لأسباب أمنية.');
    }
    const rawDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
      reader.readAsDataURL(file);
    });
    const safeUrl = await compressImageDataUrl(rawDataUrl);
    return sanitizeAttachmentItem({
      name: file.name,
      mimeType: 'image/jpeg',
      size: file.size,
      dataUrl: safeUrl
    });
  }

  if (kind === 'log') {
    const textContent = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('تعذر قراءة ملف السجل'));
      reader.readAsText(file.slice(0, MAX_TEXT_PREVIEW_CHARS * 2));
    });
    return sanitizeAttachmentItem({
      name: file.name,
      mimeType: file.type || 'text/plain',
      size: file.size,
      textPreview: textContent.slice(0, MAX_TEXT_PREVIEW_CHARS)
    });
  }

  return sanitizeAttachmentItem({
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size
  });
}
