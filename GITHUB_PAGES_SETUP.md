# GitHub Pages Setup Guide

## Prerequisites
1. Your repository must be public (or you have GitHub Pro for private repos)
2. GitHub Actions must be enabled for your repository

## Repository Settings

### 1. Enable GitHub Pages
1. Go to your repository on GitHub
2. Click on "Settings" tab
3. Scroll down to "Pages" section
4. Under "Source", select "Deploy from a branch"
5. Choose branch: `gh-pages` (this will be created automatically)
6. Click "Save"

### 2. Check Repository Name
- Your repository name is: `dubai-bus-buddy`
- This means your app will be available at: `https://yourusername.github.io/dubai-bus-buddy/`

## Deployment Process

### 1. Push Changes
```bash
git add .
git commit -m "Fix GitHub Pages deployment configuration"
git push origin main
```

### 2. Monitor Deployment
1. Go to "Actions" tab in your repository
2. You should see "Deploy to GitHub Pages" workflow running
3. Wait for it to complete (green checkmark)

### 3. Check GitHub Pages
1. Go to "Settings" → "Pages"
2. You should see a green checkmark with "Your site is published at..."
3. Click the link to view your deployed app

## Troubleshooting

### If the page is still blank:
1. Check browser console for errors
2. Verify the base path in `vite.config.ts` matches your repository name
3. Ensure all assets are loading correctly
4. Check if the `gh-pages` branch was created

### Common Issues:
- **404 errors**: Check if the base path is correct
- **Blank page**: Check browser console for JavaScript errors
- **Missing assets**: Verify the build output and asset paths

## Local Testing

### Test Production Build Locally:
```bash
npm run preview:prod
```

This will build with production settings and serve locally to test the exact build that will be deployed.

## Manual Deployment (if needed)

If GitHub Actions fails, you can manually deploy:

1. Build the project:
```bash
npm run build:prod
```

2. Create a new branch:
```bash
git checkout -b gh-pages
git add dist/
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

3. Set the source branch in GitHub Pages settings to `gh-pages`

## Important Notes

- The base path `/dubai-bus-buddy/` in `vite.config.ts` must match your repository name
- All internal links and asset references must be relative
- The service worker and PWA features should work correctly with the proper base path
- GitHub Pages may take a few minutes to update after deployment
