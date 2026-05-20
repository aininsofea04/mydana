import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { COLORS } from '../constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const [emel, setEmel] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "449619888673-h2f3nki7u1c33quclhsfm4st5gu4ov3u.apps.googleusercontent.com",
    iosClientId: "449619888673-m1i1573nd48kuu3e2pcgv0555tpcuqcg.apps.googleusercontent.com",
    webClientId: "449619888673-h2f3nki7u1c33quclhsfm4st5gu4ov3u.apps.googleusercontent.com",
  }, {
    redirectUri: "https://auth.expo.io/@ainin/mydana",
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential)
        .then(() => {
          Alert.alert('Berjaya', 'Log masuk Google berjaya!');
        })
        .catch((err) => {
          setError(`Gagal log masuk Google: ${err.message}`);
        })
        .finally(() => setLoading(false));
    }
  }, [response]);

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

  const handleGoogleLogin = () => {
    promptAsync();
  };

  return (
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
            <View style={styles.illustCircle}>
              <Ionicons name="heart" size={40} color={COLORS.primary} style={{ opacity: 0.9 }} />
              <Ionicons name="hand-left-outline" size={24} color={COLORS.secondary} style={{ opacity: 0.8, position: 'absolute', bottom: 12, right: 16 }} />
            </View>
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
              placeholder="contoh@email.com"
              placeholderTextColor={COLORS.textMuted}
              value={emel}
              onChangeText={setEmel}
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
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

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

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerLine} />
          </View>

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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginTop: 12, marginBottom: 10, padding: 4, alignSelf: 'flex-start' },
  illustration: { alignItems: 'center', marginBottom: 24 },
  illustCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#e0e7ff',
    justifyContent: 'center', alignItems: 'center',
  },
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
  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.surface, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  footer: {
    flexDirection: 'row', justifyContent: 'center', marginTop: 28,
  },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  footerLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
