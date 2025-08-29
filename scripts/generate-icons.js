#!/usr/bin/env node

/**
 * Script to generate PWA icons
 * Note: This script requires the canvas package to be installed
 */

const fs = require('fs');
const path = require('path');

// Ensure public directory exists
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Function to generate icons
function generateIcon(size) {
  try {
    // Background
    const canvas = require('canvas').createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Bus icon
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);
    
    // Draw simple bus icon
    ctx.fillStyle = '#FFD700';
    
    // Bus body
    ctx.fillRect(size * 0.2, size * 0.3, size * 0.6, size * 0.4);
    
    // Windows
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(size * 0.25, size * 0.35, size * 0.1, size * 0.2);
    ctx.fillRect(size * 0.45, size * 0.35, size * 0.1, size * 0.2);
    ctx.fillRect(size * 0.65, size * 0.35, size * 0.1, size * 0.2);
    
    // Wheels
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(size * 0.3, size * 0.75, size * 0.08, 0, Math.PI * 2);
    ctx.arc(size * 0.7, size * 0.75, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    
    // Save icon
    const buffer = canvas.toBuffer('image/png');
    const iconPath = path.join(publicDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(iconPath, buffer);
    
    console.log(`✅ Generated icon: icon-${size}x${size}.png`);
  } catch (error) {
    console.error(`❌ Failed to generate icon (${size}x${size}):`, error.message);
    console.log('💡 Tip: Please install canvas package: npm install canvas');
  }
}

// Generate different icon sizes
const sizes = [16, 32, 48, 64, 128, 192, 256, 512];
sizes.forEach(generateIcon);

console.log('\n🎉 Icon generation completed!');
console.log('📁 Icon files have been saved to public/ directory');
console.log('🔧 If generation fails, please manually create icon files or use online tools to generate');
