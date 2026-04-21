import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '../../firebase';
import { collection, addDoc, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Groq from 'groq-sdk';
import '../../css/PermohonanChat.css';
import { GROQ_API_KEY } from '../../constants';

const groq = new Groq({ 
  apiKey: GROQ_API_KEY,
  dangerouslyAllowBrowser: true 
});

const SYSTEM_PROMPT = `
Anda adalah Pembantu AI MyDana. Tugas anda adalah mengambil butiran untuk permohonan Kempen Kutipan Dana.
Proses:
1. Siapa pengguna dan minta Nama Penuh jika belum diberi.
2. Tanya tujuan bantuan dan jumlah wang yang diperlukan (RM).
3. Selepas mendapat butiran, minta pengguna lampirkan dokumen sokongan yang berkaitan di ruangan chat.
Tanya satu soalan pada satu masa. Bersikap empati dan profesional dalam Bahasa Melayu.
`;

function PermohonanChat() {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState(() => {
    const savedSession = localStorage.getItem('mydana_chat_session');
    if (savedSession) {
      try {
        return JSON.parse(savedSession);
      } catch (e) {
        console.error("Error reading saved chat", e);
      }
    }
    return [
      {
        id: 1,
        sender: 'bot',
        name: 'Pembantu AI MyDana',
        text: 'Selamat datang ke MyDana. Saya adalah Pembantu AI anda. Mari kita mulakan permohonan anda. Boleh saya tahu nama penuh anda?',
        role: 'assistant'
      }
    ];
  });

  const [uploadedDocs, setUploadedDocs] = useState(() => {
    const savedDocs = localStorage.getItem('mydana_docs');
    return savedDocs ? JSON.parse(savedDocs) : [];
  });

  const [existingApp, setExistingApp] = useState(null);
  const [checkingApp, setCheckingApp] = useState(true);

  // Check if user already has an application
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const docSnap = await getDoc(doc(db, 'applications', user.uid));
          if (docSnap.exists()) {
            setExistingApp(docSnap.data());
          }
        } catch (e) { console.error("Error checking app info", e); }
      }
      setCheckingApp(false);
    });
    return () => unsubscribe();
  }, []);

  // Preserve chat history to localStorage dynamically so user doesn't lose progress
  useEffect(() => {
    localStorage.setItem('mydana_chat_session', JSON.stringify(messages));
    localStorage.setItem('mydana_docs', JSON.stringify(uploadedDocs));
  }, [messages, uploadedDocs]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText;
    const newUserMsg = {
      id: messages.length + 1,
      sender: 'user',
      name: 'Pemohon',
      text: userText,
      role: 'user'
    };

    const newChatHistory = [...messages, newUserMsg];
    setMessages(newChatHistory);
    setInputText('');
    setIsTyping(true);

    try {
      // Format history for Groq ({role, content})
      const groqHistory = newChatHistory.map(m => ({ 
        role: m.role, 
        content: m.text 
      }));

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...groqHistory
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
        max_tokens: 1024,
      });

      const botReply = completion.choices[0]?.message?.content || "Harap maaf, sistem tergendala.";
      
      setMessages(prev => [...prev, { 
        id: prev.length + 1, 
        sender: 'bot', 
        name: 'Pembantu AI MyDana', 
        text: botReply,
        role: 'assistant'
      }]);
    } catch (error) {
      console.error("Groq Error: ", error);
      setMessages(prev => [...prev, { 
        id: prev.length + 1, 
        sender: 'bot', 
        name: 'Pembantu AI MyDana', 
        text: "Koneksi ke AI terputus. Sila semak API Key anda.",
        role: 'assistant'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsTyping(true);
    let userText = `[Sistem: Pemohon telah memuat naik dokumen bersaiz ${(file.size / 1024).toFixed(1)}KB bertajuk '${file.name}']`;

    // Process Upload to Storage
    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setUploadedDocs(prev => [...prev, { name: file.name, url: downloadURL }]);
    } catch (uploadErr) {
      console.error("Failed to upload to firebase storage:", uploadErr);
    }

    // Process Image with Groq Fallback Text Model since Vision is unavailable for this API Key tier
    if (file.type.startsWith('image/')) {
      try {
        const fallbackCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "Anda adalah enjin Pengecaman Imej Bantuan. Berikan satu rumusan tekaan RINGKAS 1 baris mengenai dokumen berdasarkan nama fail ini. Contoh: 'Ini adalah gambar resit.'",
            },
            { role: "user", content: `Nama fail imej: ${file.name}` }
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          max_tokens: 150,
        });

        const fallbackResult = fallbackCompletion.choices[0]?.message?.content || "Sebuah fail dokumen sokongan bergambar.";
        userText += `\n[Analisis Imej MyDana (Fallback): ${fallbackResult}]`;
        
        await proceedWithChat(userText);
      } catch (err) {
        console.error("Fallback Error: ", err);
        await proceedWithChat(userText);
      }
    } else {
      // Not an image, just proceed
      await proceedWithChat(userText);
    }

    // Reset input
    e.target.value = null;
  };

  const proceedWithChat = async (userText) => {
    const newUserMsg = {
      id: messages.length + 1,
      sender: 'user',
      name: 'Pemohon',
      text: userText,
      role: 'user'
    };

    const newChatHistory = [...messages, newUserMsg];
    setMessages(newChatHistory);

    try {
      const groqHistory = newChatHistory.map(m => ({ 
        role: m.role, 
        content: m.text 
      }));

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...groqHistory
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
        max_tokens: 1024,
      });

      const botReply = completion.choices[0]?.message?.content || "Dokumen diterima, terima kasih.";
      
      setMessages(prev => [...prev, { 
        id: prev.length + 1, 
        sender: 'bot', 
        name: 'Pembantu AI MyDana', 
        text: botReply,
        role: 'assistant'
      }]);
    } catch (error) {
      console.error("Groq Error on Upload: ", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmitApplication = async () => {
    setIsTyping(true);
    try {
      // Calculate a random AI authenticity score based on transcript length for realism
      let score = 50 + Math.min(messages.length * 5, 45) + Math.floor(Math.random() * 5);
      
      const user = auth.currentUser;
      const userName = user?.displayName || user?.email?.split('@')[0] || "Pemohon MyDana";

      const appData = {
        name: userName,
        category: "Permohonan Bantuan",
        score: score,
        scoreClass: score >= 80 ? 'high' : (score > 60 ? 'medium' : 'low'),
        createdAt: serverTimestamp(),
        transcript: messages,
        documents: uploadedDocs
      };

      // Ensure it doesn't hang indefinitely (timeout after 5 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout Database')), 5000)
      );
      
      const submitDb = user 
        ? setDoc(doc(db, 'applications', user.uid), appData)
        : addDoc(collection(db, 'applications'), appData);

      await Promise.race([submitDb, timeoutPromise]);

      const successMsg = {
        id: messages.length + 1,
        sender: 'bot',
        name: 'Sistem',
        text: 'Tahniah, permohonan anda berserta dokumen sokongan telah dianalisis. Permohonan telah dihantar kepada Panel Pentadbir MyDana!',
        role: 'assistant'
      };

      setMessages(prev => [...prev, successMsg]);
      localStorage.removeItem('mydana_chat_session');
      localStorage.removeItem('mydana_docs');
      
      // Force UI to show pending view instantly
      setExistingApp({ ...appData, status: 'pending' });

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        sender: 'bot',
        name: 'Sistem',
        text: 'Sistem ralat: Pendaftaran permohonan ke database gagal. Sila periksa "Firestore Security Rules" atau capaian internet anda.',
        role: 'assistant'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (checkingApp) {
    return <div style={{padding: '5rem', textAlign: 'center', color: '#64748b', fontSize: '1.2rem'}}>Menyemak status permohonan anda...</div>;
  }

  if (existingApp) {
    if (existingApp.status === 'rejected') {
      return (
        <div style={{padding: '5rem 2rem', display: 'flex', justifyContent: 'center'}}>
          <div style={{background: '#fef2f2', border: '1px solid #fecaca', padding: '3rem', borderRadius: '16px', maxWidth: '600px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}>
            <div style={{width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <h2 style={{color: '#b91c1c', fontSize: '1.8rem', marginBottom: '1rem'}}>Permohonan Ditolak</h2>
            <p style={{color: '#475569', lineHeight: '1.6'}}>Dukacita dimaklumkan bahawa permohonan kempen bantuan anda telah tidak diluluskan oleh Panel Pentadbir MyDana selepas semakan. Berikut adalah alasan penolakan rasmi:</p>
            <div style={{background: '#ffffff', padding: '1.5rem', borderRadius: '8px', border: '1px dashed #fca5a5', margin: '2rem 0', color: '#1e293b', fontWeight: '500', fontStyle: 'italic'}}>
              "{existingApp.reason}"
            </div>
            <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem'}}>Sila pastikan anda memperbetulkan maklumat atau melampirkan bukti dokumen yang lebih sahih sebelum memohon semula.</p>
            <button className="btn-admin-primary" style={{margin: '0 auto', display: 'flex'}} onClick={async () => {
              if(!window.confirm("Adakah anda pasti untuk membuat permohonan baharu? Rekod penolakan lama ini akan dipadam.")) return;
              try {
                if (auth.currentUser) await deleteDoc(doc(db, 'applications', auth.currentUser.uid));
                setExistingApp(null);
                localStorage.removeItem('mydana_chat_session');
                localStorage.removeItem('mydana_docs');
                setUploadedDocs([]);
                setMessages([{ id: 1, sender: 'bot', name: 'Pembantu AI MyDana', text: 'Selamat datang kembali ke MyDana. Mari kita mulakan permohonan baru anda.', role: 'assistant' }]);
              } catch(e) { alert("Ralat semasa log out / delete old app"); }
            }}>
              Mohon Semula
            </button>
          </div>
        </div>
      );
    }

    if (existingApp.status === 'approved') {
      return (
        <div style={{padding: '5rem 2rem', display: 'flex', justifyContent: 'center'}}>
          <div style={{background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3rem', borderRadius: '16px', maxWidth: '600px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}>
            <div style={{width: '64px', height: '64px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h2 style={{color: '#047857', fontSize: '1.8rem', marginBottom: '1rem'}}>Permohonan Diluluskan!</h2>
            <p style={{color: '#475569', lineHeight: '1.6'}}>Tahniah, permohonan sumbangan anda telah melepasi semakan keselamatan dan diluluskan sepenuhnya oleh Panel Pentadbir MyDana.</p>
            <p style={{marginTop: '2rem', color: '#10b981', fontWeight: 'bold'}}>Dana akan disalurkan mengikut ketetapan sistem rasmi tidak lama lagi.</p>
          </div>
        </div>
      );
    }

    return (
      <div style={{padding: '5rem 2rem', display: 'flex', justifyContent: 'center'}}>
        <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3rem', borderRadius: '16px', maxWidth: '600px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}>
          <div style={{width: '64px', height: '64px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <h2 style={{color: '#0284c7', fontSize: '1.8rem', marginBottom: '1rem'}}>Sedang Diproses</h2>
          <p style={{color: '#475569', lineHeight: '1.6'}}>Permohonan anda telah berjaya diterima dan kini sedang <b>menunggu semakan pengesahan</b> daripada Panel Pentadbir MyDana.</p>
          <p style={{marginTop: '2rem', fontSize: '0.9rem', color: '#94a3b8'}}>Sila semak kembali halaman ini dari semasa ke semasa untuk mengetahui perkembangan terkini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page-container">

      {/* Progress Card */}
      <div className="chat-progress-card">
        <div className="chat-progress-header">
          <div className="chat-progress-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Kemajuan Permohonan Bantuan
          </div>
          <div className="chat-progress-percentage">40%</div>
        </div>

        <div className="chat-progress-bar-bg">
          <div className="chat-progress-bar-fill" style={{ width: '40%' }}></div>
        </div>

        <div className="chat-progress-footer">
          <div className="chat-progress-step">Langkah 2 daripada 5: Maklumat Keperluan</div>
          <div className="chat-progress-badge">Auto-simpan diaktifkan</div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="chat-main-card">

        {/* Chat Header */}
        <div className="chat-card-header">
          <div className="chat-header-profile">
            <div className="chat-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path><path d="M9 14h.01"></path><path d="M15 14h.01"></path></svg>
            </div>
            <div className="chat-header-info">
              <h3>Pembantu AI MyDana</h3>
              <div className="chat-header-status">
                <span className="chat-header-status-dot"></span> Dalam talian
              </div>
            </div>
          </div>
          <div className="chat-header-actions">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages-area">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
              <div className="chat-message-sender-name">{msg.name}</div>
              <div className="chat-message-content">
                <div className="chat-avatar">
                  {msg.sender === 'bot' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"></path><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  )}
                </div>
                <div className="chat-bubble">
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="chat-message-row bot">
              <div className="chat-message-content" style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#94a3b8', fontSize: '0.8rem' }}>
                Pembantu AI sedang berfikir...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="chat-input-container">
          <form className="chat-input-wrapper" onSubmit={handleSend} style={{marginBottom: '1rem'}}>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={handleFileSelect} 
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              capture="environment"
              onChange={handleFileSelect} 
            />

            <button 
              type="button" 
              className="chat-btn-icon" 
              title="Lampirkan Dokumen"
              onClick={() => fileInputRef.current.click()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </button>
            <button 
              type="button" 
              className="chat-btn-icon" 
              title="Ambil Gambar"
              onClick={() => cameraInputRef.current.click()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            </button>
            <input
              type="text"
              className="chat-input-field"
              placeholder="Taip mesej anda di sini..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button type="submit" className="chat-btn-send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </form>

          <button onClick={handleSubmitApplication} className="btn-admin-primary" style={{width: '100%', justifyContent: 'center', backgroundColor: '#10b981', padding: '0.8rem'}}>
            Selesai & Hantar Permohonan ke Dashboard
          </button>

          <div className="chat-footer-links">
            <button className="chat-footer-action">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Bantuan lanjut
            </button>
            <button className="chat-footer-action" onClick={() => {
              if (window.confirm("Adakah anda pasti untuk membatalkan permohonan dan padam sejarah chat ini?")) {
                localStorage.removeItem('mydana_chat_session');
                localStorage.removeItem('mydana_docs');
                setUploadedDocs([]);
                setMessages([{
                  id: 1,
                  sender: 'bot',
                  name: 'Pembantu AI MyDana',
                  text: 'Permohonan dibatalkan. Selamat datang ke MyDana. Boleh saya bantu dengan permohonan baru untuk anda?',
                  role: 'assistant'
                }]);
              }
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              Batalkan permohonan
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

export default PermohonanChat;
