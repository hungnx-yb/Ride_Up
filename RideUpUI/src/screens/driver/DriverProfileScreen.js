import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../config/config';
import DriverBottomNav from '../../components/DriverBottomNav';
import { getDriverProfile, submitDriverProfile, uploadFile } from '../../services/api';
import { syncDriverProfileApprovalCache } from '../../services/driverProfileGuard';

const DRIVER_STATUS_TEXT = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

const THEME = {
  top: '#0B6E4F',
  glow: '#B9FBC0',
  cardBorder: '#D6F5E3',
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
  vehicleType: '',
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

  const [activeDateField, setActiveDateField] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDay, setPickerDay] = useState(1);
  const [pickerMonth, setPickerMonth] = useState(1);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const [uploadingField, setUploadingField] = useState('');

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
    vehicleType: data?.vehicleType || '',
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
        setSubmitSuccessMsg('Hồ sơ đã được nộp thành công và đang chờ admin xét duyệt.');
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
    if (submitSuccessMsg) setSubmitSuccessMsg('');
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

  const formatDate = (date) => {
    if (!date || Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseDate = (value) => {
    if (!value) return new Date();
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  };

  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const changePickerPart = (part, delta) => {
    if (part === 'year') {
      setPickerYear((prev) => {
        const next = Math.max(1950, Math.min(2100, prev + delta));
        setPickerDay((d) => Math.min(d, getDaysInMonth(next, pickerMonth)));
        return next;
      });
      return;
    }

    if (part === 'month') {
      setPickerMonth((prev) => {
        const next = Math.max(1, Math.min(12, prev + delta));
        setPickerDay((d) => Math.min(d, getDaysInMonth(pickerYear, next)));
        return next;
      });
      return;
    }

    setPickerDay((prev) => {
      const maxDay = getDaysInMonth(pickerYear, pickerMonth);
      return Math.max(1, Math.min(maxDay, prev + delta));
    });
  };

  const openDatePicker = (fieldKey, currentValue) => {
    if (isLocked) return;
    const initialDate = parseDate(currentValue);
    setActiveDateField(fieldKey);
    setPickerDay(initialDate.getDate());
    setPickerMonth(initialDate.getMonth() + 1);
    setPickerYear(initialDate.getFullYear());
    setShowDatePicker(true);
  };

  const confirmPickedDate = () => {
    if (!activeDateField) return;
    const finalDate = new Date(pickerYear, pickerMonth - 1, pickerDay);
    onChange(activeDateField, formatDate(finalDate));
    setShowDatePicker(false);
  };

  const pickAndUploadImage = async (fieldKey, fieldLabel) => {
    if (isLocked || uploadingField) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cấp quyền thư viện ảnh để tải tệp lên.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) return;

      const selected = result.assets[0];
      setUploadingField(fieldKey);

      const uploadedUrl = await uploadFile({
        uri: selected.uri,
        name: selected.fileName || `${fieldKey}-${Date.now()}.jpg`,
        type: selected.mimeType || 'image/jpeg',
      });

      onChange(fieldKey, uploadedUrl || '');
      Alert.alert('Thành công', `${fieldLabel} đã được tải lên.`);
    } catch (err) {
      Alert.alert('Tải tệp thất bại', err?.message || 'Không thể tải tệp lên. Vui lòng thử lại.');
    } finally {
      setUploadingField('');
    }
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
        vehicleType: form.vehicleType.trim() || null,
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
      setSubmitSuccessMsg('Nộp hồ sơ thành công. Hồ sơ đang chờ admin xét duyệt.');
      Alert.alert('Thành công', 'Hồ sơ đã cập nhật và gửi lại cho admin xét duyệt.');
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
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProfile(true)} tintColor={THEME.top} />}
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
          <View style={styles.badgePill}><Text style={styles.badgeText}>Trạng thái: {statusText}</Text></View>
          <View style={styles.badgePillSoft}><Text style={styles.badgeTextSoft}>⭐ {profile?.driverRating || 0} · {profile?.totalDriverRides || 0} chuyến</Text></View>
        </View>
        {isLocked && <Text style={styles.lockedHint}>Hồ sơ đang chờ duyệt, bạn chỉ có thể xem và chưa thể chỉnh sửa.</Text>}
        {profile?.status === 'REJECTED' && profile?.rejectionReason ? (
          <Text style={styles.rejectedHint}>Lý do từ chối: {profile.rejectionReason}</Text>
        ) : null}
      </Animated.View>

      {!!submitSuccessMsg && (
        <View style={styles.successBanner}><Text style={styles.successText}>{submitSuccessMsg}</Text></View>
      )}

      <Animated.View style={[styles.card, { opacity: infoAnim, transform: [{ translateY: infoTranslate }] }]}>
        <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
        <FormField label="Họ và tên" value={form.fullName} onChangeText={(v) => onChange('fullName', v)} placeholder="Nguyễn Văn A" editable={!isLocked} />
        <FormField label="Số điện thoại" value={form.phoneNumber} onChangeText={(v) => onChange('phoneNumber', v)} placeholder="09xxxxxxxx" keyboardType="phone-pad" editable={!isLocked} />
        <FormField label="Email" value={form.email} onChangeText={() => {}} placeholder="Email" editable={false} />
        <DateField label="Ngày sinh" value={form.dateOfBirth} placeholder="Chọn ngày sinh" editable={!isLocked} onPress={() => openDatePicker('dateOfBirth', form.dateOfBirth)} />
        <FormField label="Avatar URL" value={form.avatarUrl} onChangeText={(v) => onChange('avatarUrl', v)} placeholder="https://..." editable={!isLocked} />
      </Animated.View>

      <Animated.View style={[styles.card, { opacity: docAnim, transform: [{ translateY: docTranslate }] }]}>
        <Text style={styles.sectionTitle}>Giấy tờ tài xế</Text>
        <FormField label="CCCD" value={form.cccd} onChangeText={(v) => onChange('cccd', v)} placeholder="079xxxxxxxxx" editable={!isLocked} error={submitErrors.cccd} />
        <UploadField label="Ảnh CCCD mặt trước" value={form.cccdImageFront} onChangeText={(v) => onChange('cccdImageFront', v)} editable={!isLocked} uploading={uploadingField === 'cccdImageFront'} onUpload={() => pickAndUploadImage('cccdImageFront', 'Ảnh CCCD mặt trước')} />
        <UploadField label="Ảnh CCCD mặt sau" value={form.cccdImageBack} onChangeText={(v) => onChange('cccdImageBack', v)} editable={!isLocked} uploading={uploadingField === 'cccdImageBack'} onUpload={() => pickAndUploadImage('cccdImageBack', 'Ảnh CCCD mặt sau')} />
        <FormField label="GPLX" value={form.gplx} onChangeText={(v) => onChange('gplx', v)} placeholder="B2 / C / D..." editable={!isLocked} error={submitErrors.gplx} />
        <DateField label="Hạn GPLX" value={form.gplxExpiryDate} placeholder="Chọn ngày hết hạn" editable={!isLocked} onPress={() => openDatePicker('gplxExpiryDate', form.gplxExpiryDate)} />
        <UploadField label="Ảnh GPLX" value={form.gplxImage} onChangeText={(v) => onChange('gplxImage', v)} editable={!isLocked} uploading={uploadingField === 'gplxImage'} onUpload={() => pickAndUploadImage('gplxImage', 'Ảnh GPLX')} />
      </Animated.View>

      <Animated.View style={[styles.card, { opacity: vehicleAnim, transform: [{ translateY: vehicleTranslate }] }]}>
        <Text style={styles.sectionTitle}>Thông tin xe</Text>
        <FormField label="Biển số" value={form.plateNumber} onChangeText={(v) => onChange('plateNumber', v)} placeholder="30A-123.45" editable={!isLocked} error={submitErrors.plateNumber} />
        <View style={styles.row}>
          <View style={styles.col}><FormField label="Hãng xe" value={form.vehicleBrand} onChangeText={(v) => onChange('vehicleBrand', v)} placeholder="Toyota" editable={!isLocked} error={submitErrors.vehicleBrand} /></View>
          <View style={styles.col}><FormField label="Dòng xe" value={form.vehicleModel} onChangeText={(v) => onChange('vehicleModel', v)} placeholder="Vios" editable={!isLocked} error={submitErrors.vehicleModel} /></View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}><FormField label="Năm xe" value={form.vehicleYear} onChangeText={(v) => onChange('vehicleYear', v.replace(/[^0-9]/g, ''))} placeholder="2020" keyboardType="number-pad" editable={!isLocked} /></View>
          <View style={styles.col}><FormField label="Số ghế" value={form.seatCapacity} onChangeText={(v) => onChange('seatCapacity', v.replace(/[^0-9]/g, ''))} placeholder="4" keyboardType="number-pad" editable={!isLocked} /></View>
        </View>
        <FormField label="Màu xe" value={form.vehicleColor} onChangeText={(v) => onChange('vehicleColor', v)} placeholder="Trắng / Đen / Xám" editable={!isLocked} />
        <FormField label="Loại xe" value={form.vehicleType} onChangeText={(v) => onChange('vehicleType', v)} placeholder="Sedan 4 chỗ / Limousine..." editable={!isLocked} />
        <UploadField label="Ảnh xe" value={form.vehicleImage} onChangeText={(v) => onChange('vehicleImage', v)} editable={!isLocked} uploading={uploadingField === 'vehicleImage'} onUpload={() => pickAndUploadImage('vehicleImage', 'Ảnh xe')} />
        <UploadField label="Ảnh đăng ký xe" value={form.registrationImage} onChangeText={(v) => onChange('registrationImage', v)} editable={!isLocked} uploading={uploadingField === 'registrationImage'} onUpload={() => pickAndUploadImage('registrationImage', 'Ảnh đăng ký xe')} />
        <DateField label="Hạn đăng ký" value={form.registrationExpiryDate} placeholder="Chọn ngày hết hạn" editable={!isLocked} onPress={() => openDatePicker('registrationExpiryDate', form.registrationExpiryDate)} />
        <UploadField label="Ảnh bảo hiểm" value={form.insuranceImage} onChangeText={(v) => onChange('insuranceImage', v)} editable={!isLocked} uploading={uploadingField === 'insuranceImage'} onUpload={() => pickAndUploadImage('insuranceImage', 'Ảnh bảo hiểm')} />
        <DateField label="Hạn bảo hiểm" value={form.insuranceExpiryDate} placeholder="Chọn ngày hết hạn" editable={!isLocked} onPress={() => openDatePicker('insuranceExpiryDate', form.insuranceExpiryDate)} />

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
        <TouchableOpacity style={[styles.submitBtn, (submitting || isLocked) && styles.saveBtnDisabled]} onPress={handleSubmitProfile} disabled={submitting || isLocked}>
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{submitBtnText}</Text>}
        </TouchableOpacity>
      )}

      {showDatePicker && (
        <Modal transparent visible={showDatePicker} animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Chọn ngày</Text>
              <View style={styles.datePartRow}>
                <DatePartStepper label="Ngày" value={pickerDay} onMinus={() => changePickerPart('day', -1)} onPlus={() => changePickerPart('day', 1)} />
                <DatePartStepper label="Tháng" value={pickerMonth} onMinus={() => changePickerPart('month', -1)} onPlus={() => changePickerPart('month', 1)} />
                <DatePartStepper label="Năm" value={pickerYear} onMinus={() => changePickerPart('year', -1)} onPlus={() => changePickerPart('year', 1)} />
              </View>
              <Text style={styles.pickerPreview}>Đã chọn: {String(pickerDay).padStart(2, '0')}/{String(pickerMonth).padStart(2, '0')}/{pickerYear}</Text>
              <View style={styles.pickerActions}>
                <TouchableOpacity style={styles.pickerBtnGhost} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerBtnGhostText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerBtnPrimary} onPress={confirmPickedDate}>
                  <Text style={styles.pickerBtnPrimaryText}>Xác nhận</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

        <View style={styles.bottomGap} />
      </ScrollView>
      <DriverBottomNav navigation={navigation} activeKey="profile" />
    </View>
  );
};

const DatePartStepper = ({ label, value, onMinus, onPlus }) => (
  <View style={styles.datePartCol}>
    <Text style={styles.datePartLabel}>{label}</Text>
    <View style={styles.datePartControl}>
      <TouchableOpacity style={styles.datePartBtn} onPress={onMinus}><Text style={styles.datePartBtnText}>-</Text></TouchableOpacity>
      <Text style={styles.datePartValue}>{label === 'Năm' ? String(value) : String(value).padStart(2, '0')}</Text>
      <TouchableOpacity style={styles.datePartBtn} onPress={onPlus}><Text style={styles.datePartBtnText}>+</Text></TouchableOpacity>
    </View>
  </View>
);

const DateField = ({ label, value, placeholder, editable, onPress }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TouchableOpacity style={[styles.selectorBox, !editable && styles.inputDisabled]} onPress={onPress} disabled={!editable}>
      <Text style={[styles.selectorText, !value && styles.selectorPlaceholder]}>{value || placeholder}</Text>
      <Text style={styles.selectorIcon}>📅</Text>
    </TouchableOpacity>
  </View>
);

const UploadField = ({ label, value, onChangeText, editable, uploading, onUpload }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.uploadRow}>
      <TextInput
        style={[styles.input, styles.uploadInput, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder="https://..."
        editable={editable}
        placeholderTextColor="#94A3B8"
      />
      <TouchableOpacity style={[styles.uploadBtn, (!editable || uploading) && styles.uploadBtnDisabled]} onPress={onUpload} disabled={!editable || uploading}>
        {uploading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.uploadBtnText}>Tải ảnh</Text>}
      </TouchableOpacity>
    </View>
  </View>
);

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
  screen: { flex: 1, backgroundColor: '#F4FBF7' },
  container: { flex: 1, backgroundColor: '#F4FBF7' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4FBF7' },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  topBar: { marginTop: 48, marginHorizontal: 16, marginBottom: 6 },
  backBtn: { alignSelf: 'flex-start', backgroundColor: '#E7F8EF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#CDEFD9' },
  backBtnText: { color: '#0B6E4F', fontSize: 13, fontWeight: '700' },
  hero: { marginTop: 8, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: THEME.top, paddingVertical: 20, paddingHorizontal: 18 },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 999, right: -50, top: -40, backgroundColor: THEME.glow, opacity: 0.25 },
  heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, fontWeight: '700' },
  heroTitle: { marginTop: 6, color: COLORS.white, fontSize: 24, fontWeight: '800' },
  badgeRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgePill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgePillSoft: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  badgeTextSoft: { color: '#E8FFF1', fontSize: 12, fontWeight: '600' },
  lockedHint: { marginTop: 10, color: '#FEE2E2', fontSize: 12, fontWeight: '600' },
  rejectedHint: { marginTop: 8, color: '#FEE2E2', fontSize: 12 },
  successBanner: { marginTop: 12, marginHorizontal: 16, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  successText: { color: '#166534', fontSize: 13, fontWeight: '700' },
  card: { marginTop: 14, marginHorizontal: 16, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: THEME.cardBorder, padding: 14, shadowColor: '#0A4D38', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0A5A40', marginBottom: 10 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: '#4B5563', marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#D1EBDD', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: '#FCFFFD' },
  inputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  errorText: { marginTop: 4, fontSize: 12, color: '#DC2626', fontWeight: '600' },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  selectorBox: { borderWidth: 1, borderColor: '#D1EBDD', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FCFFFD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  selectorPlaceholder: { color: '#94A3B8', fontWeight: '500' },
  selectorIcon: { fontSize: 16 },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadInput: { flex: 1 },
  uploadBtn: { backgroundColor: '#0B6E4F', paddingHorizontal: 12, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 86 },
  uploadBtnDisabled: { opacity: 0.75 },
  uploadBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  pickerCard: { width: '100%', maxWidth: 360, borderRadius: 16, padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1EBDD' },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: '#0A5A40', marginBottom: 12, textAlign: 'center' },
  datePartRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  datePartCol: { flex: 1, alignItems: 'center' },
  datePartLabel: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  datePartControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePartBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  datePartBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  datePartValue: { minWidth: 44, textAlign: 'center', color: '#0F172A', fontSize: 16, fontWeight: '800' },
  pickerPreview: { marginTop: 12, textAlign: 'center', color: '#334155', fontSize: 13, fontWeight: '600' },
  pickerActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  pickerBtnGhost: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#CBD5E1' },
  pickerBtnGhostText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  pickerBtnPrimary: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' },
  pickerBtnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  switchRow: { marginTop: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  verifyHint: { fontSize: 12, color: '#64748B' },
  submitBtn: { marginTop: 16, marginHorizontal: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#1D4ED8', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  saveBtnDisabled: { opacity: 0.8 },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  bottomGap: { height: 110 },
});

export default DriverProfileScreen;
