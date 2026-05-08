import { Router, type Request, type Response, type NextFunction } from 'express';
import { authGuard } from '@middlewares/authGuard';
import { NotificationsService } from './notifications.service';

const router = Router();
const svc = new NotificationsService();

// ── Listing ──────────────────────────────────────────────────────────────────
router.get('/', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursor, limit, type } = req.query as Record<string, string | undefined>;
    res.json(await svc.list(req.user!.id, cursor, limit, type));
  } catch (e) { next(e); }
});

router.get('/unread-count', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.unreadCount(req.user!.id)); } catch (e) { next(e); }
});

// ── Preferences (must be before /:id routes to avoid param conflicts) ─────────
router.get('/preferences', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getPreferences(req.user!.id)); } catch (e) { next(e); }
});

router.patch('/preferences/:type', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') { res.status(400).json({ error: 'enabled (boolean) is required' }); return; }
    res.json(await svc.setPreference(req.user!.id, String(req.params.type), enabled));
  } catch (e) { next(e); }
});

router.put('/preferences', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferences } = req.body as { preferences?: { type: string; enabled: boolean }[] };
    if (!Array.isArray(preferences)) { res.status(400).json({ error: 'preferences array is required' }); return; }
    res.json(await svc.setAllPreferences(req.user!.id, preferences));
  } catch (e) { next(e); }
});

// ── Read / Delete ─────────────────────────────────────────────────────────────
router.post('/read-all', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.markAllRead(req.user!.id); res.status(204).end(); } catch (e) { next(e); }
});

router.delete('/read', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.deleteAllRead(req.user!.id); res.status(204).end(); } catch (e) { next(e); }
});

router.post('/:id/read', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.markOneRead(req.user!.id, String(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
});

router.delete('/:id', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.deleteOne(req.user!.id, String(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
});

export { router as notificationsRouter };
