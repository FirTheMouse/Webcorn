#!/bin/bash

SERVER="https://goldensystems.ca:443"
# SERVER="http://localhost:443"
NUM_USERS=10

trap 'kill 0' SIGINT SIGTERM


simulate_user() {
    local user_id=$1
    
    # Bootstrap: get a session token from the initial page load
    local cookie_jar="/tmp/user_${user_id}_cookies.txt"
    curl -s -c "$cookie_jar" "$SERVER/" > /dev/null
    local session=$(grep "guestid" "$cookie_jar" | awk '{print $NF}')
    
    if [ -z "$session" ]; then
        echo "User $user_id failed to get a session"
        return
    fi
    echo "User $user_id got session: ${session:0:16}..."
    
    while true; do
        # Simulate a page load burst (root + assets loading concurrently)
        local concurrency=$((RANDOM % 8 + 3))   # 3-10 concurrent
        local requests=$((RANDOM % 30 + 10))     # 10-40 requests
        
        ab -n $requests -c $concurrency \
           -C "guestid=$session" \
           -q \
           "$SERVER/" 2>&1 | grep -E "Requests per second|Failed requests"
        
        # Irregular idle: mostly short, occasionally long (realistic reading time)
        local roll=$((RANDOM % 10))
        local idle
        if [ $roll -lt 7 ]; then
            idle=$((RANDOM % 5 + 1))    # 70% chance: 1-5s (active user)
        else
            idle=$((RANDOM % 20 + 10))  # 30% chance: 10-30s (reading)
        fi
        echo "User $user_id sleeping ${idle}s"
        sleep $idle
    done
}

# Stagger user startup so they don't all bootstrap simultaneously
for i in $(seq 1 $NUM_USERS); do
    startup_delay=$((RANDOM % 8))
    echo "Starting user $i in ${startup_delay}s"
    (sleep $startup_delay && simulate_user $i) &
done

echo "All $NUM_USERS users started. Press Ctrl+C to stop."
wait