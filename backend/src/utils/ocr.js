/**
 * OCR Utility for extracting text from images on the backend
 * Uses Tesseract.js for server-side OCR processing
 */

import fs from 'fs';
import path from 'path';

let worker = null;
let tesseractModule = null;

// Lazy load tesseract.js to avoid startup issues
async function loadTesseract() {
  if (!tesseractModule) {
    try {
      const module = await import('tesseract.js');
      // tesseract.js exports createWorker as a named export
      tesseractModule = module;
    } catch (error) {
      console.error('❌ Failed to load tesseract.js:', error.message);
      throw new Error('OCR module failed to load. Please ensure tesseract.js is installed: npm install tesseract.js');
    }
  }
  return tesseractModule;
}

/**
 * Initialize Tesseract worker (lazy loading)
 * @returns {Promise} Initialized Tesseract worker
 */
async function getWorker() {
  if (!worker) {
    console.log('🔧 Initializing Tesseract OCR worker...');
    const tesseract = await loadTesseract();
    // tesseract.js exports createWorker as a named export
    const { createWorker } = tesseract;
    worker = await createWorker('eng'); // English language
    console.log('✅ Tesseract OCR worker initialized');
  }
  return worker;
}

/**
 * Extract text from an image file using OCR
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} Extracted text from the image
 */
export async function extractTextFromImage(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  try {
    console.log('📷 Starting OCR text extraction...');
    console.log(`   Image path: ${imagePath}`);

    const imageSizeKB = (fs.statSync(imagePath).size / 1024).toFixed(2);
    console.log(`   Image size: ${imageSizeKB} KB`);

    const workerInstance = await getWorker();

    console.log('🤖 Processing image with Tesseract OCR...');
    const { data: { text } } = await workerInstance.recognize(imagePath);

    const cleanedText = text.trim();

    if (!cleanedText || cleanedText.length === 0) {
      throw new Error('No text could be extracted from the image. The image may not contain readable text.');
    }

    console.log(`✅ OCR completed. Extracted ${cleanedText.length} characters`);
    return cleanedText;
  } catch (error) {
    console.error('❌ OCR Error:', error);

    if (error.message?.includes('No text')) {
      throw new Error('No text could be extracted from the image. Please ensure the image contains clear, readable text.');
    }

    throw new Error(`Failed to extract text from image: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Check if a file type is supported for OCR
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} True if the file type is supported for OCR
 */
export function isOCRSupported(fileType) {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
  ];
  return supportedTypes.includes(fileType?.toLowerCase());
}

/**
 * Cleanup worker (call when shutting down)
 */
export async function cleanupWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
    console.log('🧹 Tesseract OCR worker terminated');
  }
}

