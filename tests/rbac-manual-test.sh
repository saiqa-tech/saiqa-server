#!/bin/bash

# RBAC Manual Test Script
# Tests privilege escalation prevention and role hierarchy enforcement
# 
# Prerequisites:
# 1. Database is running and migrated
# 2. Server is running on http://localhost:3000
# 3. Admin user exists: admin@saiqa.dev / Admin@123
#
# Usage: bash tests/rbac-manual-test.sh

set -e

BASE_URL="http://localhost:3000/api"
ADMIN_COOKIES="test-admin-cookies.txt"
MANAGER_COOKIES="test-manager-cookies.txt"
USER_COOKIES="test-user-cookies.txt"

echo "=============================================="
echo "🔒 RBAC Manual Test Suite"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to test endpoint
test_endpoint() {
    local test_name="$1"
    local expected_status="$2"
    local actual_status="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$actual_status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name (HTTP $actual_status)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name (Expected: $expected_status, Got: $actual_status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up test data..."
    
    # Delete test manager user if exists
    if [ -f "$ADMIN_COOKIES" ]; then
        if [ -n "$MANAGER_USER_ID" ]; then
            curl -s -X DELETE "$BASE_URL/users/$MANAGER_USER_ID" \
                -b "$ADMIN_COOKIES" > /dev/null 2>&1 || true
        fi
        
        # Delete test regular user if exists
        if [ -n "$TEST_USER_ID" ]; then
            curl -s -X DELETE "$BASE_URL/users/$TEST_USER_ID" \
                -b "$ADMIN_COOKIES" > /dev/null 2>&1 || true
        fi
    fi
    
    rm -f "$ADMIN_COOKIES" "$MANAGER_COOKIES" "$USER_COOKIES"
}

trap cleanup EXIT

echo "Step 1: Login as Admin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ADMIN_LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@saiqa.dev","password":"Admin@123"}' \
    -c "$ADMIN_COOKIES")

ADMIN_STATUS=$(echo "$ADMIN_LOGIN" | tail -n1)

if [ "$ADMIN_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅${NC} Admin login successful"
    ADMIN_ID=$(echo "$ADMIN_LOGIN" | head -n-1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Admin User ID: $ADMIN_ID"
else
    echo -e "${RED}❌${NC} Admin login failed (HTTP $ADMIN_STATUS)"
    echo "   Make sure admin@saiqa.dev exists with password Admin@123"
    exit 1
fi

echo ""
echo "Step 2: Create Test Manager User"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MANAGER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users" \
    -H "Content-Type: application/json" \
    -d '{
        "email":"test-manager@example.com",
        "password":"Manager@123",
        "firstName":"Test",
        "lastName":"Manager",
        "role":"manager"
    }' \
    -b "$ADMIN_COOKIES")

MANAGER_CREATE_STATUS=$(echo "$MANAGER_RESPONSE" | tail -n1)

if [ "$MANAGER_CREATE_STATUS" -eq 201 ]; then
    echo -e "${GREEN}✅${NC} Manager user created"
    MANAGER_USER_ID=$(echo "$MANAGER_RESPONSE" | head -n-1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Manager User ID: $MANAGER_USER_ID"
else
    echo -e "${YELLOW}⚠️${NC}  Manager user might already exist (HTTP $MANAGER_CREATE_STATUS)"
    # Try to get existing manager
    EXISTING_MANAGERS=$(curl -s "$BASE_URL/users?role=manager" -b "$ADMIN_COOKIES")
    MANAGER_USER_ID=$(echo "$EXISTING_MANAGERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Using existing Manager ID: $MANAGER_USER_ID"
fi

echo ""
echo "Step 3: Create Test Regular User"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

USER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users" \
    -H "Content-Type: application/json" \
    -d '{
        "email":"test-user@example.com",
        "password":"User@123",
        "firstName":"Test",
        "lastName":"User",
        "role":"user"
    }' \
    -b "$ADMIN_COOKIES")

USER_CREATE_STATUS=$(echo "$USER_RESPONSE" | tail -n1)

if [ "$USER_CREATE_STATUS" -eq 201 ]; then
    echo -e "${GREEN}✅${NC} Regular user created"
    TEST_USER_ID=$(echo "$USER_RESPONSE" | head -n-1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Regular User ID: $TEST_USER_ID"
else
    echo -e "${YELLOW}⚠️${NC}  Regular user might already exist (HTTP $USER_CREATE_STATUS)"
    EXISTING_USERS=$(curl -s "$BASE_URL/users?role=user" -b "$ADMIN_COOKIES")
    TEST_USER_ID=$(echo "$EXISTING_USERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Using existing User ID: $TEST_USER_ID"
fi

echo ""
echo "Step 4: Login as Manager"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MANAGER_LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test-manager@example.com","password":"Manager@123"}' \
    -c "$MANAGER_COOKIES")

MANAGER_LOGIN_STATUS=$(echo "$MANAGER_LOGIN" | tail -n1)

if [ "$MANAGER_LOGIN_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅${NC} Manager login successful"
else
    echo -e "${RED}❌${NC} Manager login failed (HTTP $MANAGER_LOGIN_STATUS)"
    exit 1
fi

echo ""
echo "=============================================="
echo "🧪 RBAC Tests - Privilege Escalation Prevention"
echo "=============================================="
echo ""

# Test 1: Manager cannot view users list (should be able to)
echo "Test 1: Manager CAN view users list"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/users" -b "$MANAGER_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Manager views users list" 200 "$STATUS"
echo ""

# Test 2: Manager cannot update admin user (CRITICAL)
echo "Test 2: Manager CANNOT update admin user"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/users/$ADMIN_ID" \
    -H "Content-Type: application/json" \
    -d '{"firstName":"Hacked"}' \
    -b "$MANAGER_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Manager attempts to update admin user" 403 "$STATUS"
echo ""

# Test 3: Manager cannot delete admin user (CRITICAL)
echo "Test 3: Manager CANNOT delete admin user"
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/users/$ADMIN_ID" \
    -b "$MANAGER_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Manager attempts to delete admin user" 403 "$STATUS"
echo ""

# Test 4: Manager can update regular user (except role)
echo "Test 4: Manager CAN update regular user (non-admin)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/users/$TEST_USER_ID" \
    -H "Content-Type: application/json" \
    -d '{"firstName":"UpdatedByManager"}' \
    -b "$MANAGER_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Manager updates regular user" 200 "$STATUS"
echo ""

# Test 5: Manager cannot change user role (CRITICAL)
echo "Test 5: Manager CANNOT change user role"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/users/$TEST_USER_ID" \
    -H "Content-Type: application/json" \
    -d '{"role":"admin"}' \
    -b "$MANAGER_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Manager attempts to change user role to admin" 403 "$STATUS"
echo ""

# Test 6: Manager cannot create users (admin-only)
echo "Test 6: Manager CANNOT create new users"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users" \
    -H "Content-Type: application/json" \
    -d '{
        "email":"hacker@example.com",
        "password":"Hack@123",
        "firstName":"Hacker",
        "lastName":"User",
        "role":"admin"
    }' \
    -b "$MANAGER_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Manager attempts to create user" 403 "$STATUS"
echo ""

# Test 7: Manager cannot reset passwords (admin-only)
echo "Test 7: Manager CANNOT reset user passwords"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users/$TEST_USER_ID/reset-password" \
    -H "Content-Type: application/json" \
    -d '{"newPassword":"Hacked@123"}' \
    -b "$MANAGER_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Manager attempts to reset user password" 403 "$STATUS"
echo ""

# Test 8: Admin CAN update admin user
echo "Test 8: Admin CAN update admin user"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/users/$ADMIN_ID" \
    -H "Content-Type: application/json" \
    -d '{"firstName":"Admin"}' \
    -b "$ADMIN_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Admin updates admin user" 200 "$STATUS"
echo ""

# Test 9: Admin CAN change user role
echo "Test 9: Admin CAN change user role"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/users/$TEST_USER_ID" \
    -H "Content-Type: application/json" \
    -d '{"role":"user"}' \
    -b "$ADMIN_COOKIES")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Admin changes user role" 200 "$STATUS"
echo ""

# Test 10: Unauthenticated cannot access protected endpoint
echo "Test 10: Unauthenticated CANNOT access protected endpoint"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/users")
STATUS=$(echo "$RESPONSE" | tail -n1)
test_endpoint "Unauthenticated access to /users" 401 "$STATUS"
echo ""

# Summary
echo "=============================================="
echo "📊 RBAC TEST SUMMARY"
echo "=============================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"
echo "=============================================="
echo ""

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}🎉 All RBAC tests passed!${NC}"
    echo ""
    echo "✅ RBAC is properly enforced:"
    echo "   • Managers cannot update/delete admin users"
    echo "   • Managers cannot change user roles"
    echo "   • Managers cannot create users"
    echo "   • Managers cannot reset passwords"
    echo "   • Only admins have full privileges"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️  Some RBAC tests failed!${NC}"
    echo ""
    echo "Please review the failed tests above."
    echo "RBAC may not be properly enforced."
    echo ""
    exit 1
fi
