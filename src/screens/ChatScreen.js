import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard,
  FlatList, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { COLORS } from '../constants';
import { callGroqAPI, getSystemPrompt, analyzeDocument } from '../aiService';

// ─── DATA SENARAI ─────────────────────────────────────────────────────────────
const NEGERI_LIST = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
  'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur',
  'W.P. Labuan', 'W.P. Putrajaya',
];

const BANDAR_BY_NEGERI = {
  'Johor': ['Johor Bahru', 'Batu Pahat', 'Kluang', 'Muar', 'Segamat', 'Pontian', 'Kota Tinggi', 'Mersing', 'Kulai', 'Tangkak', 'Pasir Gudang', 'Yong Peng', 'Skudai'],
  'Kedah': ['Alor Setar', 'Sungai Petani', 'Kulim', 'Langkawi', 'Baling', 'Pendang', 'Yan', 'Kubang Pasu', 'Sik', 'Padang Terap', 'Pokok Sena', 'Jitra', 'Kuala Nerang', 'Bandar Baharu'],
  'Kelantan': ['Kota Bharu', 'Tanah Merah', 'Pasir Mas', 'Machang', 'Kuala Krai', 'Gua Musang', 'Tumpat', 'Pasir Puteh', 'Bachok', 'Jeli'],
  'Melaka': ['Melaka Bandaraya', 'Alor Gajah', 'Jasin', 'Masjid Tanah', 'Merlimau', 'Ayer Keroh', 'Klebang', 'Sungai Udang'],
  'Negeri Sembilan': ['Seremban', 'Port Dickson', 'Nilai', 'Rembau', 'Jempol', 'Tampin', 'Kuala Pilah', 'Jelebu', 'Bahau', 'Senawang'],
  'Pahang': ['Kuantan', 'Temerloh', 'Bentong', 'Raub', 'Jerantut', 'Cameron Highlands', 'Rompin', 'Pekan', 'Maran', 'Lipis', 'Bera', 'Mentakab'],
  'Perak': ['Ipoh', 'Taiping', 'Teluk Intan', 'Manjung', 'Kuala Kangsar', 'Batu Gajah', 'Gerik', 'Kampar', 'Tapah', 'Parit Buntar', 'Bagan Datuk', 'Tanjung Malim', 'Lumut', 'Seri Iskandar'],
  'Perlis': ['Kangar', 'Arau', 'Padang Besar', 'Kuala Perlis', 'Simpang Empat'],
  'Pulau Pinang': ['George Town', 'Butterworth', 'Bukit Mertajam', 'Bayan Lepas', 'Nibong Tebal', 'Perai', 'Kepala Batas', 'Balik Pulau', 'Jelutong', 'Air Itam', 'Tanjung Bungah'],
  'Sabah': ['Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu', 'Keningau', 'Beaufort', 'Kudat', 'Penampang', 'Semporna', 'Ranau', 'Papar', 'Tenom', 'Kota Belud', 'Tuaran'],
  'Sarawak': ['Kuching', 'Miri', 'Sibu', 'Bintulu', 'Sri Aman', 'Kapit', 'Limbang', 'Sarikei', 'Mukah', 'Samarahan', 'Betong', 'Serian', 'Lawas', 'Bau'],
  'Selangor': ['Shah Alam', 'Petaling Jaya', 'Subang Jaya', 'Klang', 'Kajang', 'Ampang', 'Rawang', 'Sepang', 'Puchong', 'Gombak', 'Selayang', 'Seri Kembangan', 'Banting', 'Kuala Selangor', 'Sabak Bernam', 'Semenyih', 'Cyberjaya'],
  'Terengganu': ['Kuala Terengganu', 'Kemaman', 'Dungun', 'Besut', 'Marang', 'Hulu Terengganu', 'Setiu', 'Kuala Nerus', 'Kerteh', 'Paka'],
  'W.P. Kuala Lumpur': ['Kuala Lumpur', 'Cheras', 'Bukit Bintang', 'Bangsar', 'Kepong', 'Setapak', 'Wangsa Maju', 'Segambut', 'Sentul', 'Pantai Dalam', 'Mont Kiara', 'Sri Petaling', 'Bandar Tun Razak'],
  'W.P. Labuan': ['Labuan', 'Victoria'],
  'W.P. Putrajaya': ['Putrajaya', 'Presint 1', 'Presint 2', 'Presint 3', 'Presint 4', 'Presint 5', 'Presint 8', 'Presint 9', 'Presint 11', 'Presint 14', 'Presint 15'],
};

const BANK_LIST = [
  'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank',
  'AmBank', 'Bank Islam', 'Bank Rakyat', 'BSN (Bank Simpanan Nasional)',
  'Affin Bank', 'Alliance Bank', 'OCBC Bank', 'Standard Chartered',
  'HSBC Bank', 'UOB Bank', 'Bank Muamalat', 'Agrobank',
];

// ─── DROPDOWN COMPONENT (must be outside any form component) ──────────────────
const DropdownSelect = ({ label, value, options, onSelect, placeholder, error }) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={[s.input, s.dropdownTrigger, error && s.inputError]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={value ? s.dropdownValue : s.dropdownPlaceholder}>
          {value || placeholder || 'Sila pilih...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#555" />
      </TouchableOpacity>
      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[s.modalItem, value === opt && s.modalItemActive]}
                  onPress={() => { onSelect(opt); setVisible(false); }}
                >
                  <Text style={[s.modalItemText, value === opt && s.modalItemTextActive]}>{opt}</Text>
                  {value === opt && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── FIELD COMPONENT ─────────────────────────────────────────────────────────
const Field = ({ label, fkey, placeholder, multiline, keyboardType, hint, form, setForm, errors }) => {
  const set = (val) => setForm(f => ({ ...f, [fkey]: val }));
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <TextInput
        style={[s.input, multiline && s.inputMulti, errors[fkey] && s.inputError]}
        placeholder={placeholder || ''}
        placeholderTextColor="#888"
        value={form[fkey]}
        onChangeText={set}
        multiline={!!multiline}
        numberOfLines={multiline || 1}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
      {errors[fkey] ? <Text style={s.errorText}>{errors[fkey]}</Text> : null}
    </View>
  );
};

// ─── DATE PICKER CALENDAR MODAL ──────────────────────────────────────────────
const MONTHS_MY = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogs', 'Sep', 'Okt', 'Nov', 'Dis'];
const DAYS_MY = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const DatePickerModal = ({ label, value, onSelect, error }) => {
  const [visible, setVisible] = useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const formatDate = (y, m, d) => `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={[s.input, s.dropdownTrigger, error && s.inputError]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={value ? s.dropdownValue : s.dropdownPlaceholder}>
          {value || 'Pilih tarikh...'}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={[s.modalSheet, { paddingBottom: 24 }]}>
            {/* Header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            {/* Month Nav */}
            <View style={s.calNav}>
              <TouchableOpacity onPress={prevMonth} style={s.calNavBtn}>
                <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={s.calMonthLabel}>{MONTHS_MY[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={s.calNavBtn}>
                <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {/* Day headers */}
            <View style={s.calDayRow}>
              {DAYS_MY.map(d => (
                <Text key={d} style={s.calDayHeader}>{d}</Text>
              ))}
            </View>
            {/* Date grid */}
            <View style={s.calGrid}>
              {cells.map((day, idx) => {
                const dateStr = day ? formatDate(viewYear, viewMonth, day) : '';
                const isSelected = dateStr === value;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[s.calCell, isSelected && s.calCellSelected]}
                    onPress={() => { if (day) { onSelect(dateStr); setVisible(false); } }}
                    disabled={!day}
                  >
                    <Text style={[s.calCellText, isSelected && s.calCellTextSelected, !day && { opacity: 0 }]}>
                      {day || '.'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── DOCUMENT UPLOAD SECTION ──────────────────────────────────────────────────
const DocUploadSection = ({ docs, setDocs }) => {
  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Akses Ditolak', 'Sila benarkan akses kamera dalam tetapan.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setDocs(prev => [...prev, { uri: asset.uri, name: `Gambar_${Date.now()}.jpg`, type: 'image' }]);
    }
  };
  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newFiles = result.assets.map(a => ({ uri: a.uri, name: a.fileName || `Imej_${Date.now()}.jpg`, type: 'image' }));
      setDocs(prev => [...prev, ...newFiles]);
    }
  };
  const handleFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true });
    if (!result.canceled) {
      const newFiles = result.assets.map(a => ({ uri: a.uri, name: a.name, type: 'file' }));
      setDocs(prev => [...prev, ...newFiles]);
    }
  };
  const removeDoc = (idx) => setDocs(prev => prev.filter((_, i) => i !== idx));

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>⑤ Dokumen Sokongan</Text>
      <Text style={s.hint}>Muat naik bil, invois, surat rasmi, atau dokumen berkaitan (PDF/Gambar)</Text>
      <View style={s.uploadBtnRow}>
        <TouchableOpacity style={s.uploadBtn} onPress={handleCamera}>
          <Ionicons name="camera" size={22} color={COLORS.primary} />
          <Text style={s.uploadBtnText}>Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.uploadBtn} onPress={handleGallery}>
          <Ionicons name="images" size={22} color={COLORS.primary} />
          <Text style={s.uploadBtnText}>Galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.uploadBtn} onPress={handleFile}>
          <Ionicons name="document-attach" size={22} color={COLORS.primary} />
          <Text style={s.uploadBtnText}>Fail</Text>
        </TouchableOpacity>
      </View>

      {docs.length === 0 ? (
        <View style={s.emptyDoc}>
          <Ionicons name="cloud-upload-outline" size={32} color="#555" />
          <Text style={s.emptyDocText}>Belum ada dokumen dimuat naik</Text>
        </View>
      ) : (
        <View style={s.docList}>
          {docs.map((doc, idx) => (
            <View key={idx} style={s.docItem}>
              {doc.type === 'image' ? (
                <Image source={{ uri: doc.uri }} style={s.docThumb} />
              ) : (
                <View style={s.docIcon}>
                  <Ionicons name="document-text" size={24} color={COLORS.primary} />
                </View>
              )}
              <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
              <TouchableOpacity onPress={() => removeDoc(idx)} style={s.docRemoveBtn}>
                <Ionicons name="close-circle" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const CATEGORIES = [
  'Rawatan Perubatan',
  'Pendidikan',
  'Bantuan Sara Hidup',
  'Haiwan',
  'Bencana Alam',
  'Lain-lain',
];

// ─── PHASE 1: FORM ───────────────────────────────────────────────────────────
function ApplicationForm({ onSubmit }) {
  const [form, setForm] = useState({
    namapenuh: '',
    bandar: '',
    negeri: '',
    telefon: '',
    email: '',
    alamat: '',
    kategori: '',
    sebab: '',
    jumlah: '',
    tarikmula: '',
    tarihtamat: '',
    namabank: '',
    noakaun: '',
  });
  const [errors, setErrors] = useState({});
  const [docs, setDocs] = useState([]);

  const validate = () => {
    const e = {};
    if (!form.namapenuh.trim()) e.namapenuh = 'Wajib diisi';
    if (!form.bandar.trim()) e.bandar = 'Wajib diisi';
    if (!form.negeri.trim()) e.negeri = 'Wajib diisi';
    if (!form.telefon.trim()) e.telefon = 'Wajib diisi';
    if (!form.email.trim()) e.email = 'Wajib diisi';
    if (!form.alamat.trim()) e.alamat = 'Wajib diisi';
    if (!form.kategori) e.kategori = 'Sila pilih kategori';
    if (form.sebab.trim().length < 30) e.sebab = 'Sila huraikan dengan lebih terperinci (min 30 aksara)';
    if (!form.jumlah.trim() || isNaN(Number(form.jumlah))) e.jumlah = 'Sila masukkan jumlah yang sah';
    if (!form.tarikmula.trim()) e.tarikmula = 'Wajib diisi';
    if (!form.tarihtamat.trim()) e.tarihtamat = 'Wajib diisi';
    if (!form.namabank.trim()) e.namabank = 'Wajib diisi';
    if (!form.noakaun.trim()) e.noakaun = 'Wajib diisi';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validate()) onSubmit(form, docs);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Ionicons name="document-text" size={22} color={COLORS.primary} />
        <Text style={s.headerTitle}>Borang Permohonan Dana</Text>
      </View>
      <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">

        {/* SEKSYEN 1 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>① Maklumat Peribadi</Text>
          <Field label="Nama Penuh" fkey="namapenuh" placeholder="Contoh: Ahmad bin Ali" form={form} setForm={setForm} errors={errors} />
          <Field label="No. Telefon" fkey="telefon" placeholder="0123456789" keyboardType="phone-pad" form={form} setForm={setForm} errors={errors} />
          <Field label="Email" fkey="email" placeholder="email@contoh.com" keyboardType="email-address" form={form} setForm={setForm} errors={errors} />
          <Field label="Alamat Rumah Lengkap" fkey="alamat" placeholder="No, Jalan, Taman, Poskod, Negeri" multiline={4}
            hint="Sila nyatakan alamat penuh termasuk poskod." form={form} setForm={setForm} errors={errors} />
          <DropdownSelect
            label="Negeri"
            value={form.negeri}
            options={NEGERI_LIST}
            placeholder="Pilih Negeri..."
            error={errors.negeri}
            onSelect={(val) => setForm(f => ({ ...f, negeri: val, bandar: '' }))}
          />
          <DropdownSelect
            label="Bandar"
            value={form.bandar}
            options={form.negeri ? (BANDAR_BY_NEGERI[form.negeri] || []) : []}
            placeholder={form.negeri ? 'Pilih Bandar...' : 'Pilih Negeri dahulu'}
            error={errors.bandar}
            onSelect={(val) => setForm(f => ({ ...f, bandar: val }))}
          />
        </View>

        {/* SEKSYEN 2 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>② Maklumat Permohonan</Text>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Kategori Permohonan</Text>
            {errors.kategori ? <Text style={s.errorText}>{errors.kategori}</Text> : null}
            <View style={s.catGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.catChip, form.kategori === cat && s.catChipActive]}
                  onPress={() => setForm(f => ({ ...f, kategori: cat }))}
                >
                  <Text style={[s.catChipText, form.kategori === cat && s.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Field
            label="Sebab Permohonan (Terperinci)"
            fkey="sebab"
            multiline={6}
            placeholder="Huraikan sebab secara terperinci. Contoh: Bil hospital tertunggak kerana kehilangan pekerjaan sejak Mac 2024..."
            hint="⚠️ Jika ada tunggakan, jelaskan KENAPA ia tertunggak."
            form={form} setForm={setForm} errors={errors}
          />
          <Field label="Jumlah Dana Diperlukan (RM)" fkey="jumlah" placeholder="Contoh: 3500" keyboardType="decimal-pad" form={form} setForm={setForm} errors={errors} />
        </View>

        {/* SEKSYEN 3 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>③ Tempoh Kutipan</Text>
          <DatePickerModal
            label="Tarikh Mula Kutipan"
            value={form.tarikmula}
            error={errors.tarikmula}
            onSelect={(val) => setForm(f => ({ ...f, tarikmula: val }))}
          />
          <DatePickerModal
            label="Tarikh Tamat Kutipan"
            value={form.tarihtamat}
            error={errors.tarihtamat}
            onSelect={(val) => setForm(f => ({ ...f, tarihtamat: val }))}
          />
        </View>

        {/* SEKSYEN 4 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>④ Maklumat Akaun Bank</Text>
          <DropdownSelect
            label="Nama Bank"
            value={form.namabank}
            options={BANK_LIST}
            placeholder="Pilih Bank..."
            error={errors.namabank}
            onSelect={(val) => setForm(f => ({ ...f, namabank: val }))}
          />
          <Field label="No. Akaun Bank" fkey="noakaun" placeholder="Contoh: 1234567890" keyboardType="number-pad" form={form} setForm={setForm} errors={errors} />
        </View>

        {/* SEKSYEN 5 - DOKUMEN */}
        <DocUploadSection docs={docs} setDocs={setDocs} />

        <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={s.nextBtnText}>Teruskan ke Pengesahan AI</Text>
          <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── PHASE 2: CHATBOT VERIFICATION ───────────────────────────────────────────
function ChatVerification({ formData, navigation, onBack }) {
  const buildSummary = (f) =>
    `MAKLUMAT PEMOHON:\n` +
    `- Nama: ${f.namapenuh}\n` +
    `- Lokasi: ${f.bandar}, ${f.negeri}\n` +
    `- Telefon: ${f.telefon} | Email: ${f.email}\n` +
    `- Alamat: ${f.alamat}\n` +
    `- Kategori: ${f.kategori}\n` +
    `- Sebab: ${f.sebab}\n` +
    `- Jumlah: RM${f.jumlah}\n` +
    `- Tempoh: ${f.tarikmula} hingga ${f.tarihtamat}\n` +
    `- Bank: ${f.namabank} | No. Akaun: ${f.noakaun}`;

  const SYSTEM_PROMPT = getSystemPrompt(formData);

  const INIT_MSG = {
    id: '0', sender: 'bot', role: 'assistant',
    text: `Terima kasih kerana mengisi borang permohonan.\n\nSaya akan menyemak maklumat anda sebentar...`,
  };

  const [messages, setMessages] = useState([INIT_MSG]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const ocrTextRef = useRef('Tiada imbasan dokumen sokongan.');
  const flatListRef = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardActive(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardActive(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-start: AI reviews the form on mount
  useEffect(() => {
    const runInitialReview = async () => {
      setIsTyping(true);
      
      let ocrText = "TIADA imbasan dokumen (pengguna tidak memuat naik gambar bil/invois).";
      try {
        const images = formData?.uploadedDocs?.filter(doc => 
          doc.type === 'image' || 
          doc.name?.toLowerCase().endsWith('.jpg') || 
          doc.name?.toLowerCase().endsWith('.jpeg') || 
          doc.name?.toLowerCase().endsWith('.png')
        ) || [];

        if (images.length > 0) {
          const ocrResults = [];
          for (const img of images) {
            let ocrData = null;
            const cacheKey = `ocr_cache_${img.uri}`;
            
            // Check cache first to save quota
            try {
              const cachedVal = await AsyncStorage.getItem(cacheKey);
              if (cachedVal) {
                ocrData = JSON.parse(cachedVal);
              }
            } catch (cacheErr) {
              console.warn("Gagal membaca cache OCR:", cacheErr);
            }

            if (!ocrData) {
              try {
                ocrData = await analyzeDocument(img.uri);
                // Save to cache
                try {
                  await AsyncStorage.setItem(cacheKey, JSON.stringify(ocrData));
                } catch (cacheErr) {
                  console.warn("Gagal menyimpan cache OCR:", cacheErr);
                }
              } catch (apiErr) {
                console.error("Gagal imbasan OCR:", img.name, apiErr);
                const errMsg = apiErr.message || String(apiErr);
                const isRateLimit = errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit');
                
                // Graceful fallback for quota/rate limit error
                ocrData = {
                  jenis_dokumen: "Bil/Dokumen rawatan (Imbasan Gagal)",
                  institusi: "Tidak dapat dikesan",
                  tarikh: "Tidak dapat dikesan",
                  jumlah_rm: formData.jumlah || "0",
                  ringkasan: isRateLimit 
                    ? "Gagal mengimbas kerana had kuota Gemini API percuma (Error 429) telah dicapai."
                    : `Gagal mengimbas dokumen: ${errMsg}`,
                  status_verifikasi: "Perlu Semakan Manual",
                  sebab_status: isRateLimit 
                    ? "Had kuota Gemini API (Error 429) terlampaui. Sila tanya pengguna untuk mengesahkan bil secara manual." 
                    : "Ralat imbasan teknikal."
                };
              }
            }

            ocrResults.push({ name: img.name, ...ocrData });
          }

          if (ocrResults.length > 0) {
            ocrText = ocrResults.map((res, idx) => 
              `Dokumen #${idx + 1} (${res.name}):\n` +
              `- Jenis: ${res.jenis_dokumen || 'Lain-lain'}\n` +
              `- Institusi: ${res.institusi || 'Tidak diketahui'}\n` +
              `- Tarikh: ${res.tarikh || 'Tidak dikesan'}\n` +
              `- Jumlah Dikesan: RM${res.jumlah_rm || '0'}\n` +
              `- Ringkasan: ${res.ringkasan || 'Tiada'}\n` +
              `- Status Verifikasi: ${res.status_verifikasi} (${res.sebab_status || ''})`
            ).join('\n\n');
          }
        }
      } catch (err) {
        console.error("Ralat memproses dokumen sokongan:", err);
      }

      ocrTextRef.current = ocrText;
      const summary = buildSummary(formData);
      const history = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Berikut adalah maklumat yang telah saya isi dalam borang:\n\n${summary}\n\nHASIL IMBASAN OCR DOKUMEN:\n${ocrText}\n\nSila semak dan beritahu saya jika ada isu atau maklumat yang perlu saya jelaskan.`,
        },
      ];
      try {
        const reply = await callGroqAPI(history);
        const approved = reply.toLowerCase().includes('sah') || reply.toLowerCase().includes('hantar') || reply.toLowerCase().includes('lengkap');
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), sender: 'bot', role: 'assistant', text: reply },
        ]);
        setIsValidated(approved);
      } catch (e) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', role: 'assistant', text: 'Ralat sistem. Sila cuba lagi.' }]);
      } finally {
        setIsTyping(false);
      }
    };
    runInitialReview();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = { id: Date.now().toString(), sender: 'user', role: 'user', text: inputText };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputText('');
    setIsTyping(true);
    try {
      const summary = buildSummary(formData);
      const history = [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Berikut adalah maklumat yang telah saya isi dalam borang:\n\n${summary}\n\nHASIL IMBASAN OCR DOKUMEN:\n${ocrTextRef.current}` 
        },
        ...newMsgs.map(m => ({ role: m.role, content: m.text })),
      ];
      const reply = await callGroqAPI(history);
      const approved = reply.toLowerCase().includes('sah') || reply.toLowerCase().includes('hantar') || reply.toLowerCase().includes('lengkap');
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', role: 'assistant', text: reply }]);
      if (approved) setIsValidated(true);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', role: 'assistant', text: 'Ralat AI. Sila cuba lagi.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = () => {
    Alert.alert('Hantar Permohonan', 'Adakah anda pasti untuk menghantar permohonan ini?', [
      { text: 'Batal' },
      {
        text: 'Hantar', onPress: async () => {
          setIsSubmitting(true);
          try {
            const user = auth.currentUser;
            const appData = {
              userId: user.uid,
              name: formData.namapenuh,
              email: formData.email,
              telefon: formData.telefon,
              alamat: formData.alamat,
              lokasi: `${formData.bandar}, ${formData.negeri}`,
              category: formData.kategori,
              sebab: formData.sebab,
              jumlah: formData.jumlah,
              tempoh: `${formData.tarikmula} - ${formData.tarihtamat}`,
              bank: formData.namabank,
              noakaun: formData.noakaun,
              transcript: messages,
              status: 'pending',
              score: 70,
              scoreClass: 'medium',
              createdAt: serverTimestamp(),
              summary: {
                tajuk: `Permohonan ${formData.kategori} - ${formData.namapenuh}`,
                kategori: formData.kategori,
                lokasi: `${formData.bandar}, ${formData.negeri}`,
                sebab: formData.sebab,
                dana: formData.jumlah,
                bank: formData.namabank,
                tempoh: `${formData.tarikmula} - ${formData.tarihtamat}`,
              },
              aiAnalysis: {
                skor: 70,
                status: 'Perlu Semakan',
                crossChecking: 'Borang diisi oleh pemohon.',
                entityExtraction: `Nama: ${formData.namapenuh}, Jumlah: RM${formData.jumlah}`,
                toneAnalysis: 'Maklumat dari borang.',
              },
            };
            await addDoc(collection(db, 'applications'), appData);
            Alert.alert('Berjaya!', 'Permohonan anda telah dihantar kepada Admin MyDana.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (e) {
            console.error(e);
            Alert.alert('Ralat', 'Gagal menghantar permohonan. Sila cuba lagi.');
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const renderMsg = ({ item }) => (
    <View style={[c.msgRow, item.sender === 'user' && c.msgRowUser]}>
      <View style={[c.avatar, item.sender === 'user' && c.avatarUser]}>
        <Ionicons name={item.sender === 'bot' ? 'shield-checkmark' : 'person'} size={14}
          color={item.sender === 'bot' ? COLORS.primary : '#fff'} />
      </View>
      <View style={[c.bubble, item.sender === 'user' && c.bubbleUser]}>
        <Text style={[c.msgText, item.sender === 'user' && { color: '#fff' }]}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={c.safe}>
      <View style={c.header}>
        <TouchableOpacity onPress={onBack} style={c.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={c.headerTitle}>Pengesahan AI</Text>
          <Text style={c.headerSub}>Pegawai Verifikasi MyDana</Text>
        </View>
        <View style={[c.badge, isValidated && c.badgeOk]}>
          <Text style={c.badgeText}>{isValidated ? '✓ Disahkan' : '⏳ Sedang Semak'}</Text>
        </View>
      </View>

      {/* Collapsible Summary Card */}
      {!isKeyboardActive && (
        <View style={c.summaryContainer}>
          <TouchableOpacity 
            style={c.summaryHeader} 
            onPress={() => setShowSummary(!showSummary)}
            activeOpacity={0.7}
          >
            <Text style={c.summaryTitle}>
              📋 Ringkasan Maklumat Anda {showSummary ? '▲' : '▼'}
            </Text>
            <Text style={c.summaryToggleText}>
              {showSummary ? 'Sembunyikan' : 'Lihat Detail'}
            </Text>
          </TouchableOpacity>
          
          {showSummary && (
            <View style={c.summaryBody}>
              <Text style={c.summaryText}>{buildSummary(formData)}</Text>
            </View>
          )}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={10}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMsg}
          keyExtractor={item => item.id}
          contentContainerStyle={c.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={isTyping ? <Text style={c.typingText}>Pegawai AI sedang menyemak...</Text> : null}
        />

        <View style={c.inputBar}>
          <TextInput
            style={c.chatInput}
            placeholder="Jawab soalan pegawai atau tambah maklumat..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity style={c.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {!isKeyboardActive && (
          <TouchableOpacity
            style={[c.submitBtn, (!isValidated || isSubmitting) && { opacity: 0.45 }]}
            onPress={handleSubmit}
            disabled={!isValidated || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={c.submitBtnText}>
                  {isValidated ? 'Hantar Permohonan' : 'Menunggu Pengesahan AI...'}
                </Text>
              </>
            }
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function ChatScreen({ navigation }) {
  const [phase, setPhase] = useState('form'); // 'form' | 'chat'
  const [formData, setFormData] = useState(null);

  if (!auth.currentUser) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="lock-closed" size={32} color={COLORS.secondary} />
          <Text style={{ color: '#000', marginTop: 12, fontSize: 16 }}>Log Masuk Diperlukan</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'form') {
    return (
      <ApplicationForm
        onSubmit={(data, docs) => {
          setFormData({ ...data, uploadedDocs: docs });
          setPhase('chat');
        }}
      />
    );
  }

  return <ChatVerification formData={formData} navigation={navigation} onBack={() => setPhase('form')} />;
}

// ─── STYLES: FORM ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f4ff' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  formScroll: { padding: 20, gap: 16 },
  section: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 6 },
  hint: { fontSize: 11, color: '#555', marginBottom: 6, fontStyle: 'italic' },
  input: {
    backgroundColor: COLORS.borderLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#000', borderWidth: 1, borderColor: COLORS.border,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  inputError: { borderColor: COLORS.error, backgroundColor: '#fff5f5' },
  errorText: { fontSize: 11, color: COLORS.error, marginTop: 4 },
  row: { flexDirection: 'row' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.borderLight, borderWidth: 1, borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 13, color: '#000', fontWeight: '500' },
  catChipTextActive: { color: '#fff', fontWeight: '700' },
  // Calendar styles
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  calNavBtn: { padding: 6 },
  calMonthLabel: { fontSize: 16, fontWeight: '700', color: '#000' },
  calDayRow: { flexDirection: 'row', paddingHorizontal: 10, marginBottom: 4 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#555', paddingVertical: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 8 },
  calCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 100 },
  calCellSelected: { backgroundColor: COLORS.primary },
  calCellText: { fontSize: 14, color: '#000' },
  calCellTextSelected: { color: '#fff', fontWeight: '700' },
  // Upload styles
  uploadBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 14 },
  uploadBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
  },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  emptyDoc: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyDocText: { fontSize: 13, color: '#555' },
  docList: { gap: 10 },
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 10,
  },
  docThumb: { width: 44, height: 44, borderRadius: 8 },
  docIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  docName: { flex: 1, fontSize: 13, color: '#000', fontWeight: '500' },
  docRemoveBtn: { padding: 2 },
  // Dropdown styles
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownValue: { fontSize: 14, color: '#000', flex: 1 },
  dropdownPlaceholder: { fontSize: 14, color: '#555', flex: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalItemActive: { backgroundColor: '#eff6ff' },
  modalItemText: { fontSize: 15, color: '#000' },
  modalItemTextActive: { color: COLORS.primary, fontWeight: '700' },
  nextBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── STYLES: CHAT ─────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f4ff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  headerSub: { fontSize: 11, color: '#555' },
  backBtn: { padding: 4, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#fef9c3' },
  badgeOk: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#000' },
  summaryContainer: {
    margin: 12, backgroundColor: '#eff6ff',
    borderRadius: 14, borderLeftWidth: 4, borderLeftColor: COLORS.primary,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  summaryBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  summaryText: { fontSize: 12, color: '#000', lineHeight: 18 },
  msgList: { paddingHorizontal: 14, paddingVertical: 10 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  avatarUser: { backgroundColor: COLORS.primary },
  bubble: {
    backgroundColor: '#fff', padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, maxWidth: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, color: '#000', lineHeight: 20 },
  typingText: { fontSize: 13, fontStyle: 'italic', color: '#555', paddingHorizontal: 14, paddingBottom: 8 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  chatInput: {
    flex: 1, backgroundColor: COLORS.borderLight, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100, color: '#000',
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10b981', paddingVertical: 15, marginHorizontal: 12, marginBottom: 10, borderRadius: 14,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
