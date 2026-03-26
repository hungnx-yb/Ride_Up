import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../config/config';
import DriverBottomNav from '../../components/DriverBottomNav';
import { getDriverTripDetail } from '../../services/api';

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

const BookingCard = ({ booking }) => (
  <View style={styles.bookingCard}>
    <Text style={styles.bookingHead}>Booking #{booking.id?.slice?.(0, 8) || '--'}</Text>
    <DetailRow label="Trạng thái" value={booking.status} />
    <DetailRow label="Số ghế" value={booking.seatCount != null ? String(booking.seatCount) : '--'} />
    <DetailRow label="Tổng tiền" value={fmtMoney(booking.totalPrice)} />

    <Text style={styles.subTitle}>Thông tin khách hàng</Text>
    <DetailRow label="Tên khách" value={booking.customerName || booking.passengerName} />
    <DetailRow label="SĐT" value={booking.contactPhone || booking.customerPhone} />
    <DetailRow label="Email" value={booking.customerEmail} />

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
            renderItem={({ item }) => <BookingCard booking={item} />}
            scrollEnabled={false}
          />
        )}
      </SectionCard>

        <View style={{ height: 110 }} />
      </ScrollView>
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
});

export default TripDetailScreen;
