'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const yaml = require('js-yaml');
const isPlainObject = require('type/plain-object/is');

let refParserModulePromise;

const getRefParserModule = () => {
  if (!refParserModulePromise) {
    refParserModulePromise = import('@apidevtools/json-schema-ref-parser');
  }

  return refParserModulePromise;
};

const getDocumentUrl = (yamlFilePath) => pathToFileURL(path.resolve(yamlFilePath)).href;

const getFileExtension = (documentUrl) => {
  try {
    return path.extname(new URL(documentUrl).pathname).toLowerCase();
  } catch {
    return path.extname(documentUrl).toLowerCase();
  }
};

const splitReference = (absoluteReference) => {
  const hashIndex = absoluteReference.indexOf('#');

  if (hashIndex === -1) {
    return { documentUrl: absoluteReference, pointer: '#' };
  }

  return {
    documentUrl: absoluteReference.slice(0, hashIndex),
    pointer: absoluteReference.slice(hashIndex) || '#',
  };
};

const getJsonPointerValue = (source, pointer) => {
  if (!pointer || pointer === '#') return source;

  if (!pointer.startsWith('#/')) {
    throw new Error(`Unsupported JSON pointer: ${pointer}`);
  }

  let current = source;

  for (const rawSegment of pointer.slice(2).split('/')) {
    const segment = decodeURIComponent(rawSegment).replace(/~1/g, '/').replace(/~0/g, '~');

    if (current == null || !(segment in current)) {
      throw new Error(`JSON Pointer points to missing location: ${pointer}`);
    }

    current = current[segment];
  }

  return current;
};

const cloneValue = (value) => {
  if (value == null || typeof value !== 'object') return value;
  return structuredClone(value);
};

const readExternalDocument = async (documentUrl) => {
  const { FileResolver, HTTPResolver } = await getRefParserModule();
  // Preserve historical json-refs behavior: external HTTP(S) refs, including
  // localhost/private-network targets, remain allowed for this compatibility API.
  const httpResolver = { ...HTTPResolver, safeUrlResolver: false };
  const fileInfo = {
    url: documentUrl,
    extension: getFileExtension(documentUrl),
    hash: '',
  };

  if (FileResolver.canRead(fileInfo)) {
    return FileResolver.read(fileInfo);
  }

  if (httpResolver.canRead(fileInfo)) {
    return httpResolver.read(fileInfo);
  }

  throw new Error(`Unsupported $ref protocol: ${documentUrl}`);
};

const loadExternalDocument = (documentUrl, state) => {
  if (!state.documents.has(documentUrl)) {
    state.documents.set(
      documentUrl,
      readExternalDocument(documentUrl).then((document) =>
        yaml.load(Buffer.isBuffer(document) ? document.toString('utf8') : String(document))
      )
    );
  }

  return state.documents.get(documentUrl);
};

const materializeRef = async (refObject, context) => {
  if (!context.resolveLocalRefs && refObject.$ref.startsWith('#')) {
    return cloneValue(refObject);
  }

  const absoluteReference = new URL(refObject.$ref, context.documentUrl).href;

  if (context.state.activeReferences.has(absoluteReference)) {
    return cloneValue(refObject);
  }

  if (context.state.references.has(absoluteReference)) {
    return context.state.references.get(absoluteReference);
  }

  context.state.activeReferences.add(absoluteReference);

  try {
    const { documentUrl, pointer } = splitReference(absoluteReference);
    const document = await loadExternalDocument(documentUrl, context.state);
    const target = getJsonPointerValue(document, pointer);
    const resolvedTarget = await materializeTarget(
      target,
      documentUrl,
      context.state,
      absoluteReference
    );

    context.state.references.set(absoluteReference, resolvedTarget);
    return resolvedTarget;
  } catch {
    return cloneValue(refObject);
  } finally {
    context.state.activeReferences.delete(absoluteReference);
  }
};

const materializeTarget = async (target, documentUrl, state, absoluteReference) => {
  if (state.references.has(absoluteReference)) {
    return state.references.get(absoluteReference);
  }

  if (Array.isArray(target)) {
    const resolvedTarget = [];
    state.references.set(absoluteReference, resolvedTarget);

    for (const item of target) {
      resolvedTarget.push(
        await materializeValue(item, { documentUrl, resolveLocalRefs: true, state })
      );
    }

    return resolvedTarget;
  }

  if (isPlainObject(target)) {
    if (typeof target.$ref === 'string') {
      const resolvedTarget = await materializeRef(target, {
        documentUrl,
        resolveLocalRefs: true,
        state,
      });

      state.references.set(absoluteReference, resolvedTarget);
      return resolvedTarget;
    }

    const resolvedTarget = {};
    state.references.set(absoluteReference, resolvedTarget);

    for (const [key, value] of Object.entries(target)) {
      resolvedTarget[key] = await materializeValue(value, {
        documentUrl,
        resolveLocalRefs: true,
        state,
      });
    }

    return resolvedTarget;
  }

  const resolvedTarget = cloneValue(target);
  state.references.set(absoluteReference, resolvedTarget);
  return resolvedTarget;
};

const materializeValue = async (value, context) => {
  if (Array.isArray(value)) {
    const resolvedValue = [];

    for (const item of value) {
      resolvedValue.push(await materializeValue(item, context));
    }

    return resolvedValue;
  }

  if (isPlainObject(value)) {
    if (typeof value.$ref === 'string') {
      return materializeRef(value, context);
    }

    const resolvedValue = {};

    for (const [key, childValue] of Object.entries(value)) {
      resolvedValue[key] = await materializeValue(childValue, context);
    }

    return resolvedValue;
  }

  return cloneValue(value);
};

class YamlParser {
  constructor(serverless) {
    this.serverless = serverless;
  }

  async parse(yamlFilePath) {
    const root = this.serverless.utils.readFileSync(yamlFilePath);

    return materializeValue(root, {
      documentUrl: getDocumentUrl(yamlFilePath),
      resolveLocalRefs: false,
      state: {
        activeReferences: new Set(),
        documents: new Map(),
        references: new Map(),
      },
    });
  }
}

module.exports = YamlParser;
