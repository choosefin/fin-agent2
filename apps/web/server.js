#!/usr/bin/env node
// Azure App Service startup wrapper for Next.js standalone build

const path = require('path');
const { createServer } = require('http');
const { parse } = require('url');

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Azure provides the PORT environment variable
const port = parseInt(process.env.PORT || process.env.WEBSITES_PORT || '8080', 10);
const hostname = '0.0.0.0'; // Bind to all interfaces for Azure

console.log(`Starting Next.js server...`);
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Port: ${port}`);
console.log(`API URL: ${process.env.NEXT_PUBLIC_API_URL}`);

// Check if we're in standalone mode
let nextApp;
let handle;

try {
  // Try to load the standalone server
  const standaloneServerPath = path.join(__dirname, '.next', 'standalone', 'server.js');
  console.log(`Checking for standalone server at: ${standaloneServerPath}`);
  
  if (require('fs').existsSync(standaloneServerPath)) {
    console.log('Found standalone server, using it...');
    // For standalone builds, we need to set the port before requiring
    process.env.PORT = port.toString();
    require(standaloneServerPath);
  } else if (require('fs').existsSync(path.join(__dirname, '.next', 'standalone', 'apps', 'web', 'server.js'))) {
    // Monorepo structure
    console.log('Found monorepo standalone server...');
    process.env.PORT = port.toString();
    require(path.join(__dirname, '.next', 'standalone', 'apps', 'web', 'server.js'));
  } else {
    // Fallback to regular Next.js server
    console.log('No standalone build found, using regular Next.js server...');
    const next = require('next');
    const dev = process.env.NODE_ENV !== 'production';
    
    nextApp = next({ 
      dev, 
      hostname,
      port,
      dir: __dirname 
    });
    
    handle = nextApp.getRequestHandler();
    
    nextApp.prepare().then(() => {
      createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      }).listen(port, hostname, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
      });
    });
  }
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}