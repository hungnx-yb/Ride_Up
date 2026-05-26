// Admin Design Tokens – dùng chung cho tất cả màn hình admin

export const ADMIN_COLORS = {
  // Gradient header: tím đậm → xanh dương rõ ràng (khác hẳn solid #7C3AED cũ)
  gradientStart: '#3730A3',   // indigo-800
  gradientEnd:   '#0369A1',   // sky-700

  // Nền trang – xanh indigo nhạt (khác hẳn gray #F5F7FA cũ)
  pageBg: '#EEF2FF',          // indigo-50

  // Card
  cardBg: '#FFFFFF',
  cardBorder: '#C7D2FE',      // indigo-200

  // Văn bản
  textPrimary: '#1E1B4B',     // indigo-950
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',

  // Trạng thái
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  info: '#1D4ED8',
  infoBg: '#DBEAFE',

  // Role
  adminPurple: '#4338CA',
  adminPurpleBg: '#E0E7FF',
  driverCyan: '#0369A1',
  driverCyanBg: '#E0F2FE',
  customerGreen: '#15803D',
  customerGreenBg: '#DCFCE7',

  // Đặc biệt
  white: '#FFFFFF',
  border: '#C7D2FE',          // indigo-200
  divider: '#E0E7FF',         // indigo-100
};

export const ADMIN_SHADOW = {
  shadowColor: '#312E81',     // indigo shadow
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.12,
  shadowRadius: 10,
  elevation: 4,
};

export const ADMIN_SHADOW_SM = {
  shadowColor: '#312E81',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 5,
  elevation: 2,
};

export const GRADIENT_HEADER = [ADMIN_COLORS.gradientStart, ADMIN_COLORS.gradientEnd];

export const CARD_STYLE = {
  backgroundColor: ADMIN_COLORS.cardBg,
  borderRadius: 16,
  padding: 16,
  ...ADMIN_SHADOW,
};

export const SECTION_TITLE_STYLE = {
  fontSize: 15,
  fontWeight: '800',
  color: ADMIN_COLORS.textPrimary,
  marginBottom: 12,
  letterSpacing: 0.2,
};
