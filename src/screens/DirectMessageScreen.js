import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { COLORS } from '../constants';

export default function DirectMessageScreen({ route, navigation }) {
  const { chatId, otherUserId, otherUserName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      setMessages(msgs);
    }, (error) => {
      console.error("Listener error:", error);
    });
    return unsub;
  }, [chatId]);

  const handleSend = async () => {
    if (text.trim() === '') return;
    const msgText = text.trim();
    setText('');
    
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msgText,
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: msgText,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Gagal menghantar mesej", e);
      Alert.alert("Ralat", `Mesej tidak dihantar: ${e.message}`);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUser.uid;
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
          <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.avatarMini}>
          <Text style={styles.avatarMiniText}>{otherUserName ? otherUserName[0].toUpperCase() : 'U'}</Text>
        </View>
        <Text style={styles.headerTitle}>{otherUserName}</Text>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContent}
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Taip mesej..."
            placeholderTextColor={COLORS.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={!text.trim()}>
            <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', alignItems: 'center', padding: 16, 
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border 
  },
  backBtn: { marginRight: 12 },
  avatarMini: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 10
  },
  avatarMiniText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, flex: 1 },
  container: { flex: 1 },
  listContent: { padding: 16, gap: 8 },
  msgWrapper: { width: '100%', flexDirection: 'row', marginBottom: 12 },
  msgWrapperMe: { justifyContent: 'flex-end' },
  msgWrapperOther: { justifyContent: 'flex-start' },
  msgBubble: {
    maxWidth: '80%', padding: 12, borderRadius: 20,
  },
  msgBubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#e2e8f0', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: '#fff' },
  msgTextOther: { color: COLORS.text },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, 
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  input: {
    flex: 1, backgroundColor: COLORS.borderLight, borderRadius: 20, paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100, fontSize: 15, color: COLORS.text,
  },
  sendBtn: {
    width: 45, height: 45, borderRadius: 22.5, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: 10,
  }
});
