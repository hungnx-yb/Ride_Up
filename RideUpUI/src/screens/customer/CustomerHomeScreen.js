import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../config/config';
import {
  createChatRealtimeClient,
  getCustomerBookings,
  searchRidesAdvanced,
  searchRidesFromText,
  bookRide,
  createVnpayPaymentUrl,
  rateRide,
  supportChat,
  getWardById,
  getMyInfo,
  updateMyInfo,
  updateMyAvatar,
  uploadFile,
  requestChangePasswordOtp,
  changeMyPassword,
  openChatThread,
  getMyChatThreads,
  getChatMessages,
  sendChatMessage,
  markChatThreadRead,
  resolveStoragePublicUrl,
} from '../../services/api';
import ProvincePicker from '../../components/ProvincePicker';
import WardPicker from '../../components/WardPicker';
import RadiusMap from '../../components/RadiusMap';

const DEFAULT_DRIVER_IMAGE = require('../../../assets/icon.png');
const DEFAULT_VEHICLE_IMAGE = require('../../../assets/adaptive-icon.png');
const HERO_BACKGROUND_IMAGE = require('../../../assets/anh-nen-sieu-xe_020255797.jpg');
const MAP_PICK_RADIUS_KM = 20;
const MAP_PICK_RADIUS_METERS = MAP_PICK_RADIUS_KM * 1000;
const SEARCH_PAGE_SIZE = 20;
const REVERSE_GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const RATING_LABELS = {
  1: 'Rất tệ',
  2: 'Chưa ổn',
  3: 'Bình thường',
  4: 'Khá tốt',
  5: 'Tuyệt vời',
};
const SUPPORT_INTENT_META = {
  BOOKING_LOOKUP: { icon: 'document-text-outline', title: 'Booking', color: '#0EA5E9' },
  FAQ_PAYMENT: { icon: 'card-outline', title: 'Thanh toán', color: '#0284C7' },
  FAQ_CANCEL: { icon: 'close-circle-outline', title: 'Hủy chuyến', color: '#DC2626' },
  FAQ_REFUND: { icon: 'cash-outline', title: 'Hoàn tiền', color: '#16A34A' },
  FAQ_REVIEW: { icon: 'star-outline', title: 'Đánh giá', color: '#D97706' },
  FAQ_ACCOUNT: { icon: 'person-circle-outline', title: 'Tài khoản', color: '#7C3AED' },
  FAQ_DELAY: { icon: 'time-outline', title: 'Đi trễ', color: '#EA580C' },
  FAQ_LUGGAGE: { icon: 'briefcase-outline', title: 'Hành lý', color: '#0891B2' },
  FAQ_APP_ISSUE: { icon: 'build-outline', title: 'Sự cố app', color: '#334155' },
  FAQ_GREETING: { icon: 'happy-outline', title: 'Chào bạn', color: '#0EA5E9' },
  FAQ_THANKS: { icon: 'thumbs-up-outline', title: 'Không có chi', color: '#16A34A' },
  FAQ_GENERAL: { icon: 'sparkles-outline', title: 'Trợ lý RideUp', color: '#00B14F' },
};
const SUPPORT_QUICK_ACTIONS = [
  'Kiểm tra booking gần nhất',
  'Tôi đã chuyển khoản nhưng chưa xác nhận',
  'Tôi muốn hủy chuyến',
  'Hoàn tiền như thế nào',
  'Tài xế đến trễ thì sao',
  'Có được mang thú cưng không',
];

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

const normalizeCustomerMessage = (msg) => {
  if (!msg) return msg;
  return {
    ...msg,
    mine: String(msg.senderRole || '').toUpperCase() === 'CUSTOMER',
  };
};

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
  const [profileUser, setProfileUser] = useState(user || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchDate, setSearchDate] = useState('');
  const [showSearchDatePicker, setShowSearchDatePicker] = useState(false);
  const [searchCalendarMonth, setSearchCalendarMonth] = useState(new Date());
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [aiSearchText, setAiSearchText] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSearchHint, setAiSearchHint] = useState('');
  const [aiIntentChips, setAiIntentChips] = useState([]);
  const [aiParsedCriteria, setAiParsedCriteria] = useState(null);

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
  const [ratingAvatarFailed, setRatingAvatarFailed] = useState(false);
  const [paymentConfirmSubmitting, setPaymentConfirmSubmitting] = useState(false);
  const [chatThreads, setChatThreads] = useState([]);
  const [chatThread, setChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const chatRealtimeRef = useRef(null);
  const chatMessagesScrollRef = useRef(null);
  const [bookingSuccessModal, setBookingSuccessModal] = useState({ visible: false, title: '', message: '' });
  const [showSupportCenter, setShowSupportCenter] = useState(false);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [accountAvatarFailed, setAccountAvatarFailed] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [messageView, setMessageView] = useState('drivers');
  const [supportInput, setSupportInput] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportMessages, setSupportMessages] = useState([
    {
      id: `bot-${Date.now()}`,
      role: 'bot',
      intent: 'FAQ_GREETING',
      text: '👋 Xin chào! Mình là Trợ lý RideUp. Bạn hỏi mình về booking, thanh toán, hủy chuyến, hoàn tiền, đi trễ... đều được nha.',
      suggestions: SUPPORT_QUICK_ACTIONS.slice(0, 4),
    },
  ]);
  const [pickupDetailLocation, setPickupDetailLocation] = useState({ address: '', lat: null, lng: null });
  const [dropoffDetailLocation, setDropoffDetailLocation] = useState({ address: '', lat: null, lng: null });
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [pickupLiveAddress, setPickupLiveAddress] = useState('');
  const [dropoffLiveAddress, setDropoffLiveAddress] = useState('');
  const [pickupResolving, setPickupResolving] = useState(false);
  const [dropoffResolving, setDropoffResolving] = useState(false);
  const [pickupMapError, setPickupMapError] = useState('');
  const [dropoffMapError, setDropoffMapError] = useState('');
  const [pickupLocating, setPickupLocating] = useState(false);
  const [dropoffLocating, setDropoffLocating] = useState(false);
  const [pickupWardCenter, setPickupWardCenter] = useState(null);
  const [dropoffWardCenter, setDropoffWardCenter] = useState(null);
  const pickupReverseSeq = useRef(0);
  const dropoffReverseSeq = useRef(0);
  const pickupWardCenterSeq = useRef(0);
  const dropoffWardCenterSeq = useRef(0);

  const [errorText, setErrorText] = useState('');
  const [searchErrorText, setSearchErrorText] = useState('');
  const scrollRef = useRef(null);

  const canChatBooking = (booking) => ['pending', 'confirmed', 'in_progress'].includes(String(booking?.status || '').toLowerCase());

  const loadData = async () => {
    try {
      const [data, threads, me] = await Promise.all([
        getCustomerBookings(),
        getMyChatThreads().catch(() => []),
        getMyInfo().catch(() => null),
      ]);
      setBookings(Array.isArray(data) ? data : []);
      if (me) {
        setProfileUser(me);
      }
      setChatThreads(Array.isArray(threads) ? threads : []);
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

  useEffect(() => {
    setProfileUser(user || null);
  }, [user]);

  const formatTime = (isoStr) => {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    return `${d.toLocaleDateString('vi-VN')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount) => {
    const num = Number(amount || 0);
    return `${new Intl.NumberFormat('vi-VN').format(num)} đ`;
  };

  const customerFullName = (profileUser?.fullName || '').trim() || 'Khách hàng';
  const customerEmail = (profileUser?.email || '').trim() || '--';
  const customerPhone = (profileUser?.phoneNumber || profileUser?.phone || '').trim() || '--';
  const customerAvatarUrl = resolveStoragePublicUrl(profileUser?.avatarUrl);
  const ratingDriverAvatarUrl = resolveStoragePublicUrl(ratingBooking?.driverAvatarUrl);
  const roleValues = Array.isArray(profileUser?.roles)
    ? profileUser.roles
    : (profileUser?.role ? [profileUser.role] : []);
  const primaryRole = String(roleValues?.[0] || 'CUSTOMER').toUpperCase();
  const roleLabelMap = {
    CUSTOMER: 'Khách hàng',
    DRIVER: 'Tài xế',
    ADMIN: 'Quản trị viên',
  };
  const customerRoleLabel = roleLabelMap[primaryRole] || primaryRole;
  const dobText = profileUser?.dateOfBirth
    ? new Date(profileUser.dateOfBirth).toLocaleDateString('vi-VN')
    : '--';

  const initPersonalForm = (candidate) => {
    const source = candidate || profileUser || user || {};
    setPersonalForm({
      fullName: String(source?.fullName || '').trim(),
      phoneNumber: String(source?.phoneNumber || source?.phone || '').trim(),
      dateOfBirth: String(source?.dateOfBirth || '').trim(),
      gender: String(source?.gender || '').toUpperCase(),
    });
  };

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

  const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const reverseGeocode = async (lat, lng) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(lat),
        lon: String(lng),
        'accept-language': 'vi',
      });
      const response = await fetch(`${REVERSE_GEOCODE_ENDPOINT}?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      return data?.display_name || '';
    } finally {
      clearTimeout(timeout);
    }
  };

  const getActiveTripPoint = (mode = 'pickup') => {
    const points = mode === 'pickup' ? (tripDetail?.pickupPoints || []) : (tripDetail?.dropoffPoints || []);
    const selectedId = mode === 'pickup' ? selectedPickupPointId : selectedDropoffPointId;
    return points.find((p) => p.id === selectedId) || null;
  };

  const toMapCenter = (point) => {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return {
      lat,
      lng,
      wardName: point?.wardName || point?.address || '',
    };
  };

  const applyPickedCoordinate = (mode, coordinate) => {
    const setModeError = mode === 'pickup' ? setPickupMapError : setDropoffMapError;
    const point = getActiveTripPoint(mode);
    if (!point) {
      setModeError(mode === 'pickup' ? 'Vui lòng chọn điểm đón trước.' : 'Vui lòng chọn điểm trả trước.');
      return;
    }

    const center = toMapCenter(point);
    if (!center) {
      setModeError('Điểm phường hiện chưa có tọa độ để hiển thị bản đồ.');
      return;
    }

    const lat = coordinate?.latitude;
    const lng = coordinate?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const distance = calculateDistanceKm(
      center.lat,
      center.lng,
      lat,
      lng,
    );

    if (distance > MAP_PICK_RADIUS_KM) {
      setModeError(`Vị trí chọn phải nằm trong bán kính ${MAP_PICK_RADIUS_KM}km từ phường đã chọn.`);
      return;
    }

    if (mode === 'pickup') {
      setPickupDetailLocation((prev) => ({
        address: String(prev?.address || '').trim() || point?.address || point?.wardName || '',
        lat,
        lng,
      }));
    } else {
      setDropoffDetailLocation((prev) => ({
        address: String(prev?.address || '').trim() || point?.address || point?.wardName || '',
        lat,
        lng,
      }));
    }

    setModeError('');
    setErrorText('');
  };

  const handlePickupMapPress = (event) => {
    applyPickedCoordinate('pickup', event?.nativeEvent?.coordinate);
  };

  const handleDropoffMapPress = (event) => {
    applyPickedCoordinate('dropoff', event?.nativeEvent?.coordinate);
  };

  const handlePickupViewportCenterChange = (center) => {
    applyPickedCoordinate('pickup', { latitude: center?.lat, longitude: center?.lng });
  };

  const handleDropoffViewportCenterChange = (center) => {
    applyPickedCoordinate('dropoff', { latitude: center?.lat, longitude: center?.lng });
  };

  const pickCurrentLocationForMode = (mode) => {
    if (typeof navigator === 'undefined' || !navigator?.geolocation) {
      if (mode === 'pickup') {
        setPickupMapError('Thiết bị/trình duyệt này chưa hỗ trợ lấy vị trí hiện tại.');
      } else {
        setDropoffMapError('Thiết bị/trình duyệt này chưa hỗ trợ lấy vị trí hiện tại.');
      }
      return;
    }

    const setLocating = mode === 'pickup' ? setPickupLocating : setDropoffLocating;
    const setModeError = mode === 'pickup' ? setPickupMapError : setDropoffMapError;

    setLocating(true);
    setModeError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        applyPickedCoordinate(mode, {
          latitude: position?.coords?.latitude,
          longitude: position?.coords?.longitude,
        });
      },
      () => {
        setLocating(false);
        setModeError('Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
  const profileCompletion = Math.min(100, (profileUser?.email ? 35 : 0) + (bookings.length > 0 ? 35 : 0) + (completedBookings.length > 0 ? 30 : 0));
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
  const selectedPickupPoint = getActiveTripPoint('pickup');
  const selectedDropoffPoint = getActiveTripPoint('dropoff');
  const pickupMapCenter = pickupWardCenter;
  const dropoffMapCenter = dropoffWardCenter;
  const pickupDistanceKm = Number.isFinite(pickupDetailLocation?.lat) && Number.isFinite(pickupDetailLocation?.lng) && pickupMapCenter
    ? calculateDistanceKm(pickupMapCenter.lat, pickupMapCenter.lng, pickupDetailLocation.lat, pickupDetailLocation.lng)
    : null;
  const dropoffDistanceKm = Number.isFinite(dropoffDetailLocation?.lat) && Number.isFinite(dropoffDetailLocation?.lng) && dropoffMapCenter
    ? calculateDistanceKm(dropoffMapCenter.lat, dropoffMapCenter.lng, dropoffDetailLocation.lat, dropoffDetailLocation.lng)
    : null;

  useEffect(() => {
    const point = selectedPickupPoint;
    if (!point) {
      setPickupWardCenter(null);
      return;
    }

    const fallback = toMapCenter(point);
    if (fallback) {
      setPickupWardCenter(fallback);
    }

    if (!point.wardId) {
      return;
    }

    const seq = ++pickupWardCenterSeq.current;
    getWardById(point.wardId)
      .then((ward) => {
        if (seq !== pickupWardCenterSeq.current) return;
        const lat = Number(ward?.lat);
        const lng = Number(ward?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return;
        }
        setPickupWardCenter({
          lat,
          lng,
          wardName: ward?.name || point?.wardName || point?.address || '',
        });
      })
      .catch(() => {
        // Keep fallback center when ward lookup fails.
      });
  }, [selectedPickupPointId, tripDetail?.id]);

  useEffect(() => {
    const point = selectedDropoffPoint;
    if (!point) {
      setDropoffWardCenter(null);
      return;
    }

    const fallback = toMapCenter(point);
    if (fallback) {
      setDropoffWardCenter(fallback);
    }

    if (!point.wardId) {
      return;
    }

    const seq = ++dropoffWardCenterSeq.current;
    getWardById(point.wardId)
      .then((ward) => {
        if (seq !== dropoffWardCenterSeq.current) return;
        const lat = Number(ward?.lat);
        const lng = Number(ward?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return;
        }
        setDropoffWardCenter({
          lat,
          lng,
          wardName: ward?.name || point?.wardName || point?.address || '',
        });
      })
      .catch(() => {
        // Keep fallback center when ward lookup fails.
      });
  }, [selectedDropoffPointId, tripDetail?.id]);

  useEffect(() => {
    const lat = pickupDetailLocation?.lat;
    const lng = pickupDetailLocation?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setPickupLiveAddress('');
      setPickupResolving(false);
      return;
    }

    const seq = ++pickupReverseSeq.current;
    setPickupResolving(true);

    const timer = setTimeout(async () => {
      try {
        const address = await reverseGeocode(lat, lng);
        if (seq !== pickupReverseSeq.current) return;
        setPickupLiveAddress(address);
        if (address) {
          setPickupDetailLocation((prev) => {
            if (!prev) return prev;
            if (String(prev.address || '').trim()) return prev;
            return { ...prev, address };
          });
        }
      } catch {
        if (seq !== pickupReverseSeq.current) return;
        setPickupLiveAddress('Không thể tải địa chỉ realtime lúc này.');
      } finally {
        if (seq === pickupReverseSeq.current) {
          setPickupResolving(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [pickupDetailLocation?.lat, pickupDetailLocation?.lng]);

  useEffect(() => {
    const lat = dropoffDetailLocation?.lat;
    const lng = dropoffDetailLocation?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setDropoffLiveAddress('');
      setDropoffResolving(false);
      return;
    }

    const seq = ++dropoffReverseSeq.current;
    setDropoffResolving(true);

    const timer = setTimeout(async () => {
      try {
        const address = await reverseGeocode(lat, lng);
        if (seq !== dropoffReverseSeq.current) return;
        setDropoffLiveAddress(address);
        if (address) {
          setDropoffDetailLocation((prev) => {
            if (!prev) return prev;
            if (String(prev.address || '').trim()) return prev;
            return { ...prev, address };
          });
        }
      } catch {
        if (seq !== dropoffReverseSeq.current) return;
        setDropoffLiveAddress('Không thể tải địa chỉ realtime lúc này.');
      } finally {
        if (seq === dropoffReverseSeq.current) {
          setDropoffResolving(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [dropoffDetailLocation?.lat, dropoffDetailLocation?.lng]);

  const runSearch = async () => {
    setSearchErrorText('');
    setAiSearchHint('');
    setAiIntentChips([]);
    setAiParsedCriteria(null);

    try {
      setSearching(true);
      const allRides = [];
      const maxPages = 100;
      let page = 0;

      while (page < maxPages) {
        const result = await searchRidesAdvanced({
          fromProvinceId: fromProvince?.id,
          toProvinceId: toProvince?.id,
          fromWardId: fromWard?.id,
          toWardId: toWard?.id,
          departureDate: searchDate,
          status: 'OPEN',
          page,
          size: SEARCH_PAGE_SIZE,
        });

        const rides = Array.isArray(result) ? result : [];
        if (!rides.length) break;

        allRides.push(...rides);

        if (rides.length < SEARCH_PAGE_SIZE) break;
        page += 1;
      }

      const byId = new Map();
      allRides.forEach((item) => {
        if (item?.id) byId.set(item.id, item);
      });

      setSearchResults(byId.size ? Array.from(byId.values()) : allRides);
      setSearchPage(0);
      setSearchHasMore(false);
    } catch (e) {
      setSearchErrorText(e.message || 'Không tìm thấy chuyến phù hợp.');
    } finally {
      setSearching(false);
    }
  };

  const loadMoreSearch = async () => {
    if (searching || !searchHasMore) return;

    const nextPage = searchPage + 1;
    try {
      setSearchErrorText('');
      setSearching(true);
      const result = await searchRidesAdvanced({
        fromProvinceId: fromProvince?.id,
        toProvinceId: toProvince?.id,
        fromWardId: fromWard?.id,
        toWardId: toWard?.id,
        departureDate: searchDate,
        status: 'OPEN',
        page: nextPage,
        size: SEARCH_PAGE_SIZE,
      });
      const rides = Array.isArray(result) ? result : [];
      setSearchResults((prev) => {
        const merged = [...prev, ...rides];
        const byId = new Map();
        merged.forEach((item) => {
          if (item?.id) byId.set(item.id, item);
        });
        return byId.size ? Array.from(byId.values()) : merged;
      });
      setSearchPage(nextPage);
      setSearchHasMore(rides.length >= SEARCH_PAGE_SIZE);
    } catch (e) {
      setSearchErrorText(e.message || 'Không thể tải thêm chuyến.');
    } finally {
      setSearching(false);
    }
  };

  const runSearchWithAiCriteria = async (criteria, chips) => {
    if (!criteria) return;

    const active = new Set((chips || []).filter((c) => c?.active !== false).map((c) => c.id));
    const isEnabled = (chipId) => active.has(chipId);

    const request = {
      fromProvinceId: isEnabled('from') ? (criteria?.fromProvinceId || null) : null,
      toProvinceId: isEnabled('to') ? (criteria?.toProvinceId || null) : null,
      fromWardId: isEnabled('from') ? (criteria?.fromWardId || null) : null,
      toWardId: isEnabled('to') ? (criteria?.toWardId || null) : null,
      departureDate: isEnabled('date') ? (criteria?.departureDate || null) : null,
    };

    try {
      setSearching(true);
      setSearchErrorText('');
      const result = await searchRidesAdvanced(request);
      let rides = Array.isArray(result) ? result : [];

      if (isEnabled('seat') && criteria?.seatCount) {
        const wantedSeats = Number(criteria.seatCount);
        rides = rides.filter((r) => Number(r?.availableSeats || 0) >= wantedSeats);
      }

      if (isEnabled('price') && criteria?.maxPrice) {
        const ceiling = Number(criteria.maxPrice);
        rides = rides.filter((r) => Number(r?.price || 0) <= ceiling);
      }

      setSearchResults(rides);
    } catch (e) {
      setSearchErrorText(e.message || 'Không thể cập nhật kết quả theo bộ lọc AI.');
    } finally {
      setSearching(false);
    }
  };

  const toggleAiChip = async (chipId) => {
    if (!aiParsedCriteria || searching || aiSearching) return;

    const nextChips = aiIntentChips.map((chip) => (
      chip.id === chipId
        ? { ...chip, active: chip.active === false }
        : chip
    ));

    setAiIntentChips(nextChips);
    await runSearchWithAiCriteria(aiParsedCriteria, nextChips);
  };

  const runAiSearchFromText = async () => {
    const query = String(aiSearchText || '').trim();
    if (!query || aiSearching) {
      return;
    }

    try {
      setAiSearching(true);
      setSearchErrorText('');
      const result = await searchRidesFromText(query);

      const criteria = result?.criteria || {};
      setAiParsedCriteria(criteria);
      if (criteria?.fromProvinceId || criteria?.fromProvinceName) {
        setFromProvince({ id: criteria.fromProvinceId || null, name: criteria.fromProvinceName || 'Điểm đón' });
      }
      if (criteria?.toProvinceId || criteria?.toProvinceName) {
        setToProvince({ id: criteria.toProvinceId || null, name: criteria.toProvinceName || 'Điểm đến' });
      }
      if (criteria?.fromWardId || criteria?.fromWardName) {
        setFromWard({ id: criteria.fromWardId || null, name: criteria.fromWardName || 'Phường/xã đón' });
      }
      if (criteria?.toWardId || criteria?.toWardName) {
        setToWard({ id: criteria.toWardId || null, name: criteria.toWardName || 'Phường/xã đến' });
      }
      if (criteria?.departureDate) {
        setSearchDate(criteria.departureDate);
      }

      const chips = [];
      const formatCompactCurrency = (amount) => {
        const value = Number(amount || 0);
        if (!Number.isFinite(value) || value <= 0) return null;
        return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
      };
      const toDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const todayIso = toDateKey(new Date());
      const tomorrowIso = toDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));

      if (criteria?.fromWardName || criteria?.fromProvinceName) {
        chips.push({
          id: 'from',
          label: `Từ ${criteria.fromWardName || criteria.fromProvinceName}`,
          active: true,
        });
      }
      if (criteria?.toWardName || criteria?.toProvinceName) {
        chips.push({
          id: 'to',
          label: `Đến ${criteria.toWardName || criteria.toProvinceName}`,
          active: true,
        });
      }
      if (criteria?.departureDate) {
        const dateLabel = criteria.departureDate === todayIso
          ? 'Hôm nay'
          : (criteria.departureDate === tomorrowIso ? 'Ngày mai' : criteria.departureDate);
        chips.push({ id: 'date', label: dateLabel, active: true });
      }
      if (criteria?.seatCount) {
        chips.push({ id: 'seat', label: `${criteria.seatCount} ghế`, active: true });
      }
      if (criteria?.maxPrice) {
        const priceText = formatCompactCurrency(criteria.maxPrice);
        if (priceText) {
          chips.push({ id: 'price', label: `Dưới ${priceText}`, active: true });
        }
      }
      setAiIntentChips(chips);

      setSearchResults(Array.isArray(result?.rides) ? result.rides : []);

      const questions = Array.isArray(result?.clarificationQuestions)
        ? result.clarificationQuestions.filter(Boolean)
        : [];
      if (result?.needsClarification && questions.length) {
        setAiSearchHint(`AI cần làm rõ: ${questions.join(' ')} (Bạn có thể bấm chips để bật/tắt lọc)`);
      } else {
        const confidenceValue = Number(result?.confidence || 0);
        const confidencePercent = Number.isFinite(confidenceValue) ? Math.round(confidenceValue * 100) : 0;
        setAiSearchHint(`AI đã phân tích yêu cầu với độ tin cậy ${confidencePercent}%. (Bấm chips để lọc nhanh)`);
      }
    } catch (e) {
      setSearchErrorText(e.message || 'AI chưa phân tích được yêu cầu. Bạn thử viết rõ tuyến và ngày đi hơn nhé.');
    } finally {
      setAiSearching(false);
    }
  };

  const openTripDetail = (trip) => {
    const firstPickup = trip.pickupPoints?.[0]?.id || null;
    const firstDropoff = trip.dropoffPoints?.[0]?.id || null;
    setSelectedPickupPointId(firstPickup);
    setSelectedDropoffPointId(firstDropoff);
    setSeatCount(1);
    setPaymentMethod('CASH');
    setPickupDetailLocation({ address: '', lat: null, lng: null });
    setDropoffDetailLocation({ address: '', lat: null, lng: null });
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
    setRatingAvatarFailed(false);
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

    const selectedPickupPoint = (tripDetail?.pickupPoints || []).find((p) => p.id === selectedPickupPointId) || null;
    const selectedDropoffPoint = (tripDetail?.dropoffPoints || []).find((p) => p.id === selectedDropoffPointId) || null;

    try {
      setBookingSubmitting(true);
      const created = await bookRide({
        tripId: tripDetail.id,
        pickupPointId: selectedPickupPointId,
        dropoffPointId: selectedDropoffPointId,
        seatCount,
        paymentMethod,
        pickupAddress: String(pickupDetailLocation?.address || '').trim() || selectedPickupPoint?.address || selectedPickupPoint?.wardName || null,
        pickupLat: pickupDetailLocation?.lat,
        pickupLng: pickupDetailLocation?.lng,
        dropoffAddress: String(dropoffDetailLocation?.address || '').trim() || selectedDropoffPoint?.address || selectedDropoffPoint?.wardName || null,
        dropoffLat: dropoffDetailLocation?.lat,
        dropoffLng: dropoffDetailLocation?.lng,
      });

      setTripDetail(null);
      setSelectedPickupPointId(null);
      setSelectedDropoffPointId(null);
      setPickupDetailLocation({ address: '', lat: null, lng: null });
      setDropoffDetailLocation({ address: '', lat: null, lng: null });
      setSeatCount(1);
      await loadData();
      await runSearch();

      const successTitle = paymentMethod === 'VNPAY'
        ? 'Đặt chỗ thành công'
        : 'Đặt chỗ thành công';
      const successMessage = paymentMethod === 'VNPAY'
        ? 'Bạn đã giữ chỗ thành công. Vui lòng thanh toán VNPAY để hoàn tất xác nhận.'
        : 'Chuyến đi của bạn đã được ghi nhận. Tài xế sẽ đón bạn theo điểm đã chọn.';

      setBookingSuccessModal({
        visible: true,
        title: successTitle,
        message: successMessage,
      });

      if (paymentMethod === 'VNPAY') {
        const paymentUrl = created?.paymentUrl;
        if (paymentUrl) {
          await openVnpayUrl(paymentUrl);
          setErrorText('Đã mở VNPAY. Khi thanh toán xong, trạng thái sẽ tự cập nhật.');
        } else {
          setErrorText('Đặt chỗ thành công nhưng chưa tạo được link VNPAY. Bạn có thể mở lại trong Chi tiết đặt chỗ.');
        }
      }
    } catch (e) {
      setErrorText(e.message || 'Đặt chỗ thất bại.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const isAwaitingVnpay = (booking) => {
    if (!booking) return false;
    return booking.status === 'pending'
      && String(booking.paymentMethod || '').toUpperCase() === 'VNPAY'
      && String(booking.paymentStatus || '').toUpperCase() === 'UNPAID';
  };

  const openVnpayUrl = async (paymentUrl) => {
    if (!paymentUrl) {
      throw new Error('Thiếu link thanh toán VNPAY.');
    }

    const supported = await Linking.canOpenURL(paymentUrl);
    if (!supported) {
      throw new Error('Không thể mở cổng thanh toán VNPAY trên thiết bị này.');
    }

    await Linking.openURL(paymentUrl);
  };

  const submitVnpayPayment = async () => {
    if (!bookingDetail?.id) return;

    try {
      setPaymentConfirmSubmitting(true);
      const response = await createVnpayPaymentUrl(bookingDetail.id);
      const paymentUrl = response?.paymentUrl;
      if (!paymentUrl) {
        throw new Error('Không tạo được link thanh toán VNPAY.');
      }

      await openVnpayUrl(paymentUrl);
      setErrorText('Đã mở VNPAY. Khi thanh toán xong, trạng thái sẽ tự cập nhật.');
    } catch (e) {
      setErrorText(e.message || 'Mở thanh toán VNPAY thất bại.');
    } finally {
      setPaymentConfirmSubmitting(false);
    }
  };

  const submitSupportMessage = async (overrideMessage) => {
    const message = String(overrideMessage ?? supportInput ?? '').trim();
    if (!message || supportSending) return;

    const userMessage = { id: `user-${Date.now()}`, role: 'user', text: message };
    const pendingBotId = `bot-pending-${Date.now()}`;
    const historyPayload = [...supportMessages, userMessage]
      .slice(-5)
      .map((item) => ({
        role: item?.role === 'bot' ? 'assistant' : 'user',
        text: String(item?.text || '').trim(),
      }))
      .filter((item) => item.text);

    setSupportMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: pendingBotId,
        role: 'bot',
        intent: 'FAQ_GENERAL',
        text: '⏳ Mình đang xử lý yêu cầu của bạn... ',
        suggestions: [],
      },
    ]);
    if (overrideMessage === undefined) {
      setSupportInput('');
    }

    try {
      setSupportSending(true);
      const result = await supportChat(message, historyPayload);
      const replyText = result?.reply || 'Mình chưa có phản hồi phù hợp, bạn thử hỏi lại giúp mình.';
      const suggestions = Array.isArray(result?.suggestions) ? result.suggestions.filter(Boolean) : [];
      setSupportMessages((prev) => prev.map((item) => (
        item.id === pendingBotId
          ? {
            id: `bot-${Date.now()}`,
            role: 'bot',
            intent: String(result?.intent || 'FAQ_GENERAL').toUpperCase(),
            text: replyText,
            suggestions: suggestions.slice(0, 6),
          }
          : item
      )));
    } catch (e) {
      setSupportMessages((prev) => prev.map((item) => (
        item.id === pendingBotId
          ? {
            id: `bot-${Date.now()}`,
            role: 'bot',
            intent: 'FAQ_APP_ISSUE',
            text: e.message || '😵 Oops, mình đang hơi nghẽn mạng. Bạn thử lại sau vài giây nhé!',
            suggestions: ['Kiểm tra booking gần nhất', 'Tôi muốn hủy chuyến', 'Gọi hotline 1900 1234'],
          }
          : item
      )));
    } finally {
      setSupportSending(false);
    }
  };

  const getSupportIntentMeta = (intent) => SUPPORT_INTENT_META[String(intent || '').toUpperCase()] || SUPPORT_INTENT_META.FAQ_GENERAL;

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
    setRefreshing(true);
    loadData();
  };

  const openAccount = () => {
    setActiveFooterTab('account');
  };

  const openPersonalInfo = () => {
    setAccountAvatarFailed(false);
    initPersonalForm();
    setShowPersonalInfo(true);
  };

  const onChangePersonalField = (field, value) => {
    setPersonalForm((prev) => ({ ...prev, [field]: value }));
  };

  const savePersonalInfo = async () => {
    try {
      setProfileSubmitting(true);
      const payload = {
        fullName: String(personalForm.fullName || '').trim(),
        phoneNumber: String(personalForm.phoneNumber || '').trim(),
        dateOfBirth: String(personalForm.dateOfBirth || '').trim() || null,
        gender: String(personalForm.gender || '').trim() || null,
      };
      const updated = await updateMyInfo(payload);
      if (updated) {
        setProfileUser(updated);
        initPersonalForm(updated);
      }
      setErrorText('Cập nhật thông tin cá nhân thành công.');
      Alert.alert('Thành công', 'Thông tin cá nhân đã được cập nhật.');
    } catch (e) {
      Alert.alert('Không thể cập nhật', e?.message || 'Vui lòng thử lại sau.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const pickAndUploadAvatar = async () => {
    if (avatarUploading) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Thiếu quyền truy cập', 'Vui lòng cấp quyền thư viện ảnh để đổi avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) return;

      const selected = result.assets[0];
      setAvatarUploading(true);

      const updated = await updateMyAvatar({
        uri: selected.uri,
        name: selected.fileName || `customer-avatar-${Date.now()}.jpg`,
        type: selected.mimeType || 'image/jpeg',
      });

      if (updated) {
        setProfileUser(updated);
        initPersonalForm(updated);
      }
      setAccountAvatarFailed(false);
      Alert.alert('Thành công', 'Avatar đã được cập nhật.');
    } catch (e) {
      Alert.alert('Không thể đổi avatar', e?.message || 'Vui lòng thử lại.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const openChangePasswordModal = () => {
    setPasswordForm({ currentPassword: '', otp: '', newPassword: '', confirmPassword: '' });
    setShowChangePasswordModal(true);
  };

  const sendPasswordOtp = async () => {
    const currentPassword = String(passwordForm.currentPassword || '').trim();
    if (!currentPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mật khẩu hiện tại để nhận OTP.');
      return;
    }

    try {
      setOtpSending(true);
      await requestChangePasswordOtp(currentPassword);
      Alert.alert('Đã gửi OTP', 'OTP đã được gửi về email của bạn.');
    } catch (e) {
      Alert.alert('Không thể gửi OTP', e?.message || 'Vui lòng thử lại sau.');
    } finally {
      setOtpSending(false);
    }
  };

  const submitPasswordChange = async () => {
    const otp = String(passwordForm.otp || '').trim();
    const newPassword = String(passwordForm.newPassword || '').trim();
    const confirmPassword = String(passwordForm.confirmPassword || '').trim();

    if (!otp || !newPassword || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập OTP và mật khẩu mới đầy đủ.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu mới cần tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Không khớp mật khẩu', 'Mật khẩu xác nhận chưa trùng khớp.');
      return;
    }

    try {
      setPasswordSubmitting(true);
      await changeMyPassword({ otp, newPassword });
      setShowChangePasswordModal(false);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại nếu hệ thống yêu cầu.');
    } catch (e) {
      Alert.alert('Đổi mật khẩu thất bại', e?.message || 'Vui lòng kiểm tra OTP và thử lại.');
    } finally {
      setPasswordSubmitting(false);
    }
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

  const appendChatMessageIfNotExists = (incoming) => {
    if (!incoming?.id) return;
    const normalizedIncoming = normalizeCustomerMessage(incoming);
    setChatMessages((prev) => {
      const existed = prev.some((item) => item?.id === normalizedIncoming.id);
      if (existed) return prev;
      return [...prev, normalizedIncoming];
    });
  };

  const stopChatRealtime = () => {
    chatRealtimeRef.current?.disconnect?.();
    chatRealtimeRef.current = null;
  };

  const startChatRealtime = (threadId) => {
    if (!threadId) return;
    stopChatRealtime();
    chatRealtimeRef.current = createChatRealtimeClient({
      threadId,
      onMessage: (incoming) => {
        appendChatMessageIfNotExists(incoming);
      },
    });
  };

  const openChatForBooking = async (booking) => {
    if (!booking?.id) return;
    if (!canChatBooking(booking)) {
      setErrorText('Chỉ có thể chat khi đặt chỗ thành công và trước khi chuyến kết thúc.');
      return;
    }

    try {
      setChatVisible(true);
      setChatLoading(true);
      setChatThread(null);
      setChatMessages([]);
      const thread = await openChatThread(booking.id);
      const messages = await getChatMessages(thread.id, 100);
      setChatThread(thread);
      setChatMessages(Array.isArray(messages) ? messages.map(normalizeCustomerMessage) : []);
      setChatDraft('');
      startChatRealtime(thread.id);
      await markChatThreadRead(thread.id).catch(() => { });
      const threads = await getMyChatThreads().catch(() => []);
      setChatThreads(Array.isArray(threads) ? threads : []);
    } catch (e) {
      setErrorText(e.message || 'Không thể mở cuộc trò chuyện.');
      Alert.alert('Không thể mở chat', e?.message || 'Vui lòng kiểm tra lại kết nối backend/MongoDB.');
      setChatVisible(false);
    } finally {
      setChatLoading(false);
    }
  };

  const openChatByThread = async (thread) => {
    if (!thread?.id) return;
    try {
      setChatVisible(true);
      setChatLoading(true);
      setChatThread(thread);
      setChatMessages([]);
      const messages = await getChatMessages(thread.id, 100);
      setChatMessages(Array.isArray(messages) ? messages.map(normalizeCustomerMessage) : []);
      setChatDraft('');
      startChatRealtime(thread.id);
      await markChatThreadRead(thread.id).catch(() => { });
      const threads = await getMyChatThreads().catch(() => []);
      setChatThreads(Array.isArray(threads) ? threads : []);
    } catch (e) {
      setErrorText(e.message || 'Không thể tải tin nhắn.');
      Alert.alert('Không thể tải chat', e?.message || 'Vui lòng thử lại sau.');
      setChatVisible(false);
    } finally {
      setChatLoading(false);
    }
  };

  const closeChatModal = () => {
    stopChatRealtime();
    setChatVisible(false);
    setChatDraft('');
    setChatThread(null);
    setChatMessages([]);
  };

  const submitChatMessage = async () => {
    if (!chatThread?.id || !chatDraft.trim() || chatSending) {
      return;
    }
    try {
      setChatSending(true);
      const sent = await sendChatMessage(chatThread.id, chatDraft.trim());
      appendChatMessageIfNotExists(sent);
      setChatDraft('');
      const threads = await getMyChatThreads().catch(() => []);
      setChatThreads(Array.isArray(threads) ? threads : []);
    } catch (e) {
      setErrorText(e.message || 'Không thể gửi tin nhắn.');
    } finally {
      setChatSending(false);
    }
  };

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const toIsoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseIsoDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return new Date();
    const parsed = new Date(`${raw}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };
  const stripTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const isSameDay = (a, b) => a.getTime() === b.getTime();
  const addMonths = (baseDate, diff) => new Date(baseDate.getFullYear(), baseDate.getMonth() + diff, 1);

  const formatSearchDateLabel = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'Chọn ngày khởi hành';
    const parsed = parseIsoDate(raw);
    return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
  };

  const monthLabelFormatter = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  });

  const calendarDays = useMemo(() => {
    const year = searchCalendarMonth.getFullYear();
    const month = searchCalendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const leadingDays = (firstOfMonth.getDay() + 6) % 7;
    const firstCellDate = new Date(year, month, 1 - leadingDays);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCellDate.getFullYear(), firstCellDate.getMonth(), firstCellDate.getDate() + index);
      return {
        date,
        iso: toIsoDate(date),
        inCurrentMonth: date.getMonth() === month,
      };
    });
  }, [searchCalendarMonth]);

  const openSearchDatePicker = () => {
    if (!showSearchDatePicker) {
      setSearchCalendarMonth(searchDate ? parseIsoDate(searchDate) : new Date());
    }
    setShowSearchDatePicker((prev) => !prev);
  };

  const selectSearchDate = (iso) => {
    setSearchDate(String(iso || '').trim());
    setShowSearchDatePicker(false);
  };

  const clearSearchDate = () => {
    setSearchDate('');
    setShowSearchDatePicker(false);
  };

  const refreshChatMessages = async (threadId) => {
    if (!threadId) return;
    try {
      const messages = await getChatMessages(threadId, 100);
      setChatMessages(Array.isArray(messages) ? messages.map(normalizeCustomerMessage) : []);
    } catch {
      // Keep chat UI stable if fallback sync fails momentarily.
    }
  };

  useEffect(() => {
    return () => {
      stopChatRealtime();
    };
  }, []);

  useEffect(() => {
    if (!chatVisible || !chatThread?.id) return undefined;

    const syncId = setInterval(() => {
      refreshChatMessages(chatThread.id);
    }, 1500);

    return () => clearInterval(syncId);
  }, [chatVisible, chatThread?.id]);

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

              <View style={[styles.statsRow, { gap: isSmallPhone ? 8 : 10 }]}>
                <View style={[styles.statCard, { paddingVertical: isSmallPhone ? 9 : 11 }]}>
                  <Ionicons name="car-sport-outline" size={18} color="#00B14F" />
                  <Text style={[styles.statValue, { fontSize: isSmallPhone ? 16 : 18 }]}>{searchResults.length}</Text>
                  <Text style={styles.statLabel}>Chuyến đang mở</Text>
                </View>
                <View style={[styles.statCard, { paddingVertical: isSmallPhone ? 9 : 11 }]}>
                  <Ionicons name="receipt-outline" size={18} color="#00B14F" />
                  <Text style={[styles.statValue, { fontSize: isSmallPhone ? 16 : 18 }]}>{bookings.length}</Text>
                  <Text style={styles.statLabel}>Lượt đã đặt</Text>
                </View>
                <View style={[styles.statCard, { paddingVertical: isSmallPhone ? 9 : 11 }]}>
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

            <TouchableOpacity
              style={[styles.dateInputWrap, showSearchDatePicker && styles.dateInputWrapActive]}
              onPress={openSearchDatePicker}
              activeOpacity={0.9}
            >
              <Ionicons name="calendar-outline" size={16} color="#64748B" />
              <Text style={[styles.dateInput, !searchDate && styles.dateInputPlaceholder]}>
                {formatSearchDateLabel(searchDate)}
              </Text>
              <Ionicons name={showSearchDatePicker ? 'chevron-up' : 'chevron-down'} size={16} color="#16A34A" />
            </TouchableOpacity>

            {showSearchDatePicker ? (
              <View style={styles.calendarDropdown}>
                <View style={styles.calendarHeaderRow}>
                  <TouchableOpacity
                    style={styles.calendarNavBtn}
                    onPress={() => setSearchCalendarMonth((prev) => addMonths(prev, -1))}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chevron-back" size={16} color="#0F172A" />
                  </TouchableOpacity>
                  <Text style={styles.calendarMonthLabel}>{monthLabelFormatter.format(searchCalendarMonth)}</Text>
                  <TouchableOpacity
                    style={styles.calendarNavBtn}
                    onPress={() => setSearchCalendarMonth((prev) => addMonths(prev, 1))}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chevron-forward" size={16} color="#0F172A" />
                  </TouchableOpacity>
                </View>

                <View style={styles.calendarWeekRow}>
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((dayLabel) => (
                    <Text key={dayLabel} style={styles.calendarWeekLabel}>{dayLabel}</Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarDays.map((item) => {
                    const dayDate = stripTime(item.date);
                    const isToday = isSameDay(dayDate, stripTime(today));
                    const isSelected = !!searchDate && item.iso === searchDate;
                    return (
                      <TouchableOpacity
                        key={item.iso}
                        style={[
                          styles.calendarDayCell,
                          !item.inCurrentMonth && styles.calendarDayCellMuted,
                          isToday && styles.calendarDayCellToday,
                          isSelected && styles.calendarDayCellSelected,
                        ]}
                        onPress={() => selectSearchDate(item.iso)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            !item.inCurrentMonth && styles.calendarDayTextMuted,
                            isToday && styles.calendarDayTextToday,
                            isSelected && styles.calendarDayTextSelected,
                          ]}
                        >
                          {item.date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.quickDateRow}>
              <TouchableOpacity style={styles.quickDateBtn} onPress={clearSearchDate}>
                <Text style={styles.quickDateText}>Tất cả ngày</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickDateBtn} onPress={() => selectSearchDate(toIsoDate(today))}>
                <Text style={styles.quickDateText}>Hôm nay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickDateBtn} onPress={() => selectSearchDate(toIsoDate(tomorrow))}>
                <Text style={styles.quickDateText}>Ngày mai</Text>
              </TouchableOpacity>
            </View>

              <Text style={styles.aiInputLabel}>Dán mô tả chuyến đi bằng AI</Text>
              <TextInput
                style={styles.aiSearchInput}
                value={aiSearchText}
                onChangeText={setAiSearchText}
                placeholder="Ví dụ: Mai 7h từ Mỹ Đình đi Hải Phòng, 2 ghế, dưới 200k"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.aiSearchBtn} onPress={runAiSearchFromText} disabled={aiSearching}>
                <Ionicons name="sparkles-outline" size={16} color="#008A3E" />
                <Text style={styles.aiSearchBtnText}>{aiSearching ? 'AI đang phân tích...' : 'Phân tích và tìm chuyến bằng AI'}</Text>
              </TouchableOpacity>

              {!!aiSearchHint && <Text style={styles.aiSearchHint}>{aiSearchHint}</Text>}

              {aiIntentChips.length > 0 && (
                <View style={styles.aiChipWrap}>
                  {aiIntentChips.map((chip) => (
                    <TouchableOpacity
                      key={chip.id}
                      style={[styles.aiChip, chip.active === false && styles.aiChipInactive]}
                      activeOpacity={0.9}
                      onPress={() => toggleAiChip(chip.id)}
                    >
                      <Text style={[styles.aiChipText, chip.active === false && styles.aiChipTextInactive]}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.searchBtn} onPress={runSearch} disabled={searching}>
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.searchBtnText}>{searching ? 'Đang tìm...' : 'Tìm chuyến ngay'}</Text>
              </TouchableOpacity>

              {!!searchErrorText && <Text style={styles.errorText}>{searchErrorText}</Text>}
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
            <>
              {searchResults.map((trip) => (
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
              ))}

              {searchHasMore ? (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreSearch} disabled={searching}>
                  <Text style={styles.loadMoreBtnText}>{searching ? 'Đang tải thêm...' : 'Xem thêm chuyến'}</Text>
                </TouchableOpacity>
              ) : null}
            </>
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
                  canChat={canChatBooking(booking)}
                  showChat={['pending', 'confirmed', 'in_progress'].includes(String(booking?.status || '').toLowerCase())}
                  onChat={() => openChatForBooking(booking)}
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
            <TouchableOpacity style={styles.accountAvatarWrapLarge} onPress={openPersonalInfo} activeOpacity={0.9}>
              {customerAvatarUrl && !accountAvatarFailed ? (
                <Image
                  source={{ uri: customerAvatarUrl }}
                  style={styles.accountAvatarImageLarge}
                  onError={() => setAccountAvatarFailed(true)}
                />
              ) : (
                <Ionicons name="person" size={34} color="#0F172A" />
              )}
            </TouchableOpacity>
            <Text style={styles.accountPageName}>{customerFullName}</Text>
            <Text style={styles.accountPageEmail}>{customerEmail}</Text>
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
              <TouchableOpacity style={styles.quickCard} activeOpacity={0.9} onPress={openPersonalInfo}>
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

            <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.9} onPress={openPersonalInfo}>
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
                  {SUPPORT_QUICK_ACTIONS.map((question) => (
                    <TouchableOpacity key={question} style={styles.supportQuickBtn} onPress={() => submitSupportMessage(question)}>
                      <Text style={styles.supportQuickText}>{question}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.supportMessagesWrap}>
                  {supportMessages.slice(-6).map((m) => (
                    <View key={m.id} style={[styles.supportBubble, m.role === 'user' ? styles.supportBubbleUser : styles.supportBubbleBot]}>
                      {m.role === 'bot' && (
                        <View style={styles.supportBotTagRow}>
                          <Ionicons name={getSupportIntentMeta(m.intent).icon} size={12} color={getSupportIntentMeta(m.intent).color} />
                          <Text style={[styles.supportBotTagText, { color: getSupportIntentMeta(m.intent).color }]}>
                            {getSupportIntentMeta(m.intent).title}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.supportBubbleText, m.role === 'user' && styles.supportBubbleTextUser]}>{m.text}</Text>

                      {m.role === 'bot' && Array.isArray(m.suggestions) && m.suggestions.length > 0 && (
                        <View style={styles.supportSuggestRow}>
                          {m.suggestions.slice(0, 4).map((s) => (
                            <TouchableOpacity key={`${m.id}-${s}`} style={styles.supportSuggestBtn} onPress={() => submitSupportMessage(s)}>
                              <Text style={styles.supportSuggestText}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
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

                {chatThreads.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>Chưa có hội thoại</Text>
                    <Text style={styles.emptyText}>Khi bạn đặt chuyến, cuộc trò chuyện với tài xế sẽ hiển thị ở đây.</Text>
                  </View>
                ) : (
                  chatThreads.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.messageCard} activeOpacity={0.9} onPress={() => openChatByThread(item)}>
                      <View style={styles.messageAvatar}>
                        <Ionicons name="person" size={17} color="#0F172A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.messageTopRow}>
                          <Text style={styles.messageDriver}>{item.driverUserId || 'Tài xế RideUp'}</Text>
                          <Text style={styles.messageTime}>{formatTime(item.lastMessageAt)}</Text>
                        </View>
                        <Text style={styles.messageRoute}>Booking: {item.bookingId}</Text>
                        <Text style={styles.messagePreview} numberOfLines={2}>{item.lastMessagePreview || 'Bắt đầu cuộc trò chuyện'}</Text>
                      </View>
                      {!!item.myUnreadCount && <View style={styles.unreadDot} />}
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

      <Modal visible={showPersonalInfo} transparent animationType="slide" onRequestClose={() => setShowPersonalInfo(false)}>
        <View style={[styles.modalOverlay, styles.accountOverlay]}>
          <View style={[styles.modalCard, styles.accountSheet]}>
            <View style={styles.accountHandle} />

            <View style={styles.accountHeaderRow}>
              <View style={styles.accountAvatarWrap}>
                {customerAvatarUrl && !accountAvatarFailed ? (
                  <Image
                    source={{ uri: customerAvatarUrl }}
                    style={styles.accountAvatarImage}
                    onError={() => setAccountAvatarFailed(true)}
                  />
                ) : (
                  <Ionicons name="person" size={28} color="#0F172A" />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{customerFullName}</Text>
                <Text style={styles.accountEmail}>{customerEmail}</Text>
              </View>

              <View style={styles.accountRoleChip}>
                <Text style={styles.accountRoleText}>{customerRoleLabel}</Text>
              </View>
            </View>

            <View style={styles.profileActionRow}>
              <TouchableOpacity style={styles.profileActionBtn} onPress={pickAndUploadAvatar} disabled={avatarUploading}>
                <Ionicons name="camera-outline" size={14} color="#0F172A" />
                <Text style={styles.profileActionText}>{avatarUploading ? 'Đang tải...' : 'Đổi avatar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileActionBtn} onPress={openChangePasswordModal}>
                <Ionicons name="lock-closed-outline" size={14} color="#0F172A" />
                <Text style={styles.profileActionText}>Đổi mật khẩu</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfoSection}>
              <View style={styles.profileInfoRow}>
                <Text style={styles.profileInfoLabel}>Họ và tên</Text>
                <TextInput
                  style={styles.profileInfoInput}
                  value={personalForm.fullName}
                  onChangeText={(value) => onChangePersonalField('fullName', value)}
                  placeholder="Nhập họ tên"
                />
              </View>
              <View style={styles.profileInfoRow}>
                <Text style={styles.profileInfoLabel}>Số điện thoại</Text>
                <TextInput
                  style={styles.profileInfoInput}
                  value={personalForm.phoneNumber}
                  onChangeText={(value) => onChangePersonalField('phoneNumber', value)}
                  placeholder="Nhập số điện thoại"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.profileInfoRow}>
                <Text style={styles.profileInfoLabel}>Email</Text>
                <Text style={styles.profileInfoValue}>{customerEmail}</Text>
              </View>
              <View style={styles.profileInfoRow}>
                <Text style={styles.profileInfoLabel}>Ngày sinh</Text>
                <TextInput
                  style={styles.profileInfoInput}
                  value={personalForm.dateOfBirth}
                  onChangeText={(value) => onChangePersonalField('dateOfBirth', value)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.profileInfoRow}>
                <Text style={styles.profileInfoLabel}>Giới tính</Text>
                <View style={styles.genderChipRow}>
                  {[
                    { key: 'MALE', label: 'Nam' },
                    { key: 'FEMALE', label: 'Nữ' },
                    { key: 'OTHER', label: 'Khác' },
                  ].map((g) => {
                    const active = String(personalForm.gender || '').toUpperCase() === g.key;
                    return (
                      <TouchableOpacity
                        key={g.key}
                        style={[styles.genderChip, active && styles.genderChipActive]}
                        onPress={() => onChangePersonalField('gender', g.key)}
                      >
                        <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>{g.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.profileInfoRow}>
                <Text style={styles.profileInfoLabel}>Tổng chuyến</Text>
                <Text style={styles.profileInfoValue}>{bookings.length}</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowPersonalInfo(false)}
              >
                <Text style={styles.cancelBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={savePersonalInfo} disabled={profileSubmitting}>
                <Text style={styles.confirmBtnText}>{profileSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showChangePasswordModal} transparent animationType="fade" onRequestClose={() => setShowChangePasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#00B14F" />
              <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
            </View>

            <Text style={styles.modalSub}>Nhập mật khẩu hiện tại để nhận OTP qua email.</Text>
            <TextInput
              style={styles.profileInfoInputSingle}
              value={passwordForm.currentPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
              secureTextEntry
              placeholder="Mật khẩu hiện tại"
            />
            <TouchableOpacity style={styles.profileActionBtnWide} onPress={sendPasswordOtp} disabled={otpSending}>
              <Ionicons name="mail-open-outline" size={14} color="#0F172A" />
              <Text style={styles.profileActionText}>{otpSending ? 'Đang gửi OTP...' : 'Gửi OTP'}</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.profileInfoInputSingle}
              value={passwordForm.otp}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, otp: value }))}
              placeholder="Nhập mã OTP"
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.profileInfoInputSingle}
              value={passwordForm.newPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
              secureTextEntry
              placeholder="Mật khẩu mới"
            />
            <TextInput
              style={styles.profileInfoInputSingle}
              value={passwordForm.confirmPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
              secureTextEntry
              placeholder="Xác nhận mật khẩu mới"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowChangePasswordModal(false)} disabled={passwordSubmitting}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={submitPasswordChange} disabled={passwordSubmitting}>
                <Text style={styles.confirmBtnText}>{passwordSubmitting ? 'Đang đổi...' : 'Xác nhận'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
        onConfirm={() => { }}
        onConfirmRaw={(items) => setFromWard(items?.[0] || null)}
        title="Chọn quận/huyện điểm đón"
      />
      <WardPicker
        visible={showToWardPicker}
        onClose={() => setShowToWardPicker(false)}
        provinceId={toProvince?.id}
        singleSelect
        selectedNames={toWard?.name ? [toWard.name] : []}
        onConfirm={() => { }}
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
              scrollEnabled={!isMapInteracting}
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
                  onPress={() => {
                    setSelectedPickupPointId(p.id);
                    setPickupDetailLocation({ address: '', lat: null, lng: null });
                    setPickupMapError('');
                  }}
                >
                  <Text style={styles.optionText}>{p.wardName || p.address}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.selectionHint}>
                Điểm đón đã chọn: {(tripDetail?.pickupPoints || []).find((p) => p.id === selectedPickupPointId)?.wardName || '--'}
              </Text>

              {pickupMapCenter ? (
                <View style={styles.mapCardBox}>
                  <View style={styles.mapHeaderRow}>
                    <Text style={styles.mapInlineLabel}>Bản đồ điểm đón</Text>
                    <View style={styles.mapHeaderActions}>
                      <TouchableOpacity
                        style={styles.mapCurrentBtn}
                        onPress={() => pickCurrentLocationForMode('pickup')}
                        disabled={pickupLocating}
                      >
                        <Text style={styles.mapCurrentBtnText}>{pickupLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}</Text>
                      </TouchableOpacity>
                      <View style={styles.mapBadge}><Text style={styles.mapBadgeText}>20km</Text></View>
                    </View>
                  </View>
                  <Text style={styles.mapActionHint}>Kéo hoặc zoom bản đồ, vị trí tại ghim giữa sẽ tự cập nhật như Shopee/Grab.</Text>
                  <RadiusMap
                    key={`pickup-map-${tripDetail?.id || 'trip'}-${selectedPickupPointId || 'none'}`}
                    center={pickupMapCenter}
                    selectedLocation={pickupDetailLocation?.lat != null && pickupDetailLocation?.lng != null
                      ? { lat: pickupDetailLocation.lat, lng: pickupDetailLocation.lng }
                      : null}
                    onPress={handlePickupMapPress}
                    onViewportCenterChange={handlePickupViewportCenterChange}
                    onInteractStart={() => setIsMapInteracting(true)}
                    onInteractEnd={() => setIsMapInteracting(false)}
                    radiusMeters={MAP_PICK_RADIUS_METERS}
                    mode="pickup"
                  />
                  <View style={styles.liveAddressRow}>
                    <Ionicons name="navigate-circle-outline" size={14} color="#1D4ED8" />
                    <Text style={styles.liveAddressText}>
                      {pickupResolving
                        ? 'Đang cập nhật địa chỉ...'
                        : (pickupLiveAddress || 'Kéo map để xem địa chỉ realtime tại tâm ghim')}
                    </Text>
                  </View>
                  {pickupDistanceKm != null && (
                    <Text style={styles.mapMetaText}>
                      Khoảng cách đến tâm phường: {pickupDistanceKm.toFixed(2)} km (tối đa {MAP_PICK_RADIUS_KM} km)
                    </Text>
                  )}
                  {!!pickupMapError && <Text style={styles.mapErrorText}>{pickupMapError}</Text>}
                </View>
              ) : (
                <Text style={styles.mapUnavailableText}>Phường đón chưa có tọa độ để hiển thị bản đồ.</Text>
              )}

              <TextInput
                style={styles.mapAddressInput}
                value={pickupDetailLocation?.address || ''}
                onChangeText={(text) => setPickupDetailLocation((prev) => ({ ...prev, address: text }))}
                placeholder="Địa chỉ đón chi tiết (số nhà, tên đường...)"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />

              {pickupDetailLocation?.lat != null && pickupDetailLocation?.lng != null && (
                <Text style={styles.mapPickedHint}>
                  Đã pin điểm đón: {pickupDetailLocation.address || 'Địa chỉ chi tiết'} ({pickupDetailLocation.lat.toFixed(6)}, {pickupDetailLocation.lng.toFixed(6)})
                </Text>
              )}

              <Text style={styles.inputLabel}>Chọn điểm trả</Text>
              {(tripDetail?.dropoffPoints || []).map((p) => (
                <TouchableOpacity
                  key={`dd-${p.id}`}
                  style={[styles.optionBtn, selectedDropoffPointId === p.id && styles.optionBtnActive]}
                  onPress={() => {
                    setSelectedDropoffPointId(p.id);
                    setDropoffDetailLocation({ address: '', lat: null, lng: null });
                    setDropoffMapError('');
                  }}
                >
                  <Text style={styles.optionText}>{p.wardName || p.address}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.selectionHint}>
                Điểm trả đã chọn: {(tripDetail?.dropoffPoints || []).find((p) => p.id === selectedDropoffPointId)?.wardName || '--'}
              </Text>

              {dropoffMapCenter ? (
                <View style={styles.mapCardBox}>
                  <View style={styles.mapHeaderRow}>
                    <Text style={styles.mapInlineLabel}>Bản đồ điểm trả</Text>
                    <View style={styles.mapHeaderActions}>
                      <TouchableOpacity
                        style={styles.mapCurrentBtn}
                        onPress={() => pickCurrentLocationForMode('dropoff')}
                        disabled={dropoffLocating}
                      >
                        <Text style={styles.mapCurrentBtnText}>{dropoffLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}</Text>
                      </TouchableOpacity>
                      <View style={styles.mapBadge}><Text style={styles.mapBadgeText}>20km</Text></View>
                    </View>
                  </View>
                  <Text style={styles.mapActionHint}>Kéo hoặc zoom bản đồ, vị trí tại ghim giữa sẽ tự cập nhật như Shopee/Grab.</Text>
                  <RadiusMap
                    key={`dropoff-map-${tripDetail?.id || 'trip'}-${selectedDropoffPointId || 'none'}`}
                    center={dropoffMapCenter}
                    selectedLocation={dropoffDetailLocation?.lat != null && dropoffDetailLocation?.lng != null
                      ? { lat: dropoffDetailLocation.lat, lng: dropoffDetailLocation.lng }
                      : null}
                    onPress={handleDropoffMapPress}
                    onViewportCenterChange={handleDropoffViewportCenterChange}
                    onInteractStart={() => setIsMapInteracting(true)}
                    onInteractEnd={() => setIsMapInteracting(false)}
                    radiusMeters={MAP_PICK_RADIUS_METERS}
                    mode="dropoff"
                  />
                  <View style={styles.liveAddressRow}>
                    <Ionicons name="navigate-circle-outline" size={14} color="#1D4ED8" />
                    <Text style={styles.liveAddressText}>
                      {dropoffResolving
                        ? 'Đang cập nhật địa chỉ...'
                        : (dropoffLiveAddress || 'Kéo map để xem địa chỉ realtime tại tâm ghim')}
                    </Text>
                  </View>
                  {dropoffDistanceKm != null && (
                    <Text style={styles.mapMetaText}>
                      Khoảng cách đến tâm phường: {dropoffDistanceKm.toFixed(2)} km (tối đa {MAP_PICK_RADIUS_KM} km)
                    </Text>
                  )}
                  {!!dropoffMapError && <Text style={styles.mapErrorText}>{dropoffMapError}</Text>}
                </View>
              ) : (
                <Text style={styles.mapUnavailableText}>Phường trả chưa có tọa độ để hiển thị bản đồ.</Text>
              )}

              <TextInput
                style={styles.mapAddressInput}
                value={dropoffDetailLocation?.address || ''}
                onChangeText={(text) => setDropoffDetailLocation((prev) => ({ ...prev, address: text }))}
                placeholder="Địa chỉ trả chi tiết (số nhà, tên đường...)"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />

              {dropoffDetailLocation?.lat != null && dropoffDetailLocation?.lng != null && (
                <Text style={styles.mapPickedHint}>
                  Đã pin điểm trả: {dropoffDetailLocation.address || 'Địa chỉ chi tiết'} ({dropoffDetailLocation.lat.toFixed(6)}, {dropoffDetailLocation.lng.toFixed(6)})
                </Text>
              )}

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
                  style={[styles.paymentBtn, paymentMethod === 'VNPAY' && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod('VNPAY')}
                >
                  <Text style={[styles.paymentText, paymentMethod === 'VNPAY' && styles.paymentTextActive]}>VNPAY</Text>
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

      <Modal
        visible={bookingSuccessModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setBookingSuccessModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>{bookingSuccessModal.title}</Text>
            <Text style={styles.successMessage}>{bookingSuccessModal.message}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => setBookingSuccessModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.confirmBtnText}>Đã hiểu</Text>
              </TouchableOpacity>
            </View>
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
            <Text style={styles.modalSub}>Thanh toán: {bookingDetail?.paymentMethod === 'VNPAY' ? 'VNPAY' : 'Tiền mặt'}</Text>
            <Text style={styles.modalSub}>Trạng thái thanh toán: {bookingDetail?.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Text>

            {isAwaitingVnpay(bookingDetail) && (
              <TouchableOpacity style={styles.payNowBtn} onPress={submitVnpayPayment} disabled={paymentConfirmSubmitting}>
                <Ionicons name="card-outline" size={15} color="#FFFFFF" />
                <Text style={styles.payNowBtnText}>{paymentConfirmSubmitting ? 'Đang mở...' : 'Thanh toán qua VNPAY'}</Text>
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
          <View style={[styles.modalCard, styles.ratingModalCard]}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="star" size={20} color="#00B14F" />
              <Text style={styles.modalTitle}>Đánh giá chuyến đi</Text>
            </View>

            <View style={styles.ratingDriverCard}>
              {ratingDriverAvatarUrl && !ratingAvatarFailed ? (
                <Image
                  source={{ uri: ratingDriverAvatarUrl }}
                  style={styles.ratingDriverAvatar}
                  onError={() => setRatingAvatarFailed(true)}
                />
              ) : (
                <View style={styles.ratingDriverAvatarFallback}>
                  <Ionicons name="person" size={20} color="#475569" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.ratingDriverName}>{ratingBooking?.driverName || '--'}</Text>
                <View style={styles.ratingRouteBadge}>
                  <Ionicons name="navigate-outline" size={12} color="#0F172A" />
                  <Text style={styles.ratingRouteText}>{ratingBooking?.from || '--'} - {ratingBooking?.to || '--'}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.ratingPrompt}>Bạn thấy chuyến đi hôm nay thế nào?</Text>

            <Text style={styles.inputLabel}>Số sao</Text>
            <View style={styles.ratingStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const active = ratingValue >= star;
                return (
                  <TouchableOpacity key={`star-${star}`} onPress={() => setRatingValue(star)} style={[styles.ratingStarBtn, active && styles.ratingStarBtnActive]}>
                    <Ionicons name={active ? 'star' : 'star-outline'} size={26} color={active ? '#F59E0B' : '#94A3B8'} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.ratingSelectedPill}>
              <Text style={styles.ratingSelectedText}>{ratingValue}/5 - {RATING_LABELS[ratingValue]}</Text>
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

      <Modal visible={chatVisible} transparent animationType="fade" onRequestClose={closeChatModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#00B14F" />
              <Text style={styles.modalTitle}>Chat với tài xế</Text>
            </View>
            <Text style={styles.modalSub}>Booking: {chatThread?.bookingId || '--'}</Text>
            <Text style={styles.modalSubHint}>Realtime push đang bật</Text>

            {chatLoading ? (
              <View style={styles.chatLoadingWrap}>
                <ActivityIndicator size="small" color="#00B14F" />
                <Text style={styles.chatLoadingText}>Đang tải tin nhắn...</Text>
              </View>
            ) : (
              <ScrollView
                ref={chatMessagesScrollRef}
                style={styles.chatMessagesList}
                contentContainerStyle={styles.chatMessagesContent}
                onContentSizeChange={() => chatMessagesScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {chatMessages.length === 0 && (
                  <Text style={styles.chatEmptyText}>Chưa có tin nhắn. Hãy bắt đầu trò chuyện.</Text>
                )}
                {chatMessages.map((msg) => (
                  <View key={msg.id} style={[styles.chatBubble, msg.mine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
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
              <TouchableOpacity style={styles.chatSendBtn} onPress={submitChatMessage} disabled={chatSending || !chatDraft.trim()}>
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeChatModal}>
                <Text style={styles.cancelBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </>
  );
};

const BookingCard = ({ booking, formatTime, formatCurrency, onPress, onRate, canChat, showChat, onChat }) => {
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

      {showChat && (
        <View style={styles.bookingActionsRow}>
          <TouchableOpacity style={[styles.bookingChatBtn, !canChat && styles.bookingChatBtnDisabled]} onPress={onChat} disabled={!canChat}>
            <Ionicons name="chatbubble-ellipses" size={14} color="#FFFFFF" />
            <Text style={styles.bookingChatBtnText}>{canChat ? 'Chat với tài xế' : 'Chưa thể chat'}</Text>
          </TouchableOpacity>
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
    borderColor: '#D7E0E8',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 9,
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dateInputWrapActive: {
    borderColor: '#00B14F',
    backgroundColor: '#F0FFF4',
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 6,
    color: COLORS.text,
    backgroundColor: 'transparent',
    fontSize: 12,
  },
  dateInputPlaceholder: {
    color: '#94A3B8',
  },

  calendarDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D7E0E8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarNavBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  calendarMonthLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarWeekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 2,
  },
  calendarDayCellMuted: {
    opacity: 0.42,
  },
  calendarDayCellToday: {
    backgroundColor: '#ECFDF3',
  },
  calendarDayCellSelected: {
    backgroundColor: '#00B14F',
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  calendarDayTextMuted: {
    color: '#94A3B8',
  },
  calendarDayTextToday: {
    color: '#008A3E',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
  },

  quickDateRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quickDateBtn: {
    backgroundColor: '#EDF2F7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  quickDateText: { fontSize: 11, fontWeight: '700', color: '#334155' },

  aiInputLabel: {
    fontSize: 11,
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiSearchInput: {
    borderWidth: 1,
    borderColor: '#D8E2EC',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    minHeight: 74,
    fontSize: 13,
  },
  aiSearchBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#B7E8CA',
    borderRadius: 11,
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  aiSearchBtnText: {
    color: '#008A3E',
    fontWeight: '800',
    fontSize: 13,
  },
  aiSearchHint: {
    marginTop: 8,
    backgroundColor: '#EEF8FF',
    color: '#0F5EA8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  aiChipWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  aiChip: {
    backgroundColor: '#ECFDF3',
    borderColor: '#B7E8CA',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiChipInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  aiChipText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
  aiChipTextInactive: {
    color: '#64748B',
  },

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
  accountAvatarImageLarge: {
    width: 72,
    height: 72,
    borderRadius: 999,
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
  loadMoreBtn: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadMoreBtnText: { color: '#15803D', fontWeight: '800', fontSize: 13 },

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
  bookingActionsRow: { marginTop: 10, alignItems: 'flex-end' },
  bookingChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00B14F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bookingChatBtnDisabled: { backgroundColor: '#94A3B8' },
  bookingChatBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
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
  accountAvatarImage: {
    width: 58,
    height: 58,
    borderRadius: 999,
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
  profileActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  profileActionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileActionBtnWide: {
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileActionText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  profileInfoSection: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FBFCFD',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  profileInfoLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  profileInfoValue: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
    maxWidth: '64%',
    textAlign: 'right',
  },
  profileInfoInput: {
    flex: 1.5,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#0F172A',
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '700',
  },
  profileInfoInputSingle: {
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 10,
    backgroundColor: '#FAFCFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#0F172A',
    fontSize: 13,
    marginTop: 8,
  },
  genderChipRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1.5,
    justifyContent: 'flex-end',
  },
  genderChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  genderChipActive: {
    borderColor: '#00B14F',
    backgroundColor: '#ECFDF3',
  },
  genderChipText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  genderChipTextActive: {
    color: '#008A3E',
  },
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
  supportBotTagRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  supportBotTagText: { fontSize: 10, fontWeight: '800' },
  supportBubbleText: { color: '#0F172A', fontSize: 12, lineHeight: 18 },
  supportBubbleTextUser: { color: '#FFFFFF' },
  supportSuggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  supportSuggestBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7E3EF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  supportSuggestText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
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
  modalSubHint: { color: '#94A3B8', marginBottom: 2, fontSize: 11 },
  chatLoadingWrap: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  chatLoadingText: { marginTop: 8, color: '#64748B', fontSize: 12 },
  chatMessagesList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    maxHeight: 320,
    backgroundColor: '#F8FAFC',
  },
  chatMessagesContent: { padding: 10, gap: 8 },
  chatEmptyText: { color: '#64748B', fontSize: 12, textAlign: 'center', marginVertical: 12 },
  chatBubble: {
    maxWidth: '82%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chatBubbleMine: { alignSelf: 'flex-end', backgroundColor: '#00B14F' },
  chatBubbleOther: { alignSelf: 'flex-start', backgroundColor: '#E2E8F0' },
  chatBubbleText: { color: '#0F172A', fontSize: 13 },
  chatBubbleTextMine: { color: '#FFFFFF' },
  chatBubbleTime: { marginTop: 4, fontSize: 10, color: '#64748B', textAlign: 'right' },
  chatBubbleTimeMine: { color: '#D1FAE5' },
  chatComposerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#0F172A',
    fontSize: 13,
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00B14F',
  },
  successIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00B14F',
    marginBottom: 10,
  },
  successTitle: {
    textAlign: 'center',
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
  },
  successMessage: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
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
  ratingModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  ratingDriverCard: {
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratingDriverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E2E8F0',
  },
  ratingDriverAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingDriverName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  ratingRouteBadge: {
    marginTop: 5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingRouteText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  ratingPrompt: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingStarsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 },
  ratingStarBtn: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  ratingStarBtnActive: {
    backgroundColor: '#FFFBEB',
  },
  ratingSelectedPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F0FDF4',
    marginBottom: 6,
  },
  ratingSelectedText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
  },
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
  mapInlineLabel: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  mapCardBox: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    padding: 10,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mapHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapCurrentBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  mapCurrentBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  mapBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mapBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  mapUnavailableText: {
    marginTop: 2,
    marginBottom: 8,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
  mapActionHint: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  liveAddressRow: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  liveAddressText: {
    flex: 1,
    color: '#1E3A8A',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  mapMetaText: {
    marginTop: 6,
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  mapErrorText: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  mapPickedHint: { marginTop: -2, marginBottom: 8, color: '#0F766E', fontSize: 12, fontWeight: '600' },
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
  mapAddressInput: {
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DCE3EA',
    borderRadius: 10,
    backgroundColor: '#FAFCFF',
    minHeight: 68,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0F172A',
    fontSize: 13,
  },
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
