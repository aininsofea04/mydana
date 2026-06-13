import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, Image, ActivityIndicator, StatusBar, Share, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, setDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { COLORS } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useVideoPlayer, VideoView } from 'expo-video';
import Loading from './Loading';

const { width, height } = Dimensions.get('window');

const getDaysRemaining = (tempohStr) => {
  if (!tempohStr) return Infinity;
  const parts = tempohStr.split('-');
  if (parts.length < 2) return Infinity;
  const endDateStr = parts[1].trim();
  const dateParts = endDateStr.split('/');
  if (dateParts.length < 3) return Infinity;
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return Infinity;

  const endDate = new Date(year, month, day);
  const today = new Date();
  endDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const timeDiff = endDate.getTime() - today.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

const TABS = [
  { id: 'urgent_viral', label: 'MyDana Feed' },
  { id: 'Rawatan Perubatan', label: 'Perubatan' },
  { id: 'Pendidikan', label: 'Pendidikan' },
  { id: 'Bantuan Sara Hidup', label: 'Sara Hidup' },
  { id: 'Haiwan', label: 'Haiwan' },
  { id: 'Bencana Alam', label: 'Bencana' },
  { id: 'Lain-lain', label: 'Lain-lain' },
];

const CATEGORY_IMAGES = {
  'Perubatan': 'https://images.unsplash.com/photo-1576091160550-217359991f1c?w=800&q=80',
  'Haiwan': 'https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?w=800&q=80',
  'Pendidikan': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
  'Bencana Alam': 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&q=80',
  'Umum': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80',
  'Permohonan Bantuan': 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80',
};

const CommentItem = ({ item, onReply, onLike, isReply, parentId }) => {
  const [commenter, setCommenter] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const idToUse = item.userId || (item.user === currentUser?.email ? currentUser.uid : null);
    if (!idToUse) return;

    const unsub = onSnapshot(doc(db, 'users', idToUse), (snap) => {
      if (snap.exists()) setCommenter(snap.data());
    });
    return unsub;
  }, [item.userId, item.user, currentUser]);

  const displayName = commenter?.username ? `@${commenter.username}` : (item.user || 'Pengguna');
  const defaultAvatar = 'https://static.vecteezy.com/system/resources/previews/009/734/564/non_2x/default-avatar-profile-icon-of-social-media-user-vector.jpg';
  const displayPhoto = commenter?.photoURL || item.userPhoto || defaultAvatar;

  return (
    <View style={[styles.commentItem, isReply && styles.replyWrapper]}>
      <View style={[styles.commentAvatar, isReply && styles.replyAvatar]}>
        <Image source={{ uri: displayPhoto }} style={styles.commentAvatarImage} />
      </View>
      <View style={styles.commentBody}>
        <Text style={styles.commentUser}>{displayName.startsWith('@') ? displayName : `@${displayName.split('@')[0]}`}</Text>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.commentActions}>
          <Text style={styles.commentTime}>Baru sahaja</Text>
          {!isReply && onReply && (
            <TouchableOpacity onPress={() => onReply(item)}>
              <Text style={styles.replyText}>Balas</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.likeAction}>
        <TouchableOpacity onPress={() => onLike(item.id, !!isReply, parentId)}>
          <Ionicons name={item.isLiked ? "heart" : "heart-outline"} size={16} color={item.isLiked ? "#ef4444" : "#888"} />
        </TouchableOpacity>
        <Text style={styles.likeCount}>{item.likes || 0}</Text>
      </View>
    </View>
  );
};

const CommentsModal = ({ visible, onClose, campaign, comments, commentText, setCommentText, onSend, onLike, onReply, replyingTo, cancelReply }) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Komen ({comments.length})</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.commentWrapper}>
              <CommentItem item={item} onReply={onReply} onLike={onLike} />
              {item.replies && item.replies.map(reply => (
                <CommentItem key={reply.id} item={reply} isReply={true} parentId={item.id} onLike={onLike} />
              ))}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyCommentText}>Belum ada komen. Jadilah yang pertama!</Text>
          }
        />

        {replyingTo && (
          <View style={styles.replyingToBanner}>
            <Text style={styles.replyingToText}>Membalas kepada @{replyingTo.user.split('@')[0]}</Text>
            <TouchableOpacity onPress={cancelReply}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder={replyingTo ? "Taip balasan anda..." : "Tambah komen..."}
            placeholderTextColor="#888"
            value={commentText}
            onChangeText={setCommentText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={onSend}>
            <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const VideoPlayerComponent = ({ uri, isMuted, isScreenFocused, isCurrent, isSlideActive }) => {
  // Stability Fix: Pass bare URI string as source, modify properties via player instance options
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    // Aggressive playback optimization to reduce pre-play buffering delays
    p.bufferOptions = {
      preferredForwardBufferDuration: 1.0,
      playableDurationToStartPlayback: 0.5,
    };
  });

  const [isPlaying, setIsPlaying] = useState(player ? player.playing : false);
  const [playerStatus, setPlayerStatus] = useState(player ? player.status : 'idle');

  useEffect(() => {
    if (!player) return;
    setIsPlaying(player.playing);
    setPlayerStatus(player.status);

    const playingSub = player.addListener('playingChange', ({ isPlaying: newPlaying }) => {
      setIsPlaying(newPlaying);
    });

    const statusSub = player.addListener('statusChange', ({ status: newStatus }) => {
      setPlayerStatus(newStatus);
    });

    return () => {
      playingSub.remove();
      statusSub.remove();
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;

    const shouldPlay = isCurrent && isScreenFocused && isSlideActive;

    if (shouldPlay) {
      if (player.status === 'readyToPlay') {
        player.play();
      }
    } else {
      player.pause();
    }

    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && shouldPlay) {
        player.play();
      }
    });

    return () => {
      sub.remove();
    };
  }, [isCurrent, isScreenFocused, isSlideActive, isMuted, player]);

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const isLoading = playerStatus === 'loading' || playerStatus === 'idle';

  return (
    <View style={styles.mediaContent}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <TouchableOpacity activeOpacity={1} onPress={togglePlay} style={StyleSheet.absoluteFill} />

      {isLoading ? (
        <View style={styles.playOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        !isPlaying && (
          <View style={styles.playOverlay} pointerEvents="none">
            <Ionicons name="play" size={60} color="rgba(255,255,255,0.7)" />
          </View>
        )
      )}
    </View>
  );
};

const VideoSlide = ({ uri, isMuted, isScreenFocused, isCurrent, isSlideActive, shouldPreload }) => {
  if (!shouldPreload) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  return (
    <VideoPlayerComponent
      uri={uri}
      isMuted={isMuted}
      isScreenFocused={isScreenFocused}
      isCurrent={isCurrent}
      isSlideActive={isSlideActive}
    />
  );
};

const ProgressTimeline = ({ appId }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewMedia, setPreviewMedia] = useState(null);

  useEffect(() => {
    if (!appId) return;
    const q = query(collection(db, 'applications', appId, 'progress_reports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [appId]);

  if (loading) return <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} />;
  if (reports.length === 0) return (
    <View style={styles.infoUpdateBox}>
      <Ionicons name="information-circle-outline" size={24} color={COLORS.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoUpdateTitle, { color: COLORS.textMuted }]}>Belum ada perkembangan</Text>
        <Text style={[styles.infoUpdateText, { color: COLORS.textMuted }]}>Pemohon akan mengemaskini perkembangan kempen di sini sebaik sahaja bantuan diterima.</Text>
      </View>
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      {reports.map((r, i) => (
        <View key={r.id} style={[styles.progressReportCard, r.isAdminUpdate && styles.adminReportCard]}>
          <View style={styles.reportHeader}>
            <View style={[styles.reportDot, r.isAdminUpdate && { backgroundColor: COLORS.primary }]} />
            <Text style={styles.reportDate}>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru sahaja'}</Text>
            {r.isAdminUpdate && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#fff" />
                <Text style={styles.adminBadgeText}>INFO RASMI ADMIN</Text>
              </View>
            )}
          </View>
          <View style={[styles.reportContent, r.isAdminUpdate && styles.adminReportContent]}>
            <Text style={[styles.reportText, r.isAdminUpdate && { color: '#1e3a8a', fontWeight: '500' }]}>{r.text}</Text>
            {r.media && r.media.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reportMediaRow}>
                {r.media.map((m, idx) => (
                  <TouchableOpacity key={idx} style={styles.reportMediaItem} onPress={() => setPreviewMedia(m)}>
                    {m.type === 'video' ? (
                      <View style={styles.reportVideoPlaceholder}>
                        <Ionicons name="play-circle" size={24} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>VIDEO</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: m.url }} style={styles.reportImage} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      ))}

      <MediaPreviewModal
        visible={!!previewMedia}
        media={previewMedia}
        onClose={() => setPreviewMedia(null)}
      />
    </View>
  );
};

const PreviewPlayer = ({ url }) => {
  const player = useVideoPlayer(url, p => { p.play(); p.loop = true; });
  return <VideoView player={player} style={styles.fullMedia} contentFit="contain" />;
};

const MediaPreviewModal = ({ visible, media, onClose }) => {
  if (!media) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <TouchableOpacity style={styles.previewClose} onPress={onClose}>
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>

        <View style={styles.previewContent}>
          {media.type === 'video' ? (
            <PreviewPlayer url={media.url} />
          ) : (
            <Image source={{ uri: media.url }} style={styles.fullMedia} resizeMode="contain" />
          )}
        </View>
      </View>
    </Modal>
  );
};

const InfoModal = ({ visible, onClose, campaign, navigation }) => {
  const [applicant, setApplicant] = useState(null);

  useEffect(() => {
    if (!campaign) return;
    const idToUse = campaign.userId || campaign.uid || campaign.id;
    const unsub = onSnapshot(doc(db, 'users', idToUse), (snap) => {
      if (snap.exists()) setApplicant(snap.data());
    });
    return unsub;
  }, [campaign]);

  if (!campaign) return null;
  const feed = campaign.feed || {};

  const targetRaw = (campaign.summary?.dana || '').replace(/\D/g, '');
  const target = parseInt(targetRaw) || 10000;
  const current = Math.floor(target * 0.45);
  const percent = Math.min(100, Math.round((current / target) * 100));

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.infoModalContent}>
          <View style={styles.infoModalDragBar} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.infoModalTitle}>{campaign.summary?.tajuk || 'Kempen MyDana'}</Text>

            <View style={styles.infoApplicantRow}>
              <View style={styles.infoAvatar}>
                {applicant?.photoURL ? (
                  <Image source={{ uri: applicant.photoURL }} style={styles.avatarMiniImage} />
                ) : (
                  <Text style={styles.infoAvatarText}>{(applicant?.nama || campaign.name || '?')[0].toUpperCase()}</Text>
                )}
              </View>
              <View>
                <Text style={styles.infoApplicantName}>{applicant?.nama || campaign.name}</Text>
                <Text style={styles.infoApplicantSub}>@{applicant?.username || campaign.name?.toLowerCase().replace(/\s/g, '')} • Disahkan ✅</Text>
              </View>
            </View>

            <View style={styles.infoProgressBox}>
              <Text style={styles.infoProgressTitle}>Dana Terkumpul</Text>
              <Text style={styles.infoProgressAmount}>RM {current.toLocaleString('ms-MY')}</Text>
              <Text style={styles.infoProgressTarget}>daripada sasaran RM {target.toLocaleString('ms-MY')}</Text>

              <View style={styles.infoProgressBarBg}>
                <View style={[styles.infoProgressBarFill, { width: `${percent}%` }]} />
              </View>
            </View>

            <Text style={styles.infoSectionTitle}>Penerangan Kempen</Text>
            <Text style={styles.infoDescriptionText}>
              {feed.description || campaign.summary?.sebab || 'Tiada penerangan lengkap disediakan oleh pemohon.'}
            </Text>

            <Text style={styles.infoSectionTitle}>Laporan Perkembangan</Text>
            <ProgressTimeline appId={campaign.id} />

            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.infoModalFooter}>
            <TouchableOpacity
              style={styles.infoDonateBtn}
              onPress={() => {
                onClose();
                navigation.navigate('Payment', { campaign: campaign });
              }}
            >
              <Text style={styles.infoDonateBtnText}>Sumbang Sekarang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const CampaignItem = ({ item, navigation, onOpenComments, onOpenInfo, isScreenFocused, isCurrent, shouldPreload }) => {
  const feed = item.feed || {};
  const [isMuted, setIsMuted] = useState(false);
  const [applicant, setApplicant] = useState(null);
  const [localCommentCount, setLocalCommentCount] = useState(item.commentCount || 0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const fullscreenListRef = useRef(null);
  const currentUserUid = auth.currentUser?.uid;
  const isLiked = item.likedBy?.includes(currentUserUid) || false;

  useEffect(() => {
    const idToUse = item.userId || item.uid || item.id;
    if (!idToUse) return;

    const unsub = onSnapshot(doc(db, 'users', idToUse), (snap) => {
      if (snap.exists()) {
        setApplicant(snap.data());
      }
    });
    return unsub;
  }, [item.userId, item.uid, item.id]);

  useEffect(() => {
    const q = query(collection(db, 'applications', item.id, 'comments'));
    const unsub = onSnapshot(q, (snap) => {
      let total = 0;
      snap.docs.forEach(docSnap => {
        total += 1;
        const cData = docSnap.data();
        if (cData.replies && Array.isArray(cData.replies)) {
          total += cData.replies.length;
        }
      });
      setLocalCommentCount(total);
    });
    return unsub;
  }, [item.id]);

  const handleLike = async () => {
    if (!currentUserUid) {
      Alert.alert('Sila Log Masuk', 'Anda perlu log masuk untuk menyukai kempen ini.');
      return;
    }
    const campaignRef = doc(db, 'applications', item.id);
    const userRef = doc(db, 'users', currentUserUid);
    try {
      if (isLiked) {
        await updateDoc(campaignRef, {
          likedBy: arrayRemove(currentUserUid),
          likeCount: Math.max(0, (item.likeCount || 0) - 1)
        });
        await setDoc(userRef, {
          likedPosts: arrayRemove(item.id)
        }, { merge: true });
      } else {
        await updateDoc(campaignRef, {
          likedBy: arrayUnion(currentUserUid),
          likeCount: (item.likeCount || 0) + 1
        });
        await setDoc(userRef, {
          likedPosts: arrayUnion(item.id)
        }, { merge: true });
      }
    } catch (e) {
      console.error("Like error", e);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Bantu kempen MyDana ini: ${item.summary?.tajuk || 'Kempen MyDana'}\n\nMari bantu mereka yang memerlukan. Klik di sini: https://mydana.com/campaign/${item.id}`,
      });
    } catch (e) {
      console.error("Share error:", e.message);
    }
  };

  const handleComment = () => {
    if (onOpenComments) onOpenComments(item);
  };

  const handleOpenInfo = () => {
    if (onOpenInfo) onOpenInfo(item);
  };

  const allMedia = [];
  if (feed.video) allMedia.push({ type: 'video', uri: feed.video });
  if (feed.images) {
    feed.images.forEach(uri => allMedia.push({ type: 'image', uri }));
  }
  if (allMedia.length === 0) {
    allMedia.push({ type: 'image', uri: CATEGORY_IMAGES[item.summary?.kategori] || CATEGORY_IMAGES['Umum'] });
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setCurrentIndex(Math.round(index));
  };

  const scrollToIndex = (index) => {
    if (flatListRef.current && index >= 0 && index < allMedia.length) {
      flatListRef.current.scrollToIndex({ index, animated: true });
      setCurrentIndex(index);
    }
  };

  const renderMediaItem = ({ item: media, index: mediaIndex }) => (
    <View style={styles.mediaSlide}>
      {media.type === 'video' ? (
        <VideoSlide
          uri={media.uri}
          isMuted={isMuted}
          isScreenFocused={isScreenFocused}
          isCurrent={isCurrent}
          isSlideActive={currentIndex === mediaIndex}
          shouldPreload={shouldPreload}
        />
      ) : (
        <Image source={{ uri: media.uri }} style={styles.mediaContent} />
      )}
      <View style={styles.darkFilterOverlay} pointerEvents="none" />
    </View>
  );

  return (
    <View style={styles.campaignContainer}>
      <View style={styles.cardContainer}>
        <FlatList
          ref={flatListRef}
          data={allMedia}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={renderMediaItem}
          keyExtractor={(m, i) => i.toString()}
          style={styles.mediaList}
          onMomentumScrollEnd={handleScroll}
        />

        {allMedia.length > 1 && currentIndex > 0 && (
          <TouchableOpacity
            style={[styles.arrowBtn, { left: 10 }]}
            onPress={() => scrollToIndex(currentIndex - 1)}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
        )}

        {allMedia.length > 1 && currentIndex < allMedia.length - 1 && (
          <TouchableOpacity
            style={[styles.arrowBtn, { right: 10 }]}
            onPress={() => scrollToIndex(currentIndex + 1)}
          >
            <Ionicons name="chevron-forward" size={26} color="#fff" />
          </TouchableOpacity>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.gradientOverlay}
          pointerEvents="none"
        />

        {item.isLive && (
          <TouchableOpacity 
            style={styles.liveBadgeOverlay} 
            onPress={() => navigation.navigate('LiveStream', { mode: 'viewer', campaign: item })}
            activeOpacity={0.8}
          >
            <View style={styles.liveBadgeDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
            <View style={styles.viewerBadgeSmall}>
               <Ionicons name="eye" size={10} color="#fff" />
               <Text style={styles.viewerBadgeText}>{item.liveViewerCount || 0}</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => { setFullscreenIndex(currentIndex); setFullscreenVisible(true); }}
          activeOpacity={0.7}
        >
          <Ionicons name="expand-outline" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.sideActions} pointerEvents="box-none">
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={32} color={isLiked ? "#ef4444" : "#fff"} />
            <Text style={styles.actionText}>{item.likeCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleComment}>
            <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
            <Text style={styles.actionText}>{localCommentCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social" size={28} color="#fff" />
            <Text style={styles.actionText}>Kongsi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomContent} pointerEvents="box-none">
          <View style={styles.applicantRow}>
            <View style={styles.avatarMini}>
              {applicant?.photoURL ? (
                <Image source={{ uri: applicant.photoURL }} style={styles.avatarMiniImage} />
              ) : (
                <Text style={styles.avatarMiniText}>{(applicant?.nama || item.name || '?')[0].toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.applicantName}>@{applicant?.username || item.name?.toLowerCase().replace(/\s/g, '') || 'pengguna'}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
            </View>
          </View>
          <Text style={styles.campaignTitle}>{item.summary?.tajuk || 'Kempen MyDana'}</Text>


          <TouchableOpacity onPress={handleOpenInfo} activeOpacity={0.8} style={{ marginBottom: 12 }}>
            <Text style={styles.readMoreText}>Baca sepenuhnya & lihat info dana...</Text>
          </TouchableOpacity>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '45%' }]} />
          </View>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressText}>{item.summary?.dana || 'RM 0'} sasaran</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Aktif</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.donateBtn}
            onPress={() => navigation.navigate('Payment', { campaign: item })}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.donateGradient}
            >
              <Text style={styles.donateBtnText}>SUMBANG SEKARANG</Text>
              <Ionicons name="heart" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fullscreenBackdrop}>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setFullscreenVisible(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <FlatList
            ref={fullscreenListRef}
            data={allMedia}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={fullscreenIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            keyExtractor={(_, i) => `fs-${i}`}
            renderItem={({ item: media }) => (
              <View style={styles.fullscreenSlide}>
                {media.type === 'video' ? (
                  <VideoPlayerComponent
                    uri={media.uri}
                    isMuted={isMuted}
                    isScreenFocused={true}
                    isCurrent={true}
                    isSlideActive={true}
                  />
                ) : (
                  <Image
                    source={{ uri: media.uri }}
                    style={styles.fullscreenMedia}
                    resizeMode="contain"
                  />
                )}
              </View>
            )}
          />

          {allMedia.length > 1 && (
            <View style={styles.fullscreenIndicator}>
              <Text style={styles.fullscreenIndicatorText}>
                {fullscreenIndex + 1} / {allMedia.length}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

export default function MainPageScreen({ navigation }) {
  const [campaigns, setCampaigns] = useState([]);
  const [activeTab, setActiveTab] = useState('urgent_viral');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const currentUser = auth.currentUser;
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const filteredCampaigns = useMemo(() => {
    if (activeTab === 'urgent_viral') {
      const urgentOrViral = campaigns.filter(item => {
        const tempoh = item.summary?.tempoh || item.tempoh;
        const daysRemaining = getDaysRemaining(tempoh);
        const likes = item.likeCount || 0;
        const comments = item.commentCount || 0;

        const isUrgent = daysRemaining >= 0 && daysRemaining <= 7;
        const isViral = likes >= 2 || comments >= 1;

        return isUrgent || isViral;
      });
      return urgentOrViral.length > 0 ? urgentOrViral : campaigns;
    } else {
      return campaigns.filter(item => {
        const cat = item.summary?.kategori || item.category;
        return cat === activeTab;
      });
    }
  }, [campaigns, activeTab]);

  const finalCampaigns = useMemo(() => {
    let list = filteredCampaigns;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const title = (item.summary?.tajuk || '').toLowerCase();
        const sebab = (item.summary?.sebab || '').toLowerCase();
        const desc = (item.feed?.description || '').toLowerCase();
        const creator = (item.name || '').toLowerCase();
        return title.includes(q) || sebab.includes(q) || desc.includes(q) || creator.includes(q);
      });
    }
    return list;
  }, [filteredCampaigns, searchQuery]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    return unsub;
  }, [currentUser]);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);

  const [viewableItems, setViewableItems] = useState([]);
  const onViewableItemsChanged = useRef(({ viewableItems: vItems }) => {
    setViewableItems(vItems.map(vi => vi.item.id));
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const handleOpenComments = (item) => {
    setActiveCampaign(item);
    setCommentModalVisible(true);
    setReplyingTo(null);
  };

  const handleOpenInfo = (item) => {
    setActiveCampaign(item);
    setInfoModalVisible(true);
  };

  useEffect(() => {
    if (!activeCampaign || !commentModalVisible) return;
    const q = query(collection(db, 'applications', activeCampaign.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCommentsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [activeCampaign, commentModalVisible]);

  const handleSendComment = async () => {
    if (commentText.trim().length > 0 && activeCampaign) {
      const userDisplay = userData?.username ? `@${userData.username}` : (currentUser?.email || 'Pengguna');
      const userPhoto = userData?.photoURL || '';

      try {
        const campaignRef = doc(db, 'applications', activeCampaign.id);

        if (replyingTo) {
          const commentRef = doc(db, 'applications', activeCampaign.id, 'comments', replyingTo.id);
          await updateDoc(commentRef, {
            replies: arrayUnion({
              id: Date.now().toString(),
              text: commentText,
              userId: currentUser.uid,
              user: userDisplay,
              userPhoto: userPhoto,
              likes: 0,
              isLiked: false
            })
          });
        } else {
          await addDoc(collection(db, 'applications', activeCampaign.id, 'comments'), {
            text: commentText,
            userId: currentUser.uid,
            user: userDisplay,
            userPhoto: userPhoto,
            likes: 0,
            isLiked: false,
            replies: [],
            createdAt: serverTimestamp()
          });

          await updateDoc(campaignRef, {
            commentCount: (activeCampaign.commentCount || 0) + 1
          });
        }
        setCommentText('');
        setReplyingTo(null);
      } catch (e) {
        console.error("Comment error", e);
        Alert.alert("Ralat", "Gagal menghantar komen.");
      }
    }
  };

  const handleLikeComment = async (commentId, isReply = false, parentId = null) => {
    if (!activeCampaign) return;
    try {
      if (!isReply) {
        const commentToUpdate = commentsList.find(c => c.id === commentId);
        if (!commentToUpdate) return;
        const commentRef = doc(db, 'applications', activeCampaign.id, 'comments', commentId);
        await updateDoc(commentRef, {
          isLiked: !commentToUpdate.isLiked,
          likes: !commentToUpdate.isLiked ? (commentToUpdate.likes || 0) + 1 : Math.max(0, (commentToUpdate.likes || 0) - 1)
        });
      } else {
        const parent = commentsList.find(c => c.id === parentId);
        if (!parent) return;
        const updatedReplies = parent.replies.map(r =>
          r.id === commentId
            ? { ...r, isLiked: !r.isLiked, likes: !r.isLiked ? (r.likes || 0) + 1 : Math.max(0, (r.likes || 0) - 1) }
            : r
        );
        const commentRef = doc(db, 'applications', activeCampaign.id, 'comments', parentId);
        await updateDoc(commentRef, { replies: updatedReplies });
      }
    } catch (e) {
      console.error("Like comment error", e);
    }
  };

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.log("Audio config error:", e);
      }
    };
    configureAudio();

    const fetchCampaigns = () => {
      const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(app => app.status === 'approved' && app.isPublished);
        setCampaigns(data);
        setLoading(false);
      }, (e) => {
        console.error("Error fetching campaigns:", e);
        setLoading(false);
      });
      return unsub;
    };

    const unsubCampaigns = fetchCampaigns();
    return () => {
      unsubCampaigns();
    };
  }, []);

  if (loading) {
    return <Loading text="Memuatkan kempen..." />;
  }

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={[styles.headerOverlay, { top: Math.max(insets.top, 20) + 5, flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={18} color="rgba(7, 1, 1, 1)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari kempen..."
              placeholderTextColor="rgba(6, 2, 2, 1)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
          style={styles.categoryBar}
          keyboardShouldPersistTaps="handled"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {finalCampaigns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={60} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Tiada Kempen Aktif</Text>
          <Text style={styles.emptyText}>
            {searchQuery ? "Tiada kempen sepadan dengan carian anda." : "Belum ada kempen untuk kategori ini."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={finalCampaigns}
          renderItem={({ item, index }) => {
            const isCurrent = viewableItems.includes(item.id) || (viewableItems.length === 0 && index === 0);
            const activeIndex = finalCampaigns.findIndex(c => viewableItems.includes(c.id));
            const shouldPreload = isCurrent || index === activeIndex + 1 || (viewableItems.length === 0 && index === 1);
            return (
              <CampaignItem
                item={item}
                navigation={navigation}
                onOpenComments={handleOpenComments}
                onOpenInfo={handleOpenInfo}
                isScreenFocused={isFocused}
                isCurrent={isCurrent}
                shouldPreload={shouldPreload}
              />
            );
          }}
          keyExtractor={item => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height - 110}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews={true}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}

      <InfoModal
        visible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
        campaign={activeCampaign}
        navigation={navigation}
      />

      <CommentsModal
        visible={commentModalVisible}
        onClose={() => { setCommentModalVisible(false); setReplyingTo(null); }}
        campaign={activeCampaign}
        comments={commentsList}
        commentText={commentText}
        setCommentText={setCommentText}
        onSend={handleSendComment}
        onLike={handleLikeComment}
        onReply={(comment) => setReplyingTo(comment)}
        replyingTo={replyingTo}
        cancelReply={() => setReplyingTo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center' },
  headerOverlay: {
    position: 'absolute', width: '100%', zIndex: 10,
    paddingHorizontal: 20,
  },
  categoryBar: {
    marginTop: 4,
  },
  categoryScroll: {
    gap: 8,
    paddingRight: 40,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  categoryTabText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 253, 254, 1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(198, 181, 181, 0.15)',
    paddingHorizontal: 16,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#150202ff',
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  adminIcon: { position: 'absolute', right: 20 },
  campaignContainer: {
    width: width,
    height: height - 110,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 160,
    paddingBottom: 10,
  },
  cardContainer: {
    width: width * 0.95,
    height: height - 250,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  mediaList: { flex: 1 },
  mediaSlide: { width: width * 0.95, height: '100%' },
  mediaContent: { width: '100%', height: '100%', resizeMode: 'cover' },
  gradientOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.45,
  },
  darkFilterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  arrowBtn: {
    position: 'absolute',
    top: '36%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  sideActions: {
    position: 'absolute', right: 12, bottom: 150, gap: 20, alignItems: 'center',
  },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bottomContent: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    paddingHorizontal: 16,
  },
  applicantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  avatarMini: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff',
    overflow: 'hidden'
  },
  avatarMiniImage: { width: '100%', height: '100%' },
  avatarMiniText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  applicantName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  verifiedBadge: { marginTop: 2 },
  campaignTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  campaignDesc: { color: '#e2e8f0', fontSize: 14, lineHeight: 20, opacity: 0.9 },
  readMoreText: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 6 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 2 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  activeText: { color: COLORS.success, fontSize: 12, fontWeight: '700' },
  donateBtn: { width: '100%', height: 54, borderRadius: 16, overflow: 'hidden' },
  donateGradient: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  donateBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20 },
  emptyText: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.65,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  commentWrapper: { marginBottom: 16 },
  commentItem: { flexDirection: 'row', marginBottom: 6 },
  replyWrapper: { marginLeft: 40, marginTop: 4 },
  replyAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentActions: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  commentTime: { fontSize: 12, color: '#888' },
  replyText: { fontSize: 12, color: '#888', fontWeight: '600' },
  likeAction: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2, paddingLeft: 10 },
  likeCount: { fontSize: 12, color: '#888', marginTop: 2 },
  replyingToBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f9f9f9', borderTopWidth: 1, borderTopColor: '#eee' },
  replyingToText: { fontSize: 12, color: '#555', fontWeight: '500' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' },
  commentAvatarImage: { width: '100%', height: '100%' },
  commentAvatarText: { color: '#fff', fontWeight: 'bold' },
  commentBody: { flex: 1 },
  commentUser: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#000' },
  emptyCommentText: { textAlign: 'center', color: '#888', marginTop: 20 },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#000',
    marginRight: 10,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  infoModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: height * 0.85, width: '100%' },
  infoModalDragBar: { width: 40, height: 5, backgroundColor: '#ddd', borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  infoModalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  infoApplicantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  infoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  infoAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  infoApplicantName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  infoApplicantSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  infoProgressBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  infoProgressTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  infoProgressAmount: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  infoProgressTarget: { fontSize: 13, color: COLORS.textMuted, marginBottom: 12 },
  infoProgressBarBg: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  infoProgressBarFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 4 },
  infoSectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  infoDescriptionText: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, marginBottom: 30 },
  infoUpdateBox: { flexDirection: 'row', backgroundColor: '#f0fdf4', padding: 16, borderRadius: 16, alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  infoUpdateTitle: { fontSize: 15, fontWeight: '700', color: '#166534' },
  infoUpdateDate: { fontSize: 12, color: '#15803d', marginBottom: 6 },
  infoUpdateText: { fontSize: 14, color: '#166534', lineHeight: 20 },
  infoModalFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  infoDonateBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  infoDonateBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  progressReportCard: { borderLeftWidth: 2, borderLeftColor: COLORS.primary, paddingLeft: 16, marginBottom: 4 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reportDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, marginLeft: -21 },
  reportDate: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  reportContent: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  reportText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  reportMediaRow: { marginTop: 10, flexDirection: 'row' },
  reportMediaItem: { width: 100, height: 100, marginRight: 8, borderRadius: 8, overflow: 'hidden' },
  reportImage: { width: '100%', height: '100%' },
  reportVideoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', gap: 4 },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  previewClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  previewContent: { width: '100%', height: '80%' },
  fullMedia: { width: '100%', height: '100%' },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  adminReportCard: { borderLeftColor: COLORS.primary },
  adminBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  adminBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  adminReportContent: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  expandBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 6,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenSlide: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  fullscreenMedia: {
    width: '100%',
    height: '100%',
  },
  fullscreenIndicator: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  fullscreenIndicatorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  liveBadgeOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveBadgeText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewerBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
    marginLeft: 2,
  },
  viewerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});