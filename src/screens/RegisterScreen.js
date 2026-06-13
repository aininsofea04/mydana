import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image, ImageBackground
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { COLORS } from '../constants';

export default function RegisterScreen({ navigation }) {
  const [nama, setNama] = useState('');
  const [emel, setEmel] = useState('');
  const [telefon, setTelefon] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    if (!nama || !emel || !telefon || !password) {
      setError('Sila isi semua maklumat.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emel, password);
      const user = userCredential.user;

      // Auto-generate username from name
      const baseUsername = nama.toLowerCase().replace(/[^a-z0-9]/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const username = `${baseUsername || 'user'}${randomSuffix}`;

      await setDoc(doc(db, 'users', user.uid), {
        nama, emel, telefon, role: 'user', username, createdAt: serverTimestamp(),
      });
      setSuccess('Akaun berjaya didaftar!');
      Alert.alert('Berjaya', 'Akaun anda berjaya didaftar!');
      setNama(''); setEmel(''); setTelefon(''); setPassword('');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Emel ini telah digunakan. Sila log masuk.');
      } else if (err.code === 'auth/weak-password') {
        setError('Kata laluan terlalu lemah. Minimum 6 aksara.');
      } else {
        setError(`Gagal mendaftar: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Nama Penuh', icon: 'user', value: nama, setter: setNama, placeholder: 'Ali bin Abu', type: 'default' },
    { label: 'Alamat Emel', icon: 'mail', value: emel, setter: setEmel, placeholder: 'ali@example.com', type: 'email-address' },
    { label: 'Nombor Telefon', icon: 'smartphone', value: telefon, setter: setTelefon, placeholder: '012-3456789', type: 'phone-pad' },
  ];

  return (
    <ImageBackground source={require('../../assets/bg_general.jpg')} style={styles.backgroundImage} resizeMode="cover">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerIcon}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImg} />
          </View>
          <Text style={styles.title}>Daftar Akaun Baru</Text>
          <Text style={styles.subtitle}>Sila isi maklumat anda untuk bermula.</Text>

          {/* Error / Success */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={[styles.errorBox, { backgroundColor: COLORS.successBg, borderColor: '#a7f3d0' }]}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={[styles.errorText, { color: COLORS.success }]}>{success}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          {fields.map((field) => (
            <View key={field.label}>
              <Text style={styles.label}>{field.label}</Text>
              <View style={styles.inputWrapper}>
                <Feather name={field.icon} size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  value={field.value}
                  onChangeText={field.setter}
                  keyboardType={field.type}
                  autoCapitalize={field.type === 'email-address' ? 'none' : 'words'}
                />
              </View>
            </View>
          ))}

          {/* Password */}
          <Text style={styles.label}>Kata Laluan</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 aksara"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.btnPrimary, (loading || !!success) && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading || !!success}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>
              {loading ? 'Mendaftar...' : success ? 'Berjaya Didaftar!' : 'Daftar Sekarang'}
            </Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Sudah mempunyai akaun? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Log Masuk</Text>
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
  headerIcon: {
    width: 80, height: 80, borderRadius: 40, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20,
  },
  logoImg: { width: 80, height: 80 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 24 },
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  footerLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
