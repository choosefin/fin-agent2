#!/bin/sh
# Process monitoring script for debugging Motia in Azure

echo "========================================"
echo "MOTIA PROCESS MONITOR"
echo "========================================"

# Monitor function
monitor_process() {
    local process_name="$1"
    local check_interval=1
    local max_checks=30
    local check_count=0
    
    echo "[MONITOR] Starting monitoring for: $process_name"
    echo "[MONITOR] Will check every ${check_interval}s for ${max_checks}s"
    
    while [ $check_count -lt $max_checks ]; do
        check_count=$((check_count + 1))
        
        # Check if process is running
        if pgrep -f "$process_name" > /dev/null; then
            pid=$(pgrep -f "$process_name" | head -1)
            echo "[MONITOR] [$check_count/$max_checks] Process running (PID: $pid)"
            
            # Get process details
            ps -p $pid -o pid,vsz,rss,pcpu,pmem,comm 2>/dev/null | tail -1
            
            # Check open files/sockets
            lsof -p $pid 2>/dev/null | grep -E "LISTEN|ESTABLISHED" | head -5
        else
            echo "[MONITOR] [$check_count/$max_checks] Process NOT running"
            
            # Check if it exited
            if [ $check_count -gt 5 ]; then
                echo "[MONITOR] Process appears to have crashed/exited"
                return 1
            fi
        fi
        
        sleep $check_interval
    done
    
    echo "[MONITOR] Monitoring complete"
    return 0
}

# Start Motia in background with output capture
echo "[START] Launching Motia in background..."
npx motia start --port ${PORT:-3001} --host 0.0.0.0 > /tmp/motia.log 2>&1 &
MOTIA_PID=$!

echo "[START] Motia launched with PID: $MOTIA_PID"

# Give it a moment to start
sleep 2

# Monitor the process
monitor_process "motia"

# Check exit status
if [ -f /tmp/motia.log ]; then
    echo ""
    echo "[LOGS] Motia output:"
    echo "----------------------------------------"
    cat /tmp/motia.log
    echo "----------------------------------------"
fi

# Check if process is still running
if ps -p $MOTIA_PID > /dev/null 2>&1; then
    echo "[STATUS] Motia is still running"
    kill $MOTIA_PID
else
    echo "[STATUS] Motia has exited"
fi