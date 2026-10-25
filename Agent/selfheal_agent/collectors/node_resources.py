"""Host and Kubernetes Node resource collector for CPU, RAM, Disk, and Network I/O (Task 4.1 & 4.2)."""

import ctypes
from datetime import datetime, timezone
import logging
import math
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from typing import Any, Callable, Optional

from selfheal_agent.telemetry.schemas import (
    AgentNodeMetricsData,
    DiskFilesystemMetric,
    NetworkInterfaceMetric,
)

logger = logging.getLogger("selfheal_agent.collectors.node_resources")

VIRTUAL_FS_TYPES: frozenset[str] = frozenset({
    "proc",
    "sysfs",
    "tmpfs",
    "devtmpfs",
    "devpts",
    "cgroup",
    "cgroup2",
    "pstore",
    "securityfs",
    "debugfs",
    "tracefs",
    "configfs",
    "fusectl",
    "mqueue",
    "hugetlbfs",
    "autofs",
    "nsfs",
    "overlay",
    "squashfs",
    "ramfs",
    "rpc_pipefs",
    "binfmt_misc",
    "bpf",
    "efivarfs",
    "fuse.lxcfs",
})

IGNORED_MOUNT_PREFIXES: tuple[str, ...] = (
    "/proc",
    "/sys",
    "/dev",
    "/run/secrets",
    "/etc/hosts",
    "/etc/resolv.conf",
    "/etc/hostname",
)


def sanitize_finite_float(
    value: Any,
    default: float = 0.0,
    min_val: Optional[float] = None,
    max_val: Optional[float] = None,
) -> float:
    """Guarantee a finite float value (never NaN or Infinity) clamped to optional bounds."""
    try:
        f_val = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(f_val):
        return default
    if min_val is not None and f_val < min_val:
        f_val = min_val
    if max_val is not None and f_val > max_val:
        f_val = max_val
    return f_val


def _detect_container_environment() -> bool:
    """Detect whether the Agent process is running inside a container/Pod."""
    if os.getenv("KUBERNETES_SERVICE_HOST"):
        return True
    if Path("/.dockerenv").exists() or Path("/run/.containerenv").exists():
        return True
    try:
        cgroup_text = Path("/proc/1/cgroup").read_text(encoding="utf-8", errors="ignore")
        if any(tok in cgroup_text for tok in ("docker", "kubepods", "containerd", "crio")):
            return True
    except OSError:
        pass
    return False


def _default_proc_stat_reader() -> str:
    """Read /proc/stat on Linux or synthesize equivalent CPU tick counters on Windows."""
    proc_stat = Path("/proc/stat")
    if proc_stat.exists():
        return proc_stat.read_text(encoding="utf-8")

    if sys.platform == "win32":
        class FILETIME(ctypes.Structure):
            _fields_ = [("dwLowDateTime", ctypes.c_uint32), ("dwHighDateTime", ctypes.c_uint32)]

        idle_ft = FILETIME()
        kernel_ft = FILETIME()
        user_ft = FILETIME()
        ok = ctypes.windll.kernel32.GetSystemTimes(
            ctypes.byref(idle_ft),
            ctypes.byref(kernel_ft),
            ctypes.byref(user_ft),
        )
        if not ok:
            raise OSError("GetSystemTimes failed on Windows")

        idle = (idle_ft.dwHighDateTime << 32) | idle_ft.dwLowDateTime
        kernel = (kernel_ft.dwHighDateTime << 32) | kernel_ft.dwLowDateTime
        user = (user_ft.dwHighDateTime << 32) | user_ft.dwLowDateTime
        # On Windows, kernel time includes idle time
        system_busy = max(0, kernel - idle)
        return f"cpu  {user} 0 {system_busy} {idle} 0 0 0 0\n"

    raise FileNotFoundError("/proc/stat is unavailable on this platform")


def _default_proc_meminfo_reader() -> str:
    """Read /proc/meminfo on Linux or synthesize equivalent kB lines on Windows."""
    proc_meminfo = Path("/proc/meminfo")
    if proc_meminfo.exists():
        return proc_meminfo.read_text(encoding="utf-8")

    if sys.platform == "win32":
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_uint32),
                ("dwMemoryLoad", ctypes.c_uint32),
                ("ullTotalPhys", ctypes.c_uint64),
                ("ullAvailPhys", ctypes.c_uint64),
                ("ullTotalPageFile", ctypes.c_uint64),
                ("ullAvailPageFile", ctypes.c_uint64),
                ("ullTotalVirtual", ctypes.c_uint64),
                ("ullAvailVirtual", ctypes.c_uint64),
                ("ullAvailExtendedVirtual", ctypes.c_uint64),
            ]

        mem_status = MEMORYSTATUSEX()
        mem_status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        ok = ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem_status))
        if not ok:
            raise OSError("GlobalMemoryStatusEx failed on Windows")

        total_kb = mem_status.ullTotalPhys // 1024
        avail_kb = mem_status.ullAvailPhys // 1024
        return f"MemTotal:       {total_kb} kB\nMemAvailable:   {avail_kb} kB\nMemFree:        {avail_kb} kB\n"

    raise FileNotFoundError("/proc/meminfo is unavailable on this platform")


def _default_mounts_reader() -> list[tuple[str, str, str]]:
    """Return list of (device, mount_point, fs_type) from /proc/mounts or Windows fixed drives."""
    proc_mounts = Path("/proc/mounts")
    if proc_mounts.exists():
        mounts: list[tuple[str, str, str]] = []
        for line in proc_mounts.read_text(encoding="utf-8", errors="ignore").splitlines():
            parts = line.split()
            if len(parts) >= 3:
                mounts.append((parts[0], parts[1], parts[2].lower()))
        return mounts

    if sys.platform == "win32":
        drives: list[tuple[str, str, str]] = []
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for idx in range(26):
            if bitmask & (1 << idx):
                drive = f"{chr(65 + idx)}:\\"
                drive_type = ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(drive))
                # 3 = DRIVE_FIXED
                if drive_type == 3:
                    drives.append((drive, drive, "ntfs"))
        if not drives:
            drives.append(("C:\\", "C:\\", "ntfs"))
        return drives

    return [("root", "/", "unknown")]


def _default_proc_net_dev_reader() -> str:
    """Read /proc/net/dev on Linux or query Windows network interface counters."""
    proc_net = Path("/proc/net/dev")
    if proc_net.exists():
        return proc_net.read_text(encoding="utf-8")

    if sys.platform == "win32":
        proc = subprocess.run(
            ["netstat", "-e"],
            capture_output=True,
            text=True,
            timeout=3.0,
            check=False,
        )
        rx_bytes, tx_bytes = 0, 0
        rx_pkts, tx_pkts = 0, 0
        rx_errs, tx_errs = 0, 0
        for line in proc.stdout.splitlines():
            tokens = line.split()
            if len(tokens) >= 3 and tokens[-2].isdigit() and tokens[-1].isdigit():
                label = " ".join(tokens[:-2]).lower()
                v1, v2 = int(tokens[-2]), int(tokens[-1])
                if "byte" in label:
                    rx_bytes, tx_bytes = v1, v2
                elif "unicast" in label:
                    rx_pkts, tx_pkts = v1, v2
                elif "error" in label:
                    rx_errs, tx_errs = v1, v2
        return (
            "Inter-|   Receive                                                |  Transmit\n"
            " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n"
            f"  eth0: {rx_bytes} {rx_pkts} {rx_errs} 0 0 0 0 0 {tx_bytes} {tx_pkts} {tx_errs} 0 0 0 0 0\n"
        )

    raise FileNotFoundError("/proc/net/dev is unavailable on this platform")


class NodeResourceCollector:
    """Stateful collector for Host/Node CPU, RAM, Disk, and Network I/O metrics."""

    def __init__(
        self,
        node_name: Optional[str] = None,
        include_loopback: bool = False,
        proc_stat_reader: Optional[Callable[[], str]] = None,
        proc_meminfo_reader: Optional[Callable[[], str]] = None,
        mounts_reader: Optional[Callable[[], list[tuple[str, str, str]]]] = None,
        disk_usage_fn: Optional[Callable[[str], Any]] = None,
        proc_net_dev_reader: Optional[Callable[[], str]] = None,
        cpu_count_fn: Optional[Callable[[], Optional[int]]] = None,
        clock_fn: Optional[Callable[[], float]] = None,
    ) -> None:
        self.node_name = (
            node_name
            or os.getenv("NODE_NAME")
            or os.getenv("KUBERNETES_NODE_NAME")
            or socket.gethostname()
            or "default-node"
        )
        self.include_loopback = include_loopback
        self._proc_stat_reader = proc_stat_reader or _default_proc_stat_reader
        self._proc_meminfo_reader = proc_meminfo_reader or _default_proc_meminfo_reader
        self._mounts_reader = mounts_reader or _default_mounts_reader
        self._disk_usage_fn = disk_usage_fn or shutil.disk_usage
        self._proc_net_dev_reader = proc_net_dev_reader or _default_proc_net_dev_reader
        self._cpu_count_fn = cpu_count_fn or os.cpu_count
        self._clock_fn = clock_fn or time.monotonic

        # State for counter-delta metrics
        self._prev_cpu_total: Optional[int] = None
        self._prev_cpu_idle: Optional[int] = None
        self._prev_net_counters: dict[str, tuple[int, int, float]] = {}
        self._is_containerized: bool = _detect_container_environment()

    def collect_cpu(self) -> tuple[float, int, bool]:
        """Collect CPU utilization (%) via tick delta and logical CPU core count."""
        raw_cores = self._cpu_count_fn()
        cores = max(1, int(raw_cores)) if raw_cores and raw_cores > 0 else 1

        stat_text = self._proc_stat_reader()
        cpu_line: Optional[str] = None
        for line in stat_text.splitlines():
            stripped = line.strip()
            if stripped.startswith("cpu "):
                cpu_line = stripped
                break

        if not cpu_line:
            raise ValueError("Missing aggregate 'cpu ' line in /proc/stat")

        parts = cpu_line.split()[1:]
        if len(parts) < 4:
            raise ValueError("Malformed 'cpu ' line in /proc/stat: insufficient fields")

        values = [int(x) for x in parts[:8]]
        while len(values) < 8:
            values.append(0)

        # user, nice, system, idle, iowait, irq, softirq, steal
        idle_all = values[3] + values[4]
        non_idle = values[0] + values[1] + values[2] + values[5] + values[6] + values[7]
        total = idle_all + non_idle

        if self._prev_cpu_total is None or self._prev_cpu_idle is None:
            self._prev_cpu_total = total
            self._prev_cpu_idle = idle_all
            return 0.0, cores, True

        delta_total = total - self._prev_cpu_total
        delta_idle = idle_all - self._prev_cpu_idle

        self._prev_cpu_total = total
        self._prev_cpu_idle = idle_all

        if delta_total <= 0 or delta_idle < 0:
            # Zero elapsed ticks or counter rollover/reset: avoid division by zero
            return 0.0, cores, False

        busy_ticks = max(0, delta_total - delta_idle)
        usage_pct = (busy_ticks / float(delta_total)) * 100.0
        return round(sanitize_finite_float(usage_pct, 0.0, 0.0, 100.0), 2), cores, False

    def collect_ram(self) -> tuple[int, int, int, float]:
        """Collect RAM total_bytes, used_bytes, available_bytes, and usage_percent."""
        meminfo_text = self._proc_meminfo_reader()
        parsed_kb: dict[str, int] = {}

        for line in meminfo_text.splitlines():
            if ":" not in line:
                continue
            key, rest = line.split(":", 1)
            tokens = rest.strip().split()
            if tokens and tokens[0].isdigit():
                parsed_kb[key.strip()] = int(tokens[0])

        total_kb = parsed_kb.get("MemTotal", 0)
        if total_kb <= 0:
            raise ValueError("MemTotal is missing or zero in memory source")

        if "MemAvailable" in parsed_kb:
            avail_kb = parsed_kb["MemAvailable"]
        else:
            avail_kb = (
                parsed_kb.get("MemFree", 0)
                + parsed_kb.get("Buffers", 0)
                + parsed_kb.get("Cached", 0)
                + parsed_kb.get("SReclaimable", 0)
            )

        total_bytes = max(0, total_kb * 1024)
        available_bytes = max(0, min(total_bytes, avail_kb * 1024))
        used_bytes = max(0, total_bytes - available_bytes)

        usage_pct = (used_bytes / float(total_bytes)) * 100.0
        return (
            total_bytes,
            used_bytes,
            available_bytes,
            round(sanitize_finite_float(usage_pct, 0.0, 0.0, 100.0), 2),
        )

    def collect_disk(self) -> tuple[int, int, int, float, list[DiskFilesystemMetric], list[str]]:
        """Collect disk usage across real mounted filesystems in bytes and percentage."""
        mounts = self._mounts_reader()
        seen_devices: set[str] = set()
        filesystems: list[DiskFilesystemMetric] = []
        skipped_mounts: list[str] = []

        total_bytes_sum = 0
        used_bytes_sum = 0
        avail_bytes_sum = 0

        for device, mount_point, fs_type in mounts:
            fs_lower = (fs_type or "").lower()
            if fs_lower in VIRTUAL_FS_TYPES:
                continue
            if any(mount_point.startswith(prefix) for prefix in IGNORED_MOUNT_PREFIXES):
                continue
            if device in seen_devices:
                continue

            try:
                usage = self._disk_usage_fn(mount_point)
                m_total = int(getattr(usage, "total", 0))
                m_used = int(getattr(usage, "used", 0))
                m_free = int(getattr(usage, "free", 0))
            except (PermissionError, OSError) as err:
                logger.debug("Skipping inaccessible mount %s: %s", mount_point, err)
                skipped_mounts.append(mount_point)
                continue

            if m_total <= 0:
                continue

            seen_devices.add(device)
            m_used = max(0, min(m_total, m_used))
            m_free = max(0, min(m_total, m_free))
            m_pct = round(sanitize_finite_float((m_used / float(m_total)) * 100.0, 0.0, 0.0, 100.0), 2)

            filesystems.append(
                DiskFilesystemMetric(
                    device=device,
                    mount_point=mount_point,
                    fs_type=fs_lower or "unknown",
                    total_bytes=m_total,
                    used_bytes=m_used,
                    available_bytes=m_free,
                    usage_percent=m_pct,
                )
            )
            total_bytes_sum += m_total
            used_bytes_sum += m_used
            avail_bytes_sum += m_free

        if total_bytes_sum <= 0:
            raise ValueError("No valid readable filesystems found for disk metrics")

        overall_pct = round(
            sanitize_finite_float((used_bytes_sum / float(total_bytes_sum)) * 100.0, 0.0, 0.0, 100.0),
            2,
        )
        return (
            total_bytes_sum,
            used_bytes_sum,
            avail_bytes_sum,
            overall_pct,
            filesystems,
            skipped_mounts,
        )

    def collect_network(self) -> tuple[int, int, float, float, list[NetworkInterfaceMetric], bool]:
        """Collect cumulative network RX/TX bytes and delta rates (bytes/sec) per interface."""
        now_mono = self._clock_fn()
        net_text = self._proc_net_dev_reader()

        interfaces: list[NetworkInterfaceMetric] = []
        current_ifaces: set[str] = set()
        total_rx_bytes = 0
        total_tx_bytes = 0
        total_rx_rate = 0.0
        total_tx_rate = 0.0
        any_warmup = False

        for line in net_text.splitlines():
            if ":" not in line:
                continue
            iface_raw, stats_raw = line.split(":", 1)
            iface = iface_raw.strip()
            if not iface:
                continue

            if not self.include_loopback and (iface == "lo" or iface.startswith("lo") or "loopback" in iface.lower()):
                continue

            fields = stats_raw.split()
            if len(fields) < 11:
                continue

            rx_bytes = max(0, int(fields[0]))
            rx_packets = max(0, int(fields[1]))
            rx_errors = max(0, int(fields[2]))
            tx_bytes = max(0, int(fields[8]))
            tx_packets = max(0, int(fields[9]))
            tx_errors = max(0, int(fields[10]))

            current_ifaces.add(iface)
            prev = self._prev_net_counters.get(iface)

            rx_rate = 0.0
            tx_rate = 0.0
            is_warmup = False
            counter_reset = False

            if prev is None:
                is_warmup = True
                any_warmup = True
            else:
                prev_rx, prev_tx, prev_time = prev
                dt = now_mono - prev_time
                if rx_bytes < prev_rx or tx_bytes < prev_tx:
                    # Counter rollover or interface reset: never output negative rate
                    counter_reset = True
                    rx_rate = 0.0
                    tx_rate = 0.0
                elif dt > 0.0:
                    rx_rate = round(sanitize_finite_float((rx_bytes - prev_rx) / dt, 0.0, 0.0), 2)
                    tx_rate = round(sanitize_finite_float((tx_bytes - prev_tx) / dt, 0.0, 0.0), 2)

            self._prev_net_counters[iface] = (rx_bytes, tx_bytes, now_mono)

            total_rx_bytes += rx_bytes
            total_tx_bytes += tx_bytes
            total_rx_rate += rx_rate
            total_tx_rate += tx_rate

            interfaces.append(
                NetworkInterfaceMetric(
                    interface=iface,
                    rx_bytes=rx_bytes,
                    tx_bytes=tx_bytes,
                    rx_packets=rx_packets,
                    tx_packets=tx_packets,
                    rx_errors=rx_errors,
                    tx_errors=tx_errors,
                    rx_bytes_per_sec=rx_rate,
                    tx_bytes_per_sec=tx_rate,
                    is_warmup=is_warmup,
                    counter_reset=counter_reset,
                )
            )

        # Clean up disappeared interfaces so state map does not leak or keep stale baselines
        stale_ifaces = set(self._prev_net_counters.keys()) - current_ifaces
        for stale in stale_ifaces:
            self._prev_net_counters.pop(stale, None)

        return (
            total_rx_bytes,
            total_tx_bytes,
            round(sanitize_finite_float(total_rx_rate, 0.0, 0.0), 2),
            round(sanitize_finite_float(total_tx_rate, 0.0, 0.0), 2),
            interfaces,
            any_warmup,
        )

    def collect_snapshot(self) -> AgentNodeMetricsData:
        """Collect an isolated, fault-tolerant snapshot of all Node/Host resources."""
        now_iso = datetime.now(timezone.utc).isoformat()
        errors: dict[str, str] = {}
        metadata: dict[str, Any] = {
            "is_containerized": self._is_containerized,
            "platform": sys.platform,
        }

        # 1. CPU
        cpu_pct = 0.0
        cpu_cores = 1
        cpu_warmup = False
        try:
            cpu_pct, cpu_cores, cpu_warmup = self.collect_cpu()
            metadata["cpu_warmup"] = cpu_warmup
        except Exception as err:
            logger.warning("CPU metric collection failed on node %s: %s", self.node_name, err)
            errors["cpu"] = str(err)

        # 2. RAM
        ram_total, ram_used, ram_avail, ram_pct = 0, 0, 0, 0.0
        try:
            ram_total, ram_used, ram_avail, ram_pct = self.collect_ram()
        except Exception as err:
            logger.warning("RAM metric collection failed on node %s: %s", self.node_name, err)
            errors["ram"] = str(err)

        # 3. Disk
        disk_total, disk_used, disk_avail, disk_pct = 0, 0, 0, 0.0
        disk_fs: list[DiskFilesystemMetric] = []
        try:
            disk_total, disk_used, disk_avail, disk_pct, disk_fs, skipped = self.collect_disk()
            if skipped:
                metadata["disk_skipped_mounts"] = skipped
        except Exception as err:
            logger.warning("Disk metric collection failed on node %s: %s", self.node_name, err)
            errors["disk"] = str(err)

        # 4. Network I/O
        net_rx, net_tx = 0, 0
        net_rx_rate, net_tx_rate = 0.0, 0.0
        net_ifaces: list[NetworkInterfaceMetric] = []
        net_warmup = False
        try:
            net_rx, net_tx, net_rx_rate, net_tx_rate, net_ifaces, net_warmup = self.collect_network()
            metadata["net_warmup"] = net_warmup
        except Exception as err:
            logger.warning("Network metric collection failed on node %s: %s", self.node_name, err)
            errors["network"] = str(err)

        if len(errors) == 4:
            status: Any = "ERROR"
        elif errors:
            status = "PARTIAL"
        elif cpu_warmup or net_warmup:
            status = "WARMUP"
        else:
            status = "OK"

        return AgentNodeMetricsData(
            node_name=self.node_name,
            timestamp=now_iso,
            cpu_usage_percent=cpu_pct,
            cpu_cores=cpu_cores,
            ram_total_bytes=ram_total,
            ram_used_bytes=ram_used,
            ram_available_bytes=ram_avail,
            ram_usage_percent=ram_pct,
            disk_total_bytes=disk_total,
            disk_used_bytes=disk_used,
            disk_available_bytes=disk_avail,
            disk_usage_percent=disk_pct,
            disk_filesystems=disk_fs,
            net_rx_bytes=net_rx,
            net_tx_bytes=net_tx,
            net_rx_bytes_per_sec=net_rx_rate,
            net_tx_bytes_per_sec=net_tx_rate,
            net_interfaces=net_ifaces,
            collection_status=status,
            collection_errors=errors,
            metadata=metadata,
        )
