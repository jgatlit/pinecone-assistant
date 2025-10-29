'use client';

import { useState, useEffect, FormEvent, useRef, useCallback } from 'react';
import { readStreamableValue } from 'ai/rsc';
import { chat, getOrCreateSession, loadMessageHistory, saveMessage } from './actions';
import ReactMarkdown from 'react-markdown';
import AssistantFiles from './components/AssistantFiles';
import { File, Reference, Message } from './types';
import type { Citation } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid'; 

interface HomeProps {
  initialShowAssistantFiles: boolean;
  showCitations: boolean;
}

export default function Home({ initialShowAssistantFiles, showCitations }: HomeProps) {
  const [loading, setLoading] = useState(true);
  const [systemHealthy, setSystemHealthy] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [chatbotName] = useState('SBWC Chatbot');
  const [referencedFiles, setReferencedFiles] = useState<Reference[]>([]);
  const [showAssistantFiles, setShowAssistantFiles] = useState(initialShowAssistantFiles);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    // Check for dark mode preference
    if (typeof window !== 'undefined') {
      const isDarkMode = localStorage.getItem('darkMode') === 'true';
      setDarkMode(isDarkMode);
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', (!darkMode).toString());
      document.documentElement.classList.toggle('dark');
    }
  };

  const extractReferences = (content: string): Reference[] => {
    const references: Reference[] = [];
    
    // Extract full file names from the content
    const fileNameRegex = /([^:\n]+\.[a-zA-Z0-9]+)/g;
    const fileMatches = content.match(fileNameRegex);
    
    if (fileMatches) {
      fileMatches.forEach(fileName => {
        references.push({ name: fileName.trim() });
      });
    }

    return references;
  };

  useEffect(() => {
    checkHealth();
    fetchDocuments();
  }, []);

  // Initialize session and load message history on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setLoadingHistory(true);

        // Get or create session
        const sessionId = await getOrCreateSession();

        if (!sessionId) {
          setError('Failed to create chat session. Please ensure you are logged in.');
          setLoadingHistory(false);
          return;
        }

        setSessionId(sessionId);

        // Load message history for this session
        const history = await loadMessageHistory(sessionId);
        setMessages(history);

      } catch (error) {
        console.error('Error initializing session:', error);
        setError('Failed to load chat history');
      } finally {
        setLoadingHistory(false);
      }
    };

    initializeSession();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      if (data.status === 'success') {
        setFiles(data.documents || []);
      } else {
        console.error('Error fetching documents:', data.message);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()

      setLoading(false)
      setSystemHealthy(data.status === 'healthy')
      if (data.status !== 'healthy') {
        setError('Chatbot system is currently unavailable')
      }
    } catch (error) {
      setLoading(false)
      setError('Error connecting to the chatbot system')

    }
  }

  const handleChat = async () => {
    if (!input.trim()) return;

    // Check sessionId exists before proceeding
    if (!sessionId) {
      console.error('No session ID available');
      setError('Session not initialized. Please refresh the page.');
      return;
    }

    const newUserMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setInput('');
    setIsStreaming(true);

    // Save user message to database (non-blocking)
    saveMessage(sessionId, 'user', newUserMessage.content).catch(error => {
      console.error('Failed to save user message:', error);
      // Don't block chat on save failure
    });

    try {
      // Build conversation history with all previous messages for context
      const conversationHistory = [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user' as const,
          content: newUserMessage.content
        }
      ];

      const { object, citations } = await chat(conversationHistory);
      let accumulatedContent = '';
      const newAssistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        references: []
      };

      setMessages(prevMessages => [...prevMessages, newAssistantMessage]);

      // Process the response stream from the chat action
      for await (const chunk of readStreamableValue(object)) {
        if (chunk) {
          accumulatedContent += chunk;

          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            lastMessage.content = accumulatedContent;
            return updatedMessages;
          });
        }
      }

      // Convert citations to references and attach to the assistant message
      const references: Reference[] = citations?.map(cit => ({
        name: cit.name,
        url: cit.url,
        documentId: cit.documentId,
        relevance: cit.relevance,
        error: cit.error
      })) || [];

      // Update the last message with references
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages];
        const lastMessage = updatedMessages[updatedMessages.length - 1];
        lastMessage.references = references;
        return updatedMessages;
      });

      // Save assistant message with references (non-blocking)
      saveMessage(sessionId, 'assistant', accumulatedContent, references).catch(error => {
        console.error('Failed to save assistant message:', error);
        // Don't block chat on save failure
      });

      // Extract references for file highlighting (keep existing behavior)
      const extractedReferences = extractReferences(accumulatedContent);
      setReferencedFiles(extractedReferences);

    } catch (error) {
      console.error('Error in chat:', error);
      setError('An error occurred while chatting.');
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="absolute top-4 right-4 flex gap-2">
        <a
          href="/documents"
          className="p-2 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg transition-colors"
          aria-label="Manage Documents"
          title="Upload and manage documents"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </a>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
      {loading ? (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900 mb-4"></div>
          <p className="text-gray-500">Connecting to the chatbot...</p>
        </div>
      ) : systemHealthy ? (
        <div className="w-full max-w-6xl xl:max-w-7xl">
          <h1 className="text-2xl font-bold mb-4 text-indigo-900 dark:text-indigo-100">{chatbotName} <span className="text-green-500">●</span></h1>
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg mb-4 h-[calc(100vh-500px)] overflow-y-auto">
                {loadingHistory ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Loading chat history...</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                  <div key={index} className={`mb-2 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`${message.role === 'user' ? 'ml-2' : 'mr-2'}`}>
                        {message.role === 'user' ? (
                          <span className="text-2xl">👤</span>
                        ) : (
                          <span className="text-2xl">🤖</span>
                        )}
                      </div>
                      <span className={`inline-block p-2 rounded-lg ${
                        message.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      } max-w-[80%] break-words`}>
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} className="text-blue-600 dark:text-blue-400 hover:underline">
                                🔗 {props.children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                        {message.references && message.references.length > 0 && showCitations && (
                          <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                              Sources:
                            </p>
                            <ul className="space-y-1.5">
                              {message.references.map((ref, i) => (
                                <li key={i} className="text-sm">
                                  <div className="flex items-start gap-1.5">
                                    {ref.url ? (
                                      <a
                                        href={ref.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5 flex-1"
                                        aria-label={`Open source document: ${ref.name}`}
                                      >
                                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="break-all">{ref.name}</span>
                                      </a>
                                    ) : (
                                      <span className="text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5 flex-1">
                                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="break-all">
                                          {ref.name}
                                          {ref.error && <span className="text-xs ml-1">({ref.error})</span>}
                                        </span>
                                      </span>
                                    )}
                                    {ref.relevance && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto flex-shrink-0 mt-0.5">
                                        {ref.relevance}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </span>
                    </div>
                  </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleChat(); }} className="flex mb-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-grow p-2 text-black border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Type your message..."
                  disabled={isStreaming}
                />
                <button
                  type="submit"
                  className="bg-indigo-500 text-white p-2 rounded-r-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isStreaming}
                >
                  {isStreaming ? 'Streaming...' : 'Send'}
                </button>
              </form>
              {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md shadow-md">
                  <div className="flex items-center">
                    <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="font-semibold">Error</p>
                  </div>
                  <p className="mt-2">{error}</p>
                </div>
              )}
            </div>
            {showAssistantFiles && (
              <div className="w-full">
                <AssistantFiles files={files} referencedFiles={referencedFiles} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-md max-w-2xl">
          <div className="flex items-center">
            <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="font-semibold">Error</p>
          </div>
          <p className="mt-2">{error}</p>
          <div className="mt-4 text-sm">
            <p className="font-semibold">To resolve this issue:</p>
            <ol className="list-decimal list-inside mt-2 space-y-2">
              <li>Verify database connection is configured</li>
              <li>Check that required environment variables are set</li>
              <li>Restart the application</li>
            </ol>
          </div>
        </div>
      )}
    </main>
  );
}