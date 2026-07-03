import { Router } from 'express';
import { createChatSession, getChatSessions, getChatSession, addChatMessage, getChatMessages } from '../db.js';

export const chatRouter = Router();

// GET /api/v6/chat/sessions
chatRouter.get('/sessions', async (req, res) => {
  try {
    const sessions = await getChatSessions(req.user.id);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('[ChatRoutes] Error fetching sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chat sessions' });
  }
});

// POST /api/v6/chat/sessions
chatRouter.post('/sessions', async (req, res) => {
  try {
    const { title } = req.body;
    const session = await createChatSession(req.user.id, title);
    res.json({ success: true, session });
  } catch (error) {
    console.error('[ChatRoutes] Error creating session:', error);
    res.status(500).json({ success: false, error: 'Failed to create chat session' });
  }
});

// GET /api/v6/chat/sessions/:id/messages
chatRouter.get('/sessions/:id/messages', async (req, res) => {
  try {
    const session = await getChatSession(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const messages = await getChatMessages(req.params.id);
    res.json({ success: true, messages });
  } catch (error) {
    console.error('[ChatRoutes] Error fetching messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// POST /api/v6/chat/sessions/:id/messages
chatRouter.post('/sessions/:id/messages', async (req, res) => {
  try {
    const session = await getChatSession(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const { role, content, thoughts } = req.body;
    if (!role || !content) {
      return res.status(400).json({ success: false, error: 'role and content are required' });
    }

    const message = await addChatMessage(req.params.id, role, content, thoughts || []);
    res.json({ success: true, message });
  } catch (error) {
    console.error('[ChatRoutes] Error adding message:', error);
    res.status(500).json({ success: false, error: 'Failed to add message' });
  }
});
