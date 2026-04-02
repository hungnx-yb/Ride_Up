import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createTrip } from '../../services/api';
import ProvincePicker from '../../components/ProvincePicker';
import WardPicker from '../../components/WardPicker';
import DriverBottomNav, { DRIVER_BOTTOM_NAV_INSET, DRIVER_MAIN_ROUTE } from '../../components/DriverBottomNav';
import { ensureApprovedProfileBeforeCreateTrip } from '../../services/driverProfileGuard';

const THEME = {
  gradientStart: '#00B14F',
  accent: '#00A63E',
};

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

const SeatStepper = ({ value, onChange, min = 1, max = 8 }) => (
  <View style={styles.stepperRow}>
    <TouchableOpacity
      style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
      onPress={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
    >
      <Text style={styles.stepBtnText}>-</Text>
    </TouchableOpacity>
    <View style={styles.stepValue}>
      <Text style={styles.stepValueText}>{value}</Text>
      <Text style={styles.stepUnit}>ghe</Text>
    </View>
    <TouchableOpacity
      style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
      onPress={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
    >
      <Text style={styles.stepBtnText}>+</Text>
    </TouchableOpacity>
  </View>
);

const RevenuePreview = ({ fare, seats }) => {
  const total = fare * seats;
  return (
    <View style={styles.revenueCard}>
      <Text style={styles.revenueLabel}>Doanh thu du kien</Text>
      <Text style={styles.revenueMain}>{total.toLocaleString('vi-VN')} d</Text>
      <Text style={styles.revenueDetail}>
        {fare.toLocaleString('vi-VN')} d x {seats} ghe
      </Text>
    </View>
  );
};

const CreateTripScreen = ({ navigation }) => {
  const [pickupProvince, setPickupProvince] = useState(null);
  const [dropoffProvince, setDropoffProvince] = useState(null);
  const [pickupClusters, setPickupClusters] = useState([]);
  const [dropoffClusters, setDropoffClusters] = useState([]);
  const [fare, setFare] = useState('');

  const [showPickupProvince, setShowPickupProvince] = useState(false);
  const [showDropoffProvince, setShowDropoffProvince] = useState(false);
  const [showPickupWard, setShowPickupWard] = useState(false);
  const [showDropoffWard, setShowDropoffWard] = useState(false);

  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [departureDateTime, setDepartureDateTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [totalSeats, setTotalSeats] = useState(4);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;
  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const verifyApproval = async () => {
      const result = await ensureApprovedProfileBeforeCreateTrip();
      if (!result.allowed && !cancelled) {
        navigation?.replace(DRIVER_MAIN_ROUTE, { screen: 'DriverProfile' });
      }
    };

    const unsubscribe = navigation?.addListener?.('focus', verifyApproval);
    verifyApproval();

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigation]);

  const fareNum = useMemo(() => {
    const parsed = parseInt((fare || '').replace(/\D/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }, [fare]);

  const canSubmit = useMemo(() => {
    return (
      !!pickupProvince &&
      !!dropoffProvince &&
      pickupClusters.length > 0 &&
      dropoffClusters.length > 0 &&
      fareNum >= 1000 &&
      departureDate.trim().length > 0 &&
      departureTime.trim().length > 0
    );
  }, [pickupProvince, dropoffProvince, pickupClusters, dropoffClusters, fareNum, departureDate, departureTime]);

  const formatDateForUi = (date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatTimeForUi = (date) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  };

  const openDatePicker = () => {
    const ref = departureDateTime || new Date();
    setCalendarMonth(new Date(ref.getFullYear(), ref.getMonth(), 1));
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    setShowTimePicker(true);
  };

  const buildCalendarDays = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstWeekday; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const isSameDay = (a, b) => (
    a && b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );

  const isDateDisabled = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < minDate;
  };

  const handleDateSelect = (selectedDate) => {
    if (!selectedDate || isDateDisabled(selectedDate)) {
      return;
    }
    const next = departureDateTime ? new Date(departureDateTime) : new Date();
    next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    setDepartureDateTime(next);
    setDepartureDate(formatDateForUi(next));
    if (!departureTime) {
      setDepartureTime(formatTimeForUi(next));
    }
    setShowDatePicker(false);
  };

  const handleTimeSelect = (timeValue) => {
    const [hh, mm] = timeValue.split(':').map((x) => parseInt(x, 10));
    const next = departureDateTime ? new Date(departureDateTime) : new Date();
    next.setHours(hh, mm, 0, 0);
    setDepartureDateTime(next);
    setDepartureTime(timeValue);
    if (!departureDate) {
      setDepartureDate(formatDateForUi(next));
    }
    setShowTimePicker(false);
  };

  const removeWard = (list, setter, name) => setter(list.filter((w) => w !== name));

  const resetForm = () => {
    setPickupProvince(null);
    setDropoffProvince(null);
    setPickupClusters([]);
    setDropoffClusters([]);
    setFare('');
    setDepartureDate('');
    setDepartureTime('');
    setDepartureDateTime(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setTotalSeats(4);
    setNotes('');
  };

  const playSuccessAnimation = () =>
    new Promise((resolve) => {
      successAnim.setValue(0);
      setShowSuccessOverlay(true);

      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSuccessOverlay(false);
        resolve();
      });
    });

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đủ thông tin tuyến và lịch khởi hành.');
      return;
    }

    setSaving(true);
    try {
      await createTrip({
        pickupProvinceId: pickupProvince.id,
        pickupProvince: pickupProvince.name,
        pickupClusters,
        dropoffProvinceId: dropoffProvince.id,
        dropoffProvince: dropoffProvince.name,
        dropoffClusters,
        fixedFare: fareNum,
        departureDate: departureDate.trim(),
        departureTime: departureTime.trim(),
        totalSeats,
        availableSeats: totalSeats,
        notes: notes.trim(),
        status: 'scheduled',
      });

      await playSuccessAnimation();
      resetForm();
      navigation?.navigate(DRIVER_MAIN_ROUTE, { screen: 'DriverHome' });
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể tạo chuyến');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo chuyến xe</Text>
        <View style={{ width: 36 }} />
      </View>

      <ProvincePicker
        visible={showPickupProvince}
        title="Chọn tỉnh/TP đón"
        requireDb
        onClose={() => setShowPickupProvince(false)}
        onSelect={(p) => {
          setPickupProvince(p);
          setPickupClusters([]);
        }}
      />
      <ProvincePicker
        visible={showDropoffProvince}
        title="Chọn tỉnh/TP trả"
        requireDb
        onClose={() => setShowDropoffProvince(false)}
        onSelect={(p) => {
          setDropoffProvince(p);
          setDropoffClusters([]);
        }}
      />
      <WardPicker
        visible={showPickupWard}
        title="Chọn xã/phường đón"
        provinceId={pickupProvince?.id}
        selectedNames={pickupClusters}
        onClose={() => setShowPickupWard(false)}
        onConfirm={(names) => setPickupClusters(Array.isArray(names) ? names : [])}
      />
      <WardPicker
        visible={showDropoffWard}
        title="Chọn xã/phường trả"
        provinceId={dropoffProvince?.id}
        selectedNames={dropoffClusters}
        onClose={() => setShowDropoffWard(false)}
        onConfirm={(names) => setDropoffClusters(Array.isArray(names) ? names : [])}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>1. Tuyến đường</Text>

          <Text style={styles.inputLabel}>Tỉnh/TP đón *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowPickupProvince(true)}>
            <Text style={styles.selectorText}>{pickupProvince?.name || 'Chọn tỉnh đón'}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Xã/phường đón *</Text>
          <TouchableOpacity
            style={[styles.selector, !pickupProvince && styles.selectorDisabled]}
            onPress={() => setShowPickupWard(true)}
            disabled={!pickupProvince}
          >
            <Text style={styles.selectorText}>
              {pickupProvince ? 'Chọn xã/phường đón' : 'Chọn tỉnh đón trước'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          {pickupClusters.length > 0 && (
            <View style={styles.chipRow}>
              {pickupClusters.map((name) => (
                <View key={name} style={styles.chip}>
                  <Text style={styles.chipText}>{name}</Text>
                  <TouchableOpacity onPress={() => removeWard(pickupClusters, setPickupClusters, name)}>
                    <Text style={styles.chipRemove}>x</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.inputLabel}>Tỉnh/TP trả *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowDropoffProvince(true)}>
            <Text style={styles.selectorText}>{dropoffProvince?.name || 'Chọn tỉnh trả'}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Xã/phường trả *</Text>
          <TouchableOpacity
            style={[styles.selector, !dropoffProvince && styles.selectorDisabled]}
            onPress={() => setShowDropoffWard(true)}
            disabled={!dropoffProvince}
          >
            <Text style={styles.selectorText}>
              {dropoffProvince ? 'Chọn xã/phường trả' : 'Chọn tỉnh trả trước'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          {dropoffClusters.length > 0 && (
            <View style={styles.chipRow}>
              {dropoffClusters.map((name) => (
                <View key={name} style={[styles.chip, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.chipText, { color: '#2E7D32' }]}>{name}</Text>
                  <TouchableOpacity onPress={() => removeWard(dropoffClusters, setDropoffClusters, name)}>
                    <Text style={[styles.chipRemove, { color: '#2E7D32' }]}>x</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.inputLabel}>Giá vé cố định (đ) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: 120000"
            keyboardType="numeric"
            value={fare}
            onChangeText={setFare}
          />

          <Text style={styles.sectionTitle}>2. Lịch khởi hành</Text>
          <View style={styles.dateTimeRow}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Ngày (dd/MM/yyyy) *</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={openDatePicker}
                activeOpacity={0.8}
              >
                <Text style={styles.selectorText}>{departureDate || 'Chọn ngày'}</Text>
                <Ionicons name="calendar-outline" size={16} color="#64748B" style={styles.chevron} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Giờ (HH:MM) *</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={openTimePicker}
                activeOpacity={0.8}
              >
                <Text style={styles.selectorText}>{departureTime || 'Chọn giờ'}</Text>
                <Text style={styles.chevron}>🕒</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>3. Số ghế</Text>
          <SeatStepper value={totalSeats} onChange={setTotalSeats} />

          <Text style={styles.sectionTitle}>4. Ghi chú (tùy chọn)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Ví dụ: Có điều hòa, đón linh hoạt..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {fareNum >= 1000 && <RevenuePreview fare={fareNum} seats={totalSeats} />}

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || saving) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Lưu và tạo chuyến</Text>}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {showSuccessOverlay && (
        <Animated.View style={[styles.successOverlay, { opacity: successAnim }]}>
          <Animated.View
            style={[
              styles.successCard,
              {
                transform: [
                  {
                    scale: successAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.84, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.successBadge,
                {
                  transform: [
                    {
                      scale: successAnim.interpolate({
                        inputRange: [0, 0.6, 1],
                        outputRange: [0.7, 1.12, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.successBadgeText}>✓</Text>
            </Animated.View>
            <Text style={styles.successTitle}>Tạo chuyến thành công</Text>
            <Text style={styles.successSubTitle}>Đang quay về trang chủ tài xế...</Text>
          </Animated.View>
        </Animated.View>
      )}

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                <Text style={styles.pickerNav}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>
                {calendarMonth.getMonth() + 1}/{calendarMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                <Text style={styles.pickerNav}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAY_LABELS.map((w) => (
                <Text key={w} style={styles.weekLabel}>{w}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {buildCalendarDays(calendarMonth).map((d, idx) => {
                if (!d) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const selected = departureDateTime && isSameDay(d, departureDateTime);
                const disabled = isDateDisabled(d);
                return (
                  <TouchableOpacity
                    key={`day-${d.getTime()}`}
                    style={[styles.dayCell, selected && styles.dayCellSelected, disabled && styles.dayCellDisabled]}
                    disabled={disabled}
                    onPress={() => handleDateSelect(d)}
                  >
                    <Text style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.pickerCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={[styles.pickerTitle, { marginBottom: 10 }]}>Chọn giờ khởi hành</Text>
            <ScrollView style={styles.timeList} contentContainerStyle={styles.timeListContent}>
              {TIME_SLOTS.map((timeValue) => (
                <TouchableOpacity
                  key={timeValue}
                  style={[styles.timeItem, departureTime === timeValue && styles.timeItemSelected]}
                  onPress={() => handleTimeSelect(timeValue)}
                >
                  <Text style={[styles.timeItemText, departureTime === timeValue && styles.timeItemTextSelected]}>{timeValue}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => setShowTimePicker(false)}>
              <Text style={styles.pickerCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DriverBottomNav navigation={navigation} activeKey="create" />
    </View>
  );
};

export default CreateTripScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  header: {
    backgroundColor: THEME.gradientStart,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  backIcon: { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '300' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },

  body: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#333', marginTop: 18, marginBottom: 8 },

  inputWrapper: {},
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#333',
  },
  notesInput: { height: 80, textAlignVertical: 'top' },

  selector: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorDisabled: { opacity: 0.6 },
  selectorText: { color: '#333', fontSize: 14 },
  chevron: { color: '#999', fontSize: 20 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderRadius: 16,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 8,
    backgroundColor: '#FFF3E0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: '#00B14F' },
  chipRemove: { fontSize: 11, fontWeight: '800', color: '#00B14F' },

  dateTimeRow: { flexDirection: 'row' },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFF3E0',
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnDisabled: { backgroundColor: '#E0E0E0' },
  stepBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  stepValue: { flex: 1, alignItems: 'center' },
  stepValueText: { fontSize: 32, fontWeight: '800', color: '#333' },
  stepUnit: { fontSize: 13, color: '#777', marginTop: -4 },

  revenueCard: {
    backgroundColor: THEME.gradientStart,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  revenueLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  revenueMain: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 0.5 },
  revenueDetail: { color: '#FFE0B2', fontSize: 13, marginTop: 4 },

  submitBtn: {
    backgroundColor: THEME.gradientStart,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: THEME.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,20,20,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  successBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successBadgeText: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 32 },
  successTitle: { fontSize: 18, fontWeight: '800', color: '#1E1E1E' },
  successSubTitle: { fontSize: 13, color: '#666', marginTop: 6 },

  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerNav: { fontSize: 24, color: THEME.gradientStart, paddingHorizontal: 8 },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: '#333', textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekLabel: {
    width: '14.285%',
    textAlign: 'center',
    color: '#777',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dayCellSelected: { backgroundColor: '#FFE0B2' },
  dayCellDisabled: { opacity: 0.35 },
  dayText: { color: '#333', fontWeight: '600' },
  dayTextSelected: { color: THEME.gradientStart, fontWeight: '800' },
  dayTextDisabled: { color: '#999' },
  pickerCloseBtn: {
    marginTop: 12,
    backgroundColor: THEME.gradientStart,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerCloseText: { color: '#fff', fontWeight: '700' },
  timeList: { maxHeight: 260 },
  timeListContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeItem: {
    width: '23%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  timeItemSelected: { backgroundColor: '#FFE0B2', borderColor: '#FFB74D' },
  timeItemText: { color: '#444', fontWeight: '600' },
  timeItemTextSelected: { color: THEME.gradientStart, fontWeight: '800' },
  bottomSpacer: { height: DRIVER_BOTTOM_NAV_INSET },
});
