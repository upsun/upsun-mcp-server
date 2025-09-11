#!/usr/bin/env bash

echo "Remove production library..."
rm -rf node_modules/upsun-sdk-node

echo "Link local library..."
npm link upsun-sdk-node

echo "For revert, just run : npm install"
