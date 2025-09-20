

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Source, Note } from '../types';
import { SendIcon, PinIcon, BrainCircuitIcon, UserIcon, BookIcon } from './Icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  sources: Source[];
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onAddNote: (message: ChatMessage) => void;
}

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index}>{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </>
    );
};


const ChatPanel: React.FC<ChatPanelProps> = ({ messages, sources, notes, isLoading, error, onSendMessage, onAddNote }) => {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };
  
  const isMessagePinned = (messageId: string) => {
      return notes.some(note => note.sourceMessageId === messageId);
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto space-y-8">
            {messages.length === 0 && !isLoading && (
                <div className="text-center text-slate-600 p-10 neumorph-pressed">
                    <BrainCircuitIcon className="w-20 h-20 mx-auto text-[#161D6F] mb-4"/>
                    <h2 className="text-2xl font-bold text-[#161D6F]">Sổ Tay Nguồn AI</h2>
                    <p className="mt-2 max-w-md mx-auto">Thêm nguồn ở bảng bên trái và đặt câu hỏi ở đây để nhận câu trả lời dựa trên tài liệu của bạn.</p>
                </div>
            )}

            {messages.map(msg => (
                <div key={msg.id} className={`flex items-start gap-4 chat-message ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center neumorph-raised`}>
                    {msg.role === 'user' ? <UserIcon className="w-6 h-6 text-slate-700" /> : <BrainCircuitIcon className="w-6 h-6 text-slate-700" />}
                </div>
                <div className={`px-4 py-3 max-w-2xl neumorph-raised ${msg.role === 'user' ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-800"><FormattedText text={msg.text} /></p>
                    {msg.role === 'model' && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                        <h4 className="flex items-center text-xs font-semibold text-[#161D6F] mb-3 uppercase tracking-wider">
                            <BookIcon className="w-4 h-4 mr-1.5" />
                            Trích dẫn
                        </h4>
                        <div className="space-y-3">
                        {msg.citations.map((citation, index) => (
                            <blockquote key={index} className="neumorph-pressed p-3 text-sm border-l-4 border-slate-300">
                            <p className="text-slate-600 italic">"{citation.quote}"</p>
                            <footer className="text-right text-xs mt-2 font-medium text-slate-500 flex items-center justify-end gap-1.5">
                                <BookIcon className="w-3 h-3"/>
                                {citation.sourceTitle}
                            </footer>
                            </blockquote>
                        ))}
                        </div>
                    </div>
                    )}
                    {msg.role === 'model' && (
                    <div className="text-right -mb-2 -mr-2 mt-1">
                        <button 
                            onClick={() => onAddNote(msg)}
                            disabled={isMessagePinned(msg.id)}
                            className="p-2 rounded-full text-slate-500 transition-colors disabled:text-amber-600 disabled:cursor-not-allowed enabled:hover:text-amber-600"
                            aria-label="Ghim phản hồi vào ghi chú"
                        >
                        <PinIcon className="w-4 h-4" />
                        </button>
                    </div>
                    )}
                </div>
                </div>
            ))}
            
            {isLoading && (
                <div className="flex items-start gap-4 flex-row chat-message">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center neumorph-raised">
                        <BrainCircuitIcon className="w-6 h-6 text-slate-700" />
                    </div>
                    <div className="px-4 py-3 max-w-lg neumorph-raised animate-pulse">
                        <div className="flex items-center space-x-2 text-slate-600">
                            <div className="w-2.5 h-2.5 bg-slate-400 rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-slate-400 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2.5 h-2.5 bg-slate-400 rounded-full" style={{ animationDelay: '0.4s' }}></div>
                            <span className="text-sm font-medium">Đang suy nghĩ để cho câu trả lời tối nhất</span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={chatEndRef} />
            </div>
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-slate-200">
        <div className="p-4">
            <div className="max-w-4xl mx-auto">
            {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 neumorph-raised p-2">
                <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={sources.length === 0 ? "Vui lòng thêm nguồn trước" : "Đặt câu hỏi dựa trên các nguồn của bạn..."}
                disabled={isLoading || sources.length === 0}
                className="flex-grow bg-transparent focus:outline-none neumorph-pressed p-3 disabled:cursor-not-allowed text-sm"
                />
                <button
                type="submit"
                disabled={isLoading || !input.trim() || sources.length === 0}
                className="p-3 rounded-full neumorph-raised neumorph-button disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Gửi tin nhắn"
                >
                <SendIcon className="w-5 h-5 text-slate-700" />
                </button>
            </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;