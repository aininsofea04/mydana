import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image, ImageBackground
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLORS } from '../constants';

export default function LoginScreen({ navigation }) {
  const [emel, setEmel] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!emel || !password) {
      setError('Sila masukkan emel dan kata laluan.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, emel, password);
      Alert.alert('Berjaya', 'Log masuk berjaya! Selamat kembali.');
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        setError('Emel atau kata laluan tidak tepat.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Tiada akaun dijumpai dengan emel ini.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Kata laluan tidak tepat.');
      } else {
        setError(`Log masuk gagal: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    const emailTrimmed = emel.trim();
    if (!emailTrimmed) {
      Alert.alert('Info Diperlukan', 'Sila masukkan alamat e-mel anda terlebih dahulu untuk menetapkan semula kata laluan.');
      return;
    }
    setLoading(true);
    try {
      // Semak sama ada e-mel wujud di Firestore (users collection)
      const q = query(collection(db, 'users'), where('emel', '==', emailTrimmed));
      const snap = await getDocs(q);
      
      let isRegistered = !snap.empty || emailTrimmed.toLowerCase() === 'admin@admin.com';
      
      if (!isRegistered) {
        // Semakan sandaran jika huruf besar/kecil tidak sepadan
        const allUsersSnap = await getDocs(collection(db, 'users'));
        allUsersSnap.forEach(d => {
          const uData = d.data();
          if (uData.emel && uData.emel.trim().toLowerCase() === emailTrimmed.toLowerCase()) {
            isRegistered = true;
          }
        });
      }

      if (!isRegistered) {
        setError('Emel ini belum didaftarkan.');
        Alert.alert('Ralat', 'Alamat e-mel ini belum didaftarkan dalam sistem MyDana.');
        setLoading(false);
        return;
      }

      await sendPasswordResetEmail(auth, emailTrimmed);
      Alert.alert('E-mel Dihantar', `Pautan untuk menetapkan semula kata laluan telah dihantar ke e-mel: ${emailTrimmed}`);
    } catch (err) {
      if (err.code === 'auth/invalid-email') {
        setError('Format alamat e-mel tidak sah.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Tiada akaun dijumpai dengan e-mel ini.');
      } else {
        setError(`Gagal menghantar e-mel set semula: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={require('../../assets/bg_general.jpg')} style={styles.backgroundImage} resizeMode="cover">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>

            {/* Top Illustration */}
            <View style={styles.illustration}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImg} />
            </View>

            {/* Header */}
            <Text style={styles.title}>Selamat Datang ke MyDana</Text>
            <Text style={styles.subtitle}>Sila masukkan butiran anda untuk mengakses akaun.</Text>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <Text style={styles.label}>Alamat E-mel</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="ali@email.com"
                placeholderTextColor={COLORS.textMuted}
                value={emel}
                onChangeText={(val) => {
                  setEmel(val);
                  setError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Field */}
            <Text style={styles.label}>Kata Laluan</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  setError('');
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={handleForgotPassword}
              activeOpacity={0.8}
            >
              <Text style={styles.forgotBtnText}>Lupa kata laluan?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'Sila tunggu...' : 'Log Masuk'}
              </Text>
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Belum mempunyai akaun? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.footerLink}>Daftar sekarang</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginTop: 12, marginBottom: 10, padding: 4, alignSelf: 'flex-start' },
  illustration: { alignItems: 'center', marginBottom: 24 },
  logoImg: { width: 90, height: 90, borderRadius: 45 },
  title: {
    fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 8, lineHeight: 36,
  },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 24, lineHeight: 22 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.errorBg, padding: 12, borderRadius: 10, marginBottom: 16,
    borderWidth: 1, borderColor: '#fecaca',
  },
  errorText: { color: COLORS.error, fontSize: 13, flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 12 },
  btnPrimary: {
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: {
    flexDirection: 'row', justifyContent: 'center', marginTop: 28,
  },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  footerLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  forgotBtn: { alignSelf: 'center', marginBottom: 20, marginTop: -8 },
  forgotBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
});
