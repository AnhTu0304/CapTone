import { useState, useEffect, useRef, useCallback } from 'react';
import { clusterService } from '../services/clusterService';
import { nodeService } from '../services/nodeService';
import { podService } from '../services/podService';
import { deploymentService } from '../services/deploymentService';

/**
 * Custom Hook điều phối lấy dữ liệu và polling trạng thái K8s định kỳ an toàn
 * @param {Object} params
 * @param {string} params.clusterId
 * @param {string} params.orgId
 * @param {number} [params.intervalMs=20000] - Chu kỳ polling (mặc định 20 giây)
 * @param {boolean} [params.enabled=true]
 */
export function useK8sResourcePolling({ clusterId, orgId, intervalMs = 20000, enabled = true }) {
  const [data, setData] = useState({
    summary: null,
    nodes: [],
    pods: [],
    deployments: [],
    freshness: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null); // { message, status, timestamp }
  const [lastUpdated, setLastUpdated] = useState(null);

  const abortControllerRef = useRef(null);
  const inFlightRef = useRef(false);
  const timerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (!clusterId || !enabled) return;
      if (inFlightRef.current) return; // Tránh chồng lấn request

      // Hủy request cũ đang chờ nếu có
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      inFlightRef.current = true;

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }

      try {
        // 1. Thử lấy summary tổng quan theo endpoint Task 5.2
        const summaryRes =
          typeof clusterService?.getClusterStatusSummary === 'function'
            ? await clusterService.getClusterStatusSummary(clusterId, orgId, controller.signal)
            : null;

        let nodes = [];
        let pods = [];
        let deployments = [];
        let summary = null;

        if (summaryRes && summaryRes.summary) {
          summary = summaryRes.summary;
          nodes = Array.isArray(summaryRes.nodes) ? summaryRes.nodes : [];
          pods = Array.isArray(summaryRes.pods) ? summaryRes.pods : [];
          deployments = Array.isArray(summaryRes.deployments) ? summaryRes.deployments : [];
        } else {
          // Fallback gọi song song 3 service chuyên biệt
          const [nRes, pRes, dRes] = await Promise.allSettled([
            nodeService.getNodesByCluster(clusterId, { orgId, signal: controller.signal }),
            podService.getPodsByCluster(clusterId, { orgId, signal: controller.signal }),
            deploymentService.getDeploymentsByCluster(clusterId, { orgId, signal: controller.signal }),
          ]);

          nodes = nRes.status === 'fulfilled' && Array.isArray(nRes.value) ? nRes.value : [];
          pods = pRes.status === 'fulfilled' && Array.isArray(pRes.value) ? pRes.value : [];
          deployments = dRes.status === 'fulfilled' && Array.isArray(dRes.value) ? dRes.value : [];
        }

        // Tính freshness tổng quan từ node hoặc pod đầu tiên
        const sampleFreshness =
          nodes[0]?.freshness || pods[0]?.freshness || deployments[0]?.freshness || null;

        setData({
          summary,
          nodes,
          pods,
          deployments,
          freshness: sampleFreshness,
        });
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (err.name === 'AbortError') {
          return; // Hủy do unmount hoặc chuyển cụm, không báo lỗi
        }
        console.warn('[useK8sResourcePolling] Lỗi cập nhật trạng thái K8s:', err.message);
        setError({
          message: err.message || 'Lỗi kết nối máy chủ khi cập nhật tài nguyên K8s',
          status: err.status || 500,
          timestamp: new Date(),
        });
      } finally {
        inFlightRef.current = false;
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [clusterId, orgId, enabled]
  );

  // Kích hoạt initial fetch và polling lặp lại
  useEffect(() => {
    hasLoadedOnceRef.current = false;
    if (!clusterId || !enabled) {
      setIsLoading(false);
      return;
    }

    fetchData(false);

    if (intervalMs > 0) {
      timerRef.current = setInterval(() => {
        fetchData(false);
      }, intervalMs);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [clusterId, orgId, enabled, intervalMs, fetchData]);

  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    ...data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  };
}

export default useK8sResourcePolling;
