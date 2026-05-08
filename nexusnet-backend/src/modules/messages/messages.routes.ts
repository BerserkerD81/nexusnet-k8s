import { Router, type Request, type Response, type NextFunction } from 'express';
import { authGuard } from '@middlewares/authGuard';
import { uploadMiddleware } from '@middlewares/uploadMiddleware';
import { successResponse } from '@utils/http';
import { uploadsService } from '@services/uploads.service';
import { MessagesService } from './messages.service';

const router = Router();
const svc = new MessagesService();

// GET  /api/v1/messages/conversations
router.get('/conversations', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(successResponse(await svc.listConversations(req.user!.id))); } catch (e) { next(e); }
});

// POST /api/v1/messages/conversations  { otherUserId }
router.post('/conversations', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { otherUserId } = req.body as { otherUserId?: string };
    if (!otherUserId) { res.status(400).json({ error: 'otherUserId is required' }); return; }
    res.status(201).json(successResponse(await svc.getOrCreateDm(req.user!.id, otherUserId), 'Conversation ready'));
  } catch (e) { next(e); }
});

// POST /api/v1/messages/conversations/:conversationId/keys
router.post('/conversations/:conversationId/keys', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicKey } = req.body as { publicKey?: string };
    if (!publicKey) { res.status(400).json({ error: 'publicKey is required' }); return; }
    await svc.upsertPublicKey(req.user!.id, String(req.params.conversationId), publicKey);
    res.status(204).end();
  } catch (e) { next(e); }
});

// GET  /api/v1/messages/conversations/:conversationId/keys
router.get('/conversations/:conversationId/keys', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(successResponse(await svc.getConversationKeys(String(req.params.conversationId), req.user!.id))); } catch (e) { next(e); }
});

// GET  /api/v1/messages/conversations/:conversationId/messages
router.get('/conversations/:conversationId/messages', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursor, limit } = req.query as Record<string, string | undefined>;
    const result = await svc.listMessages(String(req.params.conversationId), req.user!.id, cursor, limit);
    res.json(successResponse(result.items, 'Messages loaded', result.pagination));
  } catch (e) { next(e); }
});

// POST /api/v1/messages/conversations/:conversationId/messages  (plaintext / image upload)
router.post('/conversations/:conversationId/messages', authGuard, uploadMiddleware.array('images', 1), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, mediaUrl, messageType } = req.body as {
      content?: string; mediaUrl?: string; messageType?: 'TEXT' | 'IMAGE' | 'VIDEO';
    };
    const files = Array.isArray(req.files) ? req.files : [];
    const uploadedMediaUrls = files.length > 0 ? await uploadsService.processImageFiles(files as Express.Multer.File[]) : [];
    const resolvedMediaUrl = uploadedMediaUrls[0] ?? mediaUrl;
    if (!content && !resolvedMediaUrl) { res.status(400).json({ error: 'content or mediaUrl is required' }); return; }
    res.status(201).json(successResponse(
      await svc.sendMessage(String(req.params.conversationId), req.user!.id, {
        content: content ?? '',
        mediaUrl: resolvedMediaUrl,
        messageType: messageType ?? (resolvedMediaUrl ? 'IMAGE' : 'TEXT')
      }), 'Message sent'
    ));
  } catch (e) { next(e); }
});

// POST /api/v1/messages/conversations/:conversationId/messages/encrypted
router.post('/conversations/:conversationId/messages/encrypted', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { iv, ciphertext, authTag, mediaUrl, messageType } = req.body as {
      iv?: string; ciphertext?: string; authTag?: string;
      mediaUrl?: string; messageType?: 'TEXT' | 'IMAGE' | 'VIDEO';
    };
    if (!iv || !ciphertext || !authTag) {
      res.status(400).json({ error: 'iv, ciphertext and authTag are required' }); return;
    }
    res.status(201).json(successResponse(
      await svc.sendEncryptedMessage(
        String(req.params.conversationId), req.user!.id,
        { iv, ciphertext, authTag }, mediaUrl, messageType ?? 'TEXT'
      ), 'Encrypted message sent'
    ));
  } catch (e) { next(e); }
});

// PUT  /api/v1/messages/conversations/:conversationId/messages/read
router.put('/conversations/:conversationId/messages/read', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.markRead(String(req.params.conversationId), req.user!.id); res.status(204).end(); } catch (e) { next(e); }
});

// DELETE /api/v1/messages/:messageId
router.delete('/:messageId', authGuard, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.softDelete(String(req.params.messageId), req.user!.id); res.status(204).end(); } catch (e) { next(e); }
});

export { router as messagesRouter };
