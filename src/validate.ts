import type { ChatConfig } from './types.js';

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export function validateConfig(config: unknown): asserts config is ChatConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError('Config must be an object');
  }

  const cfg = config as Partial<ChatConfig>;

  if (typeof cfg.authenticate !== 'function') {
    throw new ConfigValidationError('authenticate function is required');
  }

  if (typeof cfg.saveMessage !== 'function') {
    throw new ConfigValidationError('saveMessage function is required');
  }

  if (typeof cfg.getMessages !== 'function') {
    throw new ConfigValidationError('getMessages function is required');
  }

  if (typeof cfg.getConversations !== 'function') {
    throw new ConfigValidationError('getConversations function is required');
  }

  if (typeof cfg.getUser !== 'function') {
    throw new ConfigValidationError('getUser function is required');
  }

  if (typeof cfg.searchUsers !== 'function') {
    throw new ConfigValidationError('searchUsers function is required');
  }

  if (typeof cfg.searchMessages !== 'function') {
    throw new ConfigValidationError('searchMessages function is required');
  }

  if (cfg.onEvent !== undefined && typeof cfg.onEvent !== 'function') {
    throw new ConfigValidationError('onEvent must be a function if provided');
  }
}