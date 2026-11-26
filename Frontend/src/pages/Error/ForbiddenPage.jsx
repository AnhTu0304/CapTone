import React from 'react';
import PropTypes from 'prop-types';
import PixelStatusPage from './PixelStatusPage';
import { STATUS_PAGE_CONFIGS } from './statusConfigs';

export const ForbiddenPage = ({
  title,
  message,
  embedded = false,
}) => {
  const { title: _t, message: _m, imageAlt: _a, ...rest } = STATUS_PAGE_CONFIGS['403'];

  return (
    <PixelStatusPage
      {...rest}
      statusKey="403"
      title={title}
      message={message}
      embedded={embedded}
      testId="forbidden-page"
    />
  );
};

ForbiddenPage.propTypes = {
  onNavigate: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  redirectPath: PropTypes.string,
  embedded: PropTypes.bool,
};

export default ForbiddenPage;
