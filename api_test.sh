#!/bin/bash
BASE="http://127.0.0.1:8000/api/v1"
TOKEN=""
RESULTS=""

test_endpoint() {
    local num="$1"
    local name="$2"
    local method="$3"
    local url="$4"
    local data="$5"
    local auth="$6"
    
    local args="-s --max-time 5 -w \"\nHTTP_CODE:%{http_code}\" -X $method -H \"Content-Type: application/json\""
    
    if [ -n "$auth" ]; then
        args="$args -H \"Authorization: Bearer $auth\""
    fi
    
    if [ -n "$data" ]; then
        args="$args -d '$data'"
    fi
    
    args="$args $url"
    
    RESP=$(eval curl $args 2>/dev/null)
    HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | sed 's/HTTP_CODE://')
    BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")
    BODY_SHORT=$(echo "$BODY" | head -c 200)
    
    if [ "$HTTP_CODE" -ge 200 ] 2>/dev/null && [ "$HTTP_CODE" -lt 300 ] 2>/dev/null; then
        STATUS="PASSED"
    else
        STATUS="FAILED"
    fi
    
    echo "=== TEST $num: $name ==="
    echo "CMD: $method $url"
    if [ -n "$data" ]; then
        echo "DATA: $(echo $data | head -c 100)"
    fi
    echo "HTTP STATUS: $HTTP_CODE"
    echo "RESPONSE: $BODY_SHORT"
    echo "RESULT: $STATUS"
    echo ""
    
    echo "$BODY" > last_response.json
    RESULTS="$RESULTS|$num|$name|$HTTP_CODE|$STATUS|\n"
}

echo "=========================================="
echo "  HypertrophyOS API E2E TEST SUITE"
echo "=========================================="
echo ""

# 1: Health check
test_endpoint "1" "Health Check" "GET" "$BASE/health" "" ""

# 2: Register
test_endpoint "2" "Register User" "POST" "$BASE/auth/register" '{"email":"test@example.com","password":"Test1234!","name":"Test User"}' ""

# 3: Login
test_endpoint "3" "Login" "POST" "$BASE/auth/login" '{"email":"test@example.com","password":"Test1234!"}' ""

# Extract token
TOKEN=$(cat last_response.json | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    t=d.get('access_token','') or d.get('data',{}).get('access_token','') or d.get('token','')
    print(t)
except:
    print('')
" 2>/dev/null)

echo "--- Extracted JWT Token: ${TOKEN:0:40}... ---"
echo ""

# 5: Get user profile
test_endpoint "5" "Get Profile (GET /users/me)" "GET" "$BASE/users/me" "" "$TOKEN"

# 6: Update profile
test_endpoint "6" "Update Profile (PUT /users/me)" "PUT" "$BASE/users/me" '{"display_name":"Updated User","timezone":"UTC"}' "$TOKEN"

# 7: Create nutrition goal
test_endpoint "7" "Create Nutrition Goal" "POST" "$BASE/nutrition/goals" '{"daily_calories":2500,"daily_protein_g":180,"daily_carbs_g":300,"daily_fat_g":80}' "$TOKEN"

# 8: Log a meal
test_endpoint "8" "Log a Meal" "POST" "$BASE/meals" '{"name":"Chicken Breast","calories":300,"protein_g":50,"carbs_g":5,"fat_g":8}' "$TOKEN"

# 9: Log training session
test_endpoint "9" "Log Training Session" "POST" "$BASE/training/sessions" '{"session_date":"2025-01-15","exercises":[{"name":"Bench Press","sets":3,"reps":10,"weight_kg":80}]}' "$TOKEN"

# 10: Get food items
test_endpoint "10" "Get Food Items" "GET" "$BASE/food/items" "" ""

# 11: Get content articles
test_endpoint "11" "Get Content Articles" "GET" "$BASE/content/articles" "" ""

# 12: Get coaching tips/requests
test_endpoint "12" "Get Coaching Tips" "GET" "$BASE/coaching/tips" "" "$TOKEN"

# 13: Get health reports
test_endpoint "13" "Get Health Reports" "GET" "$BASE/health/reports" "" "$TOKEN"

# 14: Get founder story
test_endpoint "14" "Get Founder Story" "GET" "$BASE/founder/story" "" ""

# 15: Get community posts
test_endpoint "15" "Get Community Posts" "GET" "$BASE/community/posts" "" ""

# 16: Get adaptive recommendations
test_endpoint "16" "Get Adaptive Recommendations" "GET" "$BASE/adaptive/recommendations" "" "$TOKEN"

# 17: Get account info
test_endpoint "17" "Get Account Info" "GET" "$BASE/account" "" "$TOKEN"

echo ""
echo "=========================================="
echo "  SUMMARY TABLE"
echo "=========================================="
echo "| # | Endpoint | HTTP | Result |"
echo "|---|----------|------|--------|"
echo -e "$RESULTS"

rm -f last_response.json
