import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { COLORS } from '../../config/config';
import { getDriverProfile, submitDriverProfile, updateDriverProfile } from '../../services/api';
import { syncDriverProfileApprovalCache } from '../../services/driverProfileGuard';

const VEHICLE_TYPES = [
  'CAR_4_SEAT',
  'CAR_5_SEAT',
  'CAR_7_SEAT',
  'VAN_9_SEAT',
  'VAN_12_SEAT',
  'LIMOUSINE_9_SEAT',
  'LIMOUSINE_11_SEAT',
  'MINIBUS_16_SEAT',
  'MINIBUS_24_SEAT',
  'BUS_29_SEAT',
  'BUS_35_SEAT',
  'BUS_45_SEAT',
];

const DRIVER_STATUS_TEXT = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

const THEME = {
  top: '#0B6E4F',
  bottom: '#2C9C74',
  glow: '#B9FBC0',
  cardBorder: '#D6F5E3',
  chipBg: '#EAFBF2',
  chipText: '#0B6E4F',
};

const emptyForm = {
  fullName: '',
  phoneNumber: '',
  email: '',
  avatarUrl: '',
  dateOfBirth: '',
  cccd: '',
  cccdImageFront: '',
  cccdImageBack: '',
  gplx: '',
  gplxExpiryDate: '',
  gplxImage: '',
  plateNumber: '',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleColor: '',
  seatCapacity: '',
  vehicleType: 'CAR_4_SEAT',
  registrationImage: '',
  registrationExpiryDate: '',
  insuranceImage: '',
  insuranceExpiryDate: '',
  vehicleImage: '',
  vehicleActive: true,
};

const DriverProfileScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitErrors, setSubmitErrors] = useState({});
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState('');

  const headAnim = useRef(new Animated.Value(0)).current;
  const infoAnim = useRef(new Animated.Value(0)).current;
  const docAnim = useRef(new Animated.Value(0)).current;
  const vehicleAnim = useRef(new Animated.Value(0)).current;

  const startEntrance = () => {
    headAnim.setValue(0);
    infoAnim.setValue(0);
    docAnim.setValue(0);
    vehicleAnim.setValue(0);

    Animated.stagger(110, [
      Animated.timing(headAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(infoAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(docAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(vehicleAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const mapProfileToForm = (data) => ({
    fullName: data?.fullName || '',
    phoneNumber: data?.phoneNumber || '',
    email: data?.email || '',
    avatarUrl: data?.avatarUrl || '',
    dateOfBirth: data?.dateOfBirth || '',
    cccd: data?.cccd || '',
    cccdImageFront: data?.cccdImageFront || '',
    cccdImageBack: data?.cccdImageBack || '',
    gplx: data?.gplx || '',
    gplxExpiryDate: data?.gplxExpiryDate || '',
    gplxImage: data?.gplxImage || '',
    plateNumber: data?.plateNumber || '',
    vehicleBrand: data?.vehicleBrand || '',
    vehicleModel: data?.vehicleModel || '',
    vehicleYear: data?.vehicleYear ? String(data.vehicleYear) : '',
    vehicleColor: data?.vehicleColor || '',
    seatCapacity: data?.seatCapacity ? String(data.seatCapacity) : '',
    vehicleType: data?.vehicleType || 'CAR_4_SEAT',
    registrationImage: data?.registrationImage || '',
    registrationExpiryDate: data?.registrationExpiryDate || '',
    insuranceImage: data?.insuranceImage || '',
    insuranceExpiryDate: data?.insuranceExpiryDate || '',
    vehicleImage: data?.vehicleImage || '',
    vehicleActive: data?.vehicleActive !== false,
  });

  const loadProfile = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getDriverProfile();
      syncDriverProfileApprovalCache(data);
      setProfile(data);
      setForm(mapProfileToForm(data));
      if (data?.profileLocked || (data?.status === 'PENDING' && data?.submitted === true)) {
        setSubmitSuccessMsg('Ho so da duoc nop thanh cong va dang cho admin xet duyet.');
      }
      startEntrance();
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Không tải được hồ sơ tài xế');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const statusText = useMemo(() => {
    if (profile?.status === 'PENDING' && profile?.submitted !== true) {
      return 'Chưa nộp';
    }
    return DRIVER_STATUS_TEXT[profile?.status] || 'Chưa rõ';
  }, [profile]);
  const isLocked = !!profile?.profileLocked;
  const canSubmit = (profile?.status === 'PENDING' && profile?.submitted !== true)
    || profile?.status === 'REJECTED'
    || profile?.status === 'APPROVED';
  const submitBtnText = profile?.status === 'APPROVED'
    ? 'Cập nhật và gửi duyệt lại'
    : 'Gửi xét duyệt hồ sơ';

  const onChange = (key, value) => {
    if (submitErrors[key]) {
      setSubmitErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitSuccessMsg) {
      setSubmitSuccessMsg('');
    }
  };

  const validateSubmitForm = () => {
    const errors = {};
    if (!form.cccd.trim()) errors.cccd = 'Vui lòng nhập CCCD';
    if (!form.gplx.trim()) errors.gplx = 'Vui lòng nhập GPLX';
    if (!form.plateNumber.trim()) errors.plateNumber = 'Vui lòng nhập biển số xe';
    if (!form.vehicleBrand.trim()) errors.vehicleBrand = 'Vui lòng nhập hãng xe';
    if (!form.vehicleModel.trim()) errors.vehicleModel = 'Vui lòng nhập dòng xe';
    return errors;
  };

  const handleSubmitProfile = async () => {
    const errors = validateSubmitForm();
    if (Object.keys(errors).length > 0) {
      setSubmitErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        avatarUrl: form.avatarUrl.trim() || null,
        dateOfBirth: form.dateOfBirth.trim() || null,
        cccd: form.cccd.trim() || null,
        cccdImageFront: form.cccdImageFront.trim() || null,
        cccdImageBack: form.cccdImageBack.trim() || null,
        gplx: form.gplx.trim() || null,
        gplxExpiryDate: form.gplxExpiryDate.trim() || null,
        gplxImage: form.gplxImage.trim() || null,
        plateNumber: form.plateNumber.trim() || null,
        vehicleBrand: form.vehicleBrand.trim() || null,
        vehicleModel: form.vehicleModel.trim() || null,
        vehicleYear: form.vehicleYear ? Number(form.vehicleYear) : null,
        vehicleColor: form.vehicleColor.trim() || null,
        seatCapacity: form.seatCapacity ? Number(form.seatCapacity) : null,
        vehicleType: form.vehicleType || null,
        registrationImage: form.registrationImage.trim() || null,
        registrationExpiryDate: form.registrationExpiryDate.trim() || null,
        insuranceImage: form.insuranceImage.trim() || null,
        insuranceExpiryDate: form.insuranceExpiryDate.trim() || null,
        vehicleImage: form.vehicleImage.trim() || null,
        vehicleActive: !!form.vehicleActive,
      };

      const updated = await submitDriverProfile(payload);
      syncDriverProfileApprovalCache(updated);
      setProfile(updated);
      setForm(mapProfileToForm(updated));
      setSubmitErrors({});
      setSubmitSuccessMsg('Nop ho so thanh cong. Ho so dang cho admin xet duyet.');
      Alert.alert('Thanh cong', 'Ho so da cap nhat va gui lai cho admin xet duyet.');
    } catch (err) {
      if ((err?.message || '').toLowerCase().includes('incomplete')) {
        setSubmitErrors(validateSubmitForm());
      }
      Alert.alert('Không thể gửi hồ sơ', err?.message || 'Vui lòng kiểm tra lại thông tin bắt buộc.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={THEME.top} />
        <Text style={styles.loadingText}>Đang tải hồ sơ tài xế...</Text>
      </View>
    );
  }

  const headTranslate = headAnim.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] });
  const infoTranslate = infoAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const docTranslate = docAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const vehicleTranslate = vehicleAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadProfile(true)}
          tintColor={THEME.top}
        />
      }
    >
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backBtnText}>‹ Quay lại</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.hero, { opacity: headAnim, transform: [{ translateY: headTranslate }] }]}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroSubtitle}>RideUp Driver Center</Text>
        <Text style={styles.heroTitle}>Quản lý thông tin tài xế</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>Trạng thái: {statusText}</Text>
          </View>
          <View style={styles.badgePillSoft}>
            <Text style={styles.badgeTextSoft}>⭐ {profile?.driverRating || 0} · {profile?.totalDriverRides || 0} chuyến</Text>
          </View>
        </View>
        {isLocked && (
          <Text style={styles.lockedHint}>Hồ sơ đang chờ duyệt, bạn chỉ có thể xem và chưa thể chỉnh sửa.</Text>
        )}
        {profile?.status === 'REJECTED' && profile?.rejectionReason ? (
          <Text style={styles.rejectedHint}>Lý do từ chối: {profile.rejectionReason}</Text>
        ) : null}
      </Animated.View>

      {!!submitSuccessMsg && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{submitSuccessMsg}</Text>
        </View>
      )}

      <Animated.View style={[styles.card, { opacity: infoAnim, transform: [{ translateY: infoTranslate }] }]}>
        <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
        <FormField label="Họ và tên" value={form.fullName} onChangeText={(v) => onChange('fullName', v)} placeholder="Nguyễn Văn A" editable={!isLocked} />
        <FormField label="Số điện thoại" value={form.phoneNumber} onChangeText={(v) => onChange('phoneNumber', v)} placeholder="09xxxxxxxx" keyboardType="phone-pad" editable={!isLocked} />
        <FormField label="Email" value={form.email} onChangeText={() => {}} placeholder="Email" editable={false} />
        <FormField label="Ngày sinh (YYYY-MM-DD)" value={form.dateOfBirth} onChangeText={(v) => onChange('dateOfBirth', v)} placeholder="1995-08-20" editable={!isLocked} />
        <FormField label="Avatar URL" value={form.avatarUrl} onChangeText={(v) => onChange('avatarUrl', v)} placeholder="https://..." editable={!isLocked} />
      </Animated.View>

      <Animated.View style={[styles.card, { opacity: docAnim, transform: [{ translateY: docTranslate }] }]}>
        <Text style={styles.sectionTitle}>Giấy tờ tài xế</Text>
        <FormField label="CCCD" value={form.cccd} onChangeText={(v) => onChange('cccd', v)} placeholder="079xxxxxxxxx" editable={!isLocked} error={submitErrors.cccd} />
        <FormField label="Ảnh CCCD mặt trước" value={form.cccdImageFront} onChangeText={(v) => onChange('cccdImageFront', v)} placeholder="https://..." editable={!isLocked} />
        <FormField label="Ảnh CCCD mặt sau" value={form.cccdImageBack} onChangeText={(v) => onChange('cccdImageBack', v)} placeholder="https://..." editable={!isLocked} />
        <FormField label="GPLX" value={form.gplx} onChangeText={(v) => onChange('gplx', v)} placeholder="B2 / C / D..." editable={!isLocked} error={submitErrors.gplx} />
        <FormField label="Hạn GPLX (YYYY-MM-DD)" value={form.gplxExpiryDate} onChangeText={(v) => onChange('gplxExpiryDate', v)} placeholder="2030-12-31" editable={!isLocked} />
        <FormField label="Ảnh GPLX" value={form.gplxImage} onChangeText={(v) => onChange('gplxImage', v)} placeholder="https://..." editable={!isLocked} />
      </Animated.View>

      <Animated.View style={[styles.card, { opacity: vehicleAnim, transform: [{ translateY: vehicleTranslate }] }]}>
        <Text style={styles.sectionTitle}>Thông tin xe</Text>
        <FormField label="Biển số" value={form.plateNumber} onChangeText={(v) => onChange('plateNumber', v)} placeholder="30A-123.45" editable={!isLocked} error={submitErrors.plateNumber} />
        <View style={styles.row}>
          <View style={styles.col}>
            <FormField label="Hãng xe" value={form.vehicleBrand} onChangeText={(v) => onChange('vehicleBrand', v)} placeholder="Toyota" editable={!isLocked} error={submitErrors.vehicleBrand} />
          </View>
          <View style={styles.col}>
            <FormField label="Dòng xe" value={form.vehicleModel} onChangeText={(v) => onChange('vehicleModel', v)} placeholder="Vios" editable={!isLocked} error={submitErrors.vehicleModel} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <FormField label="Năm xe" value={form.vehicleYear} onChangeText={(v) => onChange('vehicleYear', v.replace(/[^0-9]/g, ''))} placeholder="2020" keyboardType="number-pad" editable={!isLocked} />
          </View>
          <View style={styles.col}>
            <FormField label="Số ghế" value={form.seatCapacity} onChangeText={(v) => onChange('seatCapacity', v.replace(/[^0-9]/g, ''))} placeholder="4" keyboardType="number-pad" editable={!isLocked} />
          </View>
        </View>

        <FormField label="Màu xe" value={form.vehicleColor} onChangeText={(v) => onChange('vehicleColor', v)} placeholder="Trắng / Đen / Xám" editable={!isLocked} />

        <Text style={styles.fieldLabel}>Loại xe</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList}>
          {VEHICLE_TYPES.map((type) => {
            const active = form.vehicleType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => !isLocked && onChange('vehicleType', type)}
              >
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{type}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <FormField label="Ảnh xe" value={form.vehicleImage} onChangeText={(v) => onChange('vehicleImage', v)} placeholder="https://..." editable={!isLocked} />
        <FormField label="Ảnh đăng ký xe" value={form.registrationImage} onChangeText={(v) => onChange('registrationImage', v)} placeholder="https://..." editable={!isLocked} />
        <FormField label="Hạn đăng ký (YYYY-MM-DD)" value={form.registrationExpiryDate} onChangeText={(v) => onChange('registrationExpiryDate', v)} placeholder="2027-01-30" editable={!isLocked} />
        <FormField label="Ảnh bảo hiểm" value={form.insuranceImage} onChangeText={(v) => onChange('insuranceImage', v)} placeholder="https://..." editable={!isLocked} />
        <FormField label="Hạn bảo hiểm (YYYY-MM-DD)" value={form.insuranceExpiryDate} onChangeText={(v) => onChange('insuranceExpiryDate', v)} placeholder="2026-10-12" editable={!isLocked} />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Xe đang hoạt động</Text>
          <Switch
            value={!!form.vehicleActive}
            onValueChange={(v) => !isLocked && onChange('vehicleActive', v)}
            disabled={isLocked}
            trackColor={{ false: '#D1D5DB', true: '#8EE4AF' }}
            thumbColor={form.vehicleActive ? '#0B6E4F' : '#9CA3AF'}
          />
        </View>

        <Text style={styles.verifyHint}>Trạng thái xác minh xe: {profile?.vehicleVerified ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
      </Animated.View>

      {canSubmit && (
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || isLocked) && styles.saveBtnDisabled]}
          onPress={handleSubmitProfile}
          disabled={submitting || isLocked}
        >
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{submitBtnText}</Text>}
        </TouchableOpacity>
      )}

      <View style={styles.bottomGap} />
    </ScrollView>
  );
};

const FormField = ({ label, value, onChangeText, placeholder, keyboardType, editable = true, error }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, !!error && styles.inputError, !editable && styles.inputDisabled]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      editable={editable}
      placeholderTextColor="#94A3B8"
    />
    {!!error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF7',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4FBF7',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
  },
  hero: {
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: THEME.top,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  topBar: {
    marginTop: 48,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#E7F8EF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CDEFD9',
  },
  backBtnText: {
    color: '#0B6E4F',
    fontSize: 13,
    fontWeight: '700',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    right: -50,
    top: -40,
    backgroundColor: THEME.glow,
    opacity: 0.25,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 6,
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
  },
  badgeRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgePillSoft: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextSoft: {
    color: '#E8FFF1',
    fontSize: 12,
    fontWeight: '600',
  },
  lockedHint: {
    marginTop: 10,
    color: '#FEE2E2',
    fontSize: 12,
    fontWeight: '600',
  },
  rejectedHint: {
    marginTop: 8,
    color: '#FEE2E2',
    fontSize: 12,
  },
  successBanner: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  successText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 14,
    shadowColor: '#0A4D38',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A5A40',
    marginBottom: 10,
  },
  fieldWrap: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1EBDD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    backgroundColor: '#FCFFFD',
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  chipList: {
    paddingVertical: 4,
    paddingBottom: 10,
    paddingRight: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#CDEFD9',
    backgroundColor: THEME.chipBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: THEME.top,
    borderColor: THEME.top,
  },
  typeChipText: {
    fontSize: 11,
    color: THEME.chipText,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: COLORS.white,
  },
  switchRow: {
    marginTop: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  verifyHint: {
    fontSize: 12,
    color: '#64748B',
  },
  submitBtn: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.8,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  bottomGap: {
    height: 36,
  },
});

export default DriverProfileScreen;
