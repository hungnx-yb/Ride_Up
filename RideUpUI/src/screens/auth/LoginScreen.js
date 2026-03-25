import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config/config';
import { login, USE_MOCK_DATA } from '../../services/api';

// Tài khoản test – chỉ hiển thị khi dùng mock
const TEST_ACCOUNTS = [
  { label: '👑 Admin', email: 'admin@rideup.vn', password: '123456' },
  { label: '🚗 Tài xế', email: 'driver@rideup.vn', password: '123456' },
  { label: '👤 Khách hàng', email: 'customer@rideup.vn', password: '123456' },
];

const LoginScreen = ({ onLoginSuccess, navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      const result = await login(trimmedEmail, password);
      onLoginSuccess(result.user, result.token);
    } catch (e) {
      Alert.alert('Đăng nhập thất bại', e.message || 'Vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const fillTestAccount = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>🚗</Text>
          </View>
          <Text style={styles.appName}>RideUp</Text>
          <Text style={styles.tagline}>Ghép chuyến xe - Tiết kiệm chi phí</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng nhập</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Nhập mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginBtnText}>{loading ? 'Dang vao RideUp...' : 'Dang nhap'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation?.navigate('Register')}
          >
            <Text style={styles.registerLinkText}>
              Chưa có tài khoản?{' '}
              <Text style={styles.registerLinkBold}>Đăng ký ngay</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Test accounts - chỉ hiện khi chạy mock */}
        {USE_MOCK_DATA && (
          <View style={styles.testBox}>
            <Text style={styles.testTitle}>📦 Tài khoản test (DEMO)</Text>
            <View style={styles.testRow}>
              {TEST_ACCOUNTS.map((acc) => (
                <TouchableOpacity
                  key={acc.email}
                  style={styles.testChip}
                  onPress={() => fillTestAccount(acc)}
                >
                  <Text style={styles.testChipText}>{acc.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.testHint}>Mật khẩu: 123456</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },

  // Logo
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  logoText: { fontSize: 36 },
  appName: { fontSize: 32, fontWeight: '800', color: COLORS.primary },
  tagline: { marginTop: 4, fontSize: 14, color: COLORS.textLight },

  // Card
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },

  // Input
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: COLORS.text, backgroundColor: '#FAFAFA',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    borderWidth: 1.5, borderColor: COLORS.border, borderLeftWidth: 0,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FAFAFA',
  },

  // Buttons
  loginBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  registerLink: { marginTop: 16, alignItems: 'center' },
  registerLinkText: { fontSize: 14, color: COLORS.textLight },
  registerLinkBold: { color: COLORS.primary, fontWeight: '700' },

  // Test box
  testBox: {
    marginTop: 24, backgroundColor: '#FFF8E7', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: '#FFE082',
  },
  testTitle: { fontSize: 13, fontWeight: '700', color: COLORS.warning, marginBottom: 10 },
  testRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  testChip: {
    backgroundColor: COLORS.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: '#FFE082',
  },
  testChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  testHint: { marginTop: 8, fontSize: 12, color: COLORS.textMuted },
});

export default LoginScreen;
