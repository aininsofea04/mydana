import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, 
  Modal, TextInput, ActivityIndicator, Alert 
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { COLORS } from '../constants';

export default function InboxScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    
    // Listen to real chats where current user is a participant
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );
    
    const unsub = onSnapshot(q, async (snap) => {
      const chatsList = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const otherUserId = data.participants ? data.participants.find(uid => uid !== currentUser.uid) : null;
        
        // Dapatkan nama pengguna lain
        let otherUserName = 'Pengguna';
        if (otherUserId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', otherUserId));
            if (userSnap.exists()) {
              otherUserName = userSnap.data().nama || userSnap.data().emel || 'Pengguna';
            }
          } catch (e) { console.error(e); }
        }
        
        return {
          id: d.id,
          otherUserId,
          name: otherUserName,
          lastMessage: data.lastMessage || 'Tiada mesej',
          updatedAt: data.updatedAt,
          unread: false // TODO: implement read receipts if needed
        };
      }));
      
      // Sort manually as we can't orderBy on a different field when using array-contains
      chatsList.sort((a, b) => {
        const t1 = a.updatedAt?.seconds || 0;
        const t2 = b.updatedAt?.seconds || 0;
        return t2 - t1;
      });
      
      setChats(chatsList);
      setLoading(false);
    });
    
    return unsub;
  }, [currentUser]);

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      // Simpulan mudah: Dapatkan semua users, kemudian filter (sebab Firestore tak support text search secara natif dengan baik)
      const usersSnap = await getDocs(collection(db, 'users'));
      const foundUsers = [];
      const queryLower = searchQuery.toLowerCase();
      
      usersSnap.forEach(d => {
        const data = d.data();
        if (d.id !== currentUser.uid && 
            ((data.nama && data.nama.toLowerCase().includes(queryLower)) || 
             (data.emel && data.emel.toLowerCase().includes(queryLower)))) {
          foundUsers.push({ id: d.id, name: data.nama || data.emel });
        }
      });
      
      setUsers(foundUsers);
    } catch (e) {
      Alert.alert('Ralat', 'Gagal mencari pengguna.');
    }
    setSearching(false);
  };

  const startChat = async (selectedUser) => {
    setSearchModalVisible(false);
    try {
      // Create a unique chat ID based on UIDs
      const chatIds = [currentUser.uid, selectedUser.id].sort();
      const chatId = chatIds.join('_');
      
      // Check if chat exists, if not create it
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          participants: chatIds,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: ''
        });
      }
      
      navigation.navigate('DirectMessage', { 
        chatId, 
        otherUserId: selectedUser.id,
        otherUserName: selectedUser.name
      });
    } catch (e) {
      Alert.alert('Ralat', 'Gagal memulakan mesej.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mesej (Inbox)</Text>
      </View>
      <FlatList
        data={chats}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.msgItem} 
            onPress={() => navigation.navigate('DirectMessage', {
              chatId: item.id,
              otherUserId: item.otherUserId,
              otherUserName: item.name
            })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.msgContent}>
              <View style={styles.msgHeader}>
                <Text style={styles.msgName}>{item.name}</Text>
                {/* <Text style={styles.msgTime}>Semalam</Text> */}
              </View>
              <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbox-ellipses-outline" size={60} color={COLORS.border} />
            <Text style={styles.emptyText}>Tiada mesej baharu buat masa ini.</Text>
          </View>
        }
      />
      
      <TouchableOpacity 
        style={styles.fabBtn} 
        onPress={() => setSearchModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
      
      {/* Search Modal */}
      <Modal visible={searchModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cari Pengguna</Text>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Feather name="search" size={20} color={COLORS.textMuted} />
              <TextInput 
                style={styles.searchInput}
                placeholder="Cari nama atau emel..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchUsers}
                returnKeyType="search"
              />
            </View>
            
            {searching ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={users}
                keyExtractor={u => u.id}
                style={{ marginTop: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.userResult} onPress={() => startChat(item)}>
                    <View style={styles.userResultAvatar}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.name[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.userResultName}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  searchQuery.length > 0 && !searching ? (
                    <Text style={{ textAlign: 'center', marginTop: 20, color: COLORS.textMuted }}>Tiada pengguna dijumpai.</Text>
                  ) : null
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingTop: 40, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  msgItem: { flexDirection: 'row', padding: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  msgContent: { flex: 1 },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  msgName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  msgTime: { fontSize: 12, color: COLORS.textMuted },
  lastMsg: { fontSize: 14, color: COLORS.textSecondary },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: '40%' },
  emptyText: { fontSize: 16, color: COLORS.textMuted, marginTop: 14 },
  fabBtn: {
    position: 'absolute', right: 20, bottom: 20,
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.borderLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: COLORS.text },
  userResult: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  userResultAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userResultName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
});
