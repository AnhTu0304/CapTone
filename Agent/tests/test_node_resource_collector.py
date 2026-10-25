"""Unit and smoke tests for Host/Node Resource Collector (Task 4.1 & 4.2)."""

import json
import math
import time
from collections import namedtuple
import pytest

from selfheal_agent.collectors.node_resources import (
    NodeResourceCollector,
    sanitize_finite_float,
)
from selfheal_agent.telemetry.schemas import AgentNodeMetricsData, NodeMetricsMessage

DiskUsageTuple = namedtuple("usage", ["total", "used", "free"])


# ==========================================
# 1. CPU Collector Tests
# ==========================================

def test_cpu_first_sample_and_delta_calculation() -> None:
    """CPU usage must be computed from counter deltas between consecutive samples."""
    # Sample 1: user=1000, nice=0, system=500, idle=8500, iowait=0 -> total=10000, idle=8500
    # Sample 2: user=1300, nice=0, system=700, idle=9000, iowait=0 -> total=11000, idle=9000
    # Delta total = 1000, Delta idle = 500 -> busy = 500 -> 50.0%
    stat_samples = [
        "cpu  1000 0 500 8500 0 0 0 0 0 0\ncpu0 500 0 250 4250 0 0 0 0 0 0\n",
        "cpu  1300 0 700 9000 0 0 0 0 0 0\ncpu0 650 0 350 4500 0 0 0 0 0 0\n",
    ]
    clock_values = [100.0, 105.0]

    collector = NodeResourceCollector(
        node_name="worker-node-01",
        proc_stat_reader=lambda: stat_samples.pop(0),
        proc_meminfo_reader=lambda: "MemTotal: 8000000 kB\nMemAvailable: 4000000 kB\n",
        mounts_reader=lambda: [("/dev/sda1", "/", "ext4")],
        disk_usage_fn=lambda _: DiskUsageTuple(100_000_000, 40_000_000, 60_000_000),
        proc_net_dev_reader=lambda: "Inter-|\n face |bytes\n  eth0: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0\n",
        cpu_count_fn=lambda: 4,
        clock_fn=lambda: clock_values.pop(0),
    )

    # First read: warmup, no division by zero
    snap1 = collector.collect_snapshot()
    assert snap1.cpu_cores == 4
    assert snap1.cpu_usage_percent == 0.0
    assert snap1.collection_status == "WARMUP"
    assert snap1.metadata.get("cpu_warmup") is True

    # Second read: delta calculation (50.0%)
    snap2 = collector.collect_snapshot()
    assert snap2.cpu_cores == 4
    assert snap2.cpu_usage_percent == 50.0
    assert snap2.collection_status == "OK"
    assert snap2.metadata.get("cpu_warmup") is False


def test_cpu_irregular_interval_and_zero_delta_protection() -> None:
    """CPU collector must not divide by zero when counters do not advance or regress."""
    stat_samples = [
        "cpu  2000 100 400 7500 0 0 0 0\n",
        "cpu  2000 100 400 7500 0 0 0 0\n",  # Identical counters (delta_total == 0)
        "cpu  1000 50 200 3000 0 0 0 0\n",   # Counter reset/regression (delta_total < 0)
        "cpu  1750 50 450 3750 0 0 0 0\n",   # Valid delta after reset: total 4250->6000 (+1750), idle 3000->3750 (+750) -> busy 1000/1750 = 57.14%
    ]
    clock_values = [10.0, 10.0, 12.5, 19.8]

    collector = NodeResourceCollector(
        node_name="worker-node-01",
        proc_stat_reader=lambda: stat_samples.pop(0),
        proc_meminfo_reader=lambda: "MemTotal: 4000000 kB\nMemAvailable: 2000000 kB\n",
        mounts_reader=lambda: [("/dev/sda1", "/", "ext4")],
        disk_usage_fn=lambda _: DiskUsageTuple(50_000_000, 25_000_000, 25_000_000),
        proc_net_dev_reader=lambda: "Inter-|\n face |bytes\n  eth0: 500 5 0 0 0 0 0 0 500 5 0 0 0 0 0 0\n",
        cpu_count_fn=lambda: 8,
        clock_fn=lambda: clock_values.pop(0),
    )

    s1 = collector.collect_snapshot()
    assert s1.cpu_usage_percent == 0.0

    # Zero delta total -> safe 0.0, no ZeroDivisionError
    s2 = collector.collect_snapshot()
    assert s2.cpu_usage_percent == 0.0
    assert math.isfinite(s2.cpu_usage_percent)

    # Counter regression -> safe 0.0, resets baseline to 4250
    s3 = collector.collect_snapshot()
    assert s3.cpu_usage_percent == 0.0

    # Next sample after reset -> 1000 / 1750 * 100 = 57.14%
    s4 = collector.collect_snapshot()
    assert s4.cpu_usage_percent == 57.14


# ==========================================
# 2. RAM Collector Tests
# ==========================================

def test_ram_calculation_and_fallback_memfree() -> None:
    """RAM collector computes total, used, available bytes and usage % accurately."""
    # Case A: MemAvailable present
    meminfo_a = (
        "MemTotal:       16384000 kB\n"
        "MemFree:         2048000 kB\n"
        "MemAvailable:    6144000 kB\n"
        "Buffers:          512000 kB\n"
        "Cached:          3584000 kB\n"
    )
    collector = NodeResourceCollector(
        node_name="node-ram-test",
        proc_stat_reader=lambda: "cpu  100 0 100 800 0 0 0 0\n",
        proc_meminfo_reader=lambda: meminfo_a,
        mounts_reader=lambda: [("/dev/sda1", "/", "ext4")],
        disk_usage_fn=lambda _: DiskUsageTuple(1000, 500, 500),
        proc_net_dev_reader=lambda: "Inter-|\n face |bytes\n  eth0: 100 1 0 0 0 0 0 0 100 1 0 0 0 0 0 0\n",
    )
    snap = collector.collect_snapshot()
    assert snap.ram_total_bytes == 16384000 * 1024
    assert snap.ram_available_bytes == 6144000 * 1024
    assert snap.ram_used_bytes == (16384000 - 6144000) * 1024
    assert snap.ram_usage_percent == 62.5

    # Case B: Older kernel without MemAvailable (uses MemFree + Buffers + Cached + SReclaimable)
    meminfo_b = (
        "MemTotal:       10000000 kB\n"
        "MemFree:         1000000 kB\n"
        "Buffers:          500000 kB\n"
        "Cached:          1000000 kB\n"
        "SReclaimable:     500000 kB\n"
    )
    collector_b = NodeResourceCollector(
        node_name="node-ram-fallback",
        proc_stat_reader=lambda: "cpu  100 0 100 800 0 0 0 0\n",
        proc_meminfo_reader=lambda: meminfo_b,
        mounts_reader=lambda: [("/dev/sda1", "/", "ext4")],
        disk_usage_fn=lambda _: DiskUsageTuple(1000, 500, 500),
        proc_net_dev_reader=lambda: "Inter-|\n face |bytes\n  eth0: 100 1 0 0 0 0 0 0 100 1 0 0 0 0 0 0\n",
    )
    snap_b = collector_b.collect_snapshot()
    assert snap_b.ram_total_bytes == 10000000 * 1024
    assert snap_b.ram_available_bytes == 3000000 * 1024
    assert snap_b.ram_used_bytes == 7000000 * 1024
    assert snap_b.ram_usage_percent == 70.0


def test_ram_zero_total_and_missing_data() -> None:
    """RAM collector handles total == 0 and missing MemTotal without dividing by zero."""
    collector_zero = NodeResourceCollector(
        node_name="node-ram-zero",
        proc_stat_reader=lambda: "cpu  100 0 100 800 0 0 0 0\n",
        proc_meminfo_reader=lambda: "MemTotal: 0 kB\nMemAvailable: 0 kB\n",
        mounts_reader=lambda: [("/dev/sda1", "/", "ext4")],
        disk_usage_fn=lambda _: DiskUsageTuple(1000, 500, 500),
        proc_net_dev_reader=lambda: "Inter-|\n face |bytes\n  eth0: 100 1 0 0 0 0 0 0 100 1 0 0 0 0 0 0\n",
    )
    snap = collector_zero.collect_snapshot()
    assert snap.ram_total_bytes == 0
    assert snap.ram_usage_percent == 0.0
    assert "ram" in snap.collection_errors
    assert snap.collection_status == "PARTIAL"


# ==========================================
# 3. Disk Collector Tests
# ==========================================

def test_disk_multiple_filesystems_virtual_filtering_and_permission_error() -> None:
    """Disk collector skips virtual filesystems, deduplicates devices, and tolerates inaccessible mounts."""
    mounts = [
        ("proc", "/proc", "proc"),
        ("tmpfs", "/run", "tmpfs"),
        ("overlay", "/var/lib/docker/overlay2/abc", "overlay"),
        ("/dev/nvme0n1p1", "/", "ext4"),
        ("/dev/nvme0n1p1", "/etc/hosts", "ext4"),  # Duplicate device bind mount -> must be deduplicated
        ("/dev/nvme0n1p2", "/mnt/data", "xfs"),
        ("/dev/nvme0n1p3", "/mnt/secret", "ext4"),  # Will raise PermissionError
    ]

    def fake_disk_usage(mount_point: str) -> DiskUsageTuple:
        if mount_point == "/":
            return DiskUsageTuple(total=100_000_000_000, used=40_000_000_000, free=60_000_000_000)
        if mount_point == "/mnt/data":
            return DiskUsageTuple(total=300_000_000_000, used=160_000_000_000, free=140_000_000_000)
        if mount_point == "/mnt/secret":
            raise PermissionError("Permission denied: '/mnt/secret'")
        raise OSError(f"Unexpected mount queried: {mount_point}")

    collector = NodeResourceCollector(
        node_name="node-disk-test",
        proc_stat_reader=lambda: "cpu  100 0 100 800 0 0 0 0\n",
        proc_meminfo_reader=lambda: "MemTotal: 8000000 kB\nMemAvailable: 4000000 kB\n",
        mounts_reader=lambda: mounts,
        disk_usage_fn=fake_disk_usage,
        proc_net_dev_reader=lambda: "Inter-|\n face |bytes\n  eth0: 100 1 0 0 0 0 0 0 100 1 0 0 0 0 0 0\n",
    )

    snap = collector.collect_snapshot()
    # Only / and /mnt/data should be included (total 400 GB, used 200 GB, available 200 GB -> 50.0%)
    assert len(snap.disk_filesystems) == 2
    assert snap.disk_total_bytes == 400_000_000_000
    assert snap.disk_used_bytes == 200_000_000_000
    assert snap.disk_available_bytes == 200_000_000_000
    assert snap.disk_usage_percent == 50.0
    assert snap.metadata.get("disk_skipped_mounts") == ["/mnt/secret"]


# ==========================================
# 4. Network I/O Collector Tests
# ==========================================

def test_network_multi_interface_disappearance_and_counter_reset() -> None:
    """Network collector computes per-sec rates, handles interface disappearance, and resets on counter rollover."""
    # Sample 1 (t=10.0s): eth0 (rx=1000, tx=2000), ens192 (rx=5000, tx=6000), lo (rx=99999, tx=99999)
    net_sample_1 = (
        "Inter-|   Receive                                                |  Transmit\n"
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n"
        "    lo:   99999     100    0    0    0     0          0         0    99999     100    0    0    0     0       0          0\n"
        "  eth0:    1000      10    0    0    0     0          0         0     2000      20    0    0    0     0       0          0\n"
        "ens192:    5000      50    1    0    0     0          0         0     6000      60    2    0    0     0       0          0\n"
    )
    # Sample 2 (t=15.0s, dt=5.0s): eth0 (+5000 rx -> 1000 B/s, +10000 tx -> 2000 B/s), ens192 (+2500 rx -> 500 B/s, +5000 tx -> 1000 B/s)
    net_sample_2 = (
        "Inter-|   Receive                                                |  Transmit\n"
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n"
        "    lo:   99999     100    0    0    0     0          0         0    99999     100    0    0    0     0       0          0\n"
        "  eth0:    6000      60    0    0    0     0          0         0    12000     120    0    0    0     0       0          0\n"
        "ens192:    7500      75    1    0    0     0          0         0    11000     110    2    0    0     0       0          0\n"
    )
    # Sample 3 (t=20.0s, dt=5.0s): ens192 disappeared! eth0 counter reset (rx=500 < 6000, tx=1000 < 12000)
    net_sample_3 = (
        "Inter-|   Receive                                                |  Transmit\n"
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n"
        "  eth0:     500       5    0    0    0     0          0         0     1000      10    0    0    0     0       0          0\n"
    )

    net_samples = [net_sample_1, net_sample_2, net_sample_3]
    clocks = [10.0, 15.0, 20.0]

    collector = NodeResourceCollector(
        node_name="node-net-test",
        proc_stat_reader=lambda: "cpu  100 0 100 800 0 0 0 0\n",
        proc_meminfo_reader=lambda: "MemTotal: 8000000 kB\nMemAvailable: 4000000 kB\n",
        mounts_reader=lambda: [("/dev/sda1", "/", "ext4")],
        disk_usage_fn=lambda _: DiskUsageTuple(1000, 500, 500),
        proc_net_dev_reader=lambda: net_samples.pop(0),
        clock_fn=lambda: clocks.pop(0),
    )

    # Read 1: Warmup, lo excluded
    s1 = collector.collect_snapshot()
    assert len(s1.net_interfaces) == 2
    assert s1.net_rx_bytes == 6000
    assert s1.net_tx_bytes == 8000
    assert s1.net_rx_bytes_per_sec == 0.0
    assert s1.net_tx_bytes_per_sec == 0.0

    # Read 2: Delta rates over 5 seconds
    s2 = collector.collect_snapshot()
    assert len(s2.net_interfaces) == 2
    assert s2.net_rx_bytes == 13500
    assert s2.net_tx_bytes == 23000
    assert s2.net_rx_bytes_per_sec == 1500.0  # 1000 (eth0) + 500 (ens192)
    assert s2.net_tx_bytes_per_sec == 3000.0  # 2000 (eth0) + 1000 (ens192)

    # Read 3: ens192 disappeared & eth0 counter reset -> no negative rates, no crash
    s3 = collector.collect_snapshot()
    assert len(s3.net_interfaces) == 1
    assert s3.net_interfaces[0].interface == "eth0"
    assert s3.net_interfaces[0].counter_reset is True
    assert s3.net_rx_bytes == 500
    assert s3.net_tx_bytes == 1000
    assert s3.net_rx_bytes_per_sec == 0.0
    assert s3.net_tx_bytes_per_sec == 0.0


# ==========================================
# 5. Fault Isolation, NaN Prevention & Real OS Smoke Test
# ==========================================

def test_partial_collector_failure_isolation_and_nan_prevention() -> None:
    """If CPU or Network fails, RAM and Disk still succeed and status is PARTIAL."""
    def failing_cpu_reader() -> str:
        raise RuntimeError("Simulated /proc/stat read failure")

    collector = NodeResourceCollector(
        node_name="node-partial-fault",
        proc_stat_reader=failing_cpu_reader,
        proc_meminfo_reader=lambda: "MemTotal: 8000000 kB\nMemAvailable: 2000000 kB\n",
        mounts_reader=lambda: [("/dev/sda1", "/", "ext4")],
        disk_usage_fn=lambda _: DiskUsageTuple(100_000, 25_000, 75_000),
        proc_net_dev_reader=lambda: "Inter-|\n face |bytes\n  eth0: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0\n",
    )

    snap = collector.collect_snapshot()
    assert snap.collection_status == "PARTIAL"
    assert "cpu" in snap.collection_errors
    # RAM, Disk, and Network still collected accurately
    assert snap.ram_usage_percent == 75.0
    assert snap.disk_usage_percent == 25.0
    assert snap.net_rx_bytes == 1000

    # Verify NaN / Infinity sanitizer
    assert sanitize_finite_float(float("nan"), 0.0) == 0.0
    assert sanitize_finite_float(float("inf"), 0.0) == 0.0
    assert sanitize_finite_float(float("-inf"), 0.0) == 0.0
    assert sanitize_finite_float(-5.0, 0.0, min_val=0.0) == 0.0

    # Verify WebSocket envelope serialization has no NaN/Infinity
    envelope = NodeMetricsMessage(data=snap)
    serialized = envelope.model_dump_json()
    parsed = json.loads(serialized)
    assert parsed["type"] == "node_metrics"
    assert parsed["data"]["node_name"] == "node-partial-fault"


def test_real_os_smoke_collection() -> None:
    """Smoke test collecting real host OS CPU, RAM, Disk, and Network I/O on the current machine."""
    collector = NodeResourceCollector()
    snap1 = collector.collect_snapshot()
    time.sleep(0.05)
    snap2 = collector.collect_snapshot()

    assert isinstance(snap2, AgentNodeMetricsData)
    assert snap2.node_name
    assert snap2.cpu_cores >= 1
    assert 0.0 <= snap2.cpu_usage_percent <= 100.0
    assert snap2.ram_total_bytes > 0
    assert snap2.ram_used_bytes >= 0
    assert snap2.ram_available_bytes >= 0
    assert 0.0 <= snap2.ram_usage_percent <= 100.0
    assert snap2.disk_total_bytes > 0
    assert 0.0 <= snap2.disk_usage_percent <= 100.0
    assert len(snap2.disk_filesystems) >= 1
    assert snap2.net_rx_bytes >= 0
    assert snap2.net_tx_bytes >= 0
    assert snap2.net_rx_bytes_per_sec >= 0.0
    assert snap2.net_tx_bytes_per_sec >= 0.0
    assert snap2.collection_status in ("OK", "PARTIAL")
