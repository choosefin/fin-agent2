#!/usr/bin/env node
// Azure App Service startup wrapper for Next.js standalone build
/* eslint-disable @typescript-eslint/no-require-imports */

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
  const fs = require('fs');
  
  // Check various possible locations for the server
  const possiblePaths = [
    // Direct server.js in monorepo structure
    path.join(__dirname, 'apps', 'web', 'server.js'),
    // Standalone build locations
    path.join(__dirname, '.next', 'standalone', 'server.js'),
    path.join(__dirname, '.next', 'standalone', 'apps', 'web', 'server.js'),
    // Current directory server (if this is already in the right place)
    path.join(__dirname, 'server.js')
  ];
  
  let serverFound = false;
  
  for (const serverPath of possiblePaths) {
    if (serverPath !== __filename && fs.existsSync(serverPath)) {
      console.log(`Found Next.js server at: ${serverPath}`);
      process.env.PORT = port.toString();
      process.env.HOSTNAME = hostname;
      
      // Change to the directory containing the server for proper relative paths
      const serverDir = path.dirname(serverPath);
      process.chdir(serverDir);
      console.log(`Changed working directory to: ${serverDir}`);
      
      require(serverPath);
      serverFound = true;
      break;
    }
  }
  
  if (!serverFound) {
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