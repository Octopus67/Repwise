#!/usr/bin/env python3
"""E2E API test suite for HypertrophyOS backend."""
import json
import subprocess
import sys
import os

# Redirect output to file
outfile = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "api_test_results.txt"), "w")

def log(msg=""):
    outfile.write(msg + "\n")
    outfile.flush()

BASE = "http://127.0.0.1:8000/api/v1"
TOKEN = ""
results = []

def run_curl(method, url, data=None, auth=None):
    cmd = ["curl", "-s", "--max-time", "5", "-w", "\nHTTP_CODE:%{http_code}", "-X", method]
    cmd += ["-H", "Content-Type: application/json"]
    if auth:
        cmd += ["-H", f"Authorization: Bearer {auth}"]
    if data:
        cmd += ["-d", data]
    cmd.append(url)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = result.stdout
        lines = output.strip().split("\n")
        http_code = ""
        body_lines = []
        for line in lines:
            if line.startswith("HTTP_CODE:"):
                http_code = line.replace("HTTP_CODE:", "")
            else:
                body_lines.append(line)
        body = "\n".join(body_lines)
        return http_code, body
    except Exception as e:
        return "ERR", str(e)

def test(num, name, method, path, data=None, auth=None):
    global TOKEN
    url = f"{BASE}{path}"
    http_code, body = run_curl(method, url, data, auth)
    body_short = body[:200] if body else "(empty)"
    
    try:
        code_int = int(http_code)
        passed = 200 <= code_int < 300
    except:
        passed = False
    
    status = "PASSED" if passed else "FAILED"
    
    log(f"=== TEST {num}: {name} ===")
    log(f"CMD: {method} {url}")
    if data:
        log(f"DATA: {data[:100]}")
    log(f"HTTP STATUS: {http_code}")
    log(f"RESPONSE: {body_short}")
    log(f"RESULT: {status}")
    log()
    
    results.append((num, name, http_code, status))
    return http_code, body

log("=" * 50)
log("  HypertrophyOS API E2E TEST SUITE")
log("=" * 50)
log()

# 1: Health check
test("1", "Health Check", "GET", "/health")

# 2: Register
test("2", "Register User", "POST", "/auth/register",
     '{"email":"test@example.com","password":"Test1234!","name":"Test User"}')

# 3: Login
code, body = test("3", "Login", "POST", "/auth/login",
     '{"email":"test@example.com","password":"Test1234!"}')

# Extract token
try:
    d = json.loads(body)
    TOKEN = d.get("access_token", "") or d.get("data", {}).get("access_token", "") or d.get("token", "")
except:
    TOKEN = ""

print(f"--- Extracted JWT Token: {TOKEN[:50]}... ---")
print()

# 5: Get profile
test("5", "Get Profile (GET /users/me)", "GET", "/users/me", auth=TOKEN)

# 6: Update profile
test("6", "Update Profile (PUT /users/me)", "PUT", "/users/me",
     '{"display_name":"Updated User","timezone":"UTC"}', auth=TOKEN)

# 7: Create nutrition goal
test("7", "Create Nutrition Goal", "POST", "/nutrition/goals",
     '{"daily_calories":2500,"daily_protein_g":180,"daily_carbs_g":300,"daily_fat_g":80}', auth=TOKEN)

# Try alternate nutrition endpoints if needed
if results[-1][3] == "FAILED":
    test("7b", "Nutrition Entries (POST)", "POST", "/nutrition/entries",
         '{"meal_name":"Lunch","calories":500,"protein_g":40,"carbs_g":60,"fat_g":15,"entry_date":"2025-01-15"}', auth=TOKEN)

# 8: Log a meal
test("8", "Log a Meal", "POST", "/meals",
     '{"name":"Chicken Breast","calories":300,"protein_g":50,"carbs_g":5,"fat_g":8}', auth=TOKEN)

# Try alternate meal endpoint
if results[-1][3] == "FAILED":
    test("8b", "Log Meal (custom)", "POST", "/meals/custom",
         '{"name":"Chicken Breast","calories":300,"protein_g":50,"carbs_g":5,"fat_g":8,"source_type":"manual"}', auth=TOKEN)

# 9: Log training session
test("9", "Log Training Session", "POST", "/training/sessions",
     '{"session_date":"2025-01-15","exercises":[{"name":"Bench Press","sets":3,"reps":10,"weight_kg":80}]}', auth=TOKEN)

# 10: Get food items
test("10", "Get Food Items", "GET", "/food/items")

# 11: Get content articles
test("11", "Get Content Articles", "GET", "/content/articles")

# 12: Get coaching
test("12", "Get Coaching Tips", "GET", "/coaching/tips", auth=TOKEN)
if results[-1][3] == "FAILED":
    test("12b", "Get Coaching Requests", "GET", "/coaching/requests", auth=TOKEN)

# 13: Get health reports
test("13", "Get Health Reports", "GET", "/health/reports", auth=TOKEN)

# 14: Get founder story
test("14", "Get Founder Story", "GET", "/founder/story")

# 15: Get community posts
test("15", "Get Community Posts", "GET", "/community/posts")

# 16: Get adaptive recommendations
test("16", "Get Adaptive Recommendations", "GET", "/adaptive/recommendations", auth=TOKEN)
if results[-1][3] == "FAILED":
    test("16b", "Get Adaptive Snapshot", "GET", "/adaptive/snapshot", auth=TOKEN)

# 17: Get account info
test("17", "Get Account Info", "GET", "/account", auth=TOKEN)

print()
print("=" * 50)
print("  SUMMARY TABLE")
print("=" * 50)
print(f"{'#':<5} {'Endpoint':<40} {'HTTP':<6} {'Result':<8}")
print("-" * 60)
passed = 0
failed = 0
for num, name, code, status in results:
    print(f"{num:<5} {name:<40} {code:<6} {status:<8}")
    if status == "PASSED":
        passed += 1
    else:
        failed += 1

print("-" * 60)
print(f"TOTAL: {passed} PASSED, {failed} FAILED out of {len(results)} tests")
