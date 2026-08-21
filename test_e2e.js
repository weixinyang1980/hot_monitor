import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:8787';

async function run() {
  // 1. Check initial latest scan status
  const latestRes = await fetch(`${SERVER_URL}/api/scans/latest`);
  const initialLatest = await latestRes.json();
  const initiallyRunning = initialLatest && initialLatest.status === 'running';
  console.log(`[INIT] Initial latest scan status: ${initialLatest ? initialLatest.status : 'none'} (Running: ${initiallyRunning})`);

  const socket = io(SERVER_URL, {
    transports: ['websocket']
  });

  let startTime = null;
  let timer = null;
  let posted = false;

  const cleanupAndExit = (status, extra = {}) => {
    if (timer) clearTimeout(timer);
    socket.disconnect();
    console.log(JSON.stringify({
      status,
      initiallyRunning,
      ...extra
    }, null, 2));
    process.exit(0);
  };

  timer = setTimeout(() => {
    cleanupAndExit('timeout', { error: '180-second safety timeout reached' });
  }, 180000);

  socket.on('connect', async () => {
    console.log('[SOCKET] Connected');
    if (!posted) {
      posted = true;
      startTime = Date.now();
      try {
        const postRes = await fetch(`${SERVER_URL}/api/scans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const postData = await postRes.json();
        console.log('[POST] /api/scans status:', postRes.status, postData);
      } catch (err) {
        cleanupAndExit('failed', { error: 'POST failed: ' + err.message });
      }
    }
  });

  socket.on('scan:started', (payload) => {
    console.log('[EVENT] scan:started', payload);
  });

  socket.on('scan:completed', async (payload) => {
    const elapsed = Date.now() - startTime;
    console.log('[EVENT] scan:completed', payload);
    try {
      const storiesRes = await fetch(`${SERVER_URL}/api/stories`);
      const stories = await storiesRes.json();
      cleanupAndExit('completed', {
        elapsedMs: elapsed,
        eventPayloadFields: Object.keys(payload),
        storyCount: stories.length
      });
    } catch (err) {
      cleanupAndExit('completed', {
        elapsedMs: elapsed,
        eventPayloadFields: Object.keys(payload),
        storyCountError: err.message
      });
    }
  });

  socket.on('scan:failed', (payload) => {
    const elapsed = Date.now() - startTime;
    console.log('[EVENT] scan:failed', payload);
    cleanupAndExit('failed', {
      elapsedMs: elapsed,
      payload
    });
  });

  socket.on('connect_error', (err) => {
    cleanupAndExit('failed', { error: 'Connection error: ' + err.message });
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
