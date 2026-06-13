import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform, ImageBackground
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { db, auth } from '../firebase';
import { doc, addDoc, collection, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function PaymentScreen({ route, navigation }) {
  const { campaign } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('20');
  const [customAmount, setCustomAmount] = useState('');
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('fpx');

  const inputRef = useRef(null);
  const presetAmounts = ['20', '25', '40', '60', '100'];

  const handlePay = async () => {
    const finalAmount = isOtherSelected ? customAmount : amount;
    const amountNum = parseFloat(finalAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Ralat', 'Sila masukkan jumlah sumbangan yang sah.');
      return;
    }

    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      const campName = campaign?.name || campaign?.summary?.tajuk || 'Kempen MyDana';

      // Demo mode: Save donation directly to Firestore
      await addDoc(collection(db, 'donations'), {
        userId: currentUser?.uid || 'anonymous',
        userName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Penyumbang',
        userEmail: currentUser?.email || 'demo@mydana.com',
        campaignId: campaign?.id || '',
        campaignName: campName,
        amount: amountNum,
        paymentMethod: paymentMethod,
        status: 'completed',
        isDemo: true,
        createdAt: serverTimestamp(),
      });

      // Update the campaign's collected amount
      if (campaign?.id) {
        const campRef = doc(db, 'applications', campaign.id);
        const campSnap = await getDoc(campRef);
        if (campSnap.exists()) {
          const currentCollected = campSnap.data().collectedAmount || 0;
          await updateDoc(campRef, {
            collectedAmount: currentCollected + amountNum,
          });
        }
      }

      setLoading(false);
      Alert.alert(
        '✅ Berjaya! (Demo)',
        `Sumbangan RM ${amountNum.toFixed(2)} telah direkodkan untuk kempen "${campName}".\n\nNota: Ini adalah mod demo. Tiada pembayaran sebenar dibuat.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setLoading(false);
      console.error('Demo payment error:', error);
      Alert.alert('Ralat', 'Gagal merekodkan sumbangan. Sila cuba lagi.');
    }
  };

  const currentDisplayAmount = isOtherSelected ? customAmount : amount;

  return (
    <ImageBackground source={require('../../assets/bg_general.jpg')} style={styles.backgroundImage} resizeMode="cover">
      <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sumbangan Dana</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Main Amount Display (Now supports interactive input when 'Other' is active) */}
          <View style={[styles.amountDisplayBox, isOtherSelected && styles.amountDisplayBoxActive]}>
            <Text style={styles.amountDisplayCurrency}>RM</Text>
            {isOtherSelected ? (
              <TextInput
                ref={inputRef}
                style={styles.amountDisplayText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#cbd5e1"
                value={customAmount}
                onChangeText={setCustomAmount}
                autoFocus
              />
            ) : (
              <Text style={styles.amountDisplayText}>{currentDisplayAmount}</Text>
            )}
          </View>

          {/* Preset Grid */}
          <View style={styles.gridContainer}>
            {presetAmounts.map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.gridItem, amount === val && !isOtherSelected && styles.gridItemActive]}
                onPress={() => {
                  setAmount(val);
                  setIsOtherSelected(false);
                  setCustomAmount('');
                }}
              >
                <Text style={[styles.gridText, amount === val && !isOtherSelected && styles.gridTextActive]}>
                  RM <Text style={{ fontSize: 20 }}>{val}</Text>
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.gridItem, isOtherSelected && styles.gridItemActive]}
              onPress={() => {
                setIsOtherSelected(true);
                setAmount('');
                // Small timeout to ensure the input is rendered before focusing
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
            >
              <Text style={[styles.gridText, isOtherSelected && styles.gridTextActive]}>Other</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Kaedah Pembayaran</Text>

          {/* FPX */}
          <TouchableOpacity
            style={[styles.methodCard, paymentMethod === 'fpx' && styles.methodCardActive]}
            onPress={() => setPaymentMethod('fpx')}
          >
            <View style={styles.radioContainer}>
              <View style={[styles.radioOuter, paymentMethod === 'fpx' && styles.radioActive]}>
                {paymentMethod === 'fpx' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.methodName}>Perbankan Dalam Talian (FPX)</Text>
            </View>
            <View style={styles.methodLogo}>
              <Text style={styles.logoText}>FPX</Text>
            </View>
          </TouchableOpacity>

          {/* Card */}
          <TouchableOpacity
            style={[styles.methodCard, paymentMethod === 'card' && styles.methodCardActive]}
            onPress={() => setPaymentMethod('card')}
          >
            <View style={styles.radioContainer}>
              <View style={[styles.radioOuter, paymentMethod === 'card' && styles.radioActive]}>
                {paymentMethod === 'card' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.methodName}>Kad Kredit / Debit</Text>
            </View>
            <Ionicons name="card-outline" size={24} color="#64748b" />
          </TouchableOpacity>

          {/* E-Wallet */}
          <TouchableOpacity
            style={[styles.methodCard, paymentMethod === 'wallet' && styles.methodCardActive]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <View style={styles.radioContainer}>
              <View style={[styles.radioOuter, paymentMethod === 'wallet' && styles.radioActive]}>
                {paymentMethod === 'wallet' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.methodName}>E-Wallet</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <View style={styles.miniLogo}><Text style={styles.miniLogoText}>TNG</Text></View>
              <View style={styles.miniLogo}><Text style={styles.miniLogoText}>GRABPAY</Text></View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, loading && { opacity: 0.8 }]}
            onPress={handlePay}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>
                SUMBANG · RM{parseFloat(currentDisplayAmount || 0).toFixed(0)}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  backBtn: { padding: 4 },
  scroll: { padding: 20 },

  amountDisplayBox: {
    backgroundColor: '#f1f5f9', borderRadius: 20, paddingVertical: 30,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: 'transparent'
  },
  amountDisplayBoxActive: { borderColor: '#0ea5e9', backgroundColor: '#fff' },
  amountDisplayCurrency: { fontSize: 24, fontWeight: '700', color: '#475569', marginRight: 8, marginTop: -10 },
  amountDisplayText: { fontSize: 60, fontWeight: '800', color: '#334155', minWidth: 60, textAlign: 'center' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  gridItem: {
    width: '31.3%', height: 75, backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center',
  },
  gridItemActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  gridText: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  gridTextActive: { color: '#0ea5e9' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 16 },

  methodCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 12, padding: 16, marginBottom: 12,
  },
  methodCardActive: { borderColor: '#3b82f6', backgroundColor: '#f8fafc' },
  radioContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1',
    justifyContent: 'center', alignItems: 'center'
  },
  radioActive: { borderColor: '#3b82f6' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  methodName: { fontSize: 14, fontWeight: '700', color: '#334155' },

  methodLogo: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  logoText: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
  miniLogo: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniLogoText: { fontSize: 8, fontWeight: '800', color: '#94a3b8' },

  confirmBtn: {
    backgroundColor: '#0ea5e9', height: 60, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
    shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4
  },
  confirmBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', textTransform: 'uppercase', textDecorationLine: 'underline' },
});
