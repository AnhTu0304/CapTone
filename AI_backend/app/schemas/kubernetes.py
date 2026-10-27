from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class ControllerInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    owner_kind: str | None = None
    owner_name: str | None = None
    workload_type: str | None = None
    workload_name: str | None = None


class TerminationDetails(BaseModel):
    model_config = ConfigDict(extra="ignore")

    last_state: str | None = None
    last_exit_code: int | None = None
    reason: str | None = None
    finished_at: str | None = None
    container_name: str | None = None


class MongoDBClusterHealth(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: Literal["PRIMARY", "SECONDARY", "ARBITER", "UNKNOWN"] | str = "UNKNOWN"
    healthy_members: int | None = None
    total_members: int | None = None
    replication_lag_seconds: float | None = None
    quorum_status: str | None = None


class StoragePVCInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    pvc_name: str | None = None
    mount_status: str | None = None
    mount_path: str | None = None
    capacity_bytes: int | None = None
    used_bytes: int | None = None
    used_percent: float | None = None
    io_errors: int = 0


class MemoryConfigInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    container_limit_bytes: int | None = None
    container_request_bytes: int | None = None
    wiredtiger_cache_size_bytes: int | None = None
    cache_dirty_percent: float | None = None
    cache_used_percent: float | None = None


class DeepPodMetrics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    working_set_bytes: int | None = None
    rss_bytes: int | None = None
    page_faults: int | None = None
    major_page_faults: int | None = None
    oom_kills: int | None = None


class PodInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    pod_id: str | None = None
    pod_name: str
    pod_ip: str | None = None
    node_name: str | None = None
    status: str
    ready: bool = True
    restart_count: int = 0
    controller: ControllerInfo | None = None
    termination: TerminationDetails | None = None
    mongodb_cluster_health: MongoDBClusterHealth | None = None
    storage_pvc: StoragePVCInfo | None = None
    memory_config: MemoryConfigInfo | None = None
    deep_metrics: DeepPodMetrics | None = None


class NodeConditions(BaseModel):
    model_config = ConfigDict(extra="ignore")

    MemoryPressure: bool = False
    DiskPressure: bool = False
    PIDPressure: bool = False
    Ready: bool = True


class NodeInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    node_id: str | None = None
    node_name: str
    status: str = "Ready"
    cpu_cores: float | None = None
    cpu_usage_pct: float | None = None
    ram_capacity_bytes: int | None = None
    ram_usage_bytes: int | None = None
    ram_usage_pct: float | None = None
    conditions: NodeConditions | dict[str, Any] = Field(default_factory=dict)
    allocatable_memory_bytes: int | None = None
    free_memory_bytes: int | None = None


class DeploymentInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    desired_replicas: int | None = Field(default=None, ge=0)
    available_replicas: int | None = Field(default=None, ge=0)
    version: str | None = None
    previous_version: str | None = None
    deployed_at: str | None = None


class KubernetesData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    pod_status: str | None = None
    container_status: str | None = None
    restart_count: int = Field(default=0, ge=0)
    events: list[str] = Field(default_factory=list, max_length=500)
    desired_replicas: int | None = Field(default=None, ge=0)
    available_replicas: int | None = Field(default=None, ge=0)
    readiness_probe: str | bool | None = None
    liveness_probe: str | bool | None = None
    deployment: DeploymentInfo | None = None

    # Enterprise Multi-Pod and Multi-Node extensions
    cluster_id: str | None = None
    namespace: str | None = None
    workload_id: str | None = None
    workload_type: str | None = None
    workload_name: str | None = None
    nodes: list[NodeInfo] = Field(default_factory=list)
    all_pods: list[PodInfo] = Field(default_factory=list)


class KubernetesAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    agent: str = "kubernetes_event_analysis"
    findings: list[str]
    suspected_causes: list[str]
    faulty_pod: PodInfo | None = None
    target_pod_name: str | None = None
    target_pod_id: str | None = None
    target_node_name: str | None = None
    target_node_id: str | None = None
    target_node_pressure: bool = False
    recommended_destination_node: str | None = None
    destination_node_id: str | None = None
    is_primary_database: bool = False
    exit_code_137_detected: bool = False
