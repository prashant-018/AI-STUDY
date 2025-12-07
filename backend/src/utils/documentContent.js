import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { extractTextFromImage, isOCRSupported } from './ocr.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export async function loadDocumentContent(document) {
  if (!document || !document.filePath) {
    throw new Error('Invalid document provided for content extraction');
  }

  const absolutePath = path.join(process.cwd(), 'uploads', document.filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Document file not found on server');
  }

  const fileType = document.fileType || path.extname(document.fileName || '').toLowerCase();

  if (fileType?.startsWith('image/')) {
    // Use OCR to extract text from images
    if (!isOCRSupported(fileType)) {
      throw new Error(`Image format ${fileType} is not supported for OCR. Supported formats: JPEG, PNG, GIF, BMP, WebP`);
    }
    return await extractTextFromImage(absolutePath);
  }

  if (fileType === 'application/pdf' || path.extname(document.fileName || '').toLowerCase() === '.pdf') {
    if (!pdfParse) {
      throw new Error('PDF parsing is not available. Please reinstall dependencies (pdf-parse).');
    }
    const buffer = fs.readFileSync(absolutePath);
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  return fs.readFileSync(absolutePath, 'utf-8');
}

