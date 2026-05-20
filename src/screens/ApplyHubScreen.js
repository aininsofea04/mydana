import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';

export default function ApplyHubScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pusat Permohonan</Text>
      </View>
      <View style={styles.container}>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Chat')}>
          <Ionicons name="chatbubbles-outline" size={50} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Mohon Dana</Text>
          <Text style={styles.cardDesc}>Berbual dengan AI Chatbot kami untuk memulakan permohonan dana baharu secara interaktif.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Status')}>
          <Ionicons name="document-text-outline" size={50} color={COLORS.secondary} />
          <Text style={styles.cardTitle}>Lihat Status Permohonan</Text>
          <Text style={styles.cardDesc}>Semak status terkini permohonan anda atau muat naik kandungan kempen bagi yang telah diluluskan.</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  container: { flex: 1, padding: 20, gap: 20, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.surface, padding: 30, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderLight
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  cardDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});
