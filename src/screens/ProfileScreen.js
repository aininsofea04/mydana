import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, TextInput, Alert, ActivityIndicator, Dimensions, ImageBackground,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db, storage } from '../firebase';
import { signOut, updateEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../constants';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Loading from './Loading';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation, route = {} }) {
  const { userId } = route.params || {};
  const isSelf = !userId || userId === auth.currentUser?.uid;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isSelf ? 'info' : 'history');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setActiveTab(isSelf ? 'info' : 'history');
  }, [isSelf]);

  const [nama, setNama] = useState('');
  const [username, setUsername] = useState('');
  const [emel, setEmel] = useState('');
  const [jantina, setJantina] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telefon, setTelefon] = useState('');
  const [updating, setUpdating] = useState(false);

  const [stats, setStats] = useState({ liked: 0, totalDonated: 0, campaigns: 0 });
  const [history, setHistory] = useState([]);
  const [myCampaigns, setMyCampaigns] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      const targetUid = userId || auth.currentUser?.uid;
      if (targetUid) {
        fetchProfile(targetUid);
      }
    }, [userId])
  );

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      const targetUid = userId || u?.uid;
      if (targetUid) {
        fetchProfile(targetUid);
      } else {
        setLoading(false);
      }
    });
    return unsub;
  }, [userId]);

  const fetchProfile = async (targetUid) => {
    try {
      // Use onSnapshot for real-time profile updates
      const unsubUser = onSnapshot(doc(db, 'users', targetUid), async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUser(data);

          const dbEmail = data.emel || data.email || '';
          const dbName = data.nama || data.name || '';
          const dbPhone = data.telefon || data.phone || data.nomborTelefon || '';

          setNama(dbName || '');
          setEmel(dbEmail || '');
          setTelefon(dbPhone || '');

          let dbUsername = data.username;
          if (!dbUsername && dbName && targetUid === auth.currentUser?.uid) {
            // Generate a username on the fly for self
            const baseUsername = dbName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const randomSuffix = Math.floor(100 + Math.random() * 900);
            dbUsername = `${baseUsername || 'user'}${randomSuffix}`;

            // Save it back to database automatically so they now have a username
            try {
              await updateDoc(doc(db, 'users', targetUid), { username: dbUsername });
            } catch (err) {
              console.warn("Failed to auto-save username:", err);
            }
          }

          setUsername(dbUsername || '');
          setJantina(data.jantina || '');
          setAlamat(data.alamat || '');

          // Update stats related to user doc
          setStats(prev => ({
            ...prev,
            liked: data.likedPosts?.length || 0
          }));
        }
      });

      // Fetch Stats & History (Donations)
      const donationsSnap = await getDocs(query(collection(db, 'donations'), where('userId', '==', targetUid)));
      let donationList = donationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      donationList.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

      setHistory(donationList);
      const totalRM = donationList.reduce((sum, item) => sum + (item.amount || 0), 0);
      const uniqueCampaigns = new Set(donationList.map(item => item.campaignId)).size;

      setStats(prev => ({
        ...prev,
        totalDonated: totalRM,
        campaigns: uniqueCampaigns
      }));

      // Fetch User's Created Campaigns
      const campaignSnap = await getDocs(query(collection(db, 'applications'), where('userId', '==', targetUid)));
      let campaignList = campaignSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Legacy fallback: check for doc with ID == targetUid
      const legacySnap = await getDoc(doc(db, 'applications', targetUid));
      if (legacySnap.exists()) {
        const legacyData = { id: legacySnap.id, ...legacySnap.data() };
        if (!campaignList.find(a => a.id === legacyData.id)) {
          campaignList.push(legacyData);
        }
      }
      setMyCampaigns(campaignList);

    } catch (e) {
      console.error("Profile fetch error:", e);
    }
    setLoading(false);
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const uRef = doc(db, 'users', auth.currentUser.uid);
      // Use setDoc with merge:true instead of updateDoc to handle missing docs
      await setDoc(uRef, {
        nama, username, emel, jantina, alamat, telefon
      }, { merge: true });

      if (emel !== auth.currentUser.email) {
        try {
          await updateEmail(auth.currentUser, emel);
        } catch (err) {
          console.warn("Email update failed:", err);
        }
      }

      Alert.alert('Berjaya', 'Profil dikemaskini.');
      setIsEditing(false);
      setUser(prev => ({ ...prev, nama, username, emel, jantina, alamat, telefon }));
    } catch (e) {
      console.error("Save error:", e);
      Alert.alert('Ralat', 'Gagal menyimpan maklumat.');
    }
    setUpdating(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Kami memerlukan izin galeri untuk menukar gambar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      uploadProfilePic(result.assets[0].uri);
    }
  };

  const uploadProfilePic = async (uri) => {
    setUpdating(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const sRef = ref(storage, `profiles/${auth.currentUser.uid}`);

      await uploadBytes(sRef, blob);
      const url = await getDownloadURL(sRef);

      await setDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: url }, { merge: true });
      setUser(prev => ({ ...prev, photoURL: url }));
      Alert.alert('Berjaya', 'Gambar profil telah ditukar.');
    } catch (e) {
      console.error("Upload error:", e);
      Alert.alert('Ralat', 'Gagal memuat naik gambar. Sila cuba lagi.');
    }
    setUpdating(false);
  };

  const printReceipt = async (item) => {
    setUpdating(true);
    let logoBase64 = '';
    try {
      const asset = Asset.fromModule(require('../../assets/logo.png'));
      if (!asset.localUri) {
        await asset.downloadAsync();
      }
      const uriToRead = asset.localUri || asset.uri;
      logoBase64 = await FileSystem.readAsStringAsync(uriToRead, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (err) {
      console.warn("Gagal menukar logo kepada base64:", err);
    } finally {
      setUpdating(false);
    }

    const dateStr = item.createdAt?.toDate 
      ? item.createdAt.toDate().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #4c0519;
            margin: 0;
            padding: 30px;
            background-color: #fff;
          }
          .receipt-container {
            border: 2px solid #eab308;
            border-radius: 20px;
            padding: 30px;
            position: relative;
            background-color: #fffaf0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #fde047;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-img {
            height: 48px;
            width: 48px;
            border-radius: 24px;
          }
          .company-name {
            font-size: 26px;
            font-weight: 900;
            color: #4c0519;
            letter-spacing: -0.5px;
          }
          .receipt-title {
            font-size: 15px;
            font-weight: 800;
            color: #be185d;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-align: right;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 35px;
            font-size: 14px;
            line-height: 1.6;
          }
          .meta-col {
            flex: 1;
          }
          .meta-title {
            font-weight: 800;
            color: #831843;
            text-transform: uppercase;
            font-size: 11px;
            margin-bottom: 6px;
            letter-spacing: 0.5px;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          .details-table th {
            background-color: #eab308;
            color: #fff;
            font-weight: 800;
            text-align: left;
            padding: 12px;
            font-size: 13px;
            text-transform: uppercase;
          }
          .details-table td {
            padding: 16px 12px;
            border-bottom: 1px solid #fde047;
            font-size: 14px;
            color: #4c0519;
          }
          .amount-text {
            font-size: 22px;
            font-weight: 900;
            color: #10b981;
          }
          .thank-you {
            text-align: center;
            margin-top: 50px;
            font-size: 13px;
            font-style: italic;
            color: #831843;
            border-top: 1px dashed #fde047;
            padding-top: 25px;
            line-height: 1.5;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 80px;
            color: rgba(234, 179, 8, 0.05);
            font-weight: 900;
            text-transform: uppercase;
            white-space: nowrap;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="watermark">MyDana</div>
          <div class="header-row">
            <div class="logo-container">
              ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="logo-img" />` : ''}
              <span class="company-name">MyDana</span>
            </div>
            <div class="receipt-title">Resit Rasmi<br/>Sumbangan</div>
          </div>
          
          <div class="meta-row">
            <div class="meta-col">
              <div class="meta-title">Penyumbang</div>
              <div><strong>${nama || 'Penyumbang Prihatin'}</strong></div>
              <div>${emel || ''}</div>
            </div>
            <div class="meta-col" style="text-align: right;">
              <div class="meta-title">Butiran Resit</div>
              <div>ID Transaksi: <strong>${item.id}</strong></div>
              <div>Tarikh: <strong>${dateStr}</strong></div>
              <div>Status: <strong style="color: #10b981;">BERJAYA</strong></div>
            </div>
          </div>
          
          <table class="details-table">
            <thead>
              <tr>
                <th>Keterangan Sumbangan</th>
                <th style="text-align: right; width: 160px;">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sumbangan kebajikan untuk kempen:<br/><strong style="color: #831843; font-size: 15px;">${item.campaignName || 'Kempen Bantuan MyDana'}</strong></td>
                <td style="text-align: right;" class="amount-text">RM ${(item.amount || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="thank-you">
            Sumbangan anda yang ikhlas amat kami hargai dan akan disalurkan terus kepada penerima manfaat.<br/>
            <strong>Terima Kasih daripada pihak Pentadbiran MyDana.</strong>
          </div>
        </div>
      </body>
      </html>
    `;

    Alert.alert(
      'Resit Digital MyDana',
      'Sila pilih tindakan untuk resit anda.',
      [
        {
          text: 'Lihat & Kongsi PDF',
          onPress: async () => {
            try {
              setUpdating(true);
              const { uri } = await Print.printToFileAsync({ html });
              await Sharing.shareAsync(uri);
            } catch (e) {
              Alert.alert('Ralat', 'Gagal menjana PDF resit.');
            } finally {
              setUpdating(false);
            }
          }
        },
        {
          text: 'Simpan / Cetak',
          onPress: async () => {
            try {
              setUpdating(true);
              await Print.printAsync({ html });
            } catch (e) {
              Alert.alert('Ralat', 'Gagal membuka cetakan.');
            } finally {
              setUpdating(false);
            }
          }
        },
        { text: 'Batal', style: 'cancel' }
      ]
    );
  };

  if (loading) return <Loading text="Memuatkan profil..." />;

  return (
    <ImageBackground source={require('../../assets/bg_general.jpg')} style={styles.backgroundImage} resizeMode="cover">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
            {!isSelf ? (
              <TouchableOpacity
                style={styles.topBackBtn}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.topLogoutBtn}
                onPress={() => Alert.alert('Log Keluar', 'Adakah anda pasti ingin log keluar?', [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Log Keluar', onPress: () => signOut(auth), style: 'destructive' }
                ])}
              >
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={isSelf ? pickImage : null} style={styles.avatarWrapper} disabled={!isSelf}>
              <Image
                source={{ uri: user?.photoURL || 'https://static.vecteezy.com/system/resources/previews/009/734/564/non_2x/default-avatar-profile-icon-of-social-media-user-vector.jpg' }}
                style={styles.avatar}
              />
              {isSelf && (
                updating ? (
                  <View style={[styles.editIcon, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : (
                  <View style={styles.editIcon}>
                    <Feather name="camera" size={14} color="#fff" />
                  </View>
                )
              )}
            </TouchableOpacity>
            <Text style={styles.userName}>{nama || 'Penyumbang MyDana'}</Text>
            <Text style={styles.userUsername}>@{username || 'username'}</Text>
            {isSelf && <Text style={styles.userEmail}>{emel}</Text>}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.liked}</Text>
              <Text style={styles.statLabel}>Disukai</Text>
            </View>
            <View style={[styles.statCard, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e2e8f0' }]}>
              <Text style={styles.statValue}>RM {stats.totalDonated}</Text>
              <Text style={styles.statLabel}>Sumbangan</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.campaigns}</Text>
              <Text style={styles.statLabel}>Kempen Dibantu</Text>
            </View>
          </View>

          <View style={styles.tabContainer}>
            {isSelf && (
              <TouchableOpacity style={[styles.tab, activeTab === 'info' && styles.tabActive]} onPress={() => setActiveTab('info')}>
                <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>Maklumat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.tab, activeTab === 'history' && styles.tabActive]} onPress={() => setActiveTab('history')}>
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Sumbangan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'campaigns' && styles.tabActive]} onPress={() => setActiveTab('campaigns')}>
              <Text style={[styles.tabText, activeTab === 'campaigns' && styles.tabTextActive]}>
                {isSelf ? 'Kempen Saya' : 'Kempen'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {activeTab === 'info' ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Butiran Peribadi</Text>
                  {isSelf && (
                    <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(!isEditing)}>
                      <Feather name={isEditing ? 'x' : 'edit-2'} size={14} color={COLORS.primaryDark} />
                      <Text style={styles.editBtnText}>{isEditing ? 'Batal' : 'Sunting Profil'}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.label}>Nama Penuh</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={nama} onChangeText={setNama} placeholder="Ali bin Abu" />
                ) : (
                  <View style={styles.readOnlyBox}><Text style={styles.readOnlyText}>{nama || 'N/A'}</Text></View>
                )}

                <Text style={styles.label}>Username</Text>
                {isEditing ? (
                  <View style={styles.usernameInputWrapper}>
                    <Text style={styles.usernamePrefix}>@</Text>
                    <TextInput style={styles.usernameInput} value={username} onChangeText={(val) => setUsername(val.toLowerCase().replace(/\s/g, ''))} placeholder="username" autoCapitalize="none" />
                  </View>
                ) : (
                  <View style={styles.readOnlyBox}><Text style={[styles.readOnlyText, { color: COLORS.primaryDark, fontWeight: '700' }]}>@{username || 'username'}</Text></View>
                )}

                <Text style={styles.label}>Alamat Emel</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={emel} onChangeText={setEmel} keyboardType="email-address" autoCapitalize="none" />
                ) : (
                  <View style={styles.readOnlyBox}><Text style={styles.readOnlyText}>{emel || 'N/A'}</Text></View>
                )}

                <View style={{ flexDirection: 'row', gap: 15 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Jantina</Text>
                    {isEditing ? (
                      <View style={styles.dropdownRow}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, jantina === 'Lelaki' && styles.dropdownItemActive]}
                          onPress={() => setJantina('Lelaki')}
                        >
                          <Text style={[styles.dropdownItemText, jantina === 'Lelaki' && styles.dropdownItemTextActive]}>Lelaki</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.dropdownItem, jantina === 'Perempuan' && styles.dropdownItemActive]}
                          onPress={() => setJantina('Perempuan')}
                        >
                          <Text style={[styles.dropdownItemText, jantina === 'Perempuan' && styles.dropdownItemTextActive]}>Perempuan</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.readOnlyBox}><Text style={styles.readOnlyText}>{jantina || 'N/A'}</Text></View>
                    )}
                  </View>
                </View>

                <Text style={styles.label}>Nombor Telefon</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={telefon}
                    onChangeText={(val) => setTelefon(val.replace(/[^0-9]/g, ''))}
                    keyboardType="phone-pad"
                    placeholder="Contoh: 0123456789"
                  />
                ) : (
                  <View style={styles.readOnlyBox}><Text style={styles.readOnlyText}>{telefon || 'N/A'}</Text></View>
                )}

                <Text style={styles.label}>Alamat</Text>
                {isEditing ? (
                  <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={alamat} onChangeText={setAlamat} multiline />
                ) : (
                  <View style={[styles.readOnlyBox, { height: 'auto', minHeight: 50 }]}><Text style={styles.readOnlyText}>{alamat || 'Alamat belum diisi.'}</Text></View>
                )}

                {isEditing && (
                  <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={updating}>
                    {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Simpan Perubahan</Text>}
                  </TouchableOpacity>
                )}
              </View>
            ) : activeTab === 'history' ? (
              <View>
                {history.length === 0 ? (
                  <View style={styles.emptyHistory}>
                    <Feather name="info" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyText}>Tiada sejarah sumbangan ditemui.</Text>
                  </View>
                ) : (
                  history.map((item) => {
                    const txStatus = item.status || 'completed';
                    const isSuccess = txStatus === 'completed' || txStatus === 'succeeded';
                    const dateStr = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

                    return (
                      <View key={item.id} style={styles.historyCard}>
                        {/* Top row: Campaign name + Status */}
                        <View style={styles.historyTopRow}>
                          <View style={styles.historyIconCircle}>
                            <Ionicons name="heart" size={16} color={COLORS.primaryDark} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.historyTitle} numberOfLines={1}>{item.campaignName || 'Kempen MyDana'}</Text>
                            <Text style={styles.historyDate}>{dateStr}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: isSuccess ? '#dcfce7' : '#fef2f2' }]}>
                            <Text style={[styles.statusBadgeText, { color: isSuccess ? '#16a34a' : '#dc2626' }]}>
                              {isSuccess ? 'BERJAYA' : 'GAGAL'}
                            </Text>
                          </View>
                        </View>

                        {/* Bottom row: Amount + Receipt */}
                        <View style={styles.historyBottomRow}>
                          <Text style={styles.historyAmount}>RM {(item.amount || 0).toFixed(2)}</Text>
                          <TouchableOpacity style={styles.receiptBtn} onPress={() => printReceipt(item)}>
                            <Feather name="file-text" size={14} color="#3b82f6" />
                            <Text style={styles.receiptBtnText}>Resit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : (
              <View>
                {myCampaigns.length === 0 ? (
                  <View style={styles.emptyHistory}>
                    <Feather name="folder" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyText}>Anda belum mempunyai sebarang kempen.</Text>
                  </View>
                ) : (
                  myCampaigns.map((app) => (
                    <View key={app.id} style={styles.historyCard}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTitle}>{app.summary?.tajuk || 'Permohonan Dana'}</Text>
                        <Text style={styles.historyDate}>Status: {app.status === 'approved' ? 'Diluluskan' : app.status === 'rejected' ? 'Ditolak' : 'Dalam Semakan'}</Text>
                      </View>
                      <View style={styles.historyAction}>
                        {app.status === 'approved' && app.isPublished && (
                          <TouchableOpacity
                            style={[styles.receiptBtn, { backgroundColor: '#ef4444', padding: 8, borderRadius: 8, marginTop: 0 }]}
                            onPress={() => navigation.navigate('LiveStream', { mode: 'broadcaster', campaign: app })}
                          >
                            <Ionicons name="videocam" size={16} color="#fff" />
                            <Text style={[styles.receiptBtnText, { color: '#fff', marginLeft: 4 }]}>Siar Langsung</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingVertical: 30, backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  avatarWrapper: { width: 100, height: 100, borderRadius: 50, marginBottom: 15, position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  editIcon: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.primary,
    width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff'
  },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  userUsername: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  userEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.6)', paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  tabContainer: { flexDirection: 'row', padding: 20, gap: 10 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderColor: '#e2e8f0' },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  content: { paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 5 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, borderRadius: 8, backgroundColor: COLORS.borderLight },
  editBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#1e293b' },
  readOnlyBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 48, justifyContent: 'center' },
  readOnlyText: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  usernameInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16 },
  usernamePrefix: { fontSize: 14, fontWeight: '800', color: COLORS.primaryDark, marginRight: 4 },
  usernameInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#1e293b', fontWeight: '700' },
  dropdownRow: { flexDirection: 'row', gap: 10 },
  dropdownItem: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff'
  },
  dropdownItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.borderLight },
  dropdownItemText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  dropdownItemTextActive: { color: COLORS.primaryDark },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, shadowColor: COLORS.primary, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  historyTopRow: { flexDirection: 'row', alignItems: 'center' },
  historyIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderLight, justifyContent: 'center', alignItems: 'center' },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  historyDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  historyBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  historyAction: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 17, fontWeight: '800', color: '#10b981' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.borderLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  receiptBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  emptyHistory: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 10 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40, paddingVertical: 12, alignSelf: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  topLogoutBtn: { position: 'absolute', top: 10, right: 20, zIndex: 10, padding: 8 },
  topBackBtn: { position: 'absolute', top: 10, left: 20, zIndex: 10, padding: 8 }
});