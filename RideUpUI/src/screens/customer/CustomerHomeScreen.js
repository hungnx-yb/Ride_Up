import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Image,
  ImageBackground,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../config/config';
import { getCustomerBookings, searchRidesAdvanced, bookRide, confirmBookingPayment, rateRide, supportChat } from '../../services/api';
import ProvincePicker from '../../components/ProvincePicker';
import WardPicker from '../../components/WardPicker';

const DEFAULT_DRIVER_IMAGE = require('../../../assets/icon.png');
const DEFAULT_VEHICLE_IMAGE = require('../../../assets/adaptive-icon.png');
const HERO_BACKGROUND_IMAGE = require('../../../assets/anh-nen-sieu-xe_020255797.jpg');

const STATUS_CONFIG = {
  pending: { label: 'Chờ thanh toán', color: '#B45309', bg: '#FFFBEB' },
  confirmed: { label: 'Đặt chỗ thành công', color: '#1D4ED8', bg: '#EFF6FF' },
  in_progress: { label: 'Đang di chuyển', color: '#0E7490', bg: '#ECFEFF' },
  completed: { label: 'Hoàn thành', color: '#15803D', bg: '#F0FDF4' },
  cancelled: { label: 'Đã hủy', color: '#B91C1C', bg: '#FEF2F2' },
};

const MY_TRIPS_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'booked', label: 'Đã đặt' },
  { key: 'in_progress', label: 'Đang đi' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const CustomerHomeScreen = ({ user, onLogout }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isSmallPhone = screenWidth <= 360;
  const isLargePhone = screenWidth >= 430;
  const isShortPhone = screenHeight <= 700;

  const horizontalGutter = isSmallPhone ? 12 : 16;
  const heroHorizontal = isSmallPhone ? 14 : isLargePhone ? 22 : 20;
  const heroTopPadding = isSmallPhone ? 46 : isLargePhone ? 58 : 54;
  const heroBottomPadding = isSmallPhone ? 22 : 30;
  const heroTitleSize = isSmallPhone ? 26 : isLargePhone ? 34 : 30;
  const subtitleMaxWidth = Math.max(240, screenWidth - heroHorizontal * 2 - 24);
  const sectionTopGap = isSmallPhone ? 14 : 18;
  const footerPadBottom = isShortPhone ? 10 : 12;
  const footerSpacer = (isSmallPhone ? 100 : isLargePhone ? 120 : 112) + (isShortPhone ? 0 : 4);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchDate, setSearchDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const [fromProvince, setFromProvince] = useState(null);
  const [toProvince, setToProvince] = useState(null);
  const [fromWard, setFromWard] = useState(null);
  const [toWard, setToWard] = useState(null);

  const [showFromProvincePicker, setShowFromProvincePicker] = useState(false);
  const [showToProvincePicker, setShowToProvincePicker] = useState(false);
  const [showFromWardPicker, setShowFromWardPicker] = useState(false);
  const [showToWardPicker, setShowToWardPicker] = useState(false);

  const [tripDetail, setTripDetail] = useState(null);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState(null);
  const [selectedDropoffPointId, setSelectedDropoffPointId] = useState(null);
  const [seatCount, setSeatCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [driverImageFailed, setDriverImageFailed] = useState(false);
  const [vehicleImageFailed, setVehicleImageFailed] = useState(false);
  const [activeFooterTab, setActiveFooterTab] = useState('home');
  const [myTripsFilter, setMyTripsFilter] = useState('all');
  const [ratingBooking, setRatingBooking] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [paymentConfirmSubmitting, setPaymentConfirmSubmitting] = useState(false);
  const [showSupportCenter, setShowSupportCenter] = useState(false);
  const [messageView, setMessageView] = useState('drivers');
  const [supportInput, setSupportInput] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportMessages, setSupportMessages] = useState([
    {
      id: `bot-${Date.now()}`,
      role: 'bot',
      text: 'Xin chào, mình là Trợ lý RideUp. Bạn có thể hỏi FAQ hoặc gõ "kiểm tra booking gần nhất".',
    },
  ]);

  const [errorText, setErrorText] = useState('');
  const scrollRef = useRef(null);

  const loadData = async () => {
    try {
      const data = await getCustomerBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      setErrorText(e.message || 'Không thể tải lịch sử đặt chỗ.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    runSearch();
  }, []);

  const formatTime = (isoStr) => {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    return `${d.toLocaleDateString('vi-VN')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount) => {
    const num = Number(amount || 0);
    return `${new Intl.NumberFormat('vi-VN').format(num)} đ`;
  };

  const customerFullName = (user?.fullName || '').trim() || 'Khách hàng';

  const formatDuration = (minutes) => {
    const total = Number(minutes || 0);
    if (!total) return '--';
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h <= 0) return `${m} phút`;
    if (m <= 0) return `${h} giờ`;
    return `${h} giờ ${m} phút`;
  };

  const getVehicleTypeLabel = (vehicleType) => {
    const type = String(vehicleType || '').trim().toUpperCase();
    const labels = {
      CAR_4_SEAT: 'Xe 4 chỗ',
      CAR_7_SEAT: 'Xe 7 chỗ',
      CAR_16_SEAT: 'Xe 16 chỗ',
      MOTORBIKE: 'Xe máy',
      BUS: 'Xe buýt',
      OTHER: 'Khác',
    };
    return labels[type] || (type ? type.replaceAll('_', ' ') : '--');
  };

  const activeBookings = bookings.filter((b) => ['confirmed', 'in_progress'].includes(b.status));
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const bookingMatchesFilter = (booking, filterKey) => {
    switch (filterKey) {
      case 'booked':
        return booking.status === 'pending' || booking.status === 'confirmed';
      case 'in_progress':
        return booking.status === 'in_progress';
      case 'completed':
        return booking.status === 'completed';
      case 'cancelled':
        return booking.status === 'cancelled';
      case 'all':
      default:
        return true;
    }
  };
  const filteredMyTrips = bookings.filter((b) => bookingMatchesFilter(b, myTripsFilter));
  const totalSpent = bookings.reduce((sum, b) => sum + Number(b.price || 0), 0);
  const profileCompletion = Math.min(100, (user?.email ? 35 : 0) + (bookings.length > 0 ? 35 : 0) + (completedBookings.length > 0 ? 30 : 0));
  const membershipLevel = totalSpent >= 2000000 ? 'RideUp Gold' : totalSpent >= 700000 ? 'RideUp Silver' : 'RideUp Basic';
  const inboxItems = activeBookings.slice(0, 6).map((b, idx) => ({
    id: b.id,
    driverName: b.driverName || 'Tài xế RideUp',
    route: `${b.from} - ${b.to}`,
    preview: idx % 2 === 0 ? 'Tôi sẽ đến điểm đón sau 10 phút.' : 'Bạn vui lòng xác nhận lại điểm đón giúp tôi.',
    time: formatTime(b.departureTime),
    unread: idx < 2,
  }));
  const avgRating = searchResults.length
    ? (searchResults.reduce((sum, t) => sum + Number(t.driverRating || 0), 0) / searchResults.length).toFixed(1)
    : '0.0';

  const runSearch = async () => {
    setErrorText('');

    try {
      setSearching(true);
      const result = await searchRidesAdvanced({
        fromProvinceId: fromProvince?.id,
        toProvinceId: toProvince?.id,
        fromWardId: fromWard?.id,
        toWardId: toWard?.id,
        departureDate: searchDate,
      });
      setSearchResults(Array.isArray(result) ? result : []);
    } catch (e) {
      setErrorText(e.message || 'Không tìm thấy chuyến phù hợp.');
    } finally {
      setSearching(false);
    }
  };

  const openTripDetail = (trip) => {
    const firstPickup = trip.pickupPoints?.[0]?.id || null;
    const firstDropoff = trip.dropoffPoints?.[0]?.id || null;
    setSelectedPickupPointId(firstPickup);
    setSelectedDropoffPointId(firstDropoff);
    setSeatCount(1);
    setPaymentMethod('CASH');
    setDriverImageFailed(false);
    setVehicleImageFailed(false);
    setTripDetail(trip);
  };

  const openBookingDetail = (booking) => {
    setBookingDetail(booking);
  };

  const openRatingModal = (booking) => {
    if (!booking) return;
    setBookingDetail(null);
    setRatingBooking(booking);
    setRatingValue(booking?.myRating || 5);
    setRatingComment('');
  };

  const submitBookingRating = async () => {
    if (!ratingBooking?.id) return;

    try {
      setRatingSubmitting(true);
      await rateRide(ratingBooking.id, ratingValue, ratingComment);
      setRatingBooking(null);
      setRatingComment('');
      await loadData();
      setErrorText('');
    } catch (e) {
      setErrorText(e.message || 'Gửi đánh giá thất bại.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const submitTripDetailBooking = async () => {
    if (!tripDetail || !selectedPickupPointId || !selectedDropoffPointId) {
      setErrorText('Vui lòng chọn điểm đón và điểm trả.');
      return;
    }

    try {
      setBookingSubmitting(true);
      await bookRide({
        tripId: tripDetail.id,
        pickupPointId: selectedPickupPointId,
        dropoffPointId: selectedDropoffPointId,
        seatCount,
        paymentMethod,
      });

      setTripDetail(null);
      setSelectedPickupPointId(null);
      setSelectedDropoffPointId(null);
      setSeatCount(1);
      await loadData();
      await runSearch();
      if (paymentMethod === 'BANK_TRANSFER') {
        setErrorText('Đã tạo đặt chỗ. Vui lòng xác nhận chuyển khoản để hoàn tất.');
      }
    } catch (e) {
      setErrorText(e.message || 'Đặt chỗ thất bại.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const isAwaitingBankTransfer = (booking) => {
    if (!booking) return false;
    return booking.status === 'pending'
      && String(booking.paymentMethod || '').toUpperCase() === 'BANK_TRANSFER'
      && String(booking.paymentStatus || '').toUpperCase() === 'UNPAID';
  };

  const submitConfirmTransfer = async () => {
    if (!bookingDetail?.id) return;

    try {
      setPaymentConfirmSubmitting(true);
      await confirmBookingPayment(bookingDetail.id);
      setBookingDetail(null);
      await loadData();
      setErrorText('Xác nhận chuyển khoản thành công. Đặt chỗ đã được ghi nhận.');
    } catch (e) {
      setErrorText(e.message || 'Xác nhận chuyển khoản thất bại.');
    } finally {
      setPaymentConfirmSubmitting(false);
    }
  };

  const submitSupportMessage = async (overrideMessage) => {
    const message = String(overrideMessage ?? supportInput ?? '').trim();
    if (!message || supportSending) return;

    const userMessage = { id: `user-${Date.now()}`, role: 'user', text: message };
    setSupportMessages((prev) => [...prev, userMessage]);
    if (overrideMessage === undefined) {
      setSupportInput('');
    }

    try {
      setSupportSending(true);
      const result = await supportChat(message);
      const replyText = result?.reply || 'Mình chưa có phản hồi phù hợp, bạn thử hỏi lại giúp mình.';
      const suggestions = Array.isArray(result?.suggestions) ? result.suggestions.filter(Boolean) : [];
      const fullText = suggestions.length > 0
        ? `${replyText}\n\nGợi ý: ${suggestions.join(' | ')}`
        : replyText;

      setSupportMessages((prev) => [...prev, { id: `bot-${Date.now()}`, role: 'bot', text: fullText }]);
    } catch (e) {
      setSupportMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, role: 'bot', text: e.message || 'Không thể kết nối trợ lý lúc này.' },
      ]);
    } finally {
      setSupportSending(false);
    }
  };

  const onSelectFromProvince = (province) => {
    setFromProvince(province);
    setFromWard(null);
  };

  const onSelectToProvince = (province) => {
    setToProvince(province);
    setToWard(null);
  };

  const goHome = () => {
    setActiveFooterTab('home');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const goMyTrips = () => {
    setActiveFooterTab('myTrips');
    setMyTripsFilter('all');
  };

  const openAccount = () => {
    setActiveFooterTab('account');
  };

  const openMessages = () => {
    setActiveFooterTab('messages');
    setMessageView('drivers');
  };

  const openSupportCenter = () => {
    setShowSupportCenter(true);
  };

  const openSupportChat = () => {
    setShowSupportCenter(false);
    setActiveFooterTab('messages');
    setMessageView('assistant');
  };

  const callSupportHotline = async () => {
    const hotlineUrl = 'tel:19001234';
    try {
      const canCall = await Linking.canOpenURL(hotlineUrl);
      if (canCall) {
        await Linking.openURL(hotlineUrl);
      }
    } catch (e) {
      setErrorText('Không thể mở ứng dụng gọi điện trên thiết bị này.');
    }
  };

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const toIsoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.customerColor} />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <>
      {activeFooterTab === 'home' && (
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <ImageBackground
          source={HERO_BACKGROUND_IMAGE}
          style={styles.heroBackground}
          imageStyle={styles.heroBackgroundImage}
        >
          <View
            style={[
              styles.heroOverlay,
              {
                paddingTop: heroTopPadding,
                paddingHorizontal: heroHorizontal,
                paddingBottom: heroBottomPadding,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.brand}>RideUp</Text>
                <Text style={[styles.userName, { fontSize: isSmallPhone ? 20 : 24 }]} numberOfLines={1}>
                  Xin chào, {customerFullName}
                </Text>
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
                <Ionicons name="log-out-outline" size={17} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.whereTo, { fontSize: heroTitleSize }]}>Bạn muốn đi đâu?</Text>
            <Text style={[styles.subtitle, { maxWidth: subtitleMaxWidth }]}>Đặt nhanh, giá rõ ràng, tài xế đã xác minh.</Text>

            <View style={[styles.statsRow, { gap: isSmallPhone ? 8 : 10 }] }>
              <View style={[styles.statCard, { paddingVertical: isSmallPhone ? 9 : 11 }] }>
                <Ionicons name="car-sport-outline" size={18} color="#00B14F" />
                <Text style={[styles.statValue, { fontSize: isSmallPhone ? 16 : 18 }]}>{searchResults.length}</Text>
                <Text style={styles.statLabel}>Chuyến đang mở</Text>
              </View>
              <View style={[styles.statCard, { paddingVertical: isSmallPhone ? 9 : 11 }] }>
                <Ionicons name="receipt-outline" size={18} color="#00B14F" />
                <Text style={[styles.statValue, { fontSize: isSmallPhone ? 16 : 18 }]}>{bookings.length}</Text>
                <Text style={styles.statLabel}>Lượt đã đặt</Text>
              </View>
              <View style={[styles.statCard, { paddingVertical: isSmallPhone ? 9 : 11 }] }>
                <Ionicons name="star-outline" size={18} color="#00B14F" />
                <Text style={[styles.statValue, { fontSize: isSmallPhone ? 16 : 18 }]}>{avgRating}</Text>
                <Text style={styles.statLabel}>Đánh giá TB</Text>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={[styles.searchWrap, { marginHorizontal: horizontalGutter, marginTop: isSmallPhone ? -10 : -14 }]}>
          <View style={[styles.searchCard, { padding: isSmallPhone ? 11 : 12 }]}>
            <View style={styles.searchHeadRow}>
              <Text style={[styles.searchTitle, { fontSize: isSmallPhone ? 16 : 18 }]}>Tìm chuyến ghép</Text>
              <Text style={styles.searchHintInline}>Chọn điểm đón/trả chi tiết</Text>
            </View>

            <TouchableOpacity style={styles.routeField} onPress={() => setShowFromProvincePicker(true)}>
              <View style={styles.routeDotFrom} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeFieldLabel}>Điểm đón</Text>
                <Text style={styles.routeFieldText}>{fromWard?.name || fromProvince?.name || 'Chọn khu vực đón'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.routeField} onPress={() => setShowToProvincePicker(true)}>
              <View style={styles.routeDotTo} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeFieldLabel}>Điểm đến</Text>
                <Text style={styles.routeFieldText}>{toWard?.name || toProvince?.name || 'Chọn khu vực đến'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.routeField}
              onPress={() => {
                if (fromProvince?.id) {
                  setShowFromWardPicker(true);
                } else {
                  setShowFromProvincePicker(true);
                }
              }}
            >
              <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color="#334155" />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeFieldLabel}>Phường/xã đón</Text>
                <Text style={styles.routeFieldText}>{fromWard?.name || 'Chọn phường/xã đón'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.routeField}
              onPress={() => {
                if (toProvince?.id) {
                  setShowToWardPicker(true);
                } else {
                  setShowToProvincePicker(true);
                }
              }}
            >
              <MaterialCommunityIcons name="map-marker-check-outline" size={16} color="#334155" />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeFieldLabel}>Phường/xã đến</Text>
                <Text style={styles.routeFieldText}>{toWard?.name || 'Chọn phường/xã đến'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.dateInputWrap}>
              <Ionicons name="calendar-outline" size={16} color="#64748B" />
              <TextInput
                style={styles.dateInput}
                value={searchDate}
                onChangeText={setSearchDate}
                placeholder="Ngày khởi hành (YYYY-MM-DD), để trống nếu không lọc"
              />
            </View>

            <View style={styles.quickDateRow}>
              <TouchableOpacity style={styles.quickDateBtn} onPress={() => setSearchDate('')}>
                <Text style={styles.quickDateText}>Tất cả ngày</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickDateBtn} onPress={() => setSearchDate(toIsoDate(today))}>
                <Text style={styles.quickDateText}>Hôm nay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickDateBtn} onPress={() => setSearchDate(toIsoDate(tomorrow))}>
                <Text style={styles.quickDateText}>Ngày mai</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.searchBtn} onPress={runSearch} disabled={searching}>
              <Ionicons name="search" size={16} color="#fff" />
              <Text style={styles.searchBtnText}>{searching ? 'Đang tìm...' : 'Tìm chuyến ngay'}</Text>
            </TouchableOpacity>

            {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}
          </View>
        </View>

        <View style={[styles.section, { paddingHorizontal: horizontalGutter, marginTop: sectionTopGap }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWithIcon}>
              <Ionicons name="car-sport" size={18} color="#00B14F" />
              <Text style={styles.sectionTitle}>Chuyến xe đang mở</Text>
            </View>
            <TouchableOpacity onPress={runSearch}>
              <Text style={styles.linkText}>Làm mới</Text>
            </TouchableOpacity>
          </View>

          {searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={22} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Chưa có chuyến phù hợp</Text>
              <Text style={styles.emptyText}>Thử đổi điểm đón, điểm đến hoặc ngày khởi hành.</Text>
            </View>
          ) : (
            searchResults.map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={[styles.rideCard, { padding: isSmallPhone ? 10 : 12, marginBottom: isSmallPhone ? 9 : 10 }]}
                onPress={() => openTripDetail(trip)}
                activeOpacity={0.92}
              >
                <View style={styles.rideCardTop}>
                  <View
                    style={[
                      styles.driverAvatar,
                      {
                        width: isSmallPhone ? 34 : 36,
                        height: isSmallPhone ? 34 : 36,
                        marginRight: isSmallPhone ? 7 : 8,
                      },
                    ]}
                  >
                    <Ionicons name="person-outline" size={isSmallPhone ? 16 : 17} color="#111827" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.driverTitle, { fontSize: isSmallPhone ? 13 : 14 }]}>{trip.driverName || 'Tài xế RideUp'}</Text>
                    <Text style={[styles.driverMeta, { fontSize: isSmallPhone ? 10 : 11 }]}>⭐ {trip.driverRating || 0} • Xe ghép liên tỉnh</Text>
                  </View>
                  <Text style={[styles.tripPrice, { fontSize: isSmallPhone ? 15 : 17 }]}>{formatCurrency(trip.price)}</Text>
                </View>

                <View style={styles.routeTimeline}>
                  <View style={styles.routeLineCol}>
                    <View style={styles.routeDotFrom} />
                    <View style={styles.routeLine} />
                    <View style={styles.routeDotTo} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeMain}>{trip.from}</Text>
                    <Text style={styles.routeSub}>Đón linh hoạt theo tuyến</Text>
                    <View style={{ height: 10 }} />
                    <Text style={styles.routeMain}>{trip.to}</Text>
                    <Text style={styles.routeSub}>Trả tại điểm đã đăng ký</Text>
                  </View>
                </View>

                <View style={styles.rideMetaRow}>
                  <View style={styles.metaChip}>
                    <Ionicons name="time-outline" size={13} color="#0F172A" />
                    <Text style={styles.metaChipText}>{formatTime(trip.departureTime)}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons name="people-outline" size={13} color="#0F172A" />
                    <Text style={styles.metaChipText}>{trip.availableSeats}/{trip.totalSeats} chỗ</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.bookBtn} onPress={() => openTripDetail(trip)}>
                  <Text style={styles.bookBtnText}>Xem chi tiết và đặt chỗ</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={[styles.bottomPad, { height: footerSpacer }]} />
      </ScrollView>
      )}

      {activeFooterTab === 'myTrips' && (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={[styles.pageHeader, { paddingHorizontal: horizontalGutter, paddingTop: isSmallPhone ? 18 : 24 }]}>
          <Text style={styles.pageTitle}>Chuyến của tôi</Text>
          <Text style={styles.pageSubTitle}>Theo dõi các chuyến đang đi và lịch sử của bạn</Text>
        </View>

        <View style={[styles.section, { paddingHorizontal: horizontalGutter, marginTop: sectionTopGap }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterTabsRow, { paddingRight: isSmallPhone ? 6 : 10 }]}
          >
            {MY_TRIPS_FILTERS.map((f) => {
              const count = bookings.filter((b) => bookingMatchesFilter(b, f.key)).length;
              const isActive = myTripsFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterTabBtn, isActive && styles.filterTabBtnActive]}
                  onPress={() => setMyTripsFilter(f.key)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{f.label}</Text>
                  <View style={[styles.filterTabCount, isActive && styles.filterTabCountActive]}>
                    <Text style={[styles.filterTabCountText, isActive && styles.filterTabCountTextActive]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {filteredMyTrips.length > 0 && (
          <View style={[styles.section, { paddingHorizontal: horizontalGutter, marginTop: sectionTopGap }]}>
            {filteredMyTrips.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                formatTime={formatTime}
                formatCurrency={formatCurrency}
                onPress={() => openBookingDetail(booking)}
                onRate={() => openRatingModal(booking)}
              />
            ))}
          </View>
        )}

        {filteredMyTrips.length === 0 && (
          <View style={[styles.section, { paddingHorizontal: horizontalGutter, marginTop: sectionTopGap }]}>
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={22} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Không có chuyến ở bộ lọc này</Text>
              <Text style={styles.emptyText}>Thử đổi tab lọc hoặc quay lại Trang chủ để đặt chuyến.</Text>
            </View>
          </View>
        )}

        <View style={[styles.bottomPad, { height: footerSpacer }]} />
      </ScrollView>
      )}

      {activeFooterTab === 'account' && (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={[styles.accountPageHeader, { marginHorizontal: horizontalGutter, marginTop: isSmallPhone ? 14 : 18 }]}>
          <View style={styles.accountAvatarWrapLarge}>
            <Ionicons name="person" size={34} color="#0F172A" />
          </View>
          <Text style={styles.accountPageName}>{customerFullName}</Text>
          <Text style={styles.accountPageEmail}>{user?.email || '--'}</Text>
        </View>

        <View style={[styles.section, { paddingHorizontal: horizontalGutter, marginTop: sectionTopGap }]}>
          <View style={styles.membershipCard}>
            <View style={styles.membershipTopRow}>
              <View>
                <Text style={styles.membershipLabel}>Hạng thành viên</Text>
                <Text style={styles.membershipValue}>{membershipLevel}</Text>
              </View>
              <View style={styles.membershipBadge}>
                <Text style={styles.membershipBadgeText}>{profileCompletion}%</Text>
              </View>
            </View>
            <Text style={styles.membershipHint}>Hoàn thiện tài khoản để nhận ưu đãi chuyến đi tốt hơn.</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${profileCompletion}%` }]} />
            </View>
          </View>

          <Text style={styles.accountSectionTitle}>Truy cập nhanh</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickCard} activeOpacity={0.9}>
              <Ionicons name="person-circle-outline" size={20} color="#00B14F" />
              <Text style={styles.quickCardText}>Thông tin cá nhân</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} activeOpacity={0.9}>
              <Ionicons name="card-outline" size={20} color="#00B14F" />
              <Text style={styles.quickCardText}>Thanh toán</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} activeOpacity={0.9}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#00B14F" />
              <Text style={styles.quickCardText}>An toàn tài khoản</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} activeOpacity={0.9}>
              <Ionicons name="gift-outline" size={20} color="#00B14F" />
              <Text style={styles.quickCardText}>Ưu đãi của tôi</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.accountStatsRow}>
            <View style={styles.accountStatCard}>
              <Text style={styles.accountStatValue}>{bookings.length}</Text>
              <Text style={styles.accountStatLabel}>Tổng chuyến</Text>
            </View>
            <View style={styles.accountStatCard}>
              <Text style={styles.accountStatValue}>{completedBookings.length}</Text>
              <Text style={styles.accountStatLabel}>Hoàn thành</Text>
            </View>
            <View style={styles.accountStatCard}>
              <Text style={styles.accountStatValue}>{formatCurrency(totalSpent)}</Text>
              <Text style={styles.accountStatLabel}>Đã chi</Text>
            </View>
          </View>

          <View style={styles.walletCard}>
            <View style={styles.walletHead}>
              <Ionicons name="wallet-outline" size={18} color="#00B14F" />
              <Text style={styles.walletTitle}>Ví & thanh toán</Text>
            </View>
            <Text style={styles.walletSub}>Phương thức mặc định: Tiền mặt</Text>
            <Text style={styles.walletSub}>Bạn có thể thêm thẻ hoặc tài khoản ngân hàng.</Text>
          </View>

          <Text style={styles.accountSectionTitle}>Tiện ích & hỗ trợ</Text>

          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.9}>
            <Ionicons name="person-circle-outline" size={18} color="#00B14F" />
            <Text style={styles.accountMenuText}>Thông tin cá nhân</Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.9}>
            <Ionicons name="card-outline" size={18} color="#00B14F" />
            <Text style={styles.accountMenuText}>Phương thức thanh toán</Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.9}>
            <Ionicons name="notifications-outline" size={18} color="#00B14F" />
            <Text style={styles.accountMenuText}>Thông báo</Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.9}>
            <Ionicons name="help-circle-outline" size={18} color="#00B14F" />
            <Text style={styles.accountMenuText}>Hỗ trợ</Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.9} onPress={openSupportCenter}>
            <Ionicons name="headset-outline" size={18} color="#00B14F" />
            <Text style={styles.accountMenuText}>Chăm sóc khách hàng</Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.accountLogoutWrap}>
            <TouchableOpacity style={styles.accountLogoutBtn} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.accountLogoutText}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.bottomPad, { height: footerSpacer }]} />
      </ScrollView>
      )}

      {activeFooterTab === 'messages' && (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={[styles.pageHeader, { paddingHorizontal: horizontalGutter, paddingTop: isSmallPhone ? 18 : 24 }]}>
          <Text style={styles.pageTitle}>Tin nhắn</Text>
          <Text style={styles.pageSubTitle}>Trao đổi với tài xế cho các chuyến đang hoạt động</Text>
        </View>

        <View style={[styles.section, { paddingHorizontal: horizontalGutter, marginTop: sectionTopGap }]}>
          <View style={styles.messageModeRow}>
            <TouchableOpacity
              style={[styles.messageModeBtn, messageView === 'assistant' && styles.messageModeBtnActive]}
              onPress={() => setMessageView('assistant')}
              activeOpacity={0.9}
            >
              <Ionicons name="sparkles-outline" size={14} color={messageView === 'assistant' ? '#008A3E' : '#64748B'} />
              <Text style={[styles.messageModeText, messageView === 'assistant' && styles.messageModeTextActive]}>Trợ lý CSKH</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.messageModeBtn, messageView === 'drivers' && styles.messageModeBtnActive]}
              onPress={() => setMessageView('drivers')}
              activeOpacity={0.9}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={messageView === 'drivers' ? '#008A3E' : '#64748B'} />
              <Text style={[styles.messageModeText, messageView === 'drivers' && styles.messageModeTextActive]}>Tin nhắn tài xế</Text>
            </TouchableOpacity>
          </View>

          {messageView === 'assistant' && (
          <View style={styles.supportCard}> 
            <View style={styles.supportHeadRow}> 
              <Ionicons name="headset" size={16} color="#00B14F" />
              <Text style={styles.supportTitle}>Trợ lý RideUp</Text>
            </View>

            <View style={styles.supportQuickRow}>
              <TouchableOpacity style={styles.supportQuickBtn} onPress={() => submitSupportMessage('Kiểm tra booking gần nhất')}>
                <Text style={styles.supportQuickText}>Kiểm tra booking</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.supportQuickBtn} onPress={() => submitSupportMessage('Tôi đã chuyển khoản nhưng chưa xác nhận')}>
                <Text style={styles.supportQuickText}>Thanh toán</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.supportQuickBtn} onPress={() => submitSupportMessage('Tôi muốn hủy chuyến')}>
                <Text style={styles.supportQuickText}>Hủy chuyến</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.supportMessagesWrap}>
              {supportMessages.slice(-6).map((m) => (
                <View key={m.id} style={[styles.supportBubble, m.role === 'user' ? styles.supportBubbleUser : styles.supportBubbleBot]}>
                  <Text style={[styles.supportBubbleText, m.role === 'user' && styles.supportBubbleTextUser]}>{m.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.supportInputRow}>
              <TextInput
                style={styles.supportInput}
                placeholder="Hỏi về thanh toán, booking, hủy chuyến..."
                value={supportInput}
                onChangeText={setSupportInput}
                editable={!supportSending}
                onSubmitEditing={() => submitSupportMessage()}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.supportSendBtn} onPress={() => submitSupportMessage()} disabled={supportSending}>
                <Ionicons name="send" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          )}

          {messageView === 'drivers' && (
          <>
          <View style={styles.inboxBanner}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#00B14F" />
            <Text style={styles.inboxBannerText}>Bạn có {inboxItems.filter((i) => i.unread).length} tin nhắn chưa đọc</Text>
          </View>

          {inboxItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Chưa có hội thoại</Text>
              <Text style={styles.emptyText}>Khi bạn đặt chuyến, cuộc trò chuyện với tài xế sẽ hiển thị ở đây.</Text>
            </View>
          ) : (
            inboxItems.map((item) => (
              <TouchableOpacity key={item.id} style={styles.messageCard} activeOpacity={0.9}>
                <View style={styles.messageAvatar}>
                  <Ionicons name="person" size={17} color="#0F172A" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.messageTopRow}>
                    <Text style={styles.messageDriver}>{item.driverName}</Text>
                    <Text style={styles.messageTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.messageRoute}>{item.route}</Text>
                  <Text style={styles.messagePreview} numberOfLines={2}>{item.preview}</Text>
                </View>
                {item.unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))
          )}
          </>
          )}
        </View>

        <View style={[styles.bottomPad, { height: footerSpacer }]} />
      </ScrollView>
      )}

      <View style={[styles.footerWrap, { paddingBottom: footerPadBottom }]}>
        <TouchableOpacity
          style={[styles.footerItem, activeFooterTab === 'home' && styles.footerItemActive]}
          onPress={goHome}
          activeOpacity={0.9}
        >
          <Ionicons name={activeFooterTab === 'home' ? 'home' : 'home-outline'} size={isSmallPhone ? 18 : 20} color={activeFooterTab === 'home' ? '#00B14F' : '#64748B'} />
          <Text numberOfLines={1} style={[styles.footerText, { fontSize: isSmallPhone ? 9 : 10 }, activeFooterTab === 'home' && styles.footerTextActive]}>Trang chủ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerItem, activeFooterTab === 'myTrips' && styles.footerItemActive]}
          onPress={goMyTrips}
          activeOpacity={0.9}
        >
          <Ionicons name={activeFooterTab === 'myTrips' ? 'car' : 'car-outline'} size={isSmallPhone ? 18 : 20} color={activeFooterTab === 'myTrips' ? '#00B14F' : '#64748B'} />
          <Text numberOfLines={1} style={[styles.footerText, { fontSize: isSmallPhone ? 9 : 10 }, activeFooterTab === 'myTrips' && styles.footerTextActive]}>Chuyến của tôi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerItem, activeFooterTab === 'messages' && styles.footerItemActive]}
          onPress={openMessages}
          activeOpacity={0.9}
        >
          <Ionicons name={activeFooterTab === 'messages' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={isSmallPhone ? 18 : 20} color={activeFooterTab === 'messages' ? '#00B14F' : '#64748B'} />
          <Text numberOfLines={1} style={[styles.footerText, { fontSize: isSmallPhone ? 9 : 10 }, activeFooterTab === 'messages' && styles.footerTextActive]}>Tin nhắn</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerItem, activeFooterTab === 'account' && styles.footerItemActive]}
          onPress={openAccount}
          activeOpacity={0.9}
        >
          <Ionicons name={activeFooterTab === 'account' ? 'person' : 'person-outline'} size={isSmallPhone ? 18 : 20} color={activeFooterTab === 'account' ? '#00B14F' : '#64748B'} />
          <Text numberOfLines={1} style={[styles.footerText, { fontSize: isSmallPhone ? 9 : 10 }, activeFooterTab === 'account' && styles.footerTextActive]}>Tài khoản</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.supportFab, { bottom: isShortPhone ? 86 : 94 }]} onPress={openSupportCenter} activeOpacity={0.9}>
        <Ionicons name="headset" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <ProvincePicker
        visible={showFromProvincePicker}
        onClose={() => setShowFromProvincePicker(false)}
        onSelect={onSelectFromProvince}
        requireDb
        title="Chọn tỉnh/thành điểm đón"
      />
      <ProvincePicker
        visible={showToProvincePicker}
        onClose={() => setShowToProvincePicker(false)}
        onSelect={onSelectToProvince}
        requireDb
        title="Chọn tỉnh/thành điểm đến"
      />

      <WardPicker
        visible={showFromWardPicker}
        onClose={() => setShowFromWardPicker(false)}
        provinceId={fromProvince?.id}
        singleSelect
        selectedNames={fromWard?.name ? [fromWard.name] : []}
        onConfirm={() => {}}
        onConfirmRaw={(items) => setFromWard(items?.[0] || null)}
        title="Chọn quận/huyện điểm đón"
      />
      <WardPicker
        visible={showToWardPicker}
        onClose={() => setShowToWardPicker(false)}
        provinceId={toProvince?.id}
        singleSelect
        selectedNames={toWard?.name ? [toWard.name] : []}
        onConfirm={() => {}}
        onConfirmRaw={(items) => setToWard(items?.[0] || null)}
        title="Chọn quận/huyện điểm đến"
      />

      <Modal visible={!!tripDetail} transparent animationType="fade" onRequestClose={() => setTripDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="information-circle" size={20} color="#00B14F" />
              <Text style={styles.modalTitle}>Chi tiết chuyến đi</Text>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
            >
              <View style={styles.infoSection}>
                <View style={styles.infoSectionTitleRow}>
                  <Ionicons name="map" size={15} color="#00B14F" />
                  <Text style={styles.infoSectionTitle}>Thông tin chuyến đi</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Lộ trình</Text>
                  <Text style={styles.infoValue}>{tripDetail?.from} - {tripDetail?.to}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Khởi hành</Text>
                  <Text style={styles.infoValue}>{formatTime(tripDetail?.departureTime)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Giá/vé</Text>
                  <Text style={styles.infoValueStrong}>{formatCurrency(tripDetail?.price)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ghế trống</Text>
                  <Text style={styles.infoValue}>{tripDetail?.availableSeats}/{tripDetail?.totalSeats} ghế</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Quãng đường</Text>
                  <Text style={styles.infoValue}>{tripDetail?.estimatedDistanceKm ? `${tripDetail.estimatedDistanceKm} km` : '--'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Thời lượng</Text>
                  <Text style={styles.infoValue}>{formatDuration(tripDetail?.estimatedDurationMinutes)}</Text>
                </View>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoSectionTitleRow}>
                  <Ionicons name="person" size={15} color="#00B14F" />
                  <Text style={styles.infoSectionTitle}>Thông tin tài xế</Text>
                </View>
                <View style={styles.profileRow}>
                  {tripDetail?.driverAvatarUrl && !driverImageFailed ? (
                    <Image
                      source={{ uri: tripDetail.driverAvatarUrl }}
                      style={styles.profileImage}
                      onError={() => setDriverImageFailed(true)}
                    />
                  ) : (
                    <Image source={DEFAULT_DRIVER_IMAGE} style={styles.profileImage} />
                  )}
                  <View style={styles.profileTextWrap}>
                    <Text style={styles.profileName}>{tripDetail?.driverName || '--'}</Text>
                    <Text style={styles.profileMeta}>⭐ {tripDetail?.driverRating || 0}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoSectionTitleRow}>
                  <Ionicons name="car" size={15} color="#00B14F" />
                  <Text style={styles.infoSectionTitle}>Thông tin xe</Text>
                </View>
                <View style={styles.profileRow}>
                  {tripDetail?.vehicleImageUrl && !vehicleImageFailed ? (
                    <Image
                      source={{ uri: tripDetail.vehicleImageUrl }}
                      style={styles.vehicleImage}
                      onError={() => setVehicleImageFailed(true)}
                    />
                  ) : (
                    <Image source={DEFAULT_VEHICLE_IMAGE} style={styles.vehicleImage} />
                  )}
                  <View style={styles.profileTextWrap}>
                    <Text style={styles.profileName}>{getVehicleTypeLabel(tripDetail?.vehicleType)}</Text>
                    <Text style={styles.profileMeta}>Biển số: {tripDetail?.vehiclePlateNumber || '--'}</Text>
                  </View>
                </View>
              </View>

            <Text style={styles.inputLabel}>Chọn điểm đón</Text>
            {(tripDetail?.pickupPoints || []).map((p) => (
              <TouchableOpacity
                key={`pd-${p.id}`}
                style={[styles.optionBtn, selectedPickupPointId === p.id && styles.optionBtnActive]}
                onPress={() => setSelectedPickupPointId(p.id)}
              >
                <Text style={styles.optionText}>{p.wardName || p.address}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.selectionHint}>
              Điểm đón đã chọn: {(tripDetail?.pickupPoints || []).find((p) => p.id === selectedPickupPointId)?.wardName || '--'}
            </Text>

            <Text style={styles.inputLabel}>Chọn điểm trả</Text>
            {(tripDetail?.dropoffPoints || []).map((p) => (
              <TouchableOpacity
                key={`dd-${p.id}`}
                style={[styles.optionBtn, selectedDropoffPointId === p.id && styles.optionBtnActive]}
                onPress={() => setSelectedDropoffPointId(p.id)}
              >
                <Text style={styles.optionText}>{p.wardName || p.address}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.selectionHint}>
              Điểm trả đã chọn: {(tripDetail?.dropoffPoints || []).find((p) => p.id === selectedDropoffPointId)?.wardName || '--'}
            </Text>

            <Text style={styles.inputLabel}>Số chỗ</Text>
            <View style={styles.seatRow}>
              <TouchableOpacity
                style={styles.seatBtn}
                onPress={() => setSeatCount((prev) => Math.max(1, prev - 1))}
                disabled={bookingSubmitting}
              >
                <Text style={styles.seatBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.seatValue}>{seatCount}</Text>
              <TouchableOpacity
                style={styles.seatBtn}
                onPress={() => {
                  const maxSeats = tripDetail?.availableSeats || 1;
                  setSeatCount((prev) => Math.min(maxSeats, prev + 1));
                }}
                disabled={bookingSubmitting}
              >
                <Text style={styles.seatBtnText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.seatHint}>Còn {tripDetail?.availableSeats || 0} ghế</Text>
            </View>

            <Text style={styles.inputLabel}>Phương thức thanh toán</Text>
            <View style={styles.paymentRow}>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'CASH' && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod('CASH')}
              >
                <Text style={[styles.paymentText, paymentMethod === 'CASH' && styles.paymentTextActive]}>Tiền mặt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'BANK_TRANSFER' && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod('BANK_TRANSFER')}
              >
                <Text style={[styles.paymentText, paymentMethod === 'BANK_TRANSFER' && styles.paymentTextActive]}>Chuyển khoản</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.totalHint}>Tổng tiền: {formatCurrency((tripDetail?.price || 0) * seatCount)}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTripDetail(null)} disabled={bookingSubmitting}>
                <Text style={styles.cancelBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={submitTripDetailBooking}
                disabled={bookingSubmitting}
              >
                <Text style={styles.confirmBtnText}>{bookingSubmitting ? 'Đang đặt...' : 'Xác nhận đặt chỗ'}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!bookingDetail} transparent animationType="fade" onRequestClose={() => setBookingDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="document-text" size={20} color="#00B14F" />
              <Text style={styles.modalTitle}>Chi tiết đặt chỗ</Text>
            </View>
            <Text style={styles.modalSub}>Trạng thái: {STATUS_CONFIG[bookingDetail?.status]?.label || bookingDetail?.status}</Text>
            <Text style={styles.modalSub}>Lộ trình: {bookingDetail?.from} - {bookingDetail?.to}</Text>
            <Text style={styles.modalSub}>Khởi hành: {formatTime(bookingDetail?.departureTime)}</Text>
            <Text style={styles.modalSub}>Điểm đón: {bookingDetail?.pickupPoint}</Text>
            <Text style={styles.modalSub}>Điểm trả: {bookingDetail?.dropPoint}</Text>
            <Text style={styles.modalSub}>Số vé: {bookingDetail?.seatCount || 1}</Text>
            <Text style={styles.modalSub}>Tổng tiền: {formatCurrency(bookingDetail?.price)}</Text>
            <Text style={styles.modalSub}>Tài xế: {bookingDetail?.driverName} | ⭐ {bookingDetail?.driverRating || 0}</Text>
            <Text style={styles.modalSub}>Thanh toán: {bookingDetail?.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}</Text>
            <Text style={styles.modalSub}>Trạng thái thanh toán: {bookingDetail?.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Text>

            {isAwaitingBankTransfer(bookingDetail) && (
              <TouchableOpacity style={styles.payNowBtn} onPress={submitConfirmTransfer} disabled={paymentConfirmSubmitting}>
                <Ionicons name="card-outline" size={15} color="#FFFFFF" />
                <Text style={styles.payNowBtnText}>{paymentConfirmSubmitting ? 'Đang xác nhận...' : 'Tôi đã chuyển khoản'}</Text>
              </TouchableOpacity>
            )}

            {bookingDetail?.status === 'completed' && !bookingDetail?.hasRated && (
              <TouchableOpacity style={styles.rateBtn} onPress={() => openRatingModal(bookingDetail)}>
                <Ionicons name="star" size={15} color="#FFFFFF" />
                <Text style={styles.rateBtnText}>Đánh giá chuyến đi</Text>
              </TouchableOpacity>
            )}

            {bookingDetail?.hasRated && (
              <View style={styles.ratedInfoRow}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.ratedInfoText}>Bạn đã đánh giá {bookingDetail?.myRating || 0}/5</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setBookingDetail(null)}>
                <Text style={styles.confirmBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!ratingBooking} transparent animationType="fade" onRequestClose={() => setRatingBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="star" size={20} color="#00B14F" />
              <Text style={styles.modalTitle}>Đánh giá chuyến đi</Text>
            </View>

            <Text style={styles.modalSub}>Tài xế: {ratingBooking?.driverName || '--'}</Text>
            <Text style={styles.modalSub}>Lộ trình: {ratingBooking?.from} - {ratingBooking?.to}</Text>

            <Text style={styles.inputLabel}>Số sao</Text>
            <View style={styles.ratingStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const active = ratingValue >= star;
                return (
                  <TouchableOpacity key={`star-${star}`} onPress={() => setRatingValue(star)} style={styles.ratingStarBtn}>
                    <Ionicons name={active ? 'star' : 'star-outline'} size={26} color={active ? '#F59E0B' : '#94A3B8'} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Nhận xét (tuỳ chọn)</Text>
            <TextInput
              style={styles.reviewTextInput}
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              numberOfLines={4}
              placeholder="Chia sẻ trải nghiệm chuyến đi của bạn"
              textAlignVertical="top"
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRatingBooking(null)} disabled={ratingSubmitting}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={submitBookingRating} disabled={ratingSubmitting}>
                <Text style={styles.confirmBtnText}>{ratingSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSupportCenter} transparent animationType="fade" onRequestClose={() => setShowSupportCenter(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="headset" size={20} color="#00B14F" />
              <Text style={styles.modalTitle}>Trung tâm hỗ trợ</Text>
            </View>
            <Text style={styles.modalSub}>Bạn cần hỗ trợ về chuyến đi, thanh toán hay tài khoản?</Text>

            <TouchableOpacity style={styles.supportActionBtn} onPress={openSupportChat}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color="#00B14F" />
              <Text style={styles.supportActionText}>Chat với CSKH</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportActionBtn} onPress={callSupportHotline}>
              <Ionicons name="call-outline" size={17} color="#00B14F" />
              <Text style={styles.supportActionText}>Gọi hotline 1900 1234</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowSupportCenter(false)}>
                <Text style={styles.confirmBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </>
  );
};

const BookingCard = ({ booking, formatTime, formatCurrency, onPress, onRate }) => {
  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const canRate = booking.status === 'completed' && !booking.hasRated;

  return (
    <TouchableOpacity style={styles.bookingCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.bookingTopRow}>
        <View style={styles.bookingIconWrap}>
          <Ionicons name="car-sport" size={16} color="#0F172A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingTimeStrong}>{formatTime(booking.departureTime)}</Text>
          <Text style={styles.bookingDriverMini}>Tài xế: {booking.driverName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}> 
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.bookingTimeline}>
        <View style={styles.routeLineCol}>
          <View style={styles.routeDotFrom} />
          <View style={styles.routeLine} />
          <View style={styles.routeDotTo} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingRouteMain}>{booking.from}</Text>
          <Text style={styles.bookingRouteSub}>Điểm đón: {booking.pickupPoint}</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.bookingRouteMain}>{booking.to}</Text>
          <Text style={styles.bookingRouteSub}>Điểm trả: {booking.dropPoint}</Text>
        </View>
      </View>

      <View style={styles.bookingBottomRow}>
        <View style={styles.metaChip}>
          <Ionicons name="people-outline" size={13} color="#0F172A" />
          <Text style={styles.metaChipText}>{booking.seatCount || 1} vé</Text>
        </View>
        <Text style={styles.bookingPrice}>{formatCurrency(booking.price)}</Text>
        <Ionicons name="chevron-forward-circle" size={20} color="#94A3B8" />
      </View>

      {(canRate || booking.hasRated) && (
        <View style={styles.bookingRateRow}>
          {canRate && (
            <TouchableOpacity style={styles.bookingRateBtn} onPress={onRate}>
              <Ionicons name="star" size={14} color="#FFFFFF" />
              <Text style={styles.bookingRateBtnText}>Đánh giá</Text>
            </TouchableOpacity>
          )}
          {booking.hasRated && (
            <View style={styles.bookingRatedBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.bookingRatedBadgeText}>{booking.myRating || 0}/5</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7F8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textLight },

  heroBackground: {
    backgroundColor: '#0E1111',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  heroBackgroundImage: {
    resizeMode: 'cover',
    backgroundColor: '#0E1111',
    transform: [{ translateY: -92 }],
  },
  heroOverlay: {
    backgroundColor: 'rgba(8, 12, 14, 0.42)',
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#8B949E', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  userName: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 4 },
  whereTo: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 18 },
  subtitle: { color: '#D7DEE2', fontSize: 13, marginTop: 6, maxWidth: 300 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  statsRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 0,
  },
  statValue: { marginTop: 4, fontSize: 18, fontWeight: '900', color: '#0F172A' },
  statLabel: { marginTop: 2, fontSize: 11, color: '#64748B', textAlign: 'center' },

  searchWrap: { marginHorizontal: 16, marginTop: -18 },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 6,
  },
  searchHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  searchTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  searchHintInline: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  linkText: { fontSize: 13, color: '#00B14F', fontWeight: '700' },

  routeField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FBFCFD',
    marginBottom: 7,
  },
  routeTextWrap: { flex: 1, marginLeft: 10 },
  routeFieldLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: '700' },
  routeFieldText: { fontSize: 13, color: '#0F172A', fontWeight: '700', marginTop: 2 },

  inputLabel: { fontSize: 11, color: '#334155', marginTop: 8, marginBottom: 5, fontWeight: '700', textTransform: 'uppercase' },
  dateInputWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: COLORS.text,
    backgroundColor: '#FBFCFD',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 8,
    color: COLORS.text,
    backgroundColor: 'transparent',
    fontSize: 13,
  },

  quickDateRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quickDateBtn: {
    backgroundColor: '#EEF2F3',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  quickDateText: { fontSize: 12, fontWeight: '700', color: '#334155' },

  searchBtn: {
    backgroundColor: '#00B14F',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  searchBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },

  errorText: { color: '#B42318', marginTop: 10, fontSize: 13, backgroundColor: '#FEF3F2', padding: 10, borderRadius: 10 },

  section: { paddingHorizontal: 16, marginTop: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeaderInline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
  titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterTabsRow: { gap: 8, paddingRight: 10 },
  filterTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  filterTabBtnActive: { borderColor: '#00B14F', backgroundColor: '#ECFDF3' },
  filterTabText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  filterTabTextActive: { color: '#008A3E' },
  filterTabCount: {
    minWidth: 20,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  filterTabCountActive: { backgroundColor: '#D1FAE5' },
  filterTabCountText: { color: '#475569', fontSize: 11, fontWeight: '800' },
  filterTabCountTextActive: { color: '#008A3E' },
  pageHeader: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 6 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  pageSubTitle: { fontSize: 13, color: '#64748B', marginTop: 6 },
  accountPageHeader: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  accountAvatarWrapLarge: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF8F0',
    borderWidth: 1,
    borderColor: '#D8F3E4',
  },
  accountPageName: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  accountPageEmail: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  countBadge: {
    minWidth: 28,
    borderRadius: 999,
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  countBadgeText: { color: '#00A63E', fontWeight: '800', fontSize: 12 },
  countBadgeMuted: {
    minWidth: 28,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  countBadgeTextMuted: { color: '#475569', fontWeight: '800', fontSize: 12 },

  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 6, fontSize: 15, fontWeight: '800', color: '#0F172A' },
  emptyText: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' },

  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E9EEF4',
  },
  rideCardTop: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverTitle: { fontSize: 14, fontWeight: '900', color: '#111827' },
  driverMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  tripPrice: { marginLeft: 'auto', fontSize: 17, color: '#0F172A', fontWeight: '900' },

  routeTimeline: { flexDirection: 'row', marginTop: 12 },
  routeLineCol: { alignItems: 'center', width: 18, marginRight: 8 },
  routeDotFrom: { width: 9, height: 9, borderRadius: 999, backgroundColor: '#16A34A' },
  routeDotTo: { width: 9, height: 9, borderRadius: 999, backgroundColor: '#111827' },
  routeLine: { width: 2, flex: 1, backgroundColor: '#CBD5E1', marginVertical: 4 },
  routeMain: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  routeSub: { fontSize: 11, color: '#64748B', marginTop: 2 },

  rideMetaRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: { fontSize: 11, color: '#334155', fontWeight: '700' },

  bookBtn: {
    marginTop: 10,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#00B14F',
  },
  bookBtnText: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.2 },

  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E7EDF4',
  },
  bookingTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bookingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginRight: 10,
  },
  bookingTimeStrong: { fontSize: 13, color: '#0F172A', fontWeight: '800' },
  bookingDriverMini: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  bookingTimeline: { flexDirection: 'row' },
  bookingRouteMain: { fontSize: 14, color: '#0F172A', fontWeight: '800' },
  bookingRouteSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  bookingBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  bookingPrice: { marginLeft: 'auto', fontSize: 16, fontWeight: '900', color: '#008A3E' },
  bookingRateRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookingRateBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  bookingRatedBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bookingRatedBadgeText: { color: '#92400E', fontSize: 11, fontWeight: '800' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  accountOverlay: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    maxHeight: '85%',
  },
  accountSheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '78%',
    paddingBottom: 24,
  },
  accountHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  accountHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  accountAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF8F0',
    marginRight: 12,
  },
  accountName: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  accountEmail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  accountRoleChip: {
    borderRadius: 999,
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  accountRoleText: { color: '#00A63E', fontSize: 11, fontWeight: '800' },
  accountStatsRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 12 },
  membershipCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  membershipTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  membershipLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  membershipValue: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 2 },
  membershipBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  membershipBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  membershipHint: { color: '#CBD5E1', fontSize: 12, marginTop: 8 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 999 },
  accountSectionTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginTop: 2, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  quickCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  quickCardText: { marginTop: 7, fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  accountStatCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  accountStatValue: { fontSize: 13, fontWeight: '900', color: '#0F172A' },
  accountStatLabel: { fontSize: 11, color: '#64748B', marginTop: 4, fontWeight: '600' },
  walletCard: {
    borderWidth: 1,
    borderColor: '#D9F3E4',
    borderRadius: 12,
    backgroundColor: '#F1FCF6',
    padding: 12,
    marginBottom: 12,
  },
  walletHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  walletTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  walletSub: { fontSize: 12, color: '#334155', marginTop: 2 },
  accountMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 10,
  },
  accountMenuText: { flex: 1, color: '#0F172A', fontSize: 13, fontWeight: '700' },
  accountLogoutWrap: { marginTop: 14 },
  accountLogoutBtn: {
    borderRadius: 12,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  accountLogoutText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  messageModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  messageModeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  messageModeBtnActive: {
    borderColor: '#00B14F',
    backgroundColor: '#ECFDF3',
  },
  messageModeText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  messageModeTextActive: { color: '#008A3E' },
  supportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    padding: 12,
    marginBottom: 10,
  },
  supportHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  supportTitle: { color: '#0F172A', fontWeight: '900', fontSize: 14 },
  supportQuickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  supportQuickBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9F3E4',
    backgroundColor: '#F1FCF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  supportQuickText: { color: '#008A3E', fontSize: 11, fontWeight: '700' },
  supportMessagesWrap: { gap: 7, marginBottom: 10 },
  supportBubble: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '90%',
  },
  supportBubbleBot: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start' },
  supportBubbleUser: { backgroundColor: '#00B14F', alignSelf: 'flex-end' },
  supportBubbleText: { color: '#0F172A', fontSize: 12, lineHeight: 18 },
  supportBubbleTextUser: { color: '#FFFFFF' },
  supportInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supportInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0F172A',
    backgroundColor: '#FAFCFF',
    fontSize: 13,
  },
  supportSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#00B14F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportFab: {
    position: 'absolute',
    right: 14,
    bottom: 94,
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#00B14F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 9,
  },
  supportActionBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  supportActionText: { flex: 1, color: '#0F172A', fontSize: 13, fontWeight: '700' },
  inboxBanner: {
    borderWidth: 1,
    borderColor: '#D9F3E4',
    borderRadius: 12,
    backgroundColor: '#F1FCF6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inboxBannerText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  messageTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageDriver: { color: '#0F172A', fontWeight: '800', fontSize: 13, flex: 1, marginRight: 8 },
  messageTime: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  messageRoute: { color: '#334155', fontSize: 12, fontWeight: '700', marginTop: 2 },
  messagePreview: { color: '#64748B', fontSize: 12, marginTop: 4, lineHeight: 17 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#00B14F',
    marginTop: 5,
  },
  modalScroll: { maxHeight: '100%' },
  modalScrollContent: { paddingBottom: 4 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  modalSub: { color: '#475569', marginBottom: 4 },
  rateBtn: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  rateBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  payNowBtn: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#00B14F',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  payNowBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  ratedInfoRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  ratedInfoText: { color: '#92400E', fontWeight: '700', fontSize: 12 },
  ratingStarsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 },
  ratingStarBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  reviewTextInput: {
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 10,
    backgroundColor: '#FAFCFF',
    minHeight: 92,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0F172A',
    fontSize: 13,
    marginTop: 4,
  },
  infoSection: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#FAFCFF',
  },
  infoSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  infoSectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, gap: 8 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '600', flex: 1 },
  infoValue: { color: '#0F172A', fontSize: 12, fontWeight: '600', flex: 1.4, textAlign: 'right' },
  infoValueStrong: { color: '#008A3E', fontSize: 13, fontWeight: '800', flex: 1.4, textAlign: 'right' },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E2E8F0' },
  profilePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleImage: { width: 70, height: 56, borderRadius: 10, backgroundColor: '#E2E8F0' },
  vehiclePlaceholder: {
    width: 70,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextWrap: { marginLeft: 12, flex: 1 },
  profileName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  profileMeta: { fontSize: 12, color: '#475569', marginTop: 3, fontWeight: '600' },
  optionBtn: {
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FAFCFF',
  },
  optionBtnActive: { borderColor: '#00B14F', backgroundColor: '#ECFDF3' },
  optionText: { color: COLORS.text, fontSize: 14 },
  selectionHint: { marginTop: -2, marginBottom: 8, color: '#334155', fontSize: 12, fontWeight: '600' },
  seatRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 },
  seatBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFCFF',
  },
  seatBtnText: { fontSize: 20, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  seatValue: { minWidth: 34, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0F172A', marginHorizontal: 10 },
  seatHint: { marginLeft: 10, fontSize: 12, color: '#64748B' },
  paymentRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 6 },
  paymentBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FAFCFF',
  },
  paymentBtnActive: { borderColor: '#00B14F', backgroundColor: '#ECFDF3' },
  paymentText: { color: '#475569', fontWeight: '600' },
  paymentTextActive: { color: '#008A3E', fontWeight: '800' },
  totalHint: { fontSize: 13, color: '#008A3E', fontWeight: '800', marginBottom: 4 },
  modalActions: { flexDirection: 'row', marginTop: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    alignItems: 'center',
    marginRight: 6,
  },
  cancelBtnText: { color: COLORS.text, fontWeight: '700' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#00B14F',
    alignItems: 'center',
    marginLeft: 6,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700' },

  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderColor: '#E5EAF0',
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  footerItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  footerItemActive: { backgroundColor: '#ECFDF3' },
  footerText: { marginTop: 2, fontSize: 10, color: '#64748B', fontWeight: '700' },
  footerTextActive: { color: '#00A63E' },
  bottomPad: { height: 112 },
});

export default CustomerHomeScreen;
