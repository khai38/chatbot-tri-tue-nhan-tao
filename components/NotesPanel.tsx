

import React from 'react';
import type { Note } from '../types';
import { PinIcon, TrashIcon } from './Icons';

interface NotesPanelProps {
  notes: Note[];
  onDeleteNote: (id: string) => void;
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


const NotesPanel: React.FC<NotesPanelProps> = ({ notes, onDeleteNote }) => {
  return (
    <div className="bg-gray-100 flex flex-col h-full">
      <div className="p-4">
        <h2 className="text-xl font-bold text-[#161D6F] flex items-center gap-2">
            <PinIcon className="w-6 h-6"/>
            Ghi chú
        </h2>
      </div>

      <div className="flex-grow overflow-y-auto p-4">
        {notes.length === 0 && (
          <div className="text-center text-slate-500 p-8">
            <p className="font-medium">Chưa có ghi chú nào được lưu.</p>
            <p className="text-sm mt-1">Nhấn vào biểu tượng ghim trên câu trả lời của AI để lưu lại đây.</p>
          </div>
        )}
        <ul className="space-y-4">
          {notes.map(note => (
            <li key={note.id} className="neumorph-raised p-4 group text-sm relative">
                <button 
                  onClick={() => onDeleteNote(note.id)} 
                  className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Xóa ghi chú"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed"><FormattedText text={note.content} /></p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default NotesPanel;