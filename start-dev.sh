#!/bin/bash
# Robust dev server runner — survives shell session termination.
# Uses setsid for full process-group detachment + auto-restart on crash.
# Logs to /tmp/timeblack-dev.log with timestamped entries.

cd /home/z/my-project

LOG="/tmp/timeblack-dev.log"
PIDFILE="/tmp/timeblack-dev.pid"

# Kill any existing instance
if [ -f "$PIDFILE" ]; then
  OLDPID=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    kill -- "-$OLDPID" 2>/dev/null || kill "$OLDPID" 2>/dev/null
    sleep 2
  fi
  rm -f "$PIDFILE"
fi
# Also kill any stray next processes
pkill -f "next-server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 1

# Start in a new session, fully detached
echo "[$(date '+%H:%M:%S')] starting dev server..." > "$LOG"

setsid bash -c '
  cd /home/z/my-project
  while true; do
    echo "[$(date '\''+%H:%M:%S'\'')] (re)starting next dev..." >> "'"$LOG"'"
    bun run dev >> "'"$LOG"'" 2>&1
    EXIT=$?
    echo "[$(date '\''+%H:%M:%S'\'')] dev exited with code $EXIT, restarting in 3s..." >> "'"$LOG"'"
    sleep 3
  done
' </dev/null >/dev/null 2>&1 &
GUARDPID=$!
echo "$GUARDPID" > "$PIDFILE"

# Wait for server to be ready
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "✓ server ready after ${i}s (guard PID: $GUARDPID)"
    exit 0
  fi
  sleep 1
done
echo "✗ server failed to start in 40s"
tail -20 "$LOG"
exit 1
