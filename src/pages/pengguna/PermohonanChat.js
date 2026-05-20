import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '../../firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Groq from 'groq-sdk';
import '../../css/PermohonanChat.css';
import { GROQ_API_KEY } from '../../constants';
import { getSystemPrompt, callGroqAPI, analyzeApplication } from '../../aiService';
function PermohonanChat() {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isValidated, setIsValidated] = useState(false); // Fungsi Auto-Validation
  const [messages, setMessages] = useState(() => {
    const savedSession = localStorage.getItem('mydana_chat_session');
    if (savedSession) {
      try { return JSON.parse(savedSession); } catch (e) { console.error(e); }
    }
    return [{
      id: 1, sender: 'bot', name: 'Pakar Verifikasi MyDana',
      text: 'Selamat datang ke proses verifikasi MyDana. Saya akan membantu anda menyediakan maklumat kempen yang lengkap dan selamat. Boleh saya tahu, apakah tajuk kempen bantuan anda?',
      role: 'assistant'
    }];
  });

  const [uploadedDocs, setUploadedDocs] = useState(() => {
    const savedDocs = localStorage.getItem('mydana_docs');
    return savedDocs ? JSON.parse(savedDocs) : [];
  });

  const [existingApp, setExistingApp] = useState(null);
  const [checkingApp, setCheckingApp] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const docSnap = await getDoc(doc(db, 'applications', user.uid));
        if (docSnap.exists()) setExistingApp(docSnap.data());
      }
      setCheckingApp(false);
    });
    return () => unsubscribe();
  }, []);

  // AUTO-VALIDATION: Menyemak jika input kritikal wujud dalam transkrip
  useEffect(() => {
    const chatText = messages.map(m => m.text).join(' ').toLowerCase();
    // Syarat: Mesti ada No Akaun (anggaran digit) dan maklumat bank
    const hasBankInfo = chatText.match(/\d{10,}/) || chatText.includes('maybank') || chatText.includes('cimb');
    const isLengthEnough = messages.length >= 8; // Anggaran minimum soalan terjawab

    setIsValidated(hasBankInfo && isLengthEnough);
    localStorage.setItem('mydana_chat_session', JSON.stringify(messages));
    localStorage.setItem('mydana_docs', JSON.stringify(uploadedDocs));
  }, [messages, uploadedDocs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = { id: messages.length + 1, sender: 'user', name: 'Pemohon', text: inputText, role: 'user' };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText('');
    setIsTyping(true);

    try {
      const reply = await callGroqAPI([
        { role: 'system', content: getSystemPrompt(existingApp) }, 
        ...newHistory.map(m => ({ role: m.role, content: m.text }))
      ]);

      setMessages(prev => [...prev, {
        id: prev.length + 1, sender: 'bot', name: 'Pakar Verifikasi MyDana',
        text: reply, role: 'assistant'
      }]);
    } catch (error) { console.error(error); } finally { setIsTyping(false); }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsTyping(true);

    try {
      const storageRef = ref(storage, `docs_kempen/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setUploadedDocs(prev => [...prev, { name: file.name, url }]);

      const systemLog = `[SISTEM: Dokumen '${file.name}' berjaya dimuat naik]`;
      setMessages(prev => [...prev, { id: prev.length + 1, sender: 'user', name: 'Sistem', text: systemLog, role: 'user' }]);

      // Memberitahu AI tentang fail yang baru masuk
      const reply = await callGroqAPI([
        { role: 'system', content: getSystemPrompt(existingApp) }, 
        ...messages.map(m => ({ role: m.role, content: m.text })), 
        { role: 'user', content: systemLog }
      ]);

      setMessages(prev => [...prev, { id: prev.length + 1, sender: 'bot', name: 'Pakar Verifikasi MyDana', text: reply, role: 'assistant' }]);
    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };

  const handleSubmitApplication = async () => {
    if (!isValidated) {
      alert("AI mengesan maklumat belum lengkap (No. Akaun Bank atau butiran permohonan diperlukan). Sila teruskan berbual.");
      return;
    }

    setIsTyping(true);
    try {
      // Menggunakan analisis berpusat di constants.js
      const aiAnalysis = await analyzeApplication(messages);

      const appData = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        category: aiAnalysis.summary.kategori || 'Umum',
        status: 'pending',
        details: aiAnalysis.summary, // Sesuai dengan struktur baru
        aiAnalysis: aiAnalysis.analysis, // Tambah analisis terperinci
        score: aiAnalysis.analysis?.skor || 0,
        scoreClass: aiAnalysis.analysis?.skor >= 80 ? 'high' : (aiAnalysis.analysis?.skor > 60 ? 'medium' : 'low'),
        transcript: messages,
        documents: uploadedDocs,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'applications', auth.currentUser.uid), appData);
      setExistingApp(appData);
      localStorage.clear();
    } catch (err) { alert("Ralat semasa menghantar permohonan."); } finally { setIsTyping(false); }
  };

  if (checkingApp) return <div className="loading">Menyemak status permohonan...</div>;

  if (existingApp) {
    return (
      <div className="status-container">
        <div className={`status-card ${existingApp.status}`}>
          <h2>Permohonan: {existingApp.status.toUpperCase()}</h2>
          <p>Tajuk: {existingApp.details?.tajuk}</p>
          <p>Maklumat anda sedang disemak oleh Admin MyDana mengikut protokol integriti kami.</p>
          {existingApp.status === 'rejected' && (
            <button onClick={() => deleteDoc(doc(db, 'applications', auth.currentUser.uid)).then(() => setExistingApp(null))}>
              Mohon Semula
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page-container">
      <div className="chat-main-card">
        <div className="chat-card-header">
          <h3>Pakar Verifikasi AI MyDana</h3>
          <span className={isValidated ? "badge-success" : "badge-warning"}>
            {isValidated ? "Maklumat Lengkap" : "Menunggu Maklumat"}
          </span>
        </div>

        <div className="chat-messages-area">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
              <div className="chat-bubble">{msg.text}</div>
            </div>
          ))}
          {isTyping && <div className="typing-indicator">AI sedang menganalisis data...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <form className="chat-input-wrapper" onSubmit={handleSend}>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current.click()} className="btn-attach">📎</button>
            <input
              type="text"
              className="chat-input-field"
              placeholder="Berikan jawapan anda..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button type="submit" className="chat-btn-send">Hantar</button>
          </form>

          <button
            onClick={handleSubmitApplication}
            className={`btn-submit-final ${!isValidated ? 'disabled' : ''}`}
            disabled={!isValidated}
          >
            {isValidated ? "Hantar Permohonan Sekarang" : "Sila lengkapkan maklumat chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermohonanChat;