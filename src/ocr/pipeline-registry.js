// Pipeline registry — central index of available OCR pipelines.
//
// Android/WebView note:
// Pipelines are statically imported instead of dynamically imported.
// Dynamic import() caused Android to request:
// http://localhost/assets/formula.js
//
// Static imports ensure the pipeline modules are bundled into the APK.

import { formulaPipeline } from './pipelines/formula.js';
import { textPipeline } from './pipelines/text.js';
import { mixedPipeline } from './pipelines/mixed.js';

import { getNativeModelStatus } from './ocr-native.js';

const loaded = new Map();

const loaders = new Map([
  ['formula', () => Promise.resolve(formulaPipeline)],
  ['text', () => Promise.resolve(textPipeline)],
  ['mixed', () => Promise.resolve(mixedPipeline)],
]);

/**
 * Register a pipeline at runtime (for third-party or dynamic pipelines).
 *
 * @param {string} name
 * @param {import('./pipeline.js').OcrPipeline | function} pipelineOrLoader
 */
export function registerPipeline(name, pipelineOrLoader) {
  if (typeof pipelineOrLoader === 'function') {
    loaders.set(name, pipelineOrLoader);
  } else {
    loaded.set(name, pipelineOrLoader);
    loaders.delete(name);
  }
}

/**
 * Get a pipeline by id.
 *
 * @param {string} id
 * @returns {Promise<import('./pipeline.js').OcrPipeline | undefined>}
 */
export async function getPipeline(id) {
  if (loaded.has(id)) return loaded.get(id);

  const loader = loaders.get(id);

  if (!loader) return undefined;

  const pipeline = await loader();

  if (pipeline) {
    loaded.set(id, pipeline);
  }

  return pipeline;
}

/**
 * List all registered pipeline ids (loaded + not-yet-loaded).
 *
 * @returns {string[]}
 */
export function listPipelines() {
  return [...new Set([...loaders.keys(), ...loaded.keys()])];
}

/**
 * Get all loaded pipelines with their metadata.
 *
 * @returns {Array<Object>}
 */
export async function getPipelineInfo() {
  const ids = listPipelines();
  const infos = [];

  for (const id of ids) {
    const p = await getPipeline(id);

    if (p) {
      infos.push({ ...p.meta });
    }
  }

  return infos;
}

/**
 * Centralized model availability check.
 *
 * @param {string} mode
 * @returns {boolean}
 */
export async function checkPipelineModels(mode) {
  const pipeline = await getPipeline(mode);

  if (!pipeline) return false;

  if (pipeline.meta.requiredModels.length === 0) {
    return true;
  }

  const status = getNativeModelStatus();

  if (!status) return false;

  const modelMap = {
    'formula-det': status.formulaDet,
    'formula-rec': status.formulaRec,
    'text-det': status.textDet,
    'text-rec': status.textRec,
  };

  return pipeline.meta.requiredModels.every(
    model => !!modelMap[model]
  );
}
