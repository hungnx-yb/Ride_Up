import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { COLORS } from '../../config/config';
import { getCustomerBookings, searchRides } from '../../services/api';

const STATUS_CONFIG = {
  pending: { label: 'Chờ xác nhận', color: '#E65100', bg: '#FFF3E0' },
  confirmed: { label: 'Đã xác nhận', color: '#1565C0', bg: '#E3F2FD' },
  in_progress: { label: 'Đang diễn ra', color: '#0277BD', bg: '#E1F5FE' },
  completed: { label: 'Hoàn thành', color: '#2E7D32', bg: '#E8F5E9' },
  cancelled: { label: 'Đã hủy', color: '#B71C1C', bg: '#FFEBEE' },
};

const QUICK_ACTIONS = [
  { icon: '🔍', label: 'Tìm\nchuyến xe', color: '#E3F2FD', screen: 'SearchRides' },
  { icon: '📋', label: 'Đặt xe\ncủa tôi', color: '#E8F5E9', screen: 'MyBookings' },
  { icon: '💬', label: 'Tin nhắn\nvới tài xế', color: '#FFF3E0', screen: 'Messages' },
  { icon: '⭐', label: 'Đánh giá\ncủa tôi', color: '#F3E5F5', screen: 'MyReviews' },
];

const CustomerHomeScreen = ({ user, onLogout }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');

  const loadData = async () => {
    try {
      const data = await getCustomerBookings();
      setBookings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const formatTime = (isoStr) => {
    const d = new Date(isoStr);
    return `${d.toLocaleDateString('vi-VN')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };
  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + '₫';

  const activeBookings = bookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status));
  const completedBookings = bookings.filter((b) => b.status === 'completed');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.customerColor} />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Xin chào 👋</Text>
          <Text style={styles.userName}>{user?.fullName || 'Khách hàng'}</Text>
          <Text style={styles.subtitle}>Bạn muốn đi đâu hôm nay?</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* Search Box */}
      <View style={styles.searchCard}>
        <Text style={styles.searchTitle}>🔍 Tìm chuyến xe</Text>
        <View style={styles.searchInputRow}>
          <Text style={styles.searchDot}>📍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Điểm đón (VD: Thanh Xuân, Hà Nội)"
            value={searchFrom}
            onChangeText={setSearchFrom}
          />
        </View>
        <View style={styles.searchDivider} />
        <View style={styles.searchInputRow}>
          <Text style={styles.searchDot}>🏁</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Điểm đến (VD: Ân Thi, Hưng Yên)"
            value={searchTo}
            onChangeText={setSearchTo}
          />
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => console.log('Tìm kiếm:', searchFrom, '→', searchTo)}
        >
          <Text style={styles.searchBtnText}>Tìm chuyến xe</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Chức năng</Text>
        <View style={styles.actionsRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.screen}
              style={[styles.actionBtn, { backgroundColor: a.color }]}
              onPress={() => console.log('Đến:', a.screen)}
            >
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Chuyến xe đang diễn ra / sắp tới */}
      {activeBookings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚗 Chuyến xe của tôi</Text>
          {activeBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              formatTime={formatTime}
              formatCurrency={formatCurrency}
              onChat={() => console.log('Chat với tài xế, bookingId:', booking.id)}
              onTrack={() => console.log('Theo dõi chuyến:', booking.id)}
            />
          ))}
        </View>
      )}

      {/* Lịch sử */}
      {completedBookings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📜 Lịch sử đặt xe</Text>
          {completedBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              formatTime={formatTime}
              formatCurrency={formatCurrency}
              onRate={() => !booking.hasRated && console.log('Đánh giá bookingId:', booking.id)}
            />
          ))}
        </View>
      )}

      {/* Empty state */}
      {bookings.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🚌</Text>
          <Text style={styles.emptyTitle}>Chưa có chuyến xe nào</Text>
          <Text style={styles.emptyText}>Hãy tìm và đặt chuyến xe ngay!</Text>
          <TouchableOpacity
            style={styles.searchNowBtn}
            onPress={() => console.log('Đến SearchRides')}
          >
            <Text style={styles.searchNowText}>Tìm chuyến xe ngay</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
};

const BookingCard = ({ booking, formatTime, formatCurrency, onChat, onTrack, onRate }) => {
  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const isActive = ['pending', 'confirmed', 'in_progress'].includes(booking.status);
  return (
    <TouchableOpacity style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.bookingPrice}>{formatCurrency(booking.price)}</Text>
      </View>

      <Text style={styles.bookingRoute}>📍 {booking.from}</Text>
      <Text style={styles.bookingRoute}>🏁 {booking.to}</Text>
      <Text style={styles.bookingPickup}>
        🚏 Đón: {booking.pickupPoint} → Trả: {booking.dropPoint}
      </Text>
      <Text style={styles.bookingTime}>🕒 {formatTime(booking.departureTime)}</Text>

      <View style={styles.driverRow}>
        <Text style={styles.driverName}>🚗 {booking.driverName}</Text>
        <Text style={styles.driverRating}>⭐ {booking.driverRating}</Text>
      </View>

      {/* Action buttons */}
      {isActive && (
        <View style={styles.bookingActions}>
          <TouchableOpacity style={styles.actionSmallBtn} onPress={onChat}>
            <Text style={styles.actionSmallText}>💬 Chat tài xế</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionSmallBtn, styles.trackBtn]} onPress={onTrack}>
            <Text style={styles.actionSmallText}>📍 Theo dõi</Text>
          </TouchableOpacity>
        </View>
      )}
      {booking.status === 'completed' && !booking.hasRated && (
        <TouchableOpacity style={styles.rateBtn} onPress={onRate}>
          <Text style={styles.rateBtnText}>⭐ Đánh giá chuyến xe</Text>
        </TouchableOpacity>
      )}
      {booking.status === 'completed' && booking.hasRated && (
        <View style={styles.ratedRow}>
          <Text style={styles.ratedText}>Đã đánh giá: {'⭐'.repeat(booking.myRating || 5)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textLight },

  // Header
  header: {
    backgroundColor: COLORS.customerColor,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 32,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  userName: { color: COLORS.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 4,
  },
  logoutText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // Search card
  searchCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    marginHorizontal: 16, marginTop: -16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  searchTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  searchInputRow: { flexDirection: 'row', alignItems: 'center' },
  searchDot: { fontSize: 16, marginRight: 10 },
  searchInput: {
    flex: 1, fontSize: 14, color: COLORS.text,
    paddingVertical: 6,
  },
  searchDivider: {
    height: 1, backgroundColor: COLORS.border, marginVertical: 4, marginLeft: 28,
  },
  searchBtn: {
    backgroundColor: COLORS.customerColor, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 14,
  },
  searchBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  // Quick Actions
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.text, marginTop: 6, textAlign: 'center', lineHeight: 16 },

  // Booking card
  bookingCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  bookingPrice: { fontSize: 15, fontWeight: '800', color: COLORS.accent },
  bookingRoute: { fontSize: 13, color: COLORS.text, marginBottom: 3, lineHeight: 20 },
  bookingPickup: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  bookingTime: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  driverRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  driverName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  driverRating: { fontSize: 13, color: COLORS.warning },

  // Actions
  bookingActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionSmallBtn: {
    flex: 1, backgroundColor: '#E3F2FD', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  trackBtn: { backgroundColor: '#E8F5E9' },
  actionSmallText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  rateBtn: {
    marginTop: 10, backgroundColor: '#FFF8E1', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#FFE082',
  },
  rateBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.warning },
  ratedRow: { marginTop: 8, alignItems: 'center' },
  ratedText: { fontSize: 12, color: COLORS.textMuted },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 20 },
  searchNowBtn: { backgroundColor: COLORS.customerColor, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  searchNowText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  bottomPad: { height: 32 },
});

export default CustomerHomeScreen;
