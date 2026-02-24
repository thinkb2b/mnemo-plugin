import React, { useState, useEffect } from 'react';
import { 
  Layout, Plus, Settings, Mail, Search, Folder, Edit3, Trash2, Send, 
  ArrowLeft, Sparkles, RefreshCw, X, Save, Link, Link2Off, Info
} from 'lucide-react';
import type { Snippet, Group, ViewState, SnippetFormData, SenderAccount } from './types';
import { generateSnippet } from './services/geminiService';

// Konstanten
const AVAILABLE_COLORS = [
  { name: 'Blau', class: 'bg-blue-500' },
  { name: 'Grün', class: 'bg-green-500' },
  { name: 'Orange', class: 'bg-orange-500' },
  { name: 'Lila', class: 'bg-purple-500' },
  { name: 'Rot', class: 'bg-red-500' },
  { name: 'Türkis', class: 'bg-teal-500' },
];

const INITIAL_GROUPS: Group[] = [
  { id: 'g1', name: 'Allgemein', color: 'bg-blue-500' },
  { id: 'g2', name: 'Vertrieb', color: 'bg-green-500' },
  { id: 'g3', name: 'Support', color: 'bg-orange-500' },
];

const INITIAL_SNIPPETS: Snippet[] = [
  {
    id: 's1',
    groupId: 'g1',
    title: 'Terminbestätigung',
    subject: 'Bestätigung unseres Termins am {Datum}',
    body: 'Hallo {Name},\n\nhiermit bestätige ich unseren Termin am {Datum} um {Uhrzeit}.\n\nIch freue mich auf das Gespräch.',
    variables: ['Name', 'Datum', 'Uhrzeit']
  },
];

const INITIAL_ACCOUNTS: SenderAccount[] = [
  { id: 'acc1', name: 'Standardkonto', email: 'user@firma.de', signature: '\n\nMit freundlichen Grüßen' },
];

// Helper Functions
const extractVariables = (text: string): string[] => {
  const regex = /\{([^}]+)\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
};


const getInputTypeForVariable = (variableName: string): 'text' | 'date' | 'time' | 'datetime-local' => {
  const normalized = variableName.toLowerCase();

  if (normalized.includes('datum') || normalized.includes('date')) {
    return 'date';
  }

  if (normalized.includes('uhrzeit') || normalized.includes('zeit') || normalized.includes('time')) {
    return 'time';
  }

  if (normalized.includes('termin') || normalized.includes('datetime')) {
    return 'datetime-local';
  }

  return 'text';
};

// UI Components
const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  icon: Icon,
  disabled = false
}: any) => {
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };

  return (
    <button 
      onClick={onClick} 
      className={`flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${variants[variant]} ${className}`}
      disabled={disabled}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
};


const WINDOW_MODE_PARAM = new URLSearchParams(window.location.search).get('mode');
const VIEW_PARAM = new URLSearchParams(window.location.search).get('view') as ViewState | null;
const IS_POPUP_WINDOW = WINDOW_MODE_PARAM === 'popup';
const WINDOW_SETTING_KEY = 'mnemo.openInSeparateWindow';
const INSERT_REQUEST_KEY = 'mnemo.insertRequest';

export default function App() {
  const [view, setView] = useState<ViewState>('LIST');
  const [snippets, setSnippets] = useState<Snippet[]>(INITIAL_SNIPPETS);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [accounts, setAccounts] = useState<SenderAccount[]>(INITIAL_ACCOUNTS);
  
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSnippet, setCurrentSnippet] = useState<Snippet | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [selectedAccount, setSelectedAccount] = useState<string>(INITIAL_ACCOUNTS[0]?.id || '');
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(AVAILABLE_COLORS[0].class);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  
  const [isOfficeInitialized, setIsOfficeInitialized] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(window.innerWidth < 360);
  const [openInSeparateWindow, setOpenInSeparateWindow] = useState<boolean>(() => {
    return localStorage.getItem(WINDOW_SETTING_KEY) === 'true';
  });
  const [editorData, setEditorData] = useState<SnippetFormData>({
    title: '', subject: '', body: '', groupId: 'g1'
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const setBodyHtmlAsync = (html: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      Office.context.mailbox.item.body.setSelectedDataAsync(
        html,
        { coercionType: Office.CoercionType.Html },
        (result: Office.AsyncResult<void>) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            resolve();
          } else {
            reject(new Error(result.error?.message || 'Body konnte nicht eingefügt werden.'));
          }
        }
      );
    });
  };

  const setSubjectAsync = (subject: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      Office.context.mailbox.item.subject.setAsync(subject, (result: Office.AsyncResult<void>) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(new Error(result.error?.message || 'Betreff konnte nicht gesetzt werden.'));
        }
      });
    });
  };

  // Office Initialization
  useEffect(() => {
    if (typeof Office !== 'undefined') {
      Office.onReady((info) => {
        if (info.host === Office.HostType.Outlook) {
          setIsOfficeInitialized(true);
          console.log('Outlook Integration aktiv');
        }
      });
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsCompactLayout(window.innerWidth < 360);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(WINDOW_SETTING_KEY, String(openInSeparateWindow));
  }, [openInSeparateWindow]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === WINDOW_SETTING_KEY) {
        setOpenInSeparateWindow(event.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);


  useEffect(() => {
    const handleInsertRequest = async (event: StorageEvent) => {
      if (IS_POPUP_WINDOW || !isOfficeInitialized || event.key !== INSERT_REQUEST_KEY || !event.newValue) {
        return;
      }

      try {
        const payload = JSON.parse(event.newValue) as { subject: string; body: string };
        await insertIntoOutlook(payload.subject || '', payload.body || '');
        setView('LIST');
      } catch (error) {
        console.error('Insert-Bridge Fehler:', error);
      }
    };

    window.addEventListener('storage', handleInsertRequest);
    return () => window.removeEventListener('storage', handleInsertRequest);
  }, [isOfficeInitialized]);

  useEffect(() => {
    if (!IS_POPUP_WINDOW || !VIEW_PARAM) return;
    const allowedViews: ViewState[] = ['LIST', 'CREATE', 'EDIT', 'FILL_VARS', 'SETTINGS', 'INFO'];
    if (allowedViews.includes(VIEW_PARAM)) {
      setView(VIEW_PARAM);
    }
  }, []);

  const shouldOpenInWindow = openInSeparateWindow && !IS_POPUP_WINDOW;

  const openPluginWindow = (targetView: ViewState = 'LIST') => {
    const popupUrl = `${window.location.origin}/index.html?mode=popup&view=${targetView}`;

    if (isOfficeInitialized && typeof Office !== 'undefined' && Office.context?.ui?.displayDialogAsync) {
      Office.context.ui.displayDialogAsync(
        popupUrl,
        { height: 70, width: 60, displayInIframe: false },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            console.error('Dialog konnte nicht geöffnet werden:', result.error);
            window.open(popupUrl, '_blank', 'noopener,noreferrer,width=900,height=760');
          }
        }
      );
      return;
    }

    window.open(popupUrl, '_blank', 'noopener,noreferrer,width=900,height=760');
  };

  const handleNavigate = (targetView: ViewState) => {
    if (shouldOpenInWindow) {
      openPluginWindow(targetView);
      return;
    }
    setView(targetView);
  };

  // Actions
  const handleCreate = () => {
    setEditorData({ title: '', subject: '', body: '', groupId: groups[0]?.id || 'g1' });
    setCurrentSnippet(null);
    handleNavigate('CREATE');
  };

  const handleEdit = (snippet: Snippet) => {
    setEditorData({
      title: snippet.title,
      subject: snippet.subject,
      body: snippet.body,
      groupId: snippet.groupId
    });
    setCurrentSnippet(snippet);
    setView('EDIT');
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie dieses Snippet wirklich löschen?')) {
      setSnippets(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleSave = () => {
    const variables = extractVariables(editorData.subject + ' ' + editorData.body);
    
    if (view === 'CREATE') {
      const newSnippet: Snippet = {
        id: Date.now().toString(),
        ...editorData,
        variables
      };
      setSnippets([...snippets, newSnippet]);
    } else if (view === 'EDIT' && currentSnippet) {
      setSnippets(snippets.map(s => s.id === currentSnippet.id ? { ...s, ...editorData, variables } : s));
    }
    setView('LIST');
  };

  const handleAiGenerate = async (prompt: string) => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const result = await generateSnippet(prompt);
      setEditorData(prev => ({
        ...prev,
        title: result.title || prev.title,
        subject: result.subject || prev.subject,
        body: result.body || prev.body
      }));
    } catch (e: any) {
      alert("KI-Fehler: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrepareInsert = (snippet: Snippet) => {
    setCurrentSnippet(snippet);
    setVariableValues({});
    if (snippet.variables.length > 0) {
      setView('FILL_VARS');
    } else {
      executeInsert(snippet, {});
    }
  };
  const insertIntoOutlook = async (finalSubject: string, finalBody: string) => {
    await setBodyHtmlAsync(finalBody.replace(/\n/g, '<br/>'));

    if (Office.context.mailbox.item.subject) {
      await setSubjectAsync(finalSubject);
    }
  };

  const dispatchInsertRequestToMainWindow = (finalSubject: string, finalBody: string) => {
    localStorage.setItem(
      INSERT_REQUEST_KEY,
      JSON.stringify({
        id: Date.now(),
        subject: finalSubject,
        body: finalBody,
      })
    );
  };

  const executeInsert = async (snippet: Snippet, values: Record<string, string>) => {
    let finalSubject = snippet.subject;
    let finalBody = snippet.body;

    Object.entries(values).forEach(([key, val]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      finalSubject = finalSubject.replace(regex, val);
      finalBody = finalBody.replace(regex, val);
    });

    const account = accounts.find(a => a.id === selectedAccount);
    if (account) {
      finalBody += account.signature;
    }

    if (IS_POPUP_WINDOW) {
      dispatchInsertRequestToMainWindow(finalSubject, finalBody);
      alert('Inhalt wurde an das Outlook-Hauptfenster übergeben und wird dort eingefügt.');
      setView('LIST');
      return;
    }

    if (isOfficeInitialized) {
      try {
        await insertIntoOutlook(finalSubject, finalBody);
        setView('LIST');
      } catch (e) {
        console.error('Outlook Insert Fehler:', e);
        alert('Fehler beim Einfügen in Outlook.');
      }
    } else {
      const fullText = `Betreff: ${finalSubject}

${finalBody}`;
      navigator.clipboard.writeText(fullText);
      alert(`In Zwischenablage kopiert (Browser-Modus):

${fullText.substring(0, 100)}...`);
      setView('LIST');
    }
  };

  const handleSaveGroup = () => {
    if (!newGroupName.trim()) return;

    if (editingGroupId) {
      setGroups(prev => prev.map(g => g.id === editingGroupId ? { ...g, name: newGroupName, color: newGroupColor } : g));
      setEditingGroupId(null);
    } else {
      const newGroup: Group = {
        id: `g${Date.now()}`,
        name: newGroupName,
        color: newGroupColor
      };
      setGroups([...groups, newGroup]);
    }
    setNewGroupName('');
    setNewGroupColor(AVAILABLE_COLORS[0].class);
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroupId(group.id);
    setNewGroupName(group.name);
    setNewGroupColor(group.color);
  };

  const handleDeleteGroup = (id: string) => {
    if (confirm('Kategorie löschen?')) {
      setGroups(groups.filter(g => g.id !== id));
      if (selectedGroup === id) setSelectedGroup(null);
      if (editingGroupId === id) {
        setEditingGroupId(null);
        setNewGroupName('');
      }
    }
  };

  // Render Functions
  const renderSidebar = () => (
    <div className={`${isCompactLayout ? 'w-12 py-2 space-y-2' : 'w-16 py-4 space-y-4'} bg-white border-r border-gray-200 flex flex-col items-center`}>
      <button 
        onClick={() => handleNavigate('LIST')}
        className={`p-2 rounded-xl transition-all ${view === 'LIST' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
        aria-label="Bibliothek"
      >
        <Layout className={`${isCompactLayout ? 'w-5 h-5' : 'w-6 h-6'}`} />
      </button>
      <button 
        onClick={handleCreate}
        className={`p-2 rounded-xl transition-all ${view === 'CREATE' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
        aria-label="Snippet erstellen"
      >
        <Plus className={`${isCompactLayout ? 'w-5 h-5' : 'w-6 h-6'}`} />
      </button>
      <div className="flex-grow" />
      <button 
        onClick={() => handleNavigate('SETTINGS')}
        className={`p-2 rounded-xl transition-all ${view === 'SETTINGS' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
        aria-label="Einstellungen"
      >
        <Settings className={`${isCompactLayout ? 'w-5 h-5' : 'w-6 h-6'}`} />
      </button>
      <button 
        onClick={() => handleNavigate('INFO')}
        className={`p-2 rounded-xl transition-all ${view === 'INFO' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
        aria-label="Info"
      >
        <Info className={`${isCompactLayout ? 'w-5 h-5' : 'w-6 h-6'}`} />
      </button>
    </div>
  );

  const renderWindowLauncher = () => (
    <div className="flex flex-col h-full bg-gray-50 p-4 gap-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Fenstermodus aktiviert</h2>
        <p className="text-sm text-gray-600 mb-4">
          Mnemo öffnet Ansichten jetzt in einem separaten Fenster, damit im schmalen Outlook-Sidepane keine Bedienelemente abgeschnitten werden.
        </p>
        <Button onClick={() => openPluginWindow('LIST')} className="w-full">Mnemo im Fenster öffnen</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        <p className="text-xs text-gray-500 uppercase font-semibold">Direktansichten</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="w-full" onClick={() => openPluginWindow('LIST')}>Bibliothek</Button>
          <Button variant="secondary" className="w-full" onClick={() => openPluginWindow('CREATE')}>Neu</Button>
          <Button variant="secondary" className="w-full" onClick={() => openPluginWindow('SETTINGS')}>Settings</Button>
          <Button variant="secondary" className="w-full" onClick={() => openPluginWindow('INFO')}>Info</Button>
        </div>
      </div>
    </div>
  );

  const renderSnippetList = () => {
    const filtered = snippets.filter(s => {
      const matchesGroup = selectedGroup ? s.groupId === selectedGroup : true;
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGroup && matchesSearch;
    });

    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className={`${isCompactLayout ? 'p-3 space-y-2' : 'p-4 space-y-3'} bg-white border-b border-gray-200`}>
          <div className="flex items-center justify-between">
            <h1 className={`${isCompactLayout ? 'text-lg' : 'text-xl'} font-bold text-gray-800`}>Bibliothek</h1>
            <Button onClick={handleCreate} icon={Plus} className="h-8 text-xs">Neu</Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Suchen..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button 
              onClick={() => setSelectedGroup(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${!selectedGroup ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              Alle
            </button>
            {groups.map(g => (
              <button 
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center ${selectedGroup === g.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${g.color}`} />
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className={`${isCompactLayout ? 'p-3 space-y-2' : 'p-4 space-y-3'} flex-1 overflow-y-auto`}>
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p>Keine Snippets gefunden.</p>
            </div>
          ) : (
            filtered.map(snippet => {
              const group = groups.find(g => g.id === snippet.groupId);
              return (
                <div key={snippet.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow group min-w-0">
                  <div className="p-4 cursor-pointer" onClick={() => handlePrepareInsert(snippet)}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase text-white ${group?.color || 'bg-gray-400'}`}>
                        {group?.name || 'Allgemein'}
                      </span>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(snippet); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(snippet.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">{snippet.title}</h3>
                    <p className="text-sm text-gray-500 break-words">{snippet.body}</p>
                    
                    {snippet.variables.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {snippet.variables.map(v => (
                          <span key={v} className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded text-[10px]">
                            {'{' + v + '}'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderEditor = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <button onClick={() => handleNavigate('LIST')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-lg">{view === 'CREATE' ? 'Neues Snippet' : 'Snippet bearbeiten'}</h2>
        <Button onClick={handleSave} disabled={!editorData.title}>Speichern</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center space-x-2 text-indigo-700 mb-2 font-semibold">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">KI-Assistent</span>
          </div>
          <p className="text-xs text-indigo-600 mb-3">Beschreibe das gewünschte Snippet.</p>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="z.B. Höfliche Absage für eine Bewerbung..."
              className="flex-1 text-sm border-gray-300 rounded focus:ring-indigo-500 px-3 py-2 border"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAiGenerate(e.currentTarget.value);
              }}
              id="ai-prompt"
            />
            <Button 
              variant="secondary" 
              onClick={() => {
                const input = document.getElementById('ai-prompt') as HTMLInputElement;
                handleAiGenerate(input.value);
              }}
              disabled={isGenerating}
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Generieren'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
            <input 
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 border"
              value={editorData.title}
              onChange={e => setEditorData({ ...editorData, title: e.target.value })}
              placeholder="z.B. Bewerbung Absage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
            <select 
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 border"
              value={editorData.groupId}
              onChange={e => setEditorData({ ...editorData, groupId: e.target.value })}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
            <input 
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 border"
              value={editorData.subject}
              onChange={e => setEditorData({ ...editorData, subject: e.target.value })}
              placeholder="Betreff der E-Mail"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inhalt</label>
            <textarea 
              className="w-full min-h-[200px] border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 border font-mono"
              value={editorData.body}
              onChange={e => setEditorData({ ...editorData, body: e.target.value })}
              placeholder="Nutze {Variable} für Platzhalter..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFillVars = () => {
    if (!currentSnippet) return null;
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b border-gray-200 flex items-center">
          <button onClick={() => handleNavigate('LIST')} className="text-gray-500 hover:text-gray-700 mr-3">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-gray-800">Variablen ausfüllen</h2>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {currentSnippet.variables.map(v => (
            <div key={v}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v}</label>
              <input 
                type={getInputTypeForVariable(v)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                value={variableValues[v] || ''}
                onChange={e => setVariableValues({ ...variableValues, [v]: e.target.value })}
                placeholder={getInputTypeForVariable(v) === 'text' ? `Wert für ${v}...` : undefined}
              />
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => handleNavigate('LIST')}>Abbrechen</Button>
          <Button onClick={() => executeInsert(currentSnippet, variableValues)} icon={Send}>
            Einfügen
          </Button>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center">
        <button onClick={() => handleNavigate('LIST')} className="text-gray-500 hover:text-gray-700 mr-3">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-lg">Einstellungen</h2>
      </div>

      <div className="p-6 space-y-8">
        <section className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-bold text-gray-900 mb-2">Ansicht</h3>
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-gray-800">Plugin im separaten Fenster öffnen</div>
              <div className="text-xs text-gray-500">Empfohlen bei schmalem Sidepane in Outlook.</div>
            </div>
            <input
              type="checkbox"
              checked={openInSeparateWindow}
              onChange={(e) => setOpenInSeparateWindow(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </section>

        <div className={`p-3 rounded-lg flex items-center gap-3 ${isOfficeInitialized ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
          {isOfficeInitialized ? <Link className="w-5 h-5" /> : <Link2Off className="w-5 h-5" />}
          <div>
            <div className="font-bold text-sm">{isOfficeInitialized ? 'Mit Outlook verbunden' : 'Preview Modus'}</div>
            <div className="text-xs opacity-80">{isOfficeInitialized ? 'Alle Funktionen aktiv' : 'Text wird in Zwischenablage kopiert'}</div>
          </div>
        </div>

        <section>
          <h3 className="font-bold text-gray-900 mb-4">Kategorien verwalten</h3>
          
          <div className="flex gap-2 mb-4 bg-gray-50 p-3 rounded-lg border">
            <input 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1 text-sm border-gray-300 rounded px-2 py-1.5 border"
              placeholder="Neue Kategorie..."
            />
            <div className="flex gap-1">
              {AVAILABLE_COLORS.map(c => (
                <button
                  key={c.class}
                  onClick={() => setNewGroupColor(c.class)}
                  className={`w-6 h-6 rounded-full ${c.class} ${newGroupColor === c.class ? 'ring-2 ring-gray-400' : ''}`}
                />
              ))}
            </div>
            <Button onClick={handleSaveGroup} disabled={!newGroupName}>
              {editingGroupId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-2">
            {groups.map(g => (
              <div key={g.id} className="flex items-center justify-between bg-white border p-2 rounded-md">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${g.color}`} />
                  <span className="text-sm font-medium">{g.name}</span>
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => handleEditGroup(g)} className="text-gray-400 hover:text-blue-500 p-1">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteGroup(g.id)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  const renderInfo = () => (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center">
        <button onClick={() => handleNavigate('LIST')} className="text-gray-500 hover:text-gray-700 mr-3">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-bold">Info</h2>
      </div>
      <div className="p-6 text-sm space-y-4">
        <div className="bg-blue-50 p-4 rounded border border-blue-100">
          <h4 className="font-semibold text-blue-800 mb-1">Mnemo Intelligent Snippets</h4>
          <p className="text-blue-700 text-xs">Version 1.0 - Outlook Add-in zur Verwaltung von Textbausteinen mit KI-Unterstützung.</p>
        </div>
        <p className="text-gray-600">Dieses Plugin ermöglicht das schnelle Einfügen von vordefinierten Textbausteinen in Outlook E-Mails.</p>
      </div>
    </div>
  );

  return (
    <div className="flex w-full h-screen bg-white text-gray-900 overflow-hidden">
      {!IS_POPUP_WINDOW && renderSidebar()}
      <div className="flex-1 flex flex-col min-w-0">
        {shouldOpenInWindow ? (
          renderWindowLauncher()
        ) : (
          <>
            {view === 'LIST' && renderSnippetList()}
            {(view === 'CREATE' || view === 'EDIT') && renderEditor()}
            {view === 'FILL_VARS' && renderFillVars()}
            {view === 'SETTINGS' && renderSettings()}
            {view === 'INFO' && renderInfo()}
          </>
        )}
      </div>
    </div>
  );
}
