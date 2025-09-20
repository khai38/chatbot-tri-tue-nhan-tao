export interface Source {
  id: string;
  title: string;
  fileName?: string;
  content: {
    mimeType: string;
    data: string; // Can be raw text or base64 encoded data
  };
}

export interface Citation {
  sourceId: string;
  sourceTitle: string;
  quote: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  citations?: Citation[];
}

export interface Note {
  id:string;
  content: string;
  sourceMessageId: string;
}