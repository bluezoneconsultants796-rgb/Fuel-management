import os from 'os';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { OcrInput, OcrProvider, OcrTextResult } from '../ocr.types';
import { logger } from '../../../utils/logger';

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

/**
 * Reused singleton worker — creating a worker loads the language model, so we
 * keep it alive across requests instead of paying that cost per slip.
 * If initialisation fails the cached promise is cleared so the NEXT request
 * retries, instead of OCR staying broken until the server restarts.
 */
let workerPromise: Promise<TesseractWorker> | null = null;

/**
 * The English language model ships with the app (@tesseract.js-data/eng), so
 * OCR works offline and never depends on a CDN being reachable. Without this,
 * every fresh deploy (e.g. Railway's ephemeral disk) re-downloaded the model.
 */
function languageDataDir(): string {
  return path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
}

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    logger.info('OCR: starting Tesseract worker...');
    workerPromise = createWorker('eng', 1, {
      langPath: languageDataDir(),
      gzip: true,
      cachePath: os.tmpdir(),
      // IMPORTANT: without an errorHandler, tesseract.js re-throws worker
      // failures as an *uncaught exception*, which would shut the whole API
      // down. Log it and let the pending promise reject instead.
      errorHandler: (error: unknown) => {
        logger.error(`OCR worker error: ${String(error)}`);
        workerPromise = null;
      }
    }).catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/** A single worker handles one image at a time — queue concurrent requests. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export const tesseractProvider: OcrProvider = {
  name: 'tesseract',
  async extractText(input: OcrInput): Promise<OcrTextResult> {
    if (input.mimeType === 'application/pdf') {
      throw new Error('Tesseract provider cannot read PDFs directly; PDFs are handled by the pdf-text provider.');
    }
    return enqueue(async () => {
      const worker = await getWorker();
      // Buffers are valid Tesseract image sources; cast for the type union.
      const image = input.buffer as unknown as Parameters<TesseractWorker['recognize']>[0];
      const { data } = await worker.recognize(image);
      return {
        text: data.text ?? '',
        confidence: typeof data.confidence === 'number' ? data.confidence : null
      };
    });
  }
};
