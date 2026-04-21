import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth, storage } from '../firebase';
import { collection, addDoc, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLORS, SYSTEM_PROMPT, callGroqAPI } from '../constants';

const INITIAL_MSG = {
  id: '1', sender: 'bot', name: 'Pembantu AI MyDana',
  text: 'Selamat datang ke MyDana. Saya adalah Pembantu AI anda. Mari kita mulakan permohonan anda. Boleh saya tahu nama penuh anda?',
  role: 'assistant',
};

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [existingApp, setExistingApp] = useState(null);
  const [checkingApp, setCheckingApp] = useState(true);
  const flatListRef = useRef(null);

  // Load saved session
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem('mydana_chat_session');
        if (saved) setMessages(JSON.parse(saved));
        const docs = await AsyncStorage.getItem('mydana_docs');
        if (docs) setUploadedDocs(JSON.parse(docs));
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  // Check existing application
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const docSnap = await getDoc(doc(db, 'applications', user.uid));
          if (docSnap.exists()) setExistingApp(docSnap.data());
        } catch (e) { console.error(e); }
      }
      setCheckingApp(false);
    });
    return unsub;
  }, []);

  // Auto-save chat
  useEffect(() => {
    AsyncStorage.setItem('mydana_chat_session', JSON.stringify(messages));
    AsyncStorage.setItem('mydana_docs', JSON.stringify(uploadedDocs));
  }, [messages, uploadedDocs]);

  // Auth check
  if (!auth.currentUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={32} color={COLORS.secondary} />
          <Text style={styles.accessTitle}>Log Masuk Diperlukan</Text>
          <Text style={styles.accessText}>Sila log masuk terlebih dahulu.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnPrimaryText}>Log Masuk Sekarang</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (checkingApp) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Menyemak status permohonan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Existing application states
  if (existingApp) {
    const status = existingApp.status || 'pending';
    let icon, color, title, desc, bgColor;
    if (status === 'approved') {
      icon = 'checkmark-circle'; color = COLORS.success; bgColor = COLORS.successBg;
      title = 'Permohonan Diluluskan!';
      desc = 'Tahniah! Permohonan anda telah diluluskan oleh Panel Pentadbir MyDana.';
    } else if (status === 'rejected') {
      icon = 'close-circle'; color = COLORS.error; bgColor = COLORS.errorBg;
      title = 'Permohonan Ditolak';
      desc = `Alasan: "${existingApp.reason || '-'}"`;
    } else {
      icon = 'time'; color = COLORS.secondary; bgColor = '#e0f2fe';
      title = 'Sedang Diproses';
      desc = 'Permohonan anda sedang menunggu semakan pengesahan.';
    }

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={[styles.statusCircle, { backgroundColor: bgColor }]}>
            <Ionicons name={icon} size={40} color={color} />
          </View>
          <Text style={[styles.statusTitle, { color }]}>{title}</Text>
          <Text style={styles.statusDesc}>{desc}</Text>
          {status === 'rejected' && (
            <TouchableOpacity style={styles.btnPrimary} onPress={async () => {
              Alert.alert('Mohon Semula', 'Padam rekod lama dan buat permohonan baharu?', [
                { text: 'Batal' },
                { text: 'Ya', onPress: async () => {
                  try {
                    if (auth.currentUser) await deleteDoc(doc(db, 'applications', auth.currentUser.uid));
                    setExistingApp(null);
                    await AsyncStorage.multiRemove(['mydana_chat_session', 'mydana_docs']);
                    setUploadedDocs([]);
                    setMessages([{ ...INITIAL_MSG, text: 'Selamat datang kembali. Mari mulakan permohonan baru.' }]);
                  } catch (e) { Alert.alert('Ralat', 'Gagal memadam rekod lama.'); }
                }},
              ]);
            }}>
              <Text style={styles.btnPrimaryText}>Mohon Semula</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.goBack()}>
            <Text style={styles.btnOutlineText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Chat handlers
  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = { id: Date.now().toString(), sender: 'user', name: 'Pemohon', text: inputText, role: 'user' };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputText('');
    setIsTyping(true);
    try {
      const groqHistory = newMsgs.map(m => ({ role: m.role, content: m.text }));
      const reply = await callGroqAPI([{ role: 'system', content: SYSTEM_PROMPT }, ...groqHistory]);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', name: 'Pembantu AI MyDana', text: reply, role: 'assistant' }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', name: 'Sistem', text: 'Koneksi AI terputus.', role: 'assistant' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
      if (result.canceled) return;
      const file = result.assets[0];
      setIsTyping(true);
      const userText = `[Dokumen dimuat naik: ${file.name}]`;
      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        setUploadedDocs(prev => [...prev, { name: file.name, url: downloadURL }]);
      } catch (e) { console.error('Upload error:', e); }
      await proceedWithChat(userText);
    } catch (e) { console.error(e); setIsTyping(false); }
  };

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Kebenaran Ditolak', 'Sila benarkan akses kamera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;
    setIsTyping(true);
    const uri = result.assets[0].uri;
    const fileName = `photo_${Date.now()}.jpg`;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `documents/${fileName}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      setUploadedDocs(prev => [...prev, { name: fileName, url: downloadURL }]);
    } catch (e) { console.error('Upload error:', e); }
    await proceedWithChat(`[Gambar diambil: ${fileName}]`);
  };

  const proceedWithChat = async (userText) => {
    const userMsg = { id: Date.now().toString(), sender: 'user', name: 'Pemohon', text: userText, role: 'user' };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    try {
      const groqHistory = newMsgs.map(m => ({ role: m.role, content: m.text }));
      const reply = await callGroqAPI([{ role: 'system', content: SYSTEM_PROMPT }, ...groqHistory]);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', name: 'Pembantu AI MyDana', text: reply, role: 'assistant' }]);
    } catch (e) { console.error(e); }
    setIsTyping(false);
  };

  const handleSubmit = async () => {
    Alert.alert('Hantar Permohonan', 'Adakah anda pasti?', [
      { text: 'Batal' },
      { text: 'Hantar', onPress: async () => {
        setIsTyping(true);
        try {
          const score = 50 + Math.min(messages.length * 5, 45) + Math.floor(Math.random() * 5);
          const user = auth.currentUser;
          const appData = {
            name: user?.displayName || user?.email?.split('@')[0] || 'Pemohon',
            category: 'Permohonan Bantuan', score,
            scoreClass: score >= 80 ? 'high' : score > 60 ? 'medium' : 'low',
            createdAt: serverTimestamp(), transcript: messages, documents: uploadedDocs,
          };
          await setDoc(doc(db, 'applications', user.uid), appData);
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', name: 'Sistem', text: 'Tahniah! Permohonan anda telah dihantar kepada Panel Pentadbir MyDana!', role: 'assistant' }]);
          await AsyncStorage.multiRemove(['mydana_chat_session', 'mydana_docs']);
          setExistingApp({ ...appData, status: 'pending' });
        } catch (e) {
          console.error(e);
          Alert.alert('Ralat', 'Gagal menghantar permohonan.');
        } finally { setIsTyping(false); }
      }},
    ]);
  };

  const renderMessage = ({ item }) => (
    <View style={[styles.msgRow, item.sender === 'user' && styles.msgRowUser]}>
      <View style={[styles.avatar, item.sender === 'user' && styles.avatarUser]}>
        <Ionicons
          name={item.sender === 'bot' ? 'chatbubble-ellipses' : 'person'}
          size={16}
          color={item.sender === 'bot' ? COLORS.primary : '#fff'}
        />
      </View>
      <View style={[styles.bubble, item.sender === 'user' && styles.bubbleUser]}>
        <Text style={styles.senderName}>{item.name}</Text>
        <Text style={[styles.msgText, item.sender === 'user' && { color: '#fff' }]}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Pembantu AI MyDana</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Dalam talian</Text>
          </View>
        </View>
        <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={10}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={isTyping ? (
            <Text style={styles.typingText}>Pembantu AI sedang berfikir...</Text>
          ) : null}
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleFilePick}>
            <Feather name="paperclip" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleCamera}>
            <Feather name="camera" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            placeholder="Taip mesej anda..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.submitBtnText}>Selesai & Hantar Permohonan</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  accessTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  accessText: { fontSize: 14, color: COLORS.textSecondary, marginVertical: 12, textAlign: 'center' },
  loadingText: { fontSize: 14, color: COLORS.textMuted, marginTop: 12 },
  statusCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  statusTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  statusDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 20 },
  btnPrimary: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border },
  btnOutlineText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  onlineText: { fontSize: 12, color: COLORS.textMuted },
  msgList: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end', gap: 8 },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#e0e7ff',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarUser: { backgroundColor: COLORS.primary },
  bubble: {
    backgroundColor: COLORS.surface, padding: 12, borderRadius: 16,
    borderBottomLeftRadius: 4, maxWidth: '78%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary, borderBottomLeftRadius: 16, borderBottomRightRadius: 4,
  },
  senderName: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginBottom: 4 },
  msgText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  typingText: { fontSize: 13, fontStyle: 'italic', color: COLORS.textMuted, paddingHorizontal: 16, paddingVertical: 8 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  iconBtn: { padding: 8 },
  chatInput: {
    flex: 1, backgroundColor: COLORS.borderLight, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    maxHeight: 100, color: COLORS.text,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.success, paddingVertical: 14, marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
