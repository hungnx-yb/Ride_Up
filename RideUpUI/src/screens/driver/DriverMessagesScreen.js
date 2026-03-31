import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DriverBottomNav from '../../components/DriverBottomNav';
import {
  createChatRealtimeClient,
  getChatMessages,
  getMyChatThreads,
  markChatThreadRead,
  sendChatMessage,
  uploadFile,
} from '../../services/api';

const normalizeDriverMessage = (msg) => {
  if (!msg) return msg;
  return {
    ...msg,
    mine: String(msg.senderRole || '').toUpperCase() === 'DRIVER',
  };
};

const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const DriverMessagesScreen = ({ navigation }) => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [chatVisible, setChatVisible] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatUploadingImage, setChatUploadingImage] = useState(false);
  const [chatPendingImage, setChatPendingImage] = useState(null);
  const [chatThread, setChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');

  const realtimeRef = useRef(null);
  const chatScrollRef = useRef(null);

  const stopRealtime = useCallback(() => {
    realtimeRef.current?.disconnect?.();
    realtimeRef.current = null;
  }, []);

  const appendUniqueMessage = useCallback((incoming) => {
    if (!incoming?.id) return;
    setChatMessages((prev) => {
      const normalizedIncoming = normalizeDriverMessage(incoming);
      if (prev.some((item) => item?.id === normalizedIncoming.id)) {
        return prev;
      }
      return [...prev, normalizedIncoming];
    });
  }, []);

  const startRealtime = useCallback((threadId) => {
    if (!threadId) return;
    stopRealtime();
    realtimeRef.current = createChatRealtimeClient({
      threadId,
      onMessage: appendUniqueMessage,
    });
  }, [appendUniqueMessage, stopRealtime]);

  const loadThreads = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getMyChatThreads();
      setThreads(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Loi', e?.message || 'Khong tai duoc danh sach chat');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => () => {
    stopRealtime();
  }, [stopRealtime]);

  const openThread = useCallback(async (thread) => {
    if (!thread?.id) return;
    try {
      setChatVisible(true);
      setChatLoading(true);
      setChatThread(thread);
      const messages = await getChatMessages(thread.id, 100);
      setChatMessages(Array.isArray(messages) ? messages.map(normalizeDriverMessage) : []);
      setChatDraft('');
      setChatPendingImage(null);
      await markChatThreadRead(thread.id).catch(() => {});
      startRealtime(thread.id);
      loadThreads(true);
    } catch (e) {
      Alert.alert('Loi', e?.message || 'Khong mo duoc cuoc tro chuyen');
      setChatVisible(false);
    } finally {
      setChatLoading(false);
    }
  }, [loadThreads, startRealtime]);

  const closeChatModal = useCallback(() => {
    stopRealtime();
    setChatVisible(false);
    setChatThread(null);
    setChatMessages([]);
    setChatDraft('');
    setChatPendingImage(null);
    setChatUploadingImage(false);
  }, [stopRealtime]);

  const submitChatMessage = useCallback(async () => {
    const textContent = chatDraft.trim();
    const hasPendingImage = !!(chatPendingImage?.uri || chatPendingImage?.file);
    if (!chatThread?.id || chatSending || chatUploadingImage || (!textContent && !hasPendingImage)) return;

    try {
      setChatSending(true);
      let uploadedImageUrl = null;

      if (hasPendingImage) {
        setChatUploadingImage(true);
        uploadedImageUrl = await uploadFile({
          uri: chatPendingImage.uri,
          name: chatPendingImage.name,
          type: chatPendingImage.type,
          file: chatPendingImage.file,
        });
      }

      const sent = await sendChatMessage(chatThread.id, {
        content: textContent || null,
        imageUrl: uploadedImageUrl,
      });

      appendUniqueMessage(sent);
      setChatDraft('');
      setChatPendingImage(null);
      loadThreads(true);
    } catch (e) {
      Alert.alert('Loi', e?.message || 'Gui tin nhan that bai');
    } finally {
      setChatUploadingImage(false);
      setChatSending(false);
    }
  }, [appendUniqueMessage, chatDraft, chatPendingImage, chatSending, chatThread?.id, chatUploadingImage, loadThreads]);

  const submitChatImage = useCallback(async () => {
    if (!chatThread?.id || chatSending || chatUploadingImage) return;

    try {
      const isWebRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';
      if (isWebRuntime) {
        const selected = await new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const file = input.files && input.files[0] ? input.files[0] : null;
            if (!file) {
              resolve(null);
              return;
            }
            resolve({
              uri: URL.createObjectURL(file),
              name: file.name || `chat-${Date.now()}.jpg`,
              type: file.type || 'image/jpeg',
              file,
            });
          };
          input.click();
        });

        if (!selected) return;
        setChatPendingImage(selected);
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission?.granted) {
          Alert.alert('Quyen bi tu choi', 'Vui long cap quyen thu vien anh de gui hinh.');
          return;
        }

        const picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.9,
        });
        if (picked.canceled || !picked.assets?.length) return;

        const selected = picked.assets[0];
        setChatPendingImage({
          uri: selected.uri,
          name: selected.fileName || `chat-${Date.now()}.jpg`,
          type: selected.mimeType || 'image/jpeg',
          file: selected.file,
        });
      }
    } catch (e) {
      Alert.alert('Loi', e?.message || 'Khong chon duoc hinh anh');
    }
  }, [chatSending, chatThread?.id, chatUploadingImage]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E65100" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Tin nhan tai xe</Text>
        <Text style={styles.subTitle}>Mo chat nhanh voi khach hang ma khong can vao chi tiet chuyen</Text>
      </View>

      <FlatList
        data={threads}
        keyExtractor={(item, index) => item?.id || `thread-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadThreads(true)} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.threadCard} onPress={() => openThread(item)} activeOpacity={0.9}>
            <View style={styles.threadTop}>
              <Text style={styles.threadTitle}>{item.chatTitle || `Booking: ${item.bookingId || '--'}`}</Text>
              <Text style={styles.threadTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.threadPreview} numberOfLines={2}>{item.lastMessagePreview || 'Bat dau tro chuyen'}</Text>
            {!!item.myUnreadCount && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Chua co cuoc tro chuyen nao</Text>}
      />

      <Modal visible={chatVisible} transparent animationType="fade" onRequestClose={closeChatModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chat voi khach hang</Text>
            <Text style={styles.modalSub}>Booking: {chatThread?.bookingId || '--'}</Text>

            {chatLoading ? (
              <View style={styles.chatLoadingWrap}>
                <ActivityIndicator size="small" color="#E65100" />
                <Text style={styles.chatLoadingText}>Dang tai tin nhan...</Text>
              </View>
            ) : (
              <ScrollView
                ref={chatScrollRef}
                style={styles.chatMessagesList}
                contentContainerStyle={styles.chatMessagesContent}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {chatMessages.length === 0 && (
                  <Text style={styles.chatEmptyText}>Chua co tin nhan.</Text>
                )}
                {chatMessages.map((msg, idx) => (
                  <View key={msg.id || `msg-${idx}`} style={[styles.chatBubble, msg.mine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                    {!!msg.imageUrl && <Image source={{ uri: msg.imageUrl }} style={styles.chatImage} resizeMode="cover" />}
                    {!!msg.content && <Text style={[styles.chatBubbleText, msg.mine && styles.chatBubbleTextMine]}>{msg.content}</Text>}
                    <Text style={[styles.chatBubbleTime, msg.mine && styles.chatBubbleTimeMine]}>{formatTime(msg.sentAt)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.chatComposerRow}>
              <TouchableOpacity
                style={[styles.chatImageBtn, (chatSending || chatUploadingImage) && styles.chatImageBtnDisabled]}
                onPress={submitChatImage}
                disabled={chatSending || chatUploadingImage}
              >
                {chatUploadingImage ? (
                  <ActivityIndicator size="small" color="#7C2D12" />
                ) : (
                  <Ionicons name="image-outline" size={18} color="#7C2D12" />
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.chatInput}
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder="Nhap tin nhan..."
                maxLength={2000}
              />

              <TouchableOpacity
                style={[styles.chatSendBtn, (chatSending || chatUploadingImage) && styles.chatSendBtnDisabled]}
                onPress={submitChatMessage}
                disabled={chatSending || chatUploadingImage}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {!!(chatPendingImage?.uri || chatPendingImage?.file) && (
              <View style={styles.chatPendingWrap}>
                {!!chatPendingImage?.uri && <Image source={{ uri: chatPendingImage.uri }} style={styles.chatPendingImage} resizeMode="cover" />}
                <TouchableOpacity style={styles.chatPendingRemoveBtn} onPress={() => setChatPendingImage(null)}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.chatPendingHint}>Da chon anh. Bam Gui de gui anh.</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.closeBtn} onPress={closeChatModal}>
                <Text style={styles.closeBtnText}>Dong</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DriverBottomNav navigation={navigation} activeKey="messages" />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#E65100' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  subTitle: { color: 'rgba(255,255,255,0.9)', marginTop: 4, fontSize: 12 },
  listContent: { padding: 12, paddingBottom: 110 },
  threadCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    position: 'relative',
  },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  threadTime: { fontSize: 11, color: '#6B7280' },
  threadPreview: { marginTop: 6, color: '#4B5563', fontSize: 12 },
  unreadDot: { position: 'absolute', right: 10, bottom: 10, width: 10, height: 10, borderRadius: 999, backgroundColor: '#EF4444' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 24 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 14 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, maxHeight: '78%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  modalSub: { marginTop: 4, marginBottom: 8, fontSize: 12, color: '#6B7280' },
  chatLoadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  chatLoadingText: { fontSize: 12, color: '#6B7280' },
  chatMessagesList: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, maxHeight: 320, backgroundColor: '#F9FAFB' },
  chatMessagesContent: { padding: 10, gap: 8 },
  chatEmptyText: { color: '#6B7280', fontSize: 12, textAlign: 'center', marginVertical: 10 },
  chatBubble: { maxWidth: '88%', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  chatBubbleMine: { alignSelf: 'flex-end', backgroundColor: '#E65100' },
  chatBubbleOther: { alignSelf: 'flex-start', backgroundColor: '#E5E7EB' },
  chatBubbleText: { color: '#111827', fontSize: 13 },
  chatBubbleTextMine: { color: '#FFFFFF' },
  chatBubbleTime: { fontSize: 10, color: '#4B5563', marginTop: 4, textAlign: 'right' },
  chatBubbleTimeMine: { color: '#FDE68A' },
  chatImage: { width: 180, height: 180, borderRadius: 8, marginBottom: 6, backgroundColor: '#F3F4F6' },
  chatComposerRow: { flexDirection: 'row', marginTop: 10, gap: 8, alignItems: 'center' },
  chatImageBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#FDBA74', alignItems: 'center', justifyContent: 'center' },
  chatImageBtnDisabled: { backgroundColor: '#E5E7EB' },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  chatSendBtn: { backgroundColor: '#E65100', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  chatSendBtnDisabled: { backgroundColor: '#D1D5DB' },
  chatPendingWrap: {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignSelf: 'flex-start',
  },
  chatPendingImage: { width: 110, height: 110, borderRadius: 8, backgroundColor: '#E5E7EB' },
  chatPendingRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(31,41,55,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatPendingHint: { marginTop: 6, fontSize: 11, color: '#6B7280' },
  modalActions: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E5E7EB' },
  closeBtnText: { color: '#111827', fontSize: 12, fontWeight: '700' },
});

export default DriverMessagesScreen;