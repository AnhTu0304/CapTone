import React from 'react';
import PropTypes from 'prop-types';
import PixelStatusPage from './PixelStatusPage';
import { STATUS_PAGE_CONFIGS } from './statusConfigs';

export const ForbiddenPage = ({
  title = STATUS_PAGE_CONFIGS['403'].title,
  message = STATUS_PAGE_CONFIGS['403'].message,
  embedded = false,
}) => {
  const cfg = STATUS_PAGE_CONFIGS['403'];

  return (
    <PixelStatusPage
      {...cfg}
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
