@echo off
chcp 65001 > nul
cd /d "D:\code\中绿康桥公众号\md2wechat"
npm run dev > dev-run.log 2>&1
