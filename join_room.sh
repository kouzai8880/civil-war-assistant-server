#!/bin/bash
ROOM_ID="67e942dd4e295e12ccdbb989"
TOKEN1=$(curl -s "https://dvmxujshaduv.sealoshzh.site/api/v1/auth/login" -X POST -H "Content-Type: application/json" -d "{\"email\": \"test1@example.com\", \"password\": \"password123\"}" | grep -o "\"token\":\"[^\"]*" | cut -d"\"" -f4)
