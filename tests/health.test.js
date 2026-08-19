import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/server.js';
describe('health API', () => {
    it('reports the service and default scan interval', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.scanIntervalMinutes).toBe(30);
    });
});
