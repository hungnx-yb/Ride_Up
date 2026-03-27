import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../config/config';
import DriverBottomNav from '../../components/DriverBottomNav';
import {
  getChatMessages,
  getDriverTripDetail,
  markChatThreadRead,
  openChatThread,
  sendChatMessage,
} from '../../services/api';

const statusText = {
  scheduled: 'Đã lên lịch',
  ongoing: 'Đang chạy',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const fmtMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

const fmtDateTime = (dateText, timeText) => {
  if (!dateText) return '--';
  if (!timeText) return dateText;
  return `${dateText} ${timeText}`;
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const normalizeDriverMessage = (msg) => {
  if (!msg) return msg;
  return {
    ...msg,
    mine: String(msg.senderRole || '').toUpperCase() === 'DRIVER',
  };
};

const DetailRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value || '--'}</Text>
  </View>
);

const SectionCard = ({ title, children }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const PointList = ({ title, points }) => (
  <SectionCard title={title}>
    {!points?.length ? (
      <Text style={styles.empty}>Chưa có dữ liệu</Text>
    ) : (
      points.map((point, index) => (
        <View key={point.id || `${title}-${index}`} style={styles.pointItem}>
          <Text style={styles.pointOrder}>#{(point.sortOrder ?? index) + 1}</Text>
          <View style={styles.pointInfo}>
            <Text style={styles.pointMain}>{point.address || point.wardName || 'Không rõ địa điểm'}</Text>
            <Text style={styles.pointSub}>{[point.wardName, point.provinceName].filter(Boolean).join(', ') || '--'}</Text>
            {!!point.time && <Text style={styles.pointSub}>Giờ dự kiến: {point.time}</Text>}
            {!!point.note && <Text style={styles.pointSub}>Ghi chú: {point.note}</Text>}
          </View>
        </View>
      ))
    )}
  </SectionCard>
);

const BookingCard = ({ booking, canChat, onOpenChat }) => (
  <View style={styles.bookingCard}>
    <Text style={styles.bookingHead}>Booking #{booking.id?.slice?.(0, 8) || '--'}</Text>
    <DetailRow label="Trạng thái" value={booking.status} />
    <DetailRow label="Số ghế" value={booking.seatCount != null ? String(booking.seatCount) : '--'} />
    <DetailRow label="Tổng tiền" value={fmtMoney(booking.totalPrice)} />

    <Text style={styles.subTitle}>Thông tin khách hàng</Text>
    <DetailRow label="Tên khách" value={booking.customerName || booking.passengerName} />
    <DetailRow label="SĐT" value={booking.contactPhone || booking.customerPhone} />
    <DetailRow label="Email" value={booking.customerEmail} />
    <View style={styles.chatActionRow}>
      <TouchableOpacity
        style={[styles.chatBtn, !canChat && styles.chatBtnDisabled]}
        disabled={!canChat}
        onPress={() => onOpenChat?.(booking)}
      >
        <Text style={styles.chatBtnText}>{canChat ? 'Chat với khách hàng' : 'Chỉ chat khi chuyến chưa hoàn thành'}</Text>
      </TouchableOpacity>
    </View>

    <Text style={styles.subTitle}>Hành trình booking</Text>
    <DetailRow label="Điểm đón" value={booking.pickupAddress} />
    <DetailRow label="Điểm trả" value={booking.dropoffAddress} />
    <DetailRow label="Khoảng cách" value={booking.distanceKm != null ? `${booking.distanceKm} km` : '--'} />
    <DetailRow label="Ghi chú khách" value={booking.customerNote} />

    <Text style={styles.subTitle}>Thanh toán</Text>
    <DetailRow label="PTTT" value={booking.paymentMethod} />
    <DetailRow label="Trạng thái TT" value={booking.paymentStatus} />
    <DetailRow label="Số tiền TT" value={booking.paymentAmount != null ? fmtMoney(booking.paymentAmount) : '--'} />
    <DetailRow label="Mã giao dịch" value={booking.transactionId} />

    <Text style={styles.subTitle}>Mốc thời gian</Text>
    <DetailRow label="Tạo lúc" value={booking.createdAt} />
    <DetailRow label="Xác nhận" value={booking.confirmedAt} />
    <DetailRow label="Hủy lúc" value={booking.cancelledAt} />
    <DetailRow label="Lý do hủy" value={booking.cancellationReason} />
    <DetailRow label="Hoàn thành" value={booking.completedAt} />
  </View>
);

const TripDetailScreen = ({ navigation, route }) => {
  const tripId = route?.params?.tripId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatThread, setChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBooking, setChatBooking] = useState(null);
  const realtimeRef = useRef(null);
  const chatScrollRef = useRef(null);

  const appendUniqueMessage = useCallback((incoming) => {
    if (!incoming?.id) return;
    setChatMessages((prev) => {
      const normalizedIncoming = normalizeDriverMessage(incoming);
      const existed = prev.some((item) => item?.id === normalizedIncoming.id);
      if (existed) {
        return prev;
      }
      return [...prev, normalizedIncoming];
    });
  }, []);

  const stopRealtime = useCallback(() => {
    realtimeRef.current?.disconnect?.();
    realtimeRef.current = null;
  }, []);

  const startRealtime = useCallback((threadId) => {
    if (!threadId) return;
    stopRealtime();
    realtimeRef.current = createChatRealtimeClient({
      threadId,
      onMessage: (incoming) => {
        appendUniqueMessage(incoming);
      },
    });
  }, [appendUniqueMessage, stopRealtime]);

  const refreshChatMessages = useCallback(async (threadId, options = {}) => {
    if (!threadId) return;
    const shouldMarkRead = options.markRead !== false;
    try {
      const latestMessages = await getChatMessages(threadId, 100);
      const normalized = Array.isArray(latestMessages)
        ? latestMessages.map(normalizeDriverMessage)
        : [];
      setChatMessages(normalized);
      if (shouldMarkRead) {
        await markChatThreadRead(threadId);
      }
    } catch (_) {
      // Ignore transient polling errors to keep chat modal stable.
    }
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!tripId) {
      setLoading(false);
      Alert.alert('Lỗi', 'Không tìm thấy mã chuyến xe');
      return;
    }

    try {
      if (isRefresh) setRefreshing(true);
      const detail = await getDriverTripDetail(tripId);
      setData(detail);
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không tải được chi tiết chuyến xe');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const status = useMemo(() => statusText[data?.status] || data?.status || '--', [data?.status]);
  const canChatThisTrip = useMemo(() => {
    const tripStatus = String(data?.status || '').toLowerCase();
    return tripStatus !== 'completed' && tripStatus !== 'cancelled';
  }, [data?.status]);

  const closeChatModal = useCallback(() => {
    stopRealtime();
    setChatVisible(false);
    setChatDraft('');
    setChatMessages([]);
    setChatThread(null);
    setChatBooking(null);
  }, [stopRealtime]);

  const openChatForBooking = useCallback(async (booking) => {
    if (!canChatThisTrip) {
      Alert.alert('Thông báo', 'Chỉ chat khi chuyến chưa hoàn thành.');
      return;
    }
    if (!booking?.id) {
      Alert.alert('Lỗi', 'Không tìm thấy mã booking để chat.');
      return;
    }
    try {
      setChatVisible(true);
      setChatLoading(true);
      setChatBooking(booking);
      const thread = await openChatThread(booking.id);
      setChatThread(thread);
      await refreshChatMessages(thread.id);
      startRealtime(thread.id);
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không mở được cuộc trò chuyện');
    } finally {
      setChatLoading(false);
    }
  }, [canChatThisTrip, refreshChatMessages, startRealtime]);

  const submitChatMessage = useCallback(async () => {
    if (!chatThread?.id || !chatDraft.trim()) return;
    try {
      setChatSending(true);
      const sent = await sendChatMessage(chatThread.id, chatDraft.trim());
      appendUniqueMessage(sent);
      setChatDraft('');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Gửi tin nhắn thất bại');
    } finally {
      setChatSending(false);
    }
  }, [chatThread?.id, chatDraft, appendUniqueMessage]);

  useEffect(() => {
    return () => {
      stopRealtime();
    };
  }, [stopRealtime]);

  useEffect(() => {
    if (!chatVisible || !chatThread?.id) return undefined;

    const syncId = setInterval(() => {
      refreshChatMessages(chatThread.id, { markRead: false });
    }, 1500);

    return () => clearInterval(syncId);
  }, [chatVisible, chatThread?.id, refreshChatMessages]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E65100" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={styles.content}
      >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Chi tiết chuyến đi</Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Trạng thái</Text>
          <Text style={styles.statValue}>{status}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Ghế đã đặt</Text>
          <Text style={styles.statValue}>{data?.bookedSeats ?? 0}/{data?.totalSeats ?? 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Doanh thu</Text>
          <Text style={styles.statValue}>{fmtMoney(data?.estimatedRevenue)}</Text>
        </View>
      </View>

      <SectionCard title="Thông tin chuyến xe">
        <DetailRow label="Mã chuyến" value={data?.id} />
        <DetailRow label="Tuyến" value={`${data?.pickupProvince || '--'} → ${data?.dropoffProvince || '--'}`} />
        <DetailRow label="Khởi hành" value={fmtDateTime(data?.departureDate, data?.departureTime)} />
        <DetailRow label="Tổng ghế" value={data?.totalSeats != null ? String(data.totalSeats) : '--'} />
        <DetailRow label="Còn trống" value={data?.availableSeats != null ? String(data.availableSeats) : '--'} />
        <DetailRow label="Giá/ ghế" value={fmtMoney(data?.fixedFare)} />
        <DetailRow label="Ghi chú tài xế" value={data?.driverNote} />
        <DetailRow label="Tạo lúc" value={data?.createdAt} />
        <DetailRow label="Cập nhật" value={data?.updatedAt} />
        <DetailRow label="Khởi hành thực tế" value={data?.actualDepartureTime} />
        <DetailRow label="Đến nơi thực tế" value={data?.actualArrivalTime} />
        <DetailRow label="Hoàn thành" value={data?.completedAt} />
      </SectionCard>

      <PointList title="Danh sách điểm đón" points={data?.pickupPoints} />
      <PointList title="Danh sách điểm trả" points={data?.dropoffPoints} />

      <SectionCard title={`Booking (${data?.bookings?.length || 0})`}>
        {!data?.bookings?.length ? (
          <Text style={styles.empty}>Chưa có booking nào cho chuyến này</Text>
        ) : (
          <FlatList
            data={data.bookings}
            keyExtractor={(item, index) => item?.id || `booking-${index}`}
            renderItem={({ item }) => (
              <BookingCard booking={item} canChat={canChatThisTrip} onOpenChat={openChatForBooking} />
            )}
            scrollEnabled={false}
          />
        )}
      </SectionCard>

        <View style={{ height: 110 }} />
      </ScrollView>

      <Modal visible={chatVisible} transparent animationType="fade" onRequestClose={closeChatModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chat với khách hàng</Text>
            <Text style={styles.modalSub}>Booking: {chatBooking?.id || '--'}</Text>
            <Text style={styles.modalSyncHint}>Realtime push đang bật</Text>

            {chatLoading ? (
              <View style={styles.chatLoadingWrap}>
                <ActivityIndicator size="small" color="#E65100" />
                <Text style={styles.chatLoadingText}>Đang tải tin nhắn...</Text>
              </View>
            ) : (
              <ScrollView
                ref={chatScrollRef}
                style={styles.chatMessagesList}
                contentContainerStyle={styles.chatMessagesContent}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {chatMessages.length === 0 && (
                  <Text style={styles.chatEmptyText}>Chưa có tin nhắn. Bạn có thể bắt đầu cuộc trò chuyện.</Text>
                )}
                {chatMessages.map((msg, idx) => (
                  <View
                    key={msg.id || `msg-${idx}`}
                    style={[styles.chatBubble, msg.mine ? styles.chatBubbleMine : styles.chatBubbleOther]}
                  >
                    <Text style={[styles.chatBubbleText, msg.mine && styles.chatBubbleTextMine]}>{msg.content}</Text>
                    <Text style={[styles.chatBubbleTime, msg.mine && styles.chatBubbleTimeMine]}>{formatTime(msg.sentAt)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.chatComposerRow}>
              <TextInput
                style={styles.chatInput}
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder="Nhập tin nhắn..."
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.chatSendBtn, (chatSending || !chatDraft.trim()) && styles.chatSendBtnDisabled]}
                onPress={submitChatMessage}
                disabled={chatSending || !chatDraft.trim()}
              >
                <Text style={styles.chatSendBtnText}>Gửi</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.closeBtn} onPress={closeChatModal}>
                <Text style={styles.closeBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DriverBottomNav navigation={navigation} activeKey="trips" />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FA' },
  container: { flex: 1, backgroundColor: '#F6F8FA' },
  content: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#E65100',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  backText: { color: '#fff', fontSize: 24, lineHeight: 28 },
  title: { fontSize: 18, color: '#fff', fontWeight: '800' },
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginTop: 10,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3E8E0',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  statValue: { marginTop: 3, fontSize: 13, color: '#C2410C', fontWeight: '800', textAlign: 'center' },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 10,
    marginTop: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#374151', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  label: { width: 126, fontSize: 12, color: '#6B7280', fontWeight: '700' },
  value: { flex: 1, fontSize: 13, color: '#111827' },
  empty: { color: '#6B7280', fontSize: 13 },
  pointItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  pointOrder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#92400E',
    backgroundColor: '#FDE68A',
    marginRight: 8,
    fontWeight: '800',
  },
  pointInfo: { flex: 1 },
  pointMain: { fontSize: 13, color: '#111827', fontWeight: '700' },
  pointSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  bookingCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FCFCFC',
    marginBottom: 10,
  },
  bookingHead: { color: '#1F2937', fontWeight: '800', fontSize: 13, marginBottom: 7 },
  subTitle: { marginTop: 8, marginBottom: 4, color: '#B45309', fontWeight: '800', fontSize: 12 },
  chatActionRow: {
    marginBottom: 8,
  },
  chatBtn: {
    backgroundColor: '#E65100',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  chatBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  chatBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    maxHeight: '78%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  modalSub: {
    marginTop: 4,
    marginBottom: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  modalSyncHint: {
    marginBottom: 10,
    fontSize: 11,
    color: '#9CA3AF',
  },
  chatLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  chatLoadingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  chatMessagesList: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    maxHeight: 320,
    backgroundColor: '#F9FAFB',
  },
  chatMessagesContent: {
    padding: 10,
    gap: 8,
  },
  chatEmptyText: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 10,
  },
  chatBubble: {
    maxWidth: '88%',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#E65100',
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
  },
  chatBubbleText: {
    color: '#111827',
    fontSize: 13,
  },
  chatBubbleTextMine: {
    color: '#FFFFFF',
  },
  chatBubbleTime: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 4,
    textAlign: 'right',
  },
  chatBubbleTimeMine: {
    color: '#FDE68A',
  },
  chatComposerRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
    alignItems: 'center',
  },
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
  chatSendBtn: {
    backgroundColor: '#E65100',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  chatSendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  modalActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  closeBtnText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default TripDetailScreen;
