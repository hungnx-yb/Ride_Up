import { getDriverProfile } from './api';

const REDIRECT_TITLE = 'Ho so chua duoc duyet';
const REDIRECT_MESSAGE = 'Vui lòng cập nhật hồ sơ tài xế và đợi admin duyệt trước khi sử dụng chức năng này.';
const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedProfile = null;
let cacheUpdatedAt = 0;

const isCacheValid = () => (
  !!cachedProfile && (Date.now() - cacheUpdatedAt) < CACHE_TTL_MS
);

const updateCache = (profile) => {
  cachedProfile = profile || null;
  cacheUpdatedAt = profile ? Date.now() : 0;
  return cachedProfile;
};

export const clearDriverProfileApprovalCache = () => {
  cachedProfile = null;
  cacheUpdatedAt = 0;
};

export const syncDriverProfileApprovalCache = (profile) => {
  updateCache(profile);
};

export const warmupDriverProfileApprovalCache = async ({ force = false } = {}) => {
  if (!force && isCacheValid()) {
    return cachedProfile;
  }

  const profile = await getDriverProfile();
  return updateCache(profile);
};

const resolveProfileForCheck = async ({ preferCache = true, allowNetwork = true } = {}) => {
  if (preferCache && isCacheValid()) {
    return cachedProfile;
  }

  if (!allowNetwork) {
    return null;
  }

  return warmupDriverProfileApprovalCache();
};

export const ensureApprovedProfileForTripFeature = async (message, options = {}) => {
  try {
    const profile = await resolveProfileForCheck(options);
    if (!profile) {
      return {
        allowed: false,
        title: REDIRECT_TITLE,
        message: message || REDIRECT_MESSAGE,
      };
    }

    const isApproved = profile?.status === 'APPROVED';

    if (isApproved) {
      return {
        allowed: true,
        title: '',
        message: '',
      };
    }

    return {
      allowed: false,
      title: REDIRECT_TITLE,
      message: message || REDIRECT_MESSAGE,
    };
  } catch (error) {
    return {
      allowed: false,
      title: REDIRECT_TITLE,
      message: error?.message || message || REDIRECT_MESSAGE,
    };
  }
};

export const ensureApprovedProfileBeforeCreateTrip = async () =>
  ensureApprovedProfileForTripFeature(
    'Vui lòng cập nhật hồ sơ tài xế và đợi admin duyệt trước khi tạo chuyến xe.'
  );
