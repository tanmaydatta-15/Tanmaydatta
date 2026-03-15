import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppMode, ChatMessage, MessageType, Sender, OfflineModel, UserSettings, GeneratedImage } from './types';
import { GeminiService, STARTUP_MESSAGE, fileToBase64, getMimeType } from './services/geminiService';
import { OFFLINE_MODELS } from './services/offlineModels';
import { UserService, AppState } from './services/userService';

// --- Web Speech API Types ---
interface SpeechRecognitionErrorEvent extends Event { readonly error: string; }
interface SpeechRecognitionEvent extends Event { readonly results: SpeechRecognitionResultList; }
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}
declare global { interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; } }

// --- ICONS ---
const Icons = {
  GeminiStar: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#gemini_grad)" />
      <defs>
        <linearGradient id="gemini_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
    </svg>
  ),
  HF: () => <span className="text-xl">🤗</span>,
  User: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Settings: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Paperclip: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
  Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  Close: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54Z"/></svg>,
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Heart: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-pink-500"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>,
  Sync: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>,
  External: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Puzzle: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2"/><path d="M12 18v2"/><path d="M2 12h2"/><path d="M18 12h2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="m17.7 4.9-1.4 1.4"/><path d="m4.9 17.7 1.4 1.4"/></svg>,
  Voice: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Translate: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>,
  Code: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  Mail: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  Pencil: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>,
  Sort: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-3 3-3-3"/><path d="M12 3v18"/><path d="m9 6 3-3 3 3"/></svg>,
  General: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  Planning: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
};

// --- DATA ---
const QUICK_TASKS = [
  { id: 'summarize', label: 'Summarize', icon: <Icons.Brain />, prompt: 'Can you summarize the following text for me: ' },
  { id: 'translate', label: 'Translate', icon: <Icons.Translate />, prompt: 'Please translate the following to Spanish: ' },
  { id: 'code', label: 'Explain Code', icon: <Icons.Code />, prompt: 'Could you explain how this piece of code works: ' },
  { id: 'plan', label: 'Plan Trip', icon: <Icons.Planning />, prompt: 'Help me plan a 3-day trip to: ' },
  { id: 'email', label: 'Write Email', icon: <Icons.Mail />, prompt: 'Help me write a professional email about: ' },
  { id: 'story', label: 'Creative Story', icon: <Icons.Pencil />, prompt: 'Write a short creative story about: ' },
  { id: 'analyze', label: 'Analyze Data', icon: <Icons.Search />, prompt: 'Analyze the following data points: ' },
];

type SortBy = 'name' | 'likes' | 'downloads';
type SettingsTab = 'general' | 'voice' | 'extensions';

// --- COMPONENTS ---

const Header: React.FC<{
  onOpenSettings: () => void;
  onOpenModelHub: () => void;
  isOffline: boolean;
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}> = ({ onOpenSettings, onOpenModelHub, isOffline, currentMode, onModeChange }) => (
  <header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-40 bg-white/80 dark:bg-[#131314]/80 backdrop-blur-md border-b dark:border-gray-800">
    <div className="flex items-center gap-2">
      <Icons.GeminiStar />
      <span className="text-xl font-medium text-gray-800 dark:text-gray-200">Friday</span>
      <div className={`px-2 py-0.5 rounded-full uppercase font-bold text-[10px] ${isOffline ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
        {isOffline ? 'Offline' : 'Live'}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <div className="hidden lg:flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 mr-2">
        {Object.values(AppMode).map(mode => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`px-3 py-1 text-xs rounded-full transition-all ${currentMode === mode ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {mode}
          </button>
        ))}
      </div>
      <button onClick={onOpenModelHub} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex items-center gap-2 group">
        <Icons.HF />
        <span className="hidden md:inline text-xs font-bold uppercase tracking-wider group-hover:text-black dark:group-hover:text-white transition-colors">Hub</span>
      </button>
      <button onClick={onOpenSettings} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
        <Icons.Settings />
      </button>
    </div>
  </header>
);

const LandingState: React.FC<{ onSuggest: (text: string) => void }> = ({ onSuggest }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-40 animate-fade-in">
    <h1 className="text-4xl md:text-5xl font-semibold mb-8 text-center gemini-gradient">
      Hello, Friday.
    </h1>
    <p className="text-xl text-gray-500 dark:text-gray-400 mb-12 text-center max-w-lg">
      How can I help you today?
    </p>
    <div className="flex gap-4 overflow-x-auto w-full max-w-3xl pb-4 scrollbar-hide no-scrollbar">
      {QUICK_TASKS.slice(0, 4).map(task => (
        <button 
          key={task.id}
          onClick={() => onSuggest(task.prompt)}
          className="bg-gray-50 dark:bg-[#1e1f20] p-4 rounded-xl flex flex-col gap-3 items-start text-left border border-transparent hover:border-blue-500 transition-all group w-44 min-w-[176px] shadow-sm"
        >
          <div className="text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform">{task.icon}</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium line-clamp-2">{task.label} ideas</p>
        </button>
      ))}
    </div>
  </div>
);

const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.sender === Sender.User;
  
  if (message.type === MessageType.Loading) {
    return (
      <div className="flex gap-4 p-6 animate-pulse">
        <div className="mt-1 flex-shrink-0">
          <Icons.GeminiStar />
        </div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-4 p-6 message-appear ${isUser ? 'bg-transparent' : ''}`}>
      <div className="mt-1 flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">U</div>
        ) : (
          <Icons.GeminiStar />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-gray-800 dark:text-gray-200 text-[16px] leading-relaxed whitespace-pre-wrap break-words">
          {message.imageUrl && <img src={message.imageUrl} className="max-w-md w-full rounded-xl mb-4 border dark:border-gray-700 shadow-md" alt="Generated" />}
          {message.text}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.citations.map((c, i) => (
              <a key={i} href={c.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full hover:underline border dark:border-gray-700 transition-colors">
                {c.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(UserService.loadState);
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.Chat);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isListening, setIsListening] = useState(false);
  const [isModelHubOpen, setIsModelHubOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [hubSortBy, setHubSortBy] = useState<SortBy>('downloads');
  const [hubSearchQuery, setHubSearchQuery] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [downloadingStatus, setDownloadingStatus] = useState<Record<string, number>>({});
  const [hfModelsData, setHfModelsData] = useState<Record<string, { likes: number, downloads: number }>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const { settings, chatHistory, downloadedModels: downloadedModelIds } = appState;
  const downloadedModels = useMemo(() => new Set(downloadedModelIds), [downloadedModelIds]);

  useEffect(() => { UserService.saveState(appState); }, [appState]);
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }
  }, []);

  const fetchHubStats = async () => {
    setIsSyncing(true);
    try {
      const results: Record<string, { likes: number, downloads: number }> = {};
      for (const model of OFFLINE_MODELS) {
        try {
          const resp = await fetch(`https://huggingface.co/api/models/${model.hfRepo}`);
          if (resp.ok) {
            const data = await resp.json();
            results[model.hfRepo] = {
              likes: data.likes || 0,
              downloads: data.downloads || 0
            };
          }
        } catch (e) {
          console.error(`Failed to sync ${model.hfRepo}`, e);
        }
      }
      setHfModelsData(results);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isModelHubOpen) fetchHubStats();
  }, [isModelHubOpen]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setAppState(prev => ({ ...prev, chatHistory: [...prev.chatHistory, newMessage] }));
  }, []);

  const handleSend = async (text: string, file?: File) => {
    if (!text && !file) return;
    setInputText('');
    setAttachedFile(null);
    addMessage({ sender: Sender.User, type: MessageType.Text, text });
    setIsLoading(true);

    const effectiveOffline = isOffline || settings.forceOffline;

    try {
      if (effectiveOffline) {
        const model = OFFLINE_MODELS.find(m => m.category === currentMode);
        if (model && downloadedModels.has(model.id)) {
          await new Promise(r => setTimeout(r, 1200));
          const isHighPerf = model.id.includes('27b');
          const responseText = `[HF EDGE INFERENCE]\n\nProcessing Locally: ${model.name}\n\nFriday Status: On-device private execution enabled.\n\n(Simulated local execution on your browser's NPU sandbox for ${model.hfRepo}.)`;
          addMessage({ sender: Sender.AI, type: MessageType.Text, text: responseText });
          setIsLoading(false);
          return;
        } else {
          throw new Error(`Offline Mode: Please download a compatible model for "${currentMode}" from the Friday Hub to use Friday without internet.`);
        }
      }

      let response;
      switch (currentMode) {
        case AppMode.Chat:
        case AppMode.Audio:
        case AppMode.Task:
          response = await GeminiService.generateChatResponse(text, currentMode, settings);
          addMessage({ sender: Sender.AI, type: MessageType.Text, text: response });
          break;
        case AppMode.Search:
          const sResp = await GeminiService.generateSearchResponse(text, settings);
          addMessage({ sender: Sender.AI, type: MessageType.Text, text: sResp.text, citations: sResp.citations });
          break;
        case AppMode.ImageGen:
          let imgB64, mime;
          if (file) { imgB64 = await fileToBase64(file); mime = getMimeType(file); }
          response = await GeminiService.generateImage(text, imgB64, mime);
          addMessage({ sender: Sender.AI, type: MessageType.Image, text: `Generated: ${text}`, imageUrl: response });
          break;
        case AppMode.ImageAnalysis:
          if (!file) throw new Error("Please attach an image for analysis.");
          const b64 = await fileToBase64(file);
          const m = getMimeType(file);
          response = await GeminiService.analyzeImage(text, b64, m);
          addMessage({ sender: Sender.AI, type: MessageType.Text, text: response });
          break;
      }
    } catch (e) {
      addMessage({ sender: Sender.AI, type: MessageType.Error, text: (e as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadModel = (modelId: string) => {
    if (downloadedModels.has(modelId) || downloadingStatus[modelId] !== undefined) return;
    setDownloadingStatus(prev => ({ ...prev, [modelId]: 0 }));
    const model = OFFLINE_MODELS.find(m => m.id === modelId);
    const step = model ? Math.max(0.5, 3 - parseFloat(model.size) / 5) : 1;
    const interval = setInterval(() => {
      setDownloadingStatus(prev => {
        const current = prev[modelId] || 0;
        if (current >= 100) {
          clearInterval(interval);
          setAppState(s => ({ ...s, downloadedModels: [...s.downloadedModels, modelId] }));
          const next = { ...prev };
          delete next[modelId];
          return next;
        }
        return { ...prev, [modelId]: Math.min(100, current + step * (Math.random() + 0.2)) };
      });
    }, 100);
  };

  const handleUninstallModel = (modelId: string) => {
    if (!downloadedModels.has(modelId)) return;
    if (window.confirm(`Are you sure you want to remove ${modelId} from local storage?`)) {
        setAppState(prev => ({
            ...prev,
            downloadedModels: prev.downloadedModels.filter(id => id !== modelId)
        }));
    }
  };

  const startListening = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    recognitionRef.current = new SpeechRec();
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (e: any) => setInputText(e.results[0][0].transcript);
    recognitionRef.current.start();
  };

  const parseHFValue = (val: string | number | undefined): number => {
    if (val === undefined) return 0;
    if (typeof val === 'number') return val;
    const cleaned = val.toLowerCase().replace(/[^0-9.mk]/g, '');
    if (cleaned.endsWith('m')) return parseFloat(cleaned) * 1000000;
    if (cleaned.endsWith('k')) return parseFloat(cleaned) * 1000;
    return parseFloat(cleaned) || 0;
  };

  const filteredModels = useMemo(() => {
    let filtered = OFFLINE_MODELS;
    if (hubSearchQuery) {
      const query = hubSearchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(query) || m.hfRepo.toLowerCase().includes(query)
      );
    }
    return [...filtered].sort((a, b) => {
      const statsA = hfModelsData[a.hfRepo];
      const statsB = hfModelsData[b.hfRepo];
      if (hubSortBy === 'name') return a.name.localeCompare(b.name);
      if (hubSortBy === 'likes') {
        const likesA = statsA?.likes ?? parseHFValue(a.likes ?? a.stars);
        const likesB = statsB?.likes ?? parseHFValue(b.likes ?? b.stars);
        return likesB - likesA;
      }
      const dlsA = statsA?.downloads ?? parseHFValue(a.downloads);
      const dlsB = statsB?.downloads ?? parseHFValue(b.downloads);
      return dlsB - dlsA;
    });
  }, [hubSearchQuery, hubSortBy, hfModelsData]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory, isLoading]);

  const canSend = inputText.trim().length > 0 || attachedFile !== null;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#131314] transition-colors overflow-hidden">
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onOpenModelHub={() => setIsModelHubOpen(true)}
        isOffline={isOffline || settings.forceOffline}
        currentMode={currentMode}
        onModeChange={setCurrentMode}
      />

      <main ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden pt-16 pb-48 scroll-smooth no-scrollbar">
        {chatHistory.length <= 1 && !isLoading ? (
          <LandingState onSuggest={(t) => handleSend(t)} />
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            {chatHistory.map(m => <MessageItem key={m.id} message={m} />)}
            {isLoading && <MessageItem message={{ id: 'l', sender: Sender.AI, type: MessageType.Loading, text: '', timestamp: '' }} />}
          </div>
        )}
      </main>

      {/* Bottom Bar Container */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-[#131314] via-white/95 dark:via-[#131314]/95 to-transparent z-10">
        <div className="max-w-3xl mx-auto space-y-3">
          
          {/* Quick Task Chip Bar */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 animate-fade-in px-1">
            {QUICK_TASKS.map(task => (
              <button
                key={task.id}
                onClick={() => setInputText(task.prompt)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-500 transition-all active:scale-95"
              >
                {task.icon}
                <span>{task.label}</span>
              </button>
            ))}
          </div>

          {/* Attached File Preview */}
          {attachedFile && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl animate-fade-in-up">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-500"><Icons.Paperclip /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-gray-800 dark:text-gray-200">{attachedFile.name}</p>
                <p className="text-[10px] text-gray-500 font-mono uppercase">{(attachedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => setAttachedFile(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><Icons.Close /></button>
            </div>
          )}

          {/* Input Interface */}
          <div className={`relative flex items-center gap-3 bg-gray-100 dark:bg-[#1e1f20] rounded-[28px] px-5 py-3.5 shadow-sm transition-all focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:shadow-lg focus-within:ring-2 focus-within:ring-blue-500/20 ${isListening ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-[#131314]' : ''}`}>
            <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-blue-500 transition-all active:scale-90" title="Attach File"><Icons.Paperclip /></button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && setAttachedFile(e.target.files[0])} />
            <textarea 
              rows={1}
              placeholder={isListening ? "Listening..." : "Ask Friday anything..."}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 resize-none max-h-32 scrollbar-hide"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(inputText, attachedFile || undefined); } }}
            />
            <div className="flex items-center gap-1">
              <button onClick={isListening ? () => recognitionRef.current?.stop() : startListening} className={`p-2 rounded-full transition-all active:scale-90 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'text-gray-400 hover:text-blue-500'}`}><Icons.Mic /></button>
              <button 
                disabled={!canSend || isLoading} 
                onClick={() => handleSend(inputText, attachedFile || undefined)} 
                className={`p-2.5 rounded-full transition-all ${canSend ? 'bg-blue-500 text-white shadow-md hover:scale-105 active:scale-95' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 opacity-50 cursor-not-allowed'} ${isLoading ? 'animate-pulse' : ''}`}
              >
                <Icons.Send />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Model Hub Modal */}
      {isModelHubOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsModelHubOpen(false)}>
          <div className="bg-white dark:bg-[#1e1f20] rounded-[28px] p-6 w-full max-w-3xl h-[90vh] flex flex-col shadow-2xl border dark:border-gray-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg"><Icons.HF /></div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Friday Hub</h2>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Hugging Face On-Device</p>
                    {isSyncing && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsModelHubOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><Icons.Close /></button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></div>
                <input type="text" placeholder="Search weights..." className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 pl-11 pr-4 text-sm outline-none border-transparent focus:ring-2 ring-blue-500/20" value={hubSearchQuery} onChange={e => setHubSearchQuery(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 border dark:border-gray-700">
                <Icons.Sort />
                <select value={hubSortBy} onChange={e => setHubSortBy(e.target.value as SortBy)} className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-200 outline-none cursor-pointer">
                  <option value="downloads">Downloads</option>
                  <option value="likes">Likes</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
              {filteredModels.map(m => {
                const isDownloaded = downloadedModels.has(m.id);
                const progress = downloadingStatus[m.id];
                const hfStats = hfModelsData[m.hfRepo];
                return (
                  <div key={m.id} className={`p-5 border-2 rounded-2xl transition-all ${isDownloaded ? 'border-green-100 dark:border-green-900/20 bg-green-50/20 dark:bg-green-900/5' : 'border-gray-100 dark:border-gray-800'}`}>
                    <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{m.name}</h3>
                          {m.isRecommended && <span className="bg-yellow-100 dark:bg-yellow-900/30 text-[10px] text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Recommended</span>}
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-mono">{m.size}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{m.description}</p>
                        <div className="flex items-center gap-4 text-[11px] text-gray-500 font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Icons.Download /> {(hfStats ? hfStats.downloads : m.downloads) || '-'}</span>
                          <span className="flex items-center gap-1"><Icons.Heart /> {(hfStats ? hfStats.likes : m.stars) || '-'}</span>
                        </div>
                      </div>
                      <div className="w-full md:w-auto flex flex-col items-center gap-2">
                        {isDownloaded ? (
                          <>
                            <div className="flex items-center gap-2 text-green-600 font-bold text-xs uppercase bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-xl w-full justify-center"><Icons.Check /> Local</div>
                            <button 
                                onClick={() => handleUninstallModel(m.id)} 
                                className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 p-1 transition-colors"
                                title="Remove local weights"
                            >
                                <Icons.Trash /> Remove
                            </button>
                          </>
                        ) : progress !== undefined ? (
                          <div className="w-full md:w-32 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden shadow-inner"><div className="bg-blue-500 h-full transition-all" style={{width: `${progress}%`}} /></div>
                        ) : (
                          <button onClick={() => handleDownloadModel(m.id)} className="w-full md:w-auto bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg">Download</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal with Tabbed UI */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white dark:bg-[#1e1f20] rounded-[28px] w-full max-w-2xl h-[85vh] shadow-2xl border dark:border-gray-800 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b dark:border-gray-800">
              <h2 className="text-2xl font-bold tracking-tight">Friday Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><Icons.Close /></button>
            </div>
            
            <div className="flex border-b dark:border-gray-800 px-6 bg-gray-50/50 dark:bg-white/5">
              {(['general', 'voice', 'extensions'] as SettingsTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSettingsTab(tab)}
                  className={`px-4 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${settingsTab === tab ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
              {settingsTab === 'general' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="apiKey" className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">
                      Gemini API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="apiKey"
                        type="password"
                        value={settings.apiKey || ''}
                        onChange={(e) =>
                          setAppState((p) => ({
                            ...p,
                            settings: { ...p.settings, apiKey: e.target.value },
                          }))
                        }
                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-sm border-transparent focus:ring-2 ring-blue-500/20"
                        placeholder="Enter your API key"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg"><Icons.Brain /></div>
                      <div><p className="font-bold text-sm">Friday Pro</p><p className="text-xs text-gray-500">Enable Gemini 3 Pro Reasoning</p></div>
                    </div>
                    <button onClick={() => setAppState(p => ({...p, settings: {...p.settings, highReasoningMode: !p.settings.highReasoningMode}}))} className={`w-12 h-6 rounded-full transition-all relative ${settings.highReasoningMode ? 'bg-purple-600 shadow-md' : 'bg-gray-300 dark:bg-gray-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.highReasoningMode ? 'left-7' : 'left-1'}`} /></button>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg"><Icons.HF /></div>
                      <div><p className="font-bold text-sm">Edge Inference</p><p className="text-xs text-gray-500">Force use of local offline weights</p></div>
                    </div>
                    <button onClick={() => setAppState(p => ({...p, settings: {...p.settings, forceOffline: !p.settings.forceOffline}}))} className={`w-12 h-6 rounded-full transition-all relative ${settings.forceOffline ? 'bg-orange-600 shadow-md' : 'bg-gray-300 dark:bg-gray-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.forceOffline ? 'left-7' : 'left-1'}`} /></button>
                  </div>
                </div>
              )}

              {settingsTab === 'voice' && (
                <div className="space-y-6">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest px-2">Voice Engine Preference</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'].map(v => (
                      <button key={v} onClick={() => setAppState(p => ({...p, settings: {...p.settings, voiceName: v as any}}))} className={`px-4 py-6 rounded-2xl border-2 text-xs font-black transition-all ${settings.voiceName === v ? 'bg-blue-500 text-white border-blue-600 shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-transparent hover:border-gray-300'}`}>{v}</button>
                    ))}
                  </div>
                </div>
              )}

              {settingsTab === 'extensions' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border dark:border-gray-800">
                    <div><p className="font-bold text-sm">Google Search Grounding</p><p className="text-xs text-gray-500">Access live web citations and news</p></div>
                    <button onClick={() => setAppState(p => ({...p, settings: {...p.settings, extensions: {...p.settings.extensions, googleSearch: !p.settings.extensions.googleSearch}}}))} className={`w-12 h-6 rounded-full transition-all relative ${settings.extensions.googleSearch ? 'bg-blue-600 shadow-lg' : 'bg-gray-300 dark:bg-gray-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.extensions.googleSearch ? 'left-7' : 'left-1'}`} /></button>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border dark:border-gray-800">
                    <div><p className="font-bold text-sm">Google Maps Grounding</p><p className="text-xs text-gray-500">Location-aware responses and place data</p></div>
                    <button onClick={() => setAppState(p => ({...p, settings: {...p.settings, extensions: {...p.settings.extensions, googleMaps: !p.settings.extensions.googleMaps}}}))} className={`w-12 h-6 rounded-full transition-all relative ${settings.extensions.googleMaps ? 'bg-blue-600 shadow-lg' : 'bg-gray-300 dark:bg-gray-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.extensions.googleMaps ? 'left-7' : 'left-1'}`} /></button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-[#131314] border-t dark:border-gray-800 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest px-6">
              <span>Friday Stable Build</span>
              <span>v4.3.0 Private Beta</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
