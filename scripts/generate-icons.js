#!/usr/bin/env node

/**
 * 生成PWA图标的脚本
 * 注意：这个脚本需要安装canvas包
 * npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// 确保public目录存在
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 生成图标的函数
function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 背景
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 0, size, size);
  
  // 公交图标
  const centerX = size / 2;
  const centerY = size / 2;
  const iconSize = size * 0.6;
  
  // 绘制简单的公交图标
  ctx.fillStyle = '#ffffff';
  
  // 车身
  ctx.fillRect(centerX - iconSize * 0.4, centerY - iconSize * 0.3, iconSize * 0.8, iconSize * 0.6);
  
  // 车窗
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(centerX - iconSize * 0.3, centerY - iconSize * 0.2, iconSize * 0.6, iconSize * 0.3);
  
  // 轮子
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.arc(centerX - iconSize * 0.25, centerY + iconSize * 0.25, iconSize * 0.1, 0, 2 * Math.PI);
  ctx.arc(centerX + iconSize * 0.25, centerY + iconSize * 0.25, iconSize * 0.1, 0, 2 * Math.PI);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

// 生成不同尺寸的图标
const sizes = [192, 512];

sizes.forEach(size => {
  try {
    const iconBuffer = generateIcon(size);
    const iconPath = path.join(publicDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(iconPath, iconBuffer);
    console.log(`✅ 生成图标: icon-${size}x${size}.png`);
  } catch (error) {
    console.error(`❌ 生成图标失败 (${size}x${size}):`, error.message);
    console.log('💡 提示: 请安装canvas包: npm install canvas');
  }
});

console.log('\n🎉 图标生成完成！');
console.log('📁 图标文件已保存到 public/ 目录');
console.log('🔧 如果生成失败，请手动创建图标文件或使用在线工具生成');
