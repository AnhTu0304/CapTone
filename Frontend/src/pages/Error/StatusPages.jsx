import React from 'react';
import PixelStatusPage from './PixelStatusPage';
import { STATUS_PAGE_CONFIGS } from './statusConfigs';

const createStatusPage = (key) => {
  const { title, message, imageAlt, ...rest } = STATUS_PAGE_CONFIGS[key];
  return function StatusPageComponent(overrides) {
    return <PixelStatusPage {...rest} statusKey={key} {...overrides} />;
  };
};

export const UnauthorizedPage = createStatusPage('401');
export const NotFoundPage = createStatusPage('404');
export const ServerErrorPage = createStatusPage('500');
export const ServiceUnavailablePage = createStatusPage('503');
export const TooManyRequestsPage = createStatusPage('429');
export const AgentOfflinePage = createStatusPage('agent-offline');
export const ClusterLostPage = createStatusPage('cluster-lost');
export const MonitoringStatusPage = createStatusPage('monitoring');
export const MaintenancePage = createStatusPage('maintenance');
