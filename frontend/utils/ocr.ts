/**
 * OCR Utility for extracting text from images
 * Uses Tesseract.js for client-side OCR processing
 */

import { createWorker, Worker } from 'tesseract.js';

let worker: Worker | null = null;

/**
 * Initialize Tesseract worker (lazy loading)
 * @returns {Promise<Worker>} Initialized Tesseract worker
 */
async function getWorker(): Promise<Worker> {
  if (!worker) {
    // Create worker without logger to avoid DataCloneError
    // Logger functions cannot be cloned when passed to web workers
    worker = await createWorker('eng', 1);
  }
  return worker;
}

/**
 * Extract text from an image file using OCR
 * @param {File | string} imageSource - Image file or image URL
 * @param {Function} onProgress - Optional progress callback (0-100)
 * @returns {Promise<string>} Extracted text from the image
 */
export async function extractTextFromImage(
  imageSource: File | string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const workerInstance = await getWorker();

    // Perform OCR
    // Note: Progress tracking is disabled to avoid DataCloneError with web workers
    // Logger callbacks cannot be cloned when passed to web workers
    // OCR will still work, but without real-time progress updates
    // We'll update progress to 100% when complete
    if (onProgress) {
      onProgress(0); // Start at 0%
    }

    const { data: { text } } = await workerInstance.recognize(imageSource);

    // Update progress to 100% when complete
    if (onProgress) {
      onProgress(100);
    }

    // Clean up the extracted text
    const cleanedText = text.trim();

    if (!cleanedText || cleanedText.length === 0) {
      throw new Error('No text could be extracted from the image. The image may not contain readable text.');
    }

    return cleanedText;
  } catch (error: any) {
    console.error('OCR Error:', error);

    // Provide user-friendly error messages
    if (error.message?.includes('No text')) {
      throw new Error('No text could be extracted from the image. Please ensure the image contains clear, readable text.');
    }

    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      throw new Error('Failed to load OCR engine. Please check your internet connection and try again.');
    }

    throw new Error(`Failed to extract text from image: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Check if a file is an image type
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} True if the file is an image
 */
export function isImageFile(fileType: string): boolean {
  if (!fileType) return false;
  return fileType.startsWith('image/');
}

/**
 * Check if a file type is supported for OCR
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} True if OCR can process this file type
 */
export function isOCRSupported(fileType: string): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
  ];
  return supportedTypes.includes(fileType.toLowerCase());
}

/**
 * Terminate the OCR worker (cleanup)
 * Call this when the component unmounts or when done with OCR
 */
export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

