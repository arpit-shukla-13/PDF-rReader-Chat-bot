import React, { useState, useEffect, useRef } from 'react';
import { Upload, Send, FileText, X, Loader2, MessageSquare, AlertCircle, Sun, Moon } from 'lucide-react';
import.meta.env.VITE_OPENAI_API_KEY

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! Please upload a PDF file so I can analyze it for you.' }
  ]);
  const [input, setInput] = useState('');
  const [pdfText, setPdfText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false); // State for Dark Mode
  const chatEndRef = useRef(null);

  // API Key
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load PDF.js
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  // Handle File Upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }

    setFileName(file.name);
    setIsProcessingPdf(true);
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let extractedText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += `\nPage ${i}: ${pageText}`;
      }

      setPdfText(extractedText);
      setMessages(prev => [...prev, { role: 'assistant', text: `Great! I've read "${file.name}". You can now ask questions related to this document.` }]);
    } catch (err) {
      console.error("PDF Error:", err);
      setError('Error reading the PDF. It might be encrypted or corrupted.');
      setFileName('');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Call Gemini API
  const callGeminiAPI = async (userQuery, context) => {
    try {
      const truncatedContext = context.substring(0, 30000); 
      const systemPrompt = "You are a helpful assistant. Answer the user's question strictly based on the provided PDF Context. If the answer is not in the context, say you don't know based on the document. Keep answers concise and helpful.";
      const finalPrompt = `PDF Context:\n${truncatedContext}\n\nUser Question: ${userQuery}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand that.";
    } catch (err) {
      console.error(err);
      return "Error connecting to the API. Please try again.";
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!pdfText) {
      setError('Please upload a PDF first.');
      return;
    }

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const aiResponse = await callGeminiAPI(userMessage, pdfText);
      setMessages(prev => [...prev, { role: 'assistant', text: aiResponse }]);
    } catch (err) {
      setError('Something went wrong while fetching the answer.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFile = () => {
    setPdfText('');
    setFileName('');
    setMessages([{ role: 'assistant', text: 'File removed. Please upload a new file.' }]);
  };

  return (
    // Wrap everything in a div that applies 'dark' class conditionally
    <div className={isDarkMode ? "dark" : ""}>
      <div className="fixed inset-0 flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 z-50 transition-colors duration-300">
        
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">PDF Chat Bot</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              Powered by Gemini AI
            </div>
          </div>
        </header>

        {/* Main Chat Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 w-full">
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex items-start gap-3 max-w-[85%] sm:max-w-[75%] ${
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}>
                    {msg.role === 'user' ? (
                      <span className="text-white text-xs font-bold">YOU</span>
                    ) : (
                      <MessageSquare className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-2xl shadow-sm text-sm sm:text-base leading-relaxed transition-colors duration-300 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm transition-colors duration-300">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">Thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
        </main>

        {/* Controls Area */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex-shrink-0 w-full transition-colors duration-300">
          <div className="max-w-4xl mx-auto space-y-4">
            
            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* File Status & Upload */}
            {!fileName ? (
              <div className="flex justify-center">
                <label className={`flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all w-full sm:w-auto justify-center ${
                  isProcessingPdf 
                    ? 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400 cursor-wait' 
                    : 'border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-300'
                }`}>
                  {isProcessingPdf ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Analyzing PDF...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span className="font-medium">Upload PDF Document</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={isProcessingPdf}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="bg-red-500 p-1.5 rounded text-white">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{fileName}</span>
                </div>
                <button 
                  onClick={removeFile}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={fileName ? "Ask anything related to the PDF..." : "Upload a PDF first..."}
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                disabled={!fileName || isLoading || isProcessingPdf}
              />
              <button
                type="submit"
                disabled={!input.trim() || !fileName || isLoading || isProcessingPdf}
                className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </footer>

        {/* Scrollbar Styling */}
        <style jsx global>{`
          ::-webkit-scrollbar {
            width: 8px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          .dark ::-webkit-scrollbar-thumb {
            background: #475569;
          }
          .dark ::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
        `}</style>
      </div>
    </div>
  );
}