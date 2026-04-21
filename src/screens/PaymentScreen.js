import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS } from '../constants';

export default function PaymentScreen({ route, navigation }) {
  const { campaign } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);

  const banks = [
    { id: 'mbb', name: 'Maybank2U', logo: 'https://www.maybank2u.com.my/iwov-resources/images/common/logo/m2u_logo.png' },
    { id: 'cimb', name: 'CIMB Clicks', logo: 'https://www.cimbclicks.com.my/fb-browser/img/logo-cimb.png' },
    { id: 'pbe', name: 'Public Bank', logo: 'https://www.pbebank.com/images/logos/logo-pb-bank.aspx' },
    { id: 'rhb', name: 'RHB Now', logo: 'https://www.rhbgroup.com/common/img/rhb-logo.png' },
  ];

  const handlePay = () => {
    if (!selectedBank) {
      Alert.alert('Pilih Bank', 'Sila pilih bank anda untuk meneruskan pembayaran FPX.');
      return;
    }
    setLoading(true);
    // Simulate payment process
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Sumbangan Berjaya',
        `Terima kasih! Sumbangan anda kepada ${campaign?.name || 'kempen'} telah berjaya diproses.`,
        [{ text: 'OK', onPress: () => navigation.navigate('Kempen') }]
      );
    }, 2500);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pembayaran FPX</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Sumbangan Kepada:</Text>
          <Text style={styles.campaignName}>{campaign?.name || 'Kempen MyDana'}</Text>
          <View style={styles.divider} />
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Jumlah:</Text>
            <Text style={styles.amountVal}>RM 50.00</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Pilih Bank (FPX)</Text>
        <View style={styles.bankGrid}>
          {banks.map((bank) => (
            <TouchableOpacity
              key={bank.id}
              style={[styles.bankItem, selectedBank === bank.id && styles.bankItemSelected]}
              onPress={() => setSelectedBank(bank.id)}
            >
              <View style={styles.bankIconBg}>
                <Ionicons name="business" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.bankName}>{bank.name}</Text>
              {selectedBank === bank.id && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Feather name="shield" size={20} color={COLORS.success} />
          <Text style={styles.infoText}>
            Transaksi anda dilindungi oleh penyulitan SSL 256-bit yang selamat.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, loading && { opacity: 0.7 }]}
          onPress={handlePay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.payBtnText}>Bayar Sekarang</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scroll: { padding: 20 },
  summaryCard: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 24,
    marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  summaryLabel: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4 },
  campaignName: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginBottom: 16 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  amountVal: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bankItem: {
    width: '48%', backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  bankItemSelected: { borderColor: COLORS.primary, backgroundColor: '#f0f7ff' },
  bankIconBg: {
    width: 50, height: 50, borderRadius: 12, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  bankName: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  checkBadge: { position: 'absolute', top: 8, right: 8 },
  infoBox: {
    flexDirection: 'row', gap: 12, backgroundColor: COLORS.successBg,
    padding: 16, borderRadius: 14, marginTop: 24, alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  footer: { padding: 20, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  payBtn: {
    backgroundColor: COLORS.primary, flexDirection: 'row', height: 56,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  payBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
