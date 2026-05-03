#!/bin/bash
npm install --legacy-peer-deps
npm run dev > npm_output.log 2>&1 &
