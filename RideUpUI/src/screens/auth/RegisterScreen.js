import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config/config';
import { register } from '../../services/api';

const RegisterScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CUSTOMER',
  });
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(null); // null = chưa đăng ký xong
  const countdownRef = useRef(null);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!form.fullName.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập họ tên'); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) { Alert.alert('Lỗi', 'Email không hợp lệ'); return false; }
    if (!form.password || form.password.length < 6) { Alert.alert('Lỗi', 'Mật khẩu ít nhất 6 ký tự'); return false; }
    if (form.password !== form.confirmPassword) { Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp'); return false; }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });

      // Bắt đầu đếm ngược 3 giây rồi tự chuyển sang Login
      let secs = 3;
      setCountdown(secs);
      countdownRef.current = setInterval(() => {
        secs -= 1;
        if (secs <= 0) {
          clearInterval(countdownRef.current);
          setCountdown(null);
          navigation?.navigate('Login');
        } else {
          setCountdown(secs);
        }
      }, 1000);
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Quay lại</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo tài khoản</Text>
          <Text style={styles.headerSub}>Đăng ký để bắt đầu sử dụng RideUp</Text>
        </View>

        {/* Banner thành công */}
        {countdown !== null && (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Đăng ký thành công!</Text>
              <Text style={styles.successSub}>
                Chuyển sang đăng nhập sau {countdown} giây...
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                clearInterval(countdownRef.current);
                setCountdown(null);
                navigation?.navigate('Login');
              }}
            >
              <Text style={styles.successNow}>Ngay →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form – ẩn khi đã đăng ký xong */}
        {countdown === null && <View style={styles.card}>
          {/* Họ tên */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Họ và tên *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nguyễn Văn A"
              value={form.fullName}
              onChangeText={(v) => update('fullName', v)}
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              value={form.email}
              onChangeText={(v) => update('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Mật khẩu */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ít nhất 6 ký tự"
              value={form.password}
              onChangeText={(v) => update('password', v)}
              secureTextEntry
            />
          </View>

          {/* Xác nhận mật khẩu */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Xác nhận mật khẩu *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập lại mật khẩu"
              value={form.confirmPassword}
              onChangeText={(v) => update('confirmPassword', v)}
              secureTextEntry
            />
          </View>

          {/* Loại tài khoản */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Loại tài khoản *</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleBtn, form.role === 'CUSTOMER' && styles.roleBtnActive]}
                onPress={() => update('role', 'CUSTOMER')}
              >
                <Text style={[styles.roleBtnText, form.role === 'CUSTOMER' && styles.roleBtnTextActive]}>👤 Khách hàng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, form.role === 'DRIVER' && styles.roleBtnActive]}
                onPress={() => update('role', 'DRIVER')}
              >
                <Text style={[styles.roleBtnText, form.role === 'DRIVER' && styles.roleBtnTextActive]}>🚗 Tài xế</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nút đăng ký */}
          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.registerBtnText}>Đăng ký</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation?.navigate('Login')}>
            <Text style={styles.loginLinkText}>
              Đã có tài khoản? <Text style={styles.loginLinkBold}>Đăng nhập</Text>
            </Text>
          </TouchableOpacity>
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, padding: 24 },

  header: { marginBottom: 24, paddingTop: 8 },
  backBtn: { marginBottom: 12 },
  backBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  headerSub: { marginTop: 4, fontSize: 14, color: COLORS.textLight },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: COLORS.text, backgroundColor: '#FAFAFA',
  },

  // Buttons
  registerBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  registerBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  loginLink: { marginTop: 16, alignItems: 'center' },
  loginLinkText: { fontSize: 14, color: COLORS.textLight },
  loginLinkBold: { color: COLORS.primary, fontWeight: '700' },

  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FAFAFA',
  },
  roleBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  roleBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textLight },
  roleBtnTextActive: { color: COLORS.primary },

  // Success banner
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#E8F5E9', borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1.5, borderColor: '#66BB6A',
  },
  successIcon: { fontSize: 32 },
  successTitle: { fontSize: 16, fontWeight: '800', color: '#1B5E20' },
  successSub: { fontSize: 13, color: '#2E7D32', marginTop: 2 },
  successNow: { fontSize: 14, fontWeight: '700', color: '#1B5E20', paddingLeft: 8 },
});

export default RegisterScreen;
