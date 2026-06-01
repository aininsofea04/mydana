import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Animated, Dimensions, StatusBar, PermissionsAndroid
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import {
  doc, updateDoc, onSnapshot, addDoc, collection,
  serverTimestamp, query, orderBy, limit, deleteDoc, getDocs, where,
} from 'firebase/firestore';
import { COLORS } from '../constants';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  VideoSourceType,
} from 'react-native-agora';

const { width, height } = Dimensions.get('window');
const AGORA_APP_ID = 'cc6399f1f9384d9e8222a5cae3a61845';

export default function LiveStreamScreen({ route, navigation }) {
  const { mode, campaign } = route.params;
  const isBroadcaster = mode === 'broadcaster';
  const channelName = `live_${campaign.id}`;
  const insets = useSafeAreaInsets();

  const engineRef = useRef(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [remoteUid, setRemoteUid] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [streamEnded, setStreamEnded] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [finalViewerCount, setFinalViewerCount] = useState(0);
  const [finalTotalViewers, setFinalTotalViewers] = useState(0);
  const [finalDonations, setFinalDonations] = useState(0);
  const [finalTime, setFinalTime] = useState(0);

  const [totalLiveViewers, setTotalLiveViewers] = useState(0);
  const [liveDonations, setLiveDonations] = useState(0);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const chatListRef = useRef(null);

  // Pulse animation for live indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const currentUser = auth.currentUser;

  // Pulse animation loop
  useEffect(() => {
    if (isLive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isLive]);

  // Live timer
  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isLive]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Initialize Agora Engine
  const initEngine = useCallback(async () => {
    try {
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;

      engine.initialize({ appId: AGORA_APP_ID });

      engine.registerEventHandler({
        onJoinChannelSuccess: (_connection, _elapsed) => {
          console.log('Joined channel successfully');
          setIsJoined(true);
        },
        onUserJoined: (_connection, uid, _elapsed) => {
          console.log('Remote user joined:', uid);
          setRemoteUid(uid);
        },
        onUserOffline: (_connection, uid, _reason) => {
          console.log('Remote user left:', uid);
          setRemoteUid(null);
          if (!isBroadcaster) {
            setStreamEnded(true);
          }
        },
        onError: (err, msg) => {
          console.error('Agora error:', err, msg);
        },
      });

      engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);

      if (isBroadcaster) {
        engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        engine.enableVideo();
        engine.enableAudio();
        engine.startPreview();
      } else {
        engine.setClientRole(ClientRoleType.ClientRoleAudience);
        engine.enableVideo();
      }
      setIsEngineReady(true);
    } catch (e) {
      console.error('Failed to init Agora engine:', e);
      Alert.alert('Ralat', 'Gagal memulakan enjin video. Sila cuba lagi.');
    }
  }, [isBroadcaster]);

  // Join channel
  const joinChannel = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      await engine.joinChannel('', channelName, currentUser?.uid ? parseInt(currentUser.uid.slice(-8), 16) % 100000 : 0, {});
    } catch (e) {
      console.error('Failed to join channel:', e);
    }
  }, [channelName, currentUser]);

  // Leave channel
  const leaveChannel = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      engine.leaveChannel();
    } catch (e) {
      console.error('Failed to leave channel:', e);
    }
  }, []);

  // Cleanup engine
  const destroyEngine = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      engine.unregisterEventHandler({});
      engine.release();
      engineRef.current = null;
    } catch (e) {
      console.error('Failed to destroy engine:', e);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
          if (
            granted['android.permission.CAMERA'] !== PermissionsAndroid.RESULTS.GRANTED ||
            granted['android.permission.RECORD_AUDIO'] !== PermissionsAndroid.RESULTS.GRANTED
          ) {
            Alert.alert('Akses Ditolak', 'Akses kamera dan mikrofon diperlukan untuk siaran langsung.');
            return;
          }
        } catch (err) {
          console.warn(err);
        }
      }
      initEngine();
    };

    setup();

    return () => {
      leaveChannel();
      destroyEngine();
    };
  }, []);

  // Listen to live chat messages
  useEffect(() => {
    if (!campaign?.id) return;
    const q = query(
      collection(db, 'applications', campaign.id, 'liveChat'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [campaign?.id]);

  // Listen to viewer count & total viewers
  useEffect(() => {
    if (!campaign?.id) return;
    const unsub = onSnapshot(doc(db, 'applications', campaign.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setViewerCount(data.liveViewerCount || 0);
        setTotalLiveViewers(data.totalLiveViewers || 0);
        if (!isBroadcaster && !data.isLive) {
          setStreamEnded(true);
        }
      }
    });
    return unsub;
  }, [campaign?.id, isBroadcaster]);

  // Track live donations
  useEffect(() => {
    if (!campaign?.id || !isLive || !isBroadcaster) return;
    
    const startTime = Date.now();
    const q = query(
      collection(db, 'donations'),
      where('campaignId', '==', campaign.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      let sum = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const createdAt = data.createdAt?.toMillis?.() || (data.createdAt?.seconds * 1000) || 0;
        // Count donations made after the stream started
        if (createdAt >= startTime - 120000) { 
          sum += (data.amount || 0);
        }
      });
      setLiveDonations(sum);
    });

    return unsub;
  }, [campaign?.id, isLive, isBroadcaster]);

  // Broadcaster: Go Live
  const handleGoLive = async () => {
    await joinChannel();
    setIsLive(true);
    setElapsedTime(0);

    try {
      await updateDoc(doc(db, 'applications', campaign.id), {
        isLive: true,
        liveStartedAt: serverTimestamp(),
        liveViewerCount: 0,
        totalLiveViewers: 0,
      });
    } catch (e) {
      console.error('Failed to update live status:', e);
    }
  };

  // Broadcaster: End Live
  const handleEndLive = () => {
    Alert.alert('Tamatkan Siaran', 'Adakah anda pasti mahu menamatkan siaran langsung?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Tamatkan', style: 'destructive', onPress: async () => {
          setIsLive(false);
          setStreamEnded(true);
          setShowSummary(true);
          setFinalViewerCount(viewerCount);
          setFinalTotalViewers(totalLiveViewers);
          setFinalDonations(liveDonations);
          setFinalTime(elapsedTime);
          await leaveChannel();

          try {
            await updateDoc(doc(db, 'applications', campaign.id), {
              isLive: false,
              liveViewerCount: 0,
            });

            // Clear live chat
            const chatSnap = await getDocs(collection(db, 'applications', campaign.id, 'liveChat'));
            const deletePromises = chatSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
          } catch (e) {
            console.error('Failed to clear live state:', e);
          }
        }
      }
    ]);
  };

  // Viewer: Join as audience
  const handleJoinAsViewer = async () => {
    await joinChannel();

    try {
      const campaignRef = doc(db, 'applications', campaign.id);
      const snap = await new Promise(resolve => {
        const unsub = onSnapshot(campaignRef, (s) => { unsub(); resolve(s); });
      });
      if (snap.exists()) {
        await updateDoc(campaignRef, {
          liveViewerCount: (snap.data().liveViewerCount || 0) + 1,
          totalLiveViewers: (snap.data().totalLiveViewers || 0) + 1,
        });
      }
    } catch (e) {
      console.error('Failed to increment viewer count:', e);
    }
  };

  // Viewer: Leave
  const handleLeaveAsViewer = async () => {
    await leaveChannel();

    try {
      const campaignRef = doc(db, 'applications', campaign.id);
      const snap = await new Promise(resolve => {
        const unsub = onSnapshot(campaignRef, (s) => { unsub(); resolve(s); });
      });
      if (snap.exists()) {
        await updateDoc(campaignRef, {
          liveViewerCount: Math.max(0, (snap.data().liveViewerCount || 0) - 1),
        });
      }
    } catch (e) {
      console.error('Failed to decrement viewer count:', e);
    }

    navigation.goBack();
  };

  // Auto-join for viewer
  useEffect(() => {
    if (!isBroadcaster && engineRef.current) {
      const timer = setTimeout(() => {
        handleJoinAsViewer();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isBroadcaster]);

  // Send chat message
  const handleSendChat = async () => {
    if (!chatText.trim() || !campaign?.id || !currentUser) return;

    try {
      await addDoc(collection(db, 'applications', campaign.id, 'liveChat'), {
        text: chatText.trim(),
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Pengguna',
        createdAt: serverTimestamp(),
      });
      setChatText('');
    } catch (e) {
      console.error('Failed to send chat:', e);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isMuted) {
      engine.enableLocalAudio(true);
    } else {
      engine.enableLocalAudio(false);
    }
    setIsMuted(!isMuted);
  };

  // Flip camera
  const flipCamera = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.switchCamera();
    setIsFrontCamera(!isFrontCamera);
  };

  // Render chat message
  const renderChatMsg = ({ item }) => (
    <View style={styles.chatMsg}>
      <Text style={styles.chatMsgUser}>{item.userName}</Text>
      <Text style={styles.chatMsgText}>{item.text}</Text>
    </View>
  );

  // Stream ended screen (viewer)
  if (streamEnded && !isBroadcaster) {
    return (
      <View style={styles.endedContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="videocam-off-outline" size={64} color="rgba(255,255,255,0.5)" />
        <Text style={styles.endedTitle}>Siaran Telah Tamat</Text>
        <Text style={styles.endedSubtitle}>Penyiar telah menamatkan siaran langsung ini.</Text>
        <TouchableOpacity style={styles.endedBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.endedBtnText}>Kembali ke Feed</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Broadcaster summary screen
  if (showSummary && isBroadcaster) {
    return (
      <View style={styles.endedContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="checkmark-circle-outline" size={64} color="#10b981" />
        <Text style={styles.endedTitle}>Siaran Ditamatkan</Text>
        
        <View style={{ marginTop: 20, marginBottom: 30, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 5 }}>Ringkasan Siaran</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>Masa: {formatTime(finalTime)}</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>Keseluruhan Penonton: {finalTotalViewers}</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#10b981', marginTop: 10 }}>Sumbangan Terkumpul: RM {finalDonations.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.endedBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.endedBtnText}>Selesai</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Video View */}
      {isBroadcaster ? (
        isEngineReady ? (
          <RtcSurfaceView
            style={styles.videoView}
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
          />
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.waitingText}>Memulakan kamera...</Text>
          </View>
        )
      ) : (
        remoteUid !== null && isEngineReady ? (
          <RtcSurfaceView
            style={styles.videoView}
            canvas={{ uid: remoteUid }}
          />
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.waitingText}>Menghubung ke siaran...</Text>
          </View>
        )
      )}

      {/* Top Controls Overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topRow}>
          {/* Live indicator + timer */}
          {isLive && (
            <View style={styles.liveIndicator}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveText}>LIVE</Text>
              <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
            </View>
          )}

          {!isBroadcaster && (
            <View style={styles.liveIndicator}>
              <View style={[styles.liveDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* Viewer count */}
          <View style={styles.viewerBadge}>
            <Ionicons name="eye" size={14} color="#fff" />
            <Text style={styles.viewerCount}>{viewerCount}</Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={isBroadcaster ? (isLive ? handleEndLive : () => navigation.goBack()) : handleLeaveAsViewer}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Campaign info */}
        <Text style={styles.campaignTitle} numberOfLines={1}>
          {campaign.summary?.tajuk || 'Kempen MyDana'}
        </Text>
      </View>

      {/* Bottom: Chat + Controls */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomSection}
        keyboardVerticalOffset={0}
      >
        {/* Chat messages */}
        <FlatList
          ref={chatListRef}
          data={chatMessages}
          renderItem={renderChatMsg}
          keyExtractor={item => item.id}
          style={styles.chatList}
          contentContainerStyle={styles.chatListContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Viewer Donate Button */}
        {!isBroadcaster && (
          <View style={styles.viewerFloatingRow}>
            <TouchableOpacity 
              style={styles.floatingDonateBtn}
              onPress={() => navigation.navigate('Payment', { campaign })}
              activeOpacity={0.8}
            >
              <Ionicons name="heart" size={18} color="#fff" />
              <Text style={styles.floatingDonateText}>Sumbang Sekarang</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Broadcaster controls */}
        {isBroadcaster && (
          <View style={styles.broadcasterControls}>
            {!isLive ? (
              <TouchableOpacity style={styles.goLiveBtn} onPress={handleGoLive} activeOpacity={0.8}>
                <View style={styles.goLiveDot} />
                <Text style={styles.goLiveBtnText}>Mulakan Siaran Langsung</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.liveControlsRow}>
                <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
                  <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={flipCamera}>
                  <Ionicons name="camera-reverse" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.controlBtn, styles.endLiveBtn]} onPress={handleEndLive}>
                  <Ionicons name="stop" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Chat input */}
        {(isLive || !isBroadcaster) && (
          <View style={[styles.chatInputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={styles.chatInput}
              placeholder="Tulis mesej..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={chatText}
              onChangeText={setChatText}
              returnKeyType="send"
              onSubmitEditing={handleSendChat}
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendChat}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoView: {
    ...StyleSheet.absoluteFillObject,
  },
  waitingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  waitingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    background: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  viewerCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  campaignTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Bottom section
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.45,
  },

  // Chat
  chatList: {
    maxHeight: height * 0.25,
    paddingHorizontal: 16,
  },
  chatListContent: {
    paddingBottom: 8,
  },
  chatMsg: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  chatMsgUser: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
    marginRight: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  chatMsgText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Broadcaster controls
  broadcasterControls: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  goLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 10,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  goLiveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  goLiveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endLiveBtn: {
    backgroundColor: '#ef4444',
  },

  // Chat input
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stream ended
  endedContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  endedTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  endedSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  endedBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 10,
  },
  endedBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  viewerFloatingRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-end',
    width: '100%',
  },
  floatingDonateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingDonateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
