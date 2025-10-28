(function() {
  'use strict';

  const logger = {
    logPrefix: '[CustomSW]',
    debug: (...args) => console.debug(logger.logPrefix, ...args)
  };

  // Log initial SW load
  logger.debug('Service worker script loaded');

  // Check if we're being bypassed
  self.addEventListener('fetch', event => {
    // Log if request is bypass-cache
    const isBypass = event.request.cache === 'reload' || 
                    event.request.headers.get('cache-control') === 'no-cache';
    
    logger.debug('Fetch event:', {
      url: event.request.url,
      method: event.request.method,
      destination: event.request.destination,
      bypass: isBypass,
      mode: event.request.mode,
      cache: event.request.cache
    });
    const request = event.request;
    logger.debug('Fetch event:', {
      url: request.url,
      method: request.method,
      destination: request.destination
    });

    // For navigation / HTML requests, fetch the original resource and append a marker.
    // For other requests we don't intercept and allow the Angular SW to handle them.
    const accepts = request.headers.get('accept') || '';
    const isHtmlRequest = request.mode === 'navigate' || accepts.includes('text/html');

    if (isHtmlRequest) {
      event.respondWith((async () => {
        try {
          const originalResponse = await fetch(request);
          const contentType = originalResponse.headers.get('content-type') || '';

          // Only modify text/html responses to avoid corrupting binary assets
          if (contentType.includes('text/html')) {
            const text = await originalResponse.text();
            const marker = '\n<!-- Served via CustomSW: marker -->\n';
            const newBody = text + marker;
            const headers = new Headers(originalResponse.headers);
            // Remove content-length since body size changed
            headers.delete('content-length');

            return new Response(newBody, {
              status: originalResponse.status,
              statusText: originalResponse.statusText,
              headers
            });
          }

          // Not HTML — return original response unchanged
          return originalResponse;
        } catch (err) {
          logger.debug('Fetch override failed, falling back to default fetch', err);
          return fetch(request);
        }
      })());
    }
    // else: do nothing so ngsw-worker's fetch handling runs
  });

  // Lifecycle logging: install/activate to help debugging registration issues
  self.addEventListener('install', (event) => {
    logger.debug('Service worker install event');
    // Activate worker immediately so we can start logging for pages
    try {
      self.skipWaiting();
    } catch (e) {
      logger.debug('skipWaiting not available', e);
    }
  });

  self.addEventListener('activate', (event) => {
    logger.debug('Service worker activate event');
    // Claim clients so pages are controlled immediately
    event.waitUntil((async () => {
      try {
        await self.clients.claim();
        // Notify all clients that the SW is active (useful after clearing storage)
        const all = await self.clients.matchAll({ includeUncontrolled: true });
        for (const c of all) {
          try { c.postMessage({ type: 'custom-sw:activated' }); } catch (err) { /* ignore */ }
        }
      } catch (err) {
        logger.debug('clients.claim or postMessage failed', err);
      }
    })());
  });

  // Import the Angular service worker AFTER registering fetch listener
  importScripts('./ngsw-worker.js');
})();