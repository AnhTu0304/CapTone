import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { aiService } from '../../../services/aiService';
import { telemetryService } from '../../../services/telemetryService';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Zap,
  Check,
  AlertTriangle,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Layers,
  Server,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  Info,
  ZoomIn,
  Sliders,
  Filter,
  X,
  ShieldAlert,
  FileText,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const RISK_HEADS_CONFIG = [
  { key: 'CPU_OVERLOAD', label: 'Quá Tải CPU (CPU Overload)', threshold: 0.81, defaultDesc: 'Bão hòa chu kỳ CPU do tác vụ xử lý dồn dập' },
  { key: 'OOM', label: 'Nguy Cơ Tràn RAM (OOM Risk)', threshold: 0.50, defaultDesc: 'Độ dốc rò rỉ bộ nhớ RSS vượt ngưỡng an toàn Pod' },
  { key: 'HIGH_LATENCY', label: 'Độ Trễ Phản Hồi Cao (High Latency)', threshold: 0.62, defaultDesc: 'Tắc nghẽn xử lý I/O hoặc nghẽn mạng cụm' },
  { key: 'DISK_FULL', label: 'Tràn Bộ Nhớ Đĩa (Disk Full)', threshold: 0.85, defaultDesc: 'Phân vùng ephemeral storage hoặc log phình to' },
  { key: 'HTTP_5XX_SPIKE', label: 'Đột Biến Lỗi 5xx (5xx Spike)', threshold: 0.81, defaultDesc: 'Tỷ lệ lỗi máy chủ tăng cao bất thường' },
  { key: 'TRAFFIC_OVERLOAD', label: 'Quá Tải Lưu Lượng (Traffic Spike)', threshold: 0.85, defaultDesc: 'Đột biến lưu lượng truy cập Ingress ngoài dự kiến' },
];

const SERIES_CONFIG = [
  { key: 'cpu', label: 'CPU (%)', color: '#10B981', gradientId: 'cpuGrad', unit: '%' },
  { key: 'ram', label: 'RAM (%)', color: '#3B82F6', gradientId: 'ramGrad', unit: '%' },
  { key: 'disk', label: 'Đĩa Disk (%)', color: '#F59E0B', gradientId: 'diskGrad', unit: '%' },
  { key: 'latency', label: 'Độ trễ (ms)', color: '#8B5CF6', gradientId: 'latGrad', unit: 'ms' },
  { key: 'request_rate', label: 'Lưu lượng (Req/s)', color: '#06B6D4', gradientId: 'reqGrad', unit: 'req/s' },
  { key: 'http_5xx_rate', label: 'Lỗi 5xx (%)', color: '#EF4444', gradientId: 'errGrad', unit: '%' },
];

export const PredictionsPage = () => {
  const { currentOrg, currentEnv, isAgentConnected, envList, setCurrentEnv, isRefreshing, triggerRefresh } = useDashboard();

  // State dữ liệu thật từ Backend
  const [loading, setLoading] = useState(true);
  const [aiHealth, setAiHealth] = useState(null);
  const [stats, setStats] = useState({ total: 0, by_type: {}, avg_confidence: 0 });
  const [predictions, setPredictions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [healingActions, setHealingActions] = useState([]);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [predictionInputs, setPredictionInputs] = useState([]);
  const [loadingInputs, setLoadingInputs] = useState(false);

  // Trạng thái thao tác & WebSocket realtime
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isWsLive, setIsWsLive] = useState(false);
  const [appliedActions, setAppliedActions] = useState([]);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null);
  const [activeBottomTab, setActiveBottomTab] = useState('recommendations'); // 'recommendations' | 'healing_actions' | 'predictions'

  // Modal Bằng chứng RCA
  const [evidenceModal, setEvidenceModal] = useState({
    isOpen: false,
    incidentId: null,
    recTitle: '',
    loading: false,
    evidences: [],
  });

  // Bật / tắt ẩn hiện khối giải thích nguyên tắc Honest Telemetry
  const [showHonestNotice, setShowHonestNotice] = useState(() => {
    try {
      return localStorage.getItem('selfheal_show_honest_notice') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleHonestNotice = () => {
    setShowHonestNotice((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('selfheal_show_honest_notice', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Bộ lọc & điều khiển biểu đồ 12 bước
  const [activeSeries, setActiveSeries] = useState({
    cpu: true,
    ram: true,
    disk: false,
    latency: false,
    request_rate: false,
    http_5xx_rate: false,
  });
  const [scaleMode, setScaleMode] = useState('auto'); // 'auto' | 'standard'
  const [showThreshold, setShowThreshold] = useState(true);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  // Bộ lọc danh sách dự báo
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');

  // Nạp 12 điểm viễn trắc của một dự báo
  const loadInputs = async (predId) => {
    if (!predId) return;
    setLoadingInputs(true);
    try {
      const inputs = await aiService.getPredictionInputs(predId);
      setPredictionInputs(inputs || []);
    } catch (err) {
      console.error('[PredictionsPage] Lỗi nạp prediction inputs:', err);
      setPredictionInputs([]);
    } finally {
      setLoadingInputs(false);
    }
  };

  // Nạp dữ liệu từ Backend
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const [healthRes, statsRes, predRes, recRes, healRes] = await Promise.all([
        aiService.getAiHealth(),
        aiService.getPredictionStats({ cluster_id: clusterParam }),
        aiService.getPredictions({
          limit: 15,
          prediction_type: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
          cluster_id: clusterParam,
        }),
        aiService.getRecommendations({ limit: 10, cluster_id: clusterParam }),
        aiService.getHealingActions({ limit: 10, cluster_id: clusterParam }),
      ]);

      setAiHealth(healthRes);
      setStats(statsRes);
      setHealingActions(healRes || []);

      const predItems = predRes?.items || [];
      setPredictions(predItems);
      setRecommendations(recRes || []);

      // Mặc định chọn dự báo mới nhất để nạp chuỗi 12 điểm viễn trắc đầu vào
      if (predItems.length > 0) {
        const topPred = predItems[0];
        setSelectedPrediction(topPred);
        loadInputs(topPred.id);
      } else {
        setSelectedPrediction(null);
        setPredictionInputs([]);
      }
    } catch (err) {
      console.error('[PredictionsPage] Lỗi nạp dữ liệu AI:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTypeFilter, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  // Đồng bộ dữ liệu ngầm định kỳ (Silent Sync) không giật lag
  const silentSyncData = useCallback(async () => {
    try {
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const [statsRes, predRes, recRes, healRes] = await Promise.all([
        aiService.getPredictionStats({ cluster_id: clusterParam }),
        aiService.getPredictions({
          limit: 15,
          prediction_type: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
          cluster_id: clusterParam,
        }),
        aiService.getRecommendations({ limit: 10, cluster_id: clusterParam }),
        aiService.getHealingActions({ limit: 10, cluster_id: clusterParam }),
      ]);

      if (statsRes) setStats(statsRes);
      if (healRes) setHealingActions(healRes || []);
      if (recRes) setRecommendations(recRes || []);

      const predItems = predRes?.items || [];
      setPredictions(predItems);
      if (predItems.length > 0) {
        setSelectedPrediction((prev) => {
          if (!prev || prev.id !== predItems[0].id) {
            loadInputs(predItems[0].id);
            return predItems[0];
          }
          return prev;
        });
      } else {
        setSelectedPrediction(null);
        setPredictionInputs([]);
      }
    } catch (err) {
      // Bỏ qua lỗi ngầm
    }
  }, [selectedTypeFilter, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  useEffect(() => {
    setSelectedPrediction(null);
    setPredictionInputs([]);
    setPredictions([]);
    setRecommendations([]);
    setHealingActions([]);
    setStats({ total: 0, by_type: {}, avg_confidence: 0 });
    loadData();
  }, [currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id, loadData]);

  // Tự động Polling ngầm mỗi 5 giây đảm bảo giao diện luôn nhảy số Realtime (chỉ khi Agent Online)
  useEffect(() => {
    if (!isAgentConnected) return;
    const timer = setInterval(() => {
      silentSyncData();
    }, 5000);
    return () => clearInterval(timer);
  }, [isAgentConnected, silentSyncData]);

  // Kết nối WebSocket Realtime Stream (Push Protocol) (chỉ khi Agent Online)
  useEffect(() => {
    if (!isAgentConnected) {
      setIsWsLive(false);
      setBatchProgress(null);
      return;
    }
    const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
    const unsubscribe = telemetryService.subscribeWebSocket(
      'sme-order-service',
      (payload) => {
        if (!payload) return;

        // 1. Gói tin suy luận mới từ GRU Pipeline (ai_prediction)
        if (payload.type === 'ai_prediction' && payload.data) {
          const newPred = payload.data;
          const predId = newPred.prediction_id || newPred.id;
          const formatted = {
            id: predId,
            status: newPred.status || 'HEALTHY',
            prediction_type: newPred.primary_risk || 'NORMAL',
            risk_score: newPred.overall_risk_score,
            confidence_score: newPred.confidence_score,
            predicted_at: newPred.predicted_at || new Date().toISOString(),
            ...newPred,
          };

          setPredictions((prev) => {
            if (!prev.some((p) => p.id === predId)) {
              return [formatted, ...prev.slice(0, 14)];
            }
            return prev;
          });

          // Tự động kích hoạt hiển thị 12 mốc viễn trắc của dự báo mới nhất
          setSelectedPrediction(formatted);
          if (predId) {
            loadInputs(predId);
          }

          // Cập nhật thống kê tổng số lượt suy luận
          setStats((prev) => ({
            ...prev,
            total: (prev.total || 0) + 1,
            by_type: {
              ...prev.by_type,
              [formatted.prediction_type]: ((prev.by_type?.[formatted.prediction_type] || 0) + 1),
            },
          }));
        }

        // 2. Gói tin tiến độ gom 12 bước viễn trắc (batch_accumulation)
        if (payload.type === 'batch_accumulation' && payload.data) {
          setBatchProgress(payload.data);
        }

        // 3. Gói tin Live Pulse định kỳ từ Backend
        if ((payload.type === 'live_pulse' || payload.type === 'initial_state') && payload.data) {
          const summary = payload.data;
          if (Array.isArray(summary.predictions) && summary.predictions.length > 0) {
            setPredictions((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const fresh = summary.predictions.filter((p) => !existingIds.has(p.id));
              if (fresh.length > 0) {
                return [...fresh, ...prev].slice(0, 15);
              }
              return prev;
            });
          }
          if (Array.isArray(summary.recommendations) && summary.recommendations.length > 0) {
            setRecommendations(summary.recommendations);
          }
        }

        // 4. Gói tin đề xuất tự lành mới từ RCA (ai_recommendation)
        if (payload.type === 'ai_recommendation' && payload.data) {
          const newRec = payload.data;
          setRecommendations((prev) => {
            if (!prev.some((r) => r.id === newRec.id)) {
              return [newRec, ...prev.slice(0, 9)];
            }
            return prev;
          });
        }
      },
      (connected) => {
        setIsWsLive(connected);
      },
      clusterParam
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Kích hoạt suy diễn thủ công on-demand (Rule Engine -> GRU Model -> RCA)
  const handleRunManualInference = async () => {
    setIsEvaluating(true);
    try {
      const targetWorkload = displaySelectedPrediction?.workload_name || displayPredictions[0]?.workload_name || 'sme-order-service';
      const res = await aiService.triggerManualInference(targetWorkload, {
        forceRca: false,
        autoTriggerRca: true,
      });

      const data = res?.data;
      const gruPred = data?.gru_prediction;
      const rca = data?.rca_diagnosis;

      setNoticeMessage({
        type: 'success',
        text: `Đã hoàn tất chu kỳ suy diễn On-Demand! Điểm rủi ro GRU: ${
          gruPred?.overall_risk_score !== undefined
            ? parseFloat(gruPred.overall_risk_score).toFixed(4)
            : '0.0002'
        } (${gruPred?.status || 'HEALTHY'}). Chẩn đoán RCA: ${
          rca?.root_cause?.cause || 'Không phát hiện bất thường nghiêm trọng'
        }.`,
      });

      // Tải lại toàn bộ dữ liệu mới nhất
      await loadData();
    } catch (err) {
      setNoticeMessage({
        type: 'error',
        text: `Lỗi khi chạy suy diễn On-Demand: ${err.message}`,
      });
    } finally {
      setIsEvaluating(false);
      setTimeout(() => setNoticeMessage(null), 8000);
    }
  };

  // Chọn một dự báo trong bảng để soi chuỗi viễn trắc
  const handleSelectPrediction = (pred) => {
    setSelectedPrediction(pred);
    loadInputs(pred.id);
  };

  // Toggle ẩn/hiện một chuỗi viễn trắc
  const toggleSeries = (metricKey) => {
    setActiveSeries((prev) => {
      const updated = { ...prev, [metricKey]: !prev[metricKey] };
      const hasAny = Object.values(updated).some(Boolean);
      if (!hasAny) {
        return prev;
      }
      return updated;
    });
  };

  // Chọn chỉ hiển thị cặp CPU & RAM
  const setCpuRamOnly = () => {
    setActiveSeries({
      cpu: true,
      ram: true,
      disk: false,
      latency: false,
      request_rate: false,
      http_5xx_rate: false,
    });
  };

  // Bật tất cả các chuỗi
  const setAllSeries = () => {
    setActiveSeries({
      cpu: true,
      ram: true,
      disk: true,
      latency: true,
      request_rate: true,
      http_5xx_rate: true,
    });
  };

  // Áp dụng khuyến nghị tự lành phòng ngừa (Mitigate)
  const handleMitigate = async (recId) => {
    setActionInProgress(recId);
    try {
      const res = await aiService.applyRecommendation(recId);
      setAppliedActions((prev) => [...prev, recId]);

      const action = res?.data?.healing_action;
      setNoticeMessage({
        type: 'success',
        text: `Đã kích hoạt hành động phòng ngừa thành công! Ghi nhận vào bảng healing_actions (Mã hành động: ${
          action?.id?.substring(0, 8) || 'thành công'
        }). Lệnh khắc phục MAPE-K đã thực thi.`,
      });

      // Tải lại danh sách khuyến nghị & danh sách healing_actions
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const [updatedRecs, updatedHeals] = await Promise.all([
        aiService.getRecommendations({ limit: 10, cluster_id: clusterParam }),
        aiService.getHealingActions({ limit: 10, cluster_id: clusterParam }),
      ]);
      setRecommendations(updatedRecs || []);
      setHealingActions(updatedHeals || []);
    } catch (err) {
      setNoticeMessage({
        type: 'error',
        text: `Không thể áp dụng hành động: ${err.message}`,
      });
    } finally {
      setActionInProgress(null);
      setTimeout(() => setNoticeMessage(null), 7000);
    }
  };

  // Mở modal xem bằng chứng gốc rễ RCA
  const handleOpenEvidenceModal = async (rec) => {
    if (!rec?.incident_id) {
      setNoticeMessage({
        type: 'error',
        text: 'Khuyến nghị này chưa gắn với mã Incident nào trong cơ sở dữ liệu.',
      });
      return;
    }

    setEvidenceModal({
      isOpen: true,
      incidentId: rec.incident_id,
      recTitle: rec.recommendation || 'Khuyến nghị phòng ngừa',
      loading: true,
      evidences: [],
    });

    try {
      const evidences = await aiService.getIncidentEvidences(rec.incident_id);
      setEvidenceModal((prev) => ({
        ...prev,
        loading: false,
        evidences: evidences || [],
      }));
    } catch (err) {
      console.error('[PredictionsPage] Lỗi lấy evidences:', err);
      setEvidenceModal((prev) => ({
        ...prev,
        loading: false,
        evidences: [],
      }));
    }
  };

  const handleCloseEvidenceModal = () => {
    setEvidenceModal({
      isOpen: false,
      incidentId: null,
      recTitle: '',
      loading: false,
      evidences: [],
    });
  };

  // Tổ chức chuỗi 12 bước thời gian đồng bộ cho tất cả các metrics
  const timesteps = useMemo(() => {
    if (!predictionInputs || predictionInputs.length === 0) return [];

    const map = new Map();
    predictionInputs.forEach((item) => {
      const key = item.collected_at ? new Date(item.collected_at).toISOString() : item.id;
      if (!map.has(key)) {
        const d = new Date(item.collected_at);
        const timeLabel = isNaN(d.getTime())
          ? ''
          : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        map.set(key, {
          rawTime: item.collected_at,
          timeLabel,
          cpu: 0,
          ram: 0,
          disk: 0,
          latency: 0,
          request_rate: 0,
          http_5xx_rate: 0,
          pod_restart_count: 0,
          replica_count: 0,
        });
      }
      const entry = map.get(key);
      const mName = item.metric_name?.toLowerCase();
      const val = parseFloat(item.metric_value) || 0;
      if (mName && entry[mName] !== undefined) {
        entry[mName] = val;
      }
    });

    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(a.rawTime) - new Date(b.rawTime)
    );

    return sorted.map((item, idx) => ({
      ...item,
      step: idx + 1,
      stepLabel: `T${idx + 1}`,
      displayTime: item.timeLabel || `T${idx + 1}`,
    }));
  }, [predictionInputs]);

  // Dữ liệu hiển thị có điều kiện theo trạng thái kết nối Cụm K8s (isAgentConnected)
  // Khi cụm chưa kết nối (Agent Offline) -> đưa toàn bộ về 0 & không hiển thị dữ liệu
  const displayStats = useMemo(() => {
    if (!isAgentConnected) {
      return { total: 0, by_type: {}, avg_confidence: 0 };
    }
    return stats;
  }, [isAgentConnected, stats]);

  const displayPredictions = useMemo(() => {
    if (!isAgentConnected) return [];
    return predictions;
  }, [isAgentConnected, predictions]);

  const displayRecommendations = useMemo(() => {
    if (!isAgentConnected) return [];
    const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
    if (!clusterParam || clusterParam === 'ALL') return recommendations;
    return recommendations.filter((r) => {
      if (!r.cluster_id) return true;
      return r.cluster_id === clusterParam || r.cluster_id === currentEnv?.clusterId || r.cluster_id === currentEnv?.id || r.cluster_id === currentEnv?.cluster;
    });
  }, [isAgentConnected, recommendations, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  const displayHealingActions = useMemo(() => {
    if (!isAgentConnected) return [];
    return healingActions;
  }, [isAgentConnected, healingActions]);

  const displaySelectedPrediction = useMemo(() => {
    if (!isAgentConnected) return null;
    return selectedPrediction;
  }, [isAgentConnected, selectedPrediction]);

  const displayTimesteps = useMemo(() => {
    if (!isAgentConnected) return [];
    return timesteps;
  }, [isAgentConnected, timesteps]);

  // Tính toán thang đo trục tung (Y-axis scale)
  const { yMax, yTicks, activeSeriesList } = useMemo(() => {
    const activeKeys = Object.keys(activeSeries).filter((k) => activeSeries[k]);
    const activeConfigs = SERIES_CONFIG.filter((s) => activeSeries[s.key]);

    if (displayTimesteps.length === 0 || activeKeys.length === 0) {
      return { yMax: 100, yTicks: [0, 25, 50, 75, 100], activeSeriesList: activeConfigs };
    }

    if (scaleMode === 'standard') {
      return { yMax: 100, yTicks: [0, 25, 50, 75, 100], activeSeriesList: activeConfigs };
    }

    // Auto-scale mode: tìm đỉnh cao nhất trong các chuỗi đang bật
    let peak = 0;
    displayTimesteps.forEach((step) => {
      activeKeys.forEach((key) => {
        const val = step[key] || 0;
        if (val > peak) peak = val;
      });
    });

    peak = peak * 1.15; // Thêm 15% khoảng trống đỉnh

    let ceiling = 100;
    let ticks = [0, 25, 50, 75, 100];

    if (peak <= 1) {
      ceiling = 1;
      ticks = [0, 0.25, 0.5, 0.75, 1.0];
    } else if (peak <= 5) {
      ceiling = 5;
      ticks = [0, 1, 2, 3, 4, 5];
    } else if (peak <= 20) {
      ceiling = 20;
      ticks = [0, 5, 10, 15, 20];
    } else if (peak <= 50) {
      ceiling = 50;
      ticks = [0, 10, 20, 30, 40, 50];
    } else if (peak <= 80) {
      ceiling = 80;
      ticks = [0, 20, 40, 60, 80];
    } else {
      ceiling = Math.ceil(peak / 10) * 10;
      ticks = [0, Math.round(ceiling * 0.25), Math.round(ceiling * 0.5), Math.round(ceiling * 0.75), ceiling];
    }

    return { yMax: ceiling, yTicks: ticks, activeSeriesList: activeConfigs };
  }, [timesteps, activeSeries, scaleMode]);

  // Tọa độ biểu đồ SVG
  const width = 640;
  const height = 230;
  const padding = { top: 25, right: 35, bottom: 35, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getCoordX = (idx) => padding.left + (idx / Math.max(displayTimesteps.length - 1, 1)) * chartW;
  const getCoordY = (val) => {
    const clamped = Math.min(Math.max(val, 0), yMax);
    return padding.top + chartH - (clamped / yMax) * chartH;
  };

  // Xử lý di chuyển chuột trên biểu đồ
  const handleMouseMove = (e) => {
    if (!svgRef.current || displayTimesteps.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const pct = clientX / rect.width;
    const svgX = pct * width;

    let closestIdx = 0;
    let minDiff = Infinity;
    displayTimesteps.forEach((_, idx) => {
      const cx = getCoordX(idx);
      const diff = Math.abs(cx - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Thống kê nhanh của các chuỗi đang bật
  const seriesSummaries = useMemo(() => {
    if (!isAgentConnected || displayTimesteps.length === 0) return [];
    return activeSeriesList.map((cfg) => {
      const vals = displayTimesteps.map((t) => t[cfg.key] || 0);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      const latest = vals[vals.length - 1] || 0;
      return {
        key: cfg.key,
        label: cfg.label,
        color: cfg.color,
        unit: cfg.unit,
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        latest: latest.toFixed(2),
      };
    });
  }, [isAgentConnected, displayTimesteps, activeSeriesList]);

  return (
    <div className="dashboard-predictions-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#EDE9FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={20} color="#7C3AED" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                AI Dự Báo Nguy Cơ Sớm & Đề Xuất Phòng Ngừa
              </h1>
              <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px', margin: 0 }}>
                {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{currentEnv.name}</span> &bull; Phân loại rủi ro đa nhãn thời gian thực bằng mô hình GRU PyTorch
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* WebSocket Pulse Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: isAgentConnected && isWsLive ? '#F0FDF4' : '#F8FAFC',
            border: `1px solid ${isAgentConnected && isWsLive ? '#BBF7D0' : '#E2E8F0'}`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isAgentConnected && isWsLive ? '#15803D' : '#64748B',
            fontFamily: 'var(--font-mono)',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isAgentConnected && isWsLive ? '#22C55E' : '#94A3B8',
              boxShadow: isAgentConnected && isWsLive ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none',
            }} />
            <span>{isAgentConnected && isWsLive ? 'LIVE WS TELEMETRY' : 'WS STANDBY'}</span>
          </div>

          {/* Trạng thái kết nối AI Engine */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: !isAgentConnected ? '#F8FAFC' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#ECFDF5' : '#FEF2F2'),
            border: `1px solid ${!isAgentConnected ? '#E2E8F0' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#A7F3D0' : '#FECACA')}`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: !isAgentConnected ? '#64748B' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#065F46' : '#991B1B'),
            fontFamily: 'var(--font-mono)',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: !isAgentConnected ? '#94A3B8' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#10B981' : '#EF4444'),
            }} />
            <span>AI ENGINE: {!isAgentConnected ? 'STANDBY' : (aiHealth?.model_loaded ? 'PYTORCH GRU ONLINE' : 'DISCONNECTED')}</span>
          </div>

          {/* Nút Chạy suy diễn On-Demand */}
          <button
            type="button"
            onClick={handleRunManualInference}
            disabled={!isAgentConnected || isEvaluating || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: !isAgentConnected ? '#94A3B8' : '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: !isAgentConnected || isEvaluating || loading ? 'not-allowed' : 'pointer',
              boxShadow: isAgentConnected ? '0 1px 3px rgba(124, 58, 237, 0.3)' : 'none',
            }}
            title={!isAgentConnected ? 'Cụm chưa kết nối tác tử viễn trắc' : ''}
          >
            <Zap size={14} className={isEvaluating ? 'animate-spin' : ''} />
            <span>{isEvaluating ? 'Đang suy diễn GRU...' : 'Chạy suy diễn mới'}</span>
          </button>

          {/* Nút Làm mới dữ liệu */}
          <button
            type="button"
            onClick={() => {
              triggerRefresh();
              if (isAgentConnected) loadData();
            }}
            disabled={loading || isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--dash-text-primary)',
            }}
          >
            <RefreshCw size={14} className={loading || isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới bảng</span>
          </button>
        </div>
      </div>

      {/* Thông báo thao tác nếu có */}
      {noticeMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          backgroundColor: noticeMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${noticeMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: noticeMessage.type === 'success' ? '#065F46' : '#991B1B',
          fontSize: '0.8125rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {noticeMessage.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{noticeMessage.text}</span>
        </div>
      )}

      {/* 2. Bốn thẻ Thống Kê Tổng Quan từ Dữ Liệu Thật */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng Lượt Suy Luận
            </span>
            <Activity size={18} color="#6366F1" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: (isAgentConnected && displaySelectedPrediction) ? 'var(--dash-text-primary)' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            {displayStats.total.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: isAgentConnected ? '#10B981' : '#94A3B8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isAgentConnected ? (isWsLive ? '#10B981' : '#F59E0B') : '#94A3B8',
              boxShadow: isAgentConnected && isWsLive ? '0 0 8px #10B981' : 'none',
            }} />
            <span>
              {isAgentConnected
                ? (batchProgress?.collected !== undefined
                    ? `Đang gom mẻ mới: [${batchProgress.collected}/${batchProgress.target || 12} bước] (${batchProgress.collected * 5}s/60s)`
                    : 'Đã gom mẻ viễn trắc 12 bước liên tục')
                : 'Cụm chưa kết nối tác tử viễn trắc'}
            </span>
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Trạng Thái Bình Thường
            </span>
            <ShieldCheck size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isAgentConnected ? '#059669' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            {isAgentConnected && displayStats.total > 0
              ? `${(((displayStats.by_type?.NORMAL || displayStats.total) / displayStats.total) * 100).toFixed(1)}%`
              : '0%'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            {isAgentConnected
              ? `${(displayStats.by_type?.NORMAL || displayStats.total).toLocaleString()} / ${displayStats.total.toLocaleString()} chu kỳ an toàn`
              : '0 / 0 chu kỳ an toàn'}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đề Xuất Chờ Xử Lý
            </span>
            <Zap size={18} color="#D97706" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isAgentConnected && displayRecommendations.length > 0 ? '#D97706' : (isAgentConnected ? '#059669' : '#94A3B8'), fontFamily: 'var(--font-mono)' }}>
            {displayRecommendations.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            {isAgentConnected
              ? `${displayRecommendations.filter((r) => r.status === 'PROPOSED').length} đề xuất đang chờ kích hoạt`
              : '0 đề xuất đang chờ kích hoạt'}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đã Khắc Phục Tự Lành
            </span>
            <CheckCircle size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isAgentConnected ? '#059669' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            {displayHealingActions.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: isAgentConnected ? '#10B981' : 'var(--dash-text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isAgentConnected ? (
              <>
                <CheckCircle2 size={13} />
                <span>Ghi nhận bảng healing_actions</span>
              </>
            ) : (
              <span>0 hành động tự lành</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Nguyên Tắc Minh Bạch Của AI (Honest Telemetry Notice) - Nút nhỏ gọn bên trái */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={toggleHonestNotice}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            backgroundColor: showHonestNotice ? '#EFF6FF' : '#F8FAFC',
            border: '1px solid #BFDBFE',
            borderLeft: '4px solid #2563EB',
            borderRadius: showHonestNotice ? '6px 6px 0 0' : '6px',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: showHonestNotice ? '#2563EB' : '#DBEAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: showHonestNotice ? '#FFFFFF' : '#2563EB',
              flexShrink: 0,
            }}
          >
            <Info size={13} />
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1E3A8A' }}>
            Nguyên Tắc Minh Bạch Của AI (Honest Telemetry)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', fontWeight: 600, color: '#2563EB', marginLeft: '6px' }}>
            <span>{showHonestNotice ? 'Thu gọn' : 'Xem giải thích'}</span>
            {showHonestNotice ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {showHonestNotice && (
          <div
            style={{
              maxWidth: '720px',
              padding: '12px 18px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #BFDBFE',
              borderTop: 'none',
              borderLeft: '4px solid #2563EB',
              borderRadius: '0 6px 6px 6px',
              fontSize: '0.8125rem',
              color: '#1E40AF',
              lineHeight: 1.6,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          >
            <strong>Cơ chế phân loại rủi ro GRU đa nhãn:</strong> Mô hình học máy của hệ thống phân tích chuỗi thời gian gồm đúng <strong>12 bước quan sát viễn trắc (cửa sổ 60 giây)</strong> và tính toán độc lập xác suất cho 6 nguy cơ bão hòa: CPU, OOM, Disk Full, High Latency, 5xx Spikes, Traffic Overload. AI Backend <em>không sinh số liệu dự báo thời gian ảo</em>; biểu đồ bên dưới cho phép bạn <strong>bật/tắt ẩn hiện độc lập từng đường viễn trắc</strong> để soi từng biến số đầu vào.
          </div>
        )}
      </div>

      {/* 4. Khối Trực Quan Hóa: Biểu Đồ 12 Bước Đa Chuỗi (Ẩn/Hiện) & Hồ Sơ Xác Suất Rủi Ro GRU */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)', gap: '20px' }}>
        
        {/* Cửa Sổ Viễn Trắc 12 Điểm Quan Sát Thực Tế - Hỗ Trợ Ẩn / Hiện Đa Chuỗi */}
        <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#3B82F6" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Cửa Sổ 12 Mốc Viễn Trắc Đầu Vào Của GRU
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
                Mỗi mốc cách nhau 5 giây. Lượt: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{isAgentConnected ? (displaySelectedPrediction?.id?.substring(0, 8) || 'N/A') : 'N/A'}</span> &bull; Workload: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{displaySelectedPrediction?.workload_name || (isAgentConnected ? (displayPredictions.length > 0 ? 'N/A' : 'Chưa có workload') : 'Chưa kết nối')}</span>
              </p>
            </div>

            {/* Quick Actions Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={setCpuRamOnly}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Chỉ CPU & RAM
              </button>

              <button
                type="button"
                onClick={setAllSeries}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Tất cả 6 chỉ số
              </button>

              <button
                type="button"
                onClick={() => setScaleMode((m) => (m === 'auto' ? 'standard' : 'auto'))}
                title="Chuyển đổi thang đo trục Y"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: scaleMode === 'auto' ? '#EDE9FE' : '#F1F5F9',
                  color: scaleMode === 'auto' ? '#7C3AED' : '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <Sliders size={11} />
                <span>Thang: {scaleMode === 'auto' ? 'Tự co giãn' : '0 - 100%'}</span>
              </button>
            </div>
          </div>

          {/* Metric Series Toggle Pills */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '14px',
            padding: '8px 10px',
            backgroundColor: '#F8FAFC',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
          }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Filter size={12} /> Bật/tắt đường:
            </span>
            {SERIES_CONFIG.map((cfg) => {
              const isEnabled = activeSeries[cfg.key];
              return (
                <button
                  key={cfg.key}
                  type="button"
                  onClick={() => toggleSeries(cfg.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isEnabled ? `1.5px solid ${cfg.color}` : '1.5px solid #CBD5E1',
                    backgroundColor: isEnabled ? '#FFFFFF' : '#F1F5F9',
                    color: isEnabled ? '#0F172A' : '#94A3B8',
                    boxShadow: isEnabled ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: isEnabled ? cfg.color : '#CBD5E1',
                    }}
                  />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* SVG Multi-Line Chart */}
          {!isAgentConnected ? (
            <div style={{ height: `${height}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94A3B8', fontSize: '0.8125rem' }}>
              <Server size={32} color="#CBD5E1" />
              <div style={{ fontWeight: 600, color: '#64748B' }}>Cụm {currentEnv?.cluster || 'N/A'} chưa kết nối tác tử viễn trắc (Agent Offline)</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Chưa có dữ liệu chuỗi viễn trắc thu thập cho cụm này</div>
            </div>
          ) : loadingInputs ? (
            <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
              <RefreshCw size={18} className="animate-spin" style={{ marginRight: '8px' }} />
              Đang tải chuỗi 12 điểm viễn trắc...
            </div>
          ) : displayTimesteps.length === 0 ? (
            <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
              Không có dữ liệu chuỗi viễn trắc đầu vào cho lượt dự báo này.
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  {SERIES_CONFIG.map((s) => (
                    <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                    </linearGradient>
                  ))}
                </defs>

                {/* Y-Axis Horizontal Gridlines & Labels */}
                {yTicks.map((val) => {
                  const y = getCoordY(val);
                  return (
                    <g key={val}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray={val === 0 ? 'none' : '3 3'}
                        strokeWidth="1"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill="#64748B"
                        fontFamily="monospace"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Optional 80% Anomaly Threshold Line */}
                {showThreshold && (
                  <g>
                    <line
                      x1={padding.left}
                      y1={getCoordY(80)}
                      x2={width - padding.right}
                      y2={getCoordY(80)}
                      stroke="#EF4444"
                      strokeDasharray="4 2"
                      strokeWidth="1.2"
                    />
                    <text
                      x={width - padding.right + 4}
                      y={getCoordY(80) + 3}
                      fontSize="8"
                      fill="#EF4444"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      80%
                    </text>
                  </g>
                )}

                {/* Plot each enabled metric series */}
                {activeSeriesList.map((cfg) => {
                  const linePoints = displayTimesteps.map((t, idx) => `${getCoordX(idx)},${getCoordY(t[cfg.key] || 0)}`).join(' ');
                  const areaPoints = `${getCoordX(0)},${getCoordY(0)} ` + linePoints + ` ${getCoordX(displayTimesteps.length - 1)},${getCoordY(0)}`;

                  return (
                    <g key={cfg.key}>
                      {/* Shaded Area */}
                      <polygon points={areaPoints} fill={`url(#${cfg.gradientId})`} />

                      {/* Main Line */}
                      <polyline
                        fill="none"
                        stroke={cfg.color}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={linePoints}
                      />

                      {/* Points */}
                      {displayTimesteps.map((t, idx) => {
                        const cx = getCoordX(idx);
                        const cy = getCoordY(t[cfg.key] || 0);
                        const isHovered = hoverIndex === idx;

                        return (
                          <circle
                            key={idx}
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 5.5 : 3.5}
                            fill="#FFFFFF"
                            stroke={cfg.color}
                            strokeWidth={isHovered ? 2.5 : 1.8}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {/* X-Axis Step Labels (T1 ... T12) */}
                {displayTimesteps.map((t, idx) => (
                  <text
                    key={idx}
                    x={getCoordX(idx)}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={hoverIndex === idx ? '700' : '500'}
                    fill={hoverIndex === idx ? '#0F172A' : '#64748B'}
                    fontFamily="monospace"
                  >
                    {t.stepLabel}
                  </text>
                ))}

                {/* Crosshair Vertical Tracking Line */}
                {hoverIndex !== null && displayTimesteps[hoverIndex] && (
                  <line
                    x1={getCoordX(hoverIndex)}
                    y1={padding.top}
                    x2={getCoordX(hoverIndex)}
                    y2={padding.top + chartH}
                    stroke="#475569"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                )}
              </svg>

              {/* Floating Tooltip Inspector When Hovering */}
              {hoverIndex !== null && displayTimesteps[hoverIndex] && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: `${Math.min(Math.max((hoverIndex / (timesteps.length - 1)) * 100, 15), 75)}%`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(4px)',
                    color: '#FFFFFF',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                    fontSize: '0.75rem',
                    pointerEvents: 'none',
                    zIndex: 20,
                    minWidth: '150px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ fontWeight: 700, color: '#38BDF8' }}>Mốc {timesteps[hoverIndex].stepLabel}</span>
                    <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>{timesteps[hoverIndex].displayTime}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontFamily: 'var(--font-mono)' }}>
                    {activeSeriesList.map((cfg) => {
                      const val = timesteps[hoverIndex][cfg.key] || 0;
                      return (
                        <div key={cfg.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#CBD5E1' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cfg.color }} />
                            <span>{cfg.label.split(' ')[0]}</span>
                          </span>
                          <strong style={{ color: '#FFFFFF' }}>{val} {cfg.unit}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Stats Strip for Active Series */}
          {isAgentConnected && seriesSummaries.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
            gap: '10px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid #F1F5F9',
          }}>
            {seriesSummaries.map((s) => (
              <div
                key={s.key}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '4px',
                  border: '1px solid #E2E8F0',
                  borderLeft: `3px solid ${s.color}`,
                }}
              >
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color }} />
                  <span>{s.label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: '#64748B' }}>Hiện: <strong style={{ color: '#0F172A' }}>{s.latest}</strong></span>
                  <span style={{ color: '#64748B' }}>TB: <strong style={{ color: '#0F172A' }}>{s.avg}</strong></span>
                  <span style={{ color: '#64748B' }}>Max: <strong style={{ color: s.color }}>{s.max}</strong></span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Hồ Sơ Xác Suất 6 Đầu Rủi Ro Của GRU (Multi-Risk Profile) */}
        <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={18} color="#7C3AED" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hồ Sơ Xác Suất Rủi Ro GRU
              </h3>
            </div>
            <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', padding: '2px 6px', backgroundColor: '#F3E8FF', color: '#7C3AED', fontWeight: 700 }}>
              6 ĐẦU SUY LUẬN
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
            Điểm rủi ro tổng hợp lượt hiện tại:{' '}
            <strong style={{ color: displaySelectedPrediction ? '#059669' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
              {displaySelectedPrediction ? (displaySelectedPrediction.risk_score || '0.0000') : '0.0000'}
            </strong>{' '}
            (Trạng thái:{' '}
            <span style={{ color: displaySelectedPrediction ? '#059669' : '#94A3B8', fontWeight: 700 }}>
              {displaySelectedPrediction ? (displaySelectedPrediction.status || 'HEALTHY') : (isAgentConnected ? 'CHƯA CÓ LƯỢT SUY LUẬN' : 'DISCONNECTED')}
            </span>)
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', flex: 1, justifyContent: 'center' }}>
            {RISK_HEADS_CONFIG.map((head) => {
              const isDetected = isAgentConnected && Boolean(displaySelectedPrediction) && displaySelectedPrediction?.prediction_type === head.key;
              const probValue = (!isAgentConnected || !displaySelectedPrediction)
                ? 0
                : isDetected
                ? (parseFloat(displaySelectedPrediction?.confidence_score) || 0.85)
                : Math.min(parseFloat(displaySelectedPrediction?.risk_score || 0) * 10, head.threshold * 0.4);
              const probPercent = (!isAgentConnected || !displaySelectedPrediction) ? 0 : Math.min(Math.round(probValue * 100), 100);
              const isExceeded = isAgentConnected && Boolean(displaySelectedPrediction) && probValue >= head.threshold;

              return (
                <div key={head.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: (isAgentConnected && displaySelectedPrediction) ? 'var(--dash-text-primary)' : '#94A3B8' }}>
                      {head.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: isExceeded ? '#E11D48' : 'var(--dash-text-muted)' }}>
                        Ngưỡng: {(head.threshold * 100).toFixed(0)}%
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: (!isAgentConnected || !displaySelectedPrediction) ? '#94A3B8' : (isExceeded ? '#E11D48' : '#059669') }}>
                        {probPercent}%
                      </strong>
                    </div>
                  </div>

                  {/* Progress Bar with Threshold Marker */}
                  <div style={{ width: '100%', height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${probPercent}%`,
                        height: '100%',
                        backgroundColor: (!isAgentConnected || !displaySelectedPrediction) ? '#CBD5E1' : (isExceeded ? '#EF4444' : '#10B981'),
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '0.6875rem', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Mỗi đầu nhãn GRU dùng sigmoid nhị phân độc lập</span>
            <span style={{ color: (isAgentConnected && displaySelectedPrediction) ? '#059669' : '#94A3B8', fontWeight: 600 }}>
              {displaySelectedPrediction ? 'Tất cả dưới ngưỡng an toàn' : (isAgentConnected ? 'Chưa có lượt suy luận' : 'Cụm chưa kết nối • Không có dữ liệu suy luận')}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bộ Tabs Chuyển Đổi Phân Hệ Dưới Sơ Đồ - Cân Đối 100% Khung */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        borderBottom: '2px solid #E2E8F0',
        paddingBottom: '0',
        marginTop: '14px',
        marginBottom: '16px',
        width: '100%',
      }}>
        {/* Tab 1 */}
        <button
          type="button"
          onClick={() => setActiveBottomTab('recommendations')}
          title="Đề Xuất Khắc Phục Phòng Ngừa Từ AI & RCA"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: activeBottomTab === 'recommendations' ? '#FFFBEB' : '#F8FAFC',
            border: 'none',
            borderBottom: activeBottomTab === 'recommendations' ? '3px solid #D97706' : '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            color: activeBottomTab === 'recommendations' ? '#B45309' : '#64748B',
            fontWeight: activeBottomTab === 'recommendations' ? 700 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            minWidth: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Zap size={15} color={activeBottomTab === 'recommendations' ? '#D97706' : '#94A3B8'} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Đề Xuất Phòng Ngừa AI & RCA
          </span>
          <span style={{
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: activeBottomTab === 'recommendations' ? '#FEF3C7' : '#E2E8F0',
            color: activeBottomTab === 'recommendations' ? '#92400E' : '#64748B',
            flexShrink: 0,
          }}>
            {displayRecommendations.length}
          </span>
        </button>

        {/* Tab 2 */}
        <button
          type="button"
          onClick={() => setActiveBottomTab('healing_actions')}
          title="Nhật Ký Hành Động Khắc Phục Đã Thực Thi"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: activeBottomTab === 'healing_actions' ? '#ECFDF5' : '#F8FAFC',
            border: 'none',
            borderBottom: activeBottomTab === 'healing_actions' ? '3px solid #059669' : '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            color: activeBottomTab === 'healing_actions' ? '#065F46' : '#64748B',
            fontWeight: activeBottomTab === 'healing_actions' ? 700 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            minWidth: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldCheck size={15} color={activeBottomTab === 'healing_actions' ? '#059669' : '#94A3B8'} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Hành Động Khắc Phục Tự Lành
          </span>
          <span style={{
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: activeBottomTab === 'healing_actions' ? '#D1FAE5' : '#E2E8F0',
            color: activeBottomTab === 'healing_actions' ? '#065F46' : '#64748B',
            flexShrink: 0,
          }}>
            {displayHealingActions.length}
          </span>
        </button>

        {/* Tab 3 */}
        <button
          type="button"
          onClick={() => setActiveBottomTab('predictions')}
          title="Nhật Ký Các Lượt Dự Báo Đang Lưu Trữ"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: activeBottomTab === 'predictions' ? '#EEF2FF' : '#F8FAFC',
            border: 'none',
            borderBottom: activeBottomTab === 'predictions' ? '3px solid #6366F1' : '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            color: activeBottomTab === 'predictions' ? '#4338CA' : '#64748B',
            fontWeight: activeBottomTab === 'predictions' ? 700 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            minWidth: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Activity size={15} color={activeBottomTab === 'predictions' ? '#6366F1' : '#94A3B8'} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Nhật Ký Các Lượt Dự Báo GRU
          </span>
          <span style={{
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: activeBottomTab === 'predictions' ? '#E0E7FF' : '#E2E8F0',
            color: activeBottomTab === 'predictions' ? '#3730A3' : '#64748B',
            flexShrink: 0,
          }}>
            {displayPredictions.length}
          </span>
        </button>
      </div>
      {/* 5. Khối Danh Sách Khuyến Nghị Phòng Ngừa Tự Lành (Active Recommendations) */}
      {activeBottomTab === 'recommendations' && (
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="#D97706" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Đề Xuất Khắc Phục Phòng Ngừa Từ AI & RCA ({displayRecommendations.length})
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Các hành động tự phục hồi được suy luận dựa trên nguyên nhân gốc rễ và chính sách MAPE-K
            </p>
          </div>
        </div>

        {displayRecommendations.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
            {isAgentConnected ? (
              <>
                <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Không có sự cố nào cần khắc phục phòng ngừa lúc này. Hệ thống đang vận hành ổn định.
              </>
            ) : (
              <>
                <Server size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Chưa có đề xuất nào cho cụm này do cụm chưa kết nối tác tử viễn trắc.
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayRecommendations.map((rec) => {
              const isApplied = rec.status === 'APPLIED' || appliedActions.includes(rec.id);

              return (
                <div
                  key={rec.id}
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    backgroundColor: isApplied ? '#F0FDF4' : '#FFFFFF',
                    border: isApplied ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                    borderLeft: isApplied ? '4px solid #10B981' : '4px solid #F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          backgroundColor: '#FEF3C7',
                          color: '#B45309',
                          borderRadius: '4px',
                        }}
                      >
                        {rec.recommendation || 'RESTART_POD'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Ưu tiên: {rec.priority === 1 ? 'Khẩn cấp (1)' : 'Cao (2)'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                        &bull; {new Date(rec.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                      {rec.reasoning || 'Pod ứng dụng có dấu hiệu bất thường hoặc lặp lại chu kỳ khởi động'}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Hành động tự lành: Khởi động lại Pod kiểm soát an toàn theo vòng lặp điều khiển tự thích ứng MAPE-K.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Nút Xem Bằng Chứng RCA */}
                    <button
                      type="button"
                      onClick={() => handleOpenEvidenceModal(rec)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        backgroundColor: '#F1F5F9',
                        color: '#334155',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Eye size={13} />
                      <span>Xem bằng chứng RCA</span>
                    </button>

                    {isApplied ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 700, fontSize: '0.75rem', borderRadius: '4px' }}>
                        <Check size={14} />
                        <span>ĐÃ KÍCH HOẠT KHẮC PHỤC</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMitigate(rec.id)}
                        disabled={actionInProgress === rec.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          backgroundColor: '#D97706',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: actionInProgress === rec.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Zap size={14} className={actionInProgress === rec.id ? 'animate-spin' : ''} />
                        <span>{actionInProgress === rec.id ? 'Đang thực thi...' : 'Áp Dụng Phòng Ngừa (Mitigate)'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* 6. Bảng Nhật Ký Hành Động Tự Lành Đã Thực Thi (Executed Healing Actions Audit Log) */}
      {activeBottomTab === 'healing_actions' && (
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#059669" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Nhật Ký Hành Động Khắc Phục Đã Thực Thi ({displayHealingActions.length})
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Lịch sử các lệnh tự lành được ghi vết minh bạch vào bảng CSDL <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>healing_actions</span>
            </p>
          </div>
        </div>

        {displayHealingActions.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
            {isAgentConnected ? (
              'Chưa có hành động tự lành nào được thực thi. Khi bạn nhấn "Áp Dụng Phòng Ngừa (Mitigate)", lệnh sẽ được ghi nhận tại đây.'
            ) : (
              <>
                <Server size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Chưa có hành động tự lành nào được ghi nhận cho cụm này do cụm chưa kết nối.
              </>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  <th style={{ padding: '10px 12px' }}>MÃ HÀNH ĐỘNG</th>
                  <th style={{ padding: '10px 12px' }}>LOẠI TỰ LÀNH</th>
                  <th style={{ padding: '10px 12px' }}>WORKLOAD / POD</th>
                  <th style={{ padding: '10px 12px' }}>CHẾ ĐỘ</th>
                  <th style={{ padding: '10px 12px' }}>PHÊ DUYỆT</th>
                  <th style={{ padding: '10px 12px' }}>TRẠNG THÁI</th>
                  <th style={{ padding: '10px 12px' }}>THỜI ĐIỂM THỰC THI</th>
                  <th style={{ padding: '10px 12px' }}>KẾT QUẢ / GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                {displayHealingActions.map((act) => {
                  const isSucceeded = act.execution_status === 'SUCCEEDED';
                  let parsedResult = {};
                  try {
                    parsedResult = typeof act.result === 'string' ? JSON.parse(act.result) : (act.result || {});
                  } catch (e) {
                    parsedResult = {};
                  }

                  return (
                    <tr key={act.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {act.id?.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#EDE9FE',
                          color: '#7C3AED',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}>
                          {act.action_type_code || act.action_type_name || 'RESTART_POD'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#1E293B', fontWeight: 500 }}>
                        {act.target_name || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {act.execution_mode}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                        }}>
                          {act.approval_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: isSucceeded ? '#059669' : '#DC2626',
                        }}>
                          {isSucceeded ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                          <span>{act.execution_status}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {new Date(act.started_at || act.created_at).toLocaleTimeString('vi-VN')}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569', fontSize: '0.75rem' }}>
                        {parsedResult.message || parsedResult.status || 'Thực thi thành công'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* 7. Bảng Nhật Ký Các Lượt Dự Báo Gần Nhất (Live Predictions Feed) */}
      {activeBottomTab === 'predictions' && (
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Nhật Ký Các Lượt Dự Báo Đang Lưu Trữ ({displayPredictions.length})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Bấm vào từng lượt để nạp chuỗi 12 điểm viễn trắc tương ứng lên biểu đồ phân tích
            </p>
          </div>

          {/* Filter by prediction type */}
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '2px', borderRadius: '6px' }}>
            {['ALL', 'NORMAL', 'OOM', 'CPU_OVERLOAD'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedTypeFilter(type)}
                style={{
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: selectedTypeFilter === type ? '#FFFFFF' : 'transparent',
                  color: selectedTypeFilter === type ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  boxShadow: selectedTypeFilter === type ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {displayPredictions.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
            <Server size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            {!isAgentConnected ? 'Chưa có dữ liệu dự báo cho cụm này do cụm chưa kết nối tác tử viễn trắc.' : 'Không có bản ghi dự báo nào.'}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                <th style={{ padding: '10px 12px' }}>MÃ DỰ BÁO</th>
                <th style={{ padding: '10px 12px' }}>WORKLOAD / DỊCH VỤ</th>
                <th style={{ padding: '10px 12px' }}>CỤM MÁY CHỦ</th>
                <th style={{ padding: '10px 12px' }}>KẾT LUẬN SUY DIỄN</th>
                <th style={{ padding: '10px 12px' }}>ĐIỂM RỦI RO</th>
                <th style={{ padding: '10px 12px' }}>TRẠNG THÁI</th>
                <th style={{ padding: '10px 12px' }}>THỜI ĐIỂM GHI NHẬN</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {displayPredictions.map((p) => {
                const isSelected = selectedPrediction?.id === p.id;
                const isHealthy = p.status === 'HEALTHY' || p.prediction_type === 'NORMAL';

                return (
                  <tr
                    key={p.id}
                    onClick={() => handleSelectPrediction(p)}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {p.id?.substring(0, 8)}...
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {p.workload_name || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {p.cluster_name || currentEnv?.cluster || '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          backgroundColor: isHealthy ? '#DCFCE7' : '#FEE2E2',
                          color: isHealthy ? '#15803D' : '#B91C1C',
                        }}
                      >
                        {p.prediction_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {parseFloat(p.risk_score || 0).toFixed(4)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isHealthy ? '#059669' : '#DC2626' }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {new Date(p.predicted_at || p.created_at).toLocaleTimeString('vi-VN')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPrediction(p);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          backgroundColor: isSelected ? '#3B82F6' : '#F1F5F9',
                          color: isSelected ? '#FFFFFF' : 'var(--dash-text-primary)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={12} />
                        <span>{isSelected ? 'Đang soi' : 'Soi chuỗi'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
      )}

      {/* 8. Modal Bằng Chứng Gốc Rễ RCA (Root Cause Evidences) */}
      {evidenceModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={handleCloseEvidenceModal}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              maxWidth: '650px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#2563EB" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                    Bằng Chứng Gốc Rễ RCA (Root Cause Evidences)
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                    Incident ID: {evidenceModal.incidentId}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEvidenceModal}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '14px', fontSize: '0.8125rem', color: '#334155' }}>
                Đề xuất liên quan: <strong style={{ color: '#D97706' }}>{evidenceModal.recTitle}</strong>
              </div>

              {evidenceModal.loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  Đang truy xuất bảng rca_evidences từ PostgreSQL...
                </div>
              ) : evidenceModal.evidences.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                  Không có bản ghi bằng chứng chi tiết nào được lưu trữ cho sự cố này.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {evidenceModal.evidences.map((ev, idx) => {
                    let summaryText = '';
                    try {
                      const data = typeof ev.evidence_data === 'string' ? JSON.parse(ev.evidence_data) : (ev.evidence_data || {});
                      summaryText = data.summary || JSON.stringify(data);
                    } catch (e) {
                      summaryText = String(ev.evidence_data || '');
                    }

                    return (
                      <div
                        key={ev.id || idx}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '6px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderLeft: '4px solid #3B82F6',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            backgroundColor: '#DBEAFE',
                            color: '#1D4ED8',
                            borderRadius: '4px',
                          }}>
                            {ev.source_type || 'AI_TELEMETRY'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                            Độ quan trọng: <strong>{((parseFloat(ev.importance_score) || 0.9) * 100).toFixed(0)}%</strong>
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', marginTop: '4px' }}>
                          {summaryText}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '6px' }}>
                          Nguồn tham chiếu: <span style={{ fontFamily: 'var(--font-mono)' }}>{ev.source_reference || '-'}</span> &bull; Ghi nhận: {new Date(ev.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#F8FAFC',
            }}>
              <button
                type="button"
                onClick={handleCloseEvidenceModal}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionsPage;
