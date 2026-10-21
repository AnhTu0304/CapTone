import { useState, useCallback, useEffect } from 'react';
import { getStoredProfile, saveStoredProfile } from '../mocks/profileMockData';
import { profileService } from '../services/profileService';
import { getAuthToken } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const useMockProfile = () => {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [profile, setProfile] = useState(() => {
    const stored = getStoredProfile();
    // If auth context has full_name or email, prioritize keeping them aligned
    if (user?.full_name && user.full_name !== 'User') {
      return { ...stored, fullName: user.full_name, email: user.email || stored.email };
    }
    return stored;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: profile.fullName,
    phone: profile.phone,
    jobTitle: profile.jobTitle,
    avatar: profile.avatar,
  });
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar);
  const [errors, setErrors] = useState({});

  // Sync profile data from backend API with fallback when authenticated
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let isMounted = true;
    profileService.getProfile()
      .then((remoteData) => {
        if (isMounted && remoteData) {
          setProfile(remoteData);
          if (!isEditing) {
            setFormData({
              fullName: remoteData.fullName || '',
              phone: remoteData.phone || '',
              jobTitle: remoteData.jobTitle || '',
              avatar: remoteData.avatar || null,
            });
            setAvatarPreview(remoteData.avatar || null);
          }
        }
      })
      .catch(() => {
        // Fallback silently kept in state
      });

    return () => {
      isMounted = false;
    };
  }, [isEditing]);

  const startEdit = useCallback(() => {
    setFormData({
      fullName: profile.fullName,
      phone: profile.phone,
      jobTitle: profile.jobTitle,
      avatar: profile.avatar,
    });
    setAvatarPreview(profile.avatar);
    setErrors({});
    setIsEditing(true);
  }, [profile]);

  const cancelEdit = useCallback(() => {
    setFormData({
      fullName: profile.fullName,
      phone: profile.phone,
      jobTitle: profile.jobTitle,
      avatar: profile.avatar,
    });
    setAvatarPreview(profile.avatar);
    setErrors({});
    setIsEditing(false);
  }, [profile]);

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (prev[field]) {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      }
      return prev;
    });
  }, []);

  const handleAvatarFile = useCallback((file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, avatar: 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).' }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, avatar: 'Kích thước tệp không được vượt quá 2MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setAvatarPreview(dataUrl);
      setFormData((prev) => ({ ...prev, avatar: dataUrl }));
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated.avatar;
        return updated;
      });
    };
    reader.onerror = () => {
      setErrors((prev) => ({ ...prev, avatar: 'Không thể đọc tệp ảnh. Vui lòng thử lại.' }));
    };
    reader.onabort = () => {
      setErrors((prev) => ({ ...prev, avatar: 'Quá trình tải ảnh bị hủy bỏ.' }));
    };
    reader.readAsDataURL(file);
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.fullName || !formData.fullName.trim()) {
      newErrors.fullName = 'Họ và tên không được để trống.';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
    }

    if (formData.phone && formData.phone.trim()) {
      const phoneClean = formData.phone.trim();
      const phoneRegex = /^[+]?[(]?[0-9]{2,4}[)]?[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{3,6}$/;
      if (!phoneRegex.test(phoneClean) || phoneClean.replace(/\D/g, '').length < 9) {
        newErrors.phone = 'Số điện thoại không đúng định dạng (Ví dụ: 0912345678).';
      }
    }

    return newErrors;
  }, [formData]);

  const saveChanges = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toastError('Vui lòng kiểm tra lại các trường dữ liệu bị lỗi.', 'Lỗi Xác Thực');
      return false;
    }

    const updatedProfile = {
      ...profile,
      fullName: formData.fullName.trim(),
      phone: formData.phone ? formData.phone.trim() : '',
      jobTitle: formData.jobTitle ? formData.jobTitle.trim() : '',
      avatar: formData.avatar,
    };

    try {
      const saved = await profileService.updateProfile(updatedProfile);
      const finalProfile = saved || updatedProfile;

      setProfile(finalProfile);
      saveStoredProfile(finalProfile);

      // Sync to auth localStorage if exists so header updates immediately
      try {
        const authUserStr = localStorage.getItem('selfheal_auth_user');
        if (authUserStr) {
          const authUser = JSON.parse(authUserStr);
          authUser.full_name = finalProfile.fullName;
          localStorage.setItem('selfheal_auth_user', JSON.stringify(authUser));
        }
      } catch {
        // Ignore
      }

      // Broadcast profile update for real-time header sync
      try {
        window.dispatchEvent(new CustomEvent('selfheal_profile_updated', { detail: finalProfile }));
      } catch {
        // Ignore in non-browser environments
      }

      setIsEditing(false);
      toastSuccess('Hồ sơ cá nhân đã được cập nhật thành công!', 'Cập Nhật Thành Công');
      return true;
    } catch (err) {
      toastError(err.message || 'Không thể lưu hồ sơ lên máy chủ', 'Lỗi Cập Nhật');
      return false;
    }
  }, [validate, profile, formData, toastSuccess, toastError]);

  return {
    profile,
    isEditing,
    formData,
    avatarPreview,
    errors,
    startEdit,
    cancelEdit,
    handleChange,
    handleAvatarFile,
    saveChanges,
  };
};

export default useMockProfile;
