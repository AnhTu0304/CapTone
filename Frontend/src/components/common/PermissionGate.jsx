import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * @component PermissionGate
 * @description Component bao bọc bảo vệ các phần tử UI (nút bấm, form, modal) theo quyền hạn.
 * 
 * Props:
 * @param {string} permission - Quyền cần kiểm tra (từ PERMISSIONS)
 * @param {React.ReactNode} children - Component con được render khi đủ quyền
 * @param {React.ReactNode} [fallback=null] - Component thay thế khi không đủ quyền
 * @param {boolean} [renderDisabled=false] - Nếu true, thay vì ẩn đi thì render nút bấm ở trạng thái disabled kèm tooltip giải thích
 * @param {string} [disabledTooltip='Bạn không có quyền thực hiện thao tác này'] - Tooltip khi renderDisabled = true
 */
export const PermissionGate = ({
  permission,
  children,
  fallback = null,
  renderDisabled = false,
  disabledTooltip = 'Bạn không có quyền thực hiện thao tác này',
}) => {
  const { can } = usePermissions();
  const hasAccess = can(permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (renderDisabled && React.isValidElement(children)) {
    return React.cloneElement(children, {
      disabled: true,
      'aria-disabled': 'true',
      title: disabledTooltip,
      style: {
        ...(children.props.style || {}),
        opacity: 0.5,
        cursor: 'not-allowed',
      },
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
    });
  }

  return fallback;
};

export default PermissionGate;
