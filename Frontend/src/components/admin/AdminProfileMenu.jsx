import React from 'react';
import UserProfileDropdown from '../common/UserProfileDropdown';

export const AdminProfileMenu = ({ onNavigate }) => {
  return (
    <UserProfileDropdown
      variant="admin"
      onNavigate={onNavigate}
      ariaLabel="Menu hồ sơ quản trị viên"
      logoutLabel="Đăng Xuất Khỏi Admin"
    />
  );
};

export default AdminProfileMenu;
