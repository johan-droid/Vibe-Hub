import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, Search, Clock, FolderGit2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { Button } from '../../shared/components/Button';
import { api } from '../../../services/api';

export default function ChatHistorySidebar() {
  const { 
    chatSessions, 
    setChatSessions,
    activeSessionId, 
    setActiveSession,
    linkedProjects,
    user
  } = useStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await api.getChatSessions();
        if (res.success) {
          setChatSessions(res.sessions);
        }
      } catch (err) {
        console.error('Failed to fetch chat sessions:', err);
      }
    };
    if (user) {
      fetchSessions();
    }
  }, [user, setChatSessions]);

  const handleNewSession = async () => {
    try {
      const res = await api.createChatSession('New Chat');
      if (res.success) {
        setChatSessions([res.session, ...chatSessions]);
        setActiveSession(res.session.id);
        useStore.setState({ messages: [] });
      }
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      setActiveSession(sessionId);
      const res = await api.getChatMessages(sessionId);
      if (res.success) {
        // Transform backend messages to frontend format
        const formatted = res.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          thoughts: m.thoughts || [],
          timestamp: m.created_at
        }));
        useStore.setState({ messages: formatted });
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  };

  const filteredSessions = useMemo(() => {
    if (!query.trim()) return chatSessions;
    const normalized = query.trim().toLowerCase();
    return chatSessions.filter((chat) =>
      String(chat.title || 'New Chat').toLowerCase().includes(normalized)
    );
  }, [chatSessions, query]);

  return (
    <div className="flex h-full flex-col bg-surface-container-lowest text-on-surface">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant/30">
        <Button 
          variant="filled" 
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl shadow-lg shadow-primary/10"
          onClick={handleNewSession}
        >
          <Plus size={18} />
          <span className="text-sm font-bold tracking-tight">New Session</span>
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats..."
            className="w-full h-9 bg-surface-container-low border border-outline-variant/20 rounded-lg pl-9 pr-4 text-xs font-medium focus:outline-none focus:border-primary/40 focus:bg-surface-container-lowest transition-all"
          />
        </div>
      </div>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-none">
        {/* Active Projects */}
        {linkedProjects.length > 0 && (
          <div className="mb-6">
            <h3 className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Projects</h3>
            <div className="space-y-1">
              {linkedProjects.map(project => (
                <button
                  type="button"
                  aria-label={`Open project ${project.name}`}
                  key={project.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container-low group transition-colors text-left"
                >
                  <FolderGit2 size={16} className="text-primary/60 group-hover:text-primary" />
                  <span className="text-xs font-bold text-on-surface-variant group-hover:text-on-surface truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent History */}
        <div>
          <h3 className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">History</h3>
          <div className="space-y-1">
            {filteredSessions.length > 0 ? (
              filteredSessions.map(chat => (
                <button
                  type="button"
                  aria-label={`Load chat session ${chat.title || 'New Chat'}`}
                  key={chat.id}
                  onClick={() => loadSession(chat.id)}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg group transition-colors text-left ${activeSessionId === chat.id ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low'}`}
                >
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className={`${activeSessionId === chat.id ? 'text-primary' : 'text-on-surface-variant/40 group-hover:text-primary/60'} shrink-0`} />
                    <span className={`text-xs font-medium truncate ${activeSessionId === chat.id ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{chat.title || 'New Chat'}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-8 text-center">
                <Clock size={24} className="mx-auto mb-3 text-on-surface-variant/20" />
                <p className="text-[11px] font-medium text-on-surface-variant/40">
                  {query.trim() ? 'No chats match this search' : 'No recent activity'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low/20">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-on-surface truncate">{user?.name || 'Operator'}</p>
            <p className="text-[10px] font-medium text-on-surface-variant/60 truncate">{user?.email || 'Free Tier'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
