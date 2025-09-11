#!/usr/bin/env bash

echo 'Install npm-check-updates...'
npm install -g npm-check-updates

echo 'Check for updates...'
ncu

echo 'Update package.json...'
ncu -u

echo 'Check for updates again...'
ncu

echo 'Install updated dependencies...'
npm install

echo 'Committing changes...'
git add package.json package-lock.json
git commit -m "Bump dependencies"
