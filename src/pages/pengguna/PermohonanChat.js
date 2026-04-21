import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '../../firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Groq from 'groq-sdk';
import '../../css/PermohonanChat.css';
import { GROQ_API_KEY } from '../../constants';

const groq = new Groq({
  apiKey: GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

const SYSTEM_PROMPT = `
Anda adalah Chatbot AI MyDana. Tugas anda adalah mengumpul maklumat kempen sumbangan dengan teliti untuk mengelakkan penipuan dan memastikan maklumat yang diberikan adalah sahih. Anda juga perlu menggunakan Bahasa Melayu yang betul sebagai bahasa utama. Sekiranya pemohon minta untuk tukar bahasa baru, anda boleh tukar bahasa mengikut permintaan pemohon.

ALIRAN SOALAN WAJIB (Tanya satu per satu pastikan tidak tertinggal):
1. Tajuk Permohonan (Contoh: Bantuan Kos Pembedahan Jantung).
2. Lokasi Pemohon (Bandar & Negeri).
3. Deskripsi & Maklumat Penuh (Kenapa dana diperlukan secara terperinci).
4. Jumlah Dana diperlukan (RM).
5. Maklumat Akaun Bank (Nama Bank & No. Akaun). Maklumkan bahawa nama akaun MESTI sepadan dengan nama pemohon.
6. Minta lampiran dokumen sokongan berikut:
   - Bil/Invois Rasmi (Hospital/Badan berkaitan).
   - Penyata Bank (Bank Statement) untuk pengesahan akaun.
   - Sebut harga (Quotation) bagi keperluan yang dipohon.

GAYA KOMUNIKASI:
- Profesional, empati, dan berintegriti.
- Pastikan maklumat bank diberikan sebelum menamatkan chat.
- Beritahu pengguna bahawa data ini akan disemak secara manual oleh Admin MyDana.
`;

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
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...newHistory.map(m => ({ role: m.role, content: m.text }))],
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
      });

      setMessages(prev => [...prev, {
        id: prev.length + 1, sender: 'bot', name: 'Pakar Verifikasi MyDana',
        text: completion.choices[0]?.message?.content, role: 'assistant'
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
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.map(m => ({ role: m.role, content: m.text })), { role: 'user', content: systemLog }],
        model: "llama-3.3-70b-versatile",
      });

      setMessages(prev => [...prev, { id: prev.length + 1, sender: 'bot', name: 'Pakar Verifikasi MyDana', text: completion.choices[0]?.message?.content, role: 'assistant' }]);
    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };

  const handleSubmitApplication = async () => {
    if (!isValidated) {
      alert("AI mengesan maklumat belum lengkap (No. Akaun Bank atau butiran permohonan diperlukan). Sila teruskan berbual.");
      return;
    }

    setIsTyping(true);
    try {
      // Menjana ringkasan untuk ADMIN
      const analysis = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: "Hasilkan rumusan permohonan dalam JSON format: {tajuk, lokasi, jumlah_rm, bank_info, ringkasan_kes, tahap_risiko}" },
          ...messages.map(m => ({ role: m.role, content: m.text }))
        ],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }
      });

      const aiAnalysis = JSON.parse(analysis.choices[0].message.content);

      const appData = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        status: 'pending',
        details: aiAnalysis,
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