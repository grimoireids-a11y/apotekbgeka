import { createApiApp } from '../server/apiApp.js';

const app = createApiApp();

export default function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    console.error('Vercel API handler error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses permintaan API.' });
  }
}
