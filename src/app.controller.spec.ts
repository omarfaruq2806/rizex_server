import { describe, beforeEach, it, expect } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(() => {
    appService = new AppService();
    appController = new AppController(appService);
  });

  describe('root', () => {
    it('should return health status', () => {
      const health = appController.getHealth();
      expect(health.name).toBe('RizeX API');
      expect(health.status).toBe('operational');
      expect(health.version).toBe('1.0.0');
    });
  });
});
