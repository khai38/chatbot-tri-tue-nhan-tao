import React, { useState, useCallback, useEffect } from 'react';
import SourcePanel from './components/SourcePanel';
import ChatPanel from './components/ChatPanel';
import NotesPanel from './components/NotesPanel';
import { querySources } from './services/geminiService';
import type { Source, ChatMessage, Note } from './types';
import { BookIcon, BrainCircuitIcon, PinIcon } from './components/Icons';

// Custom hook to manage state with localStorage
function useLocalStorageState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}


const App: React.FC = () => {
  const [sources, setSources] = useLocalStorageState<Source[]>('ai-notebook-sources', []);
  const [messages, setMessages] = useLocalStorageState<ChatMessage[]>('ai-notebook-messages', []);
  const [notes, setNotes] = useLocalStorageState<Note[]>('ai-notebook-notes', []);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for mobile view navigation
  const [activePanel, setActivePanel] = useState<'sources' | 'chat' | 'notes'>('chat');


  const addSource = (title: string, content: { mimeType: string, data: string }, fileName?: string) => {
    const newSource: Source = { id: `source-${Date.now()}`, title, content, fileName };
    setSources(prev => [...prev, newSource]);
    setActivePanel('chat'); // Switch to chat after adding a source on mobile
  };
  
  const deleteSource = (id: string) => {
    setSources(prev => prev.filter(source => source.id !== id));
  };

  const addNote = (message: ChatMessage) => {
    if (notes.some(note => note.sourceMessageId === message.id)) return; // Avoid duplicate notes
    const newNote: Note = {
      id: `note-${Date.now()}`,
      content: message.text,
      sourceMessageId: message.id
    };
    setNotes(prev => [newNote, ...prev]);
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const startNewChat = () => {
    if (window.confirm("Bạn có chắc chắn muốn bắt đầu một cuộc trò chuyện mới không? Lịch sử trò chuyện hiện tại sẽ bị xóa, nhưng các ghi chú của bạn sẽ được giữ lại.")) {
        setMessages([]);
        setActivePanel('chat'); // Switch to chat after starting new chat
    }
  };

  const sendMessage = useCallback(async (question: string) => {
    setError(null);
    const userMessage: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', text: question };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { answer, citations: rawCitations } = await querySources(question, sources);
      
      const citations = rawCitations.map(cit => {
        const source = sources.find(s => s.id === cit.sourceId);
        return { ...cit, sourceTitle: source?.title || 'Nguồn không xác định' };
      });

      const modelMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        text: answer,
        citations: citations
      };
      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsLoading(false);
    }
  }, [sources, setMessages]);

  const Header = () => (
    <header className="flex-shrink-0 p-4 neumorph-raised z-10">
        <h1 className="text-lg sm:text-xl font-bold text-[#161D6F] text-center flex items-center justify-center gap-3">
            <BrainCircuitIcon className="w-7 h-7 text-[#161D6F]" />
            <span>Chatbot Tra Cứu Thông Tin - Tin Học Sao Việt</span>
        </h1>
    </header>
  );

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100">
      <Header />
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-[350px_1fr_350px] min-h-0">
        {/* Desktop Layout */}
        <div className="hidden lg:block h-full">
          <SourcePanel sources={sources} onAddSource={addSource} onDeleteSource={deleteSource} onStartNewChat={startNewChat} />
        </div>
        
        <main className="hidden lg:flex h-full flex-col">
          <ChatPanel 
            messages={messages} 
            sources={sources}
            notes={notes}
            isLoading={isLoading} 
            error={error}
            onSendMessage={sendMessage}
            onAddNote={addNote}
          />
        </main>
        
        <div className="hidden lg:block h-full">
          <NotesPanel notes={notes} onDeleteNote={deleteNote}/>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden h-full pb-24">
          <div className={`${activePanel === 'sources' ? 'block' : 'hidden'} h-full`}>
              <SourcePanel sources={sources} onAddSource={addSource} onDeleteSource={deleteSource} onStartNewChat={startNewChat} />
          </div>
          <div className={`${activePanel === 'chat' ? 'block' : 'hidden'} h-full`}>
              <ChatPanel 
                messages={messages} 
                sources={sources}
                notes={notes}
                isLoading={isLoading} 
                error={error}
                onSendMessage={sendMessage}
                onAddNote={addNote}
              />
          </div>
          <div className={`${activePanel === 'notes' ? 'block' : 'hidden'} h-full`}>
              <NotesPanel notes={notes} onDeleteNote={deleteNote}/>
          </div>
        </div>

        {/* Mobile Bottom Bar (Nav + Footer) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-slate-200">
            <nav className="grid grid-cols-3 gap-2 p-2">
                <button 
                onClick={() => setActivePanel('sources')} 
                className={`flex flex-col items-center py-2 rounded-lg transition-all ${activePanel === 'sources' ? 'neumorph-pressed' : 'neumorph-raised'}`}
                >
                    <BookIcon className={`w-6 h-6 ${activePanel === 'sources' ? 'text-slate-800' : 'text-slate-600'}`} />
                    <span className={`text-xs mt-1 ${activePanel === 'sources' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>Nguồn</span>
                </button>
                <button 
                onClick={() => setActivePanel('chat')} 
                className={`flex flex-col items-center py-2 rounded-lg transition-all ${activePanel === 'chat' ? 'neumorph-pressed' : 'neumorph-raised'}`}
                >
                    <BrainCircuitIcon className={`w-6 h-6 ${activePanel === 'chat' ? 'text-slate-800' : 'text-slate-600'}`} />
                    <span className={`text-xs mt-1 ${activePanel === 'chat' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>Trò chuyện</span>
                </button>
                <button 
                onClick={() => setActivePanel('notes')} 
                className={`flex flex-col items-center py-2 rounded-lg transition-all ${activePanel === 'notes' ? 'neumorph-pressed' : 'neumorph-raised'}`}
                >
                    <PinIcon className={`w-6 h-6 ${activePanel === 'notes' ? 'text-slate-800' : 'text-slate-600'}`} />
                    <span className={`text-xs mt-1 ${activePanel === 'notes' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>Ghi chú</span>
                </button>
            </nav>
            <footer className="text-center text-xs text-slate-500 pb-2">
                Chatbot Beta - Copyright © 2025 Trung Tâm Tin Học Sao Việt
            </footer>
        </div>
      </div>
    </div>
  );
};

export default App;