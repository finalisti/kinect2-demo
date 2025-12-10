import Kinect2 from 'kinect2';
import {WebSocketServer} from 'ws';
// NutJS for OS-level input (move mouse / press keys)
import {mouse, keyboard, Key, Point, straightTo} from '@nut-tree-fork/nut-js';

// small helper to sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Relative mouse movement using moveRelative for Unity compatibility.
// Unity's locked cursor uses raw relative deltas, not absolute position.
// This avoids the stutter caused by Unity fighting against cursor repositioning.

// Track mouse position server-side (like the working example)
let mousePosition = {x: 960, y: 540}; // center of typical 1920x1080 screen
let lastPosition = {x: 960, y: 540};

async function moveMouseDelta(deltaX, deltaY) {
  try {
    // Update tracked position and move
    mousePosition.x = mousePosition.x + deltaX;
    mousePosition.y = mousePosition.y + deltaY;

    // Clamp to screen bounds (rough estimate; adjust if needed)
    mousePosition.x = Math.max(0, Math.min(1920, mousePosition.x));
    mousePosition.y = Math.max(0, Math.min(1080, mousePosition.y));

    // Move to the new absolute position
    // NutJS's straightTo will handle the motion smoothly
    await mouse.move(
      straightTo(
        new Point(Math.round(mousePosition.x), Math.round(mousePosition.y)),
      ),
    );
  } catch (e) {
    console.error('moveMouseDelta failed:', e && e.message ? e.message : e);
  }
}

const PORT = 8081;
const kinect = new Kinect2();
const wss = new WebSocketServer({port: PORT});

// track whether we have the W key currently pressed to avoid duplicate presses
let wPressed = false;

if (!kinect.open()) {
  console.error(
    'Failed to open Kinect. Make sure the device is connected and drivers installed.',
  );
  process.exit(1);
}

console.log(`WebSocket server listening on ws://localhost:${PORT}`);

// Recommend starting Node with the following flag if you see N-API callback exceptions:
//   node --force-node-api-uncaught-exceptions-policy=true server.js
// Also register global handlers so we can log and keep the process stable.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (caught at process):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// helper to serialize enum-like objects
function serializeEnum(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'number' || typeof v === 'string') out[k] = v;
  }
  return out;
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send Kinect enums/constants and depth size for skeleton rendering
  const constants = {
    type: 'constants',
    JointType: serializeEnum(Kinect2.JointType),
    HandState: serializeEnum(Kinect2.HandState),
    TrackingState: serializeEnum(Kinect2.TrackingState),
    depthWidth: 1920,
    depthHeight: 1080,
  };
  ws.send(JSON.stringify(constants));

  // Accept simple control messages from clients: {cmd: 'MOUSE_MOVE'|'W_DOWN'|'W_UP'}
  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      // ignore non-json messages
      return;
    }
    const cmd = (msg && msg.cmd) || null;
    if (!cmd) return;
    try {
      if (cmd === 'MOUSE_MOVE') {
        // Hand position-based mouse movement (delta-based, X only, no smoothing)
        try {
          const screenWidth = 1920; // typical monitor width; adjust if needed
          // Direct X mapping: left hand = low x, right hand = high x
          const pointX = (msg.x || 0.5) * screenWidth;

          // Compute simple delta (X only)
          const deltaX = pointX - lastPosition.x;

          // Update tracked position (X only, Y stays locked)
          mousePosition.x = mousePosition.x + deltaX;
          lastPosition.x = pointX;
          // Y does NOT change - lock to prevent vertical camera movement

          // Clamp X to screen bounds
          mousePosition.x = Math.max(0, Math.min(screenWidth, mousePosition.x));

          // Move to the new position (minimal call, no extra smoothing to avoid stutter)
          await mouse.move(
            straightTo(
              new Point(
                Math.round(mousePosition.x),
                Math.round(mousePosition.y),
              ),
            ),
          );
        } catch (e) {
          console.error('Mouse move failed:', e && e.message ? e.message : e);
        }
      } else if (cmd === 'W_DOWN') {
        // press-and-hold W (if not already pressed)
        if (!wPressed) {
          try {
            await keyboard.pressKey(Key.W);
            wPressed = true;
          } catch (e) {
            console.error(
              'Keyboard press failed:',
              e && e.message ? e.message : e,
            );
          }
        }
      } else if (cmd === 'W_UP') {
        // release W if it was pressed
        if (wPressed) {
          try {
            await keyboard.releaseKey(Key.W);
            wPressed = false;
          } catch (e) {
            console.error(
              'Keyboard release failed:',
              e && e.message ? e.message : e,
            );
          }
        }
      }
    } catch (e) {
      console.error(
        'Error handling client command:',
        e && e.message ? e.message : e,
      );
    }
  });

  // Start body reader when first client connects
  if (wss.clients.size === 1) {
    try {
      kinect.openBodyReader();
      console.log('Body reader opened');
    } catch (e) {
      console.error('Error opening body reader', e);
    }
  }

  ws.on('close', () => {
    console.log('Client disconnected');
    if (wss.clients.size === 0) {
      kinect.closeBodyReader().catch(() => {});
      console.log('Body reader closed (no clients)');
    }
  });
});
// Broadcast body frames as JSON
// Simplified mapping: do not call any Kinect mapping functions or attempt
// to calculate precise pixel positions. Use the web client's resolution
// (512x424) and map normalized depth coords into that space.
// This keeps the server-side logic simple and deterministic.
function mapJointToColor(joint) {
  if (!joint) return {x: 0, y: 0};
  const x = joint.depthX != null ? joint.depthX * 1920 : 0;
  const y = joint.depthY != null ? joint.depthY * 1080 : 0;
  return {x, y};
}

kinect.on('bodyFrame', (bodyFrame) => {
  try {
    const bodiesArray = Array.isArray(bodyFrame && bodyFrame.bodies)
      ? bodyFrame.bodies
      : [];
    if (bodiesArray.length === 0) {
      // Nothing tracked this frame — still notify clients with empty bodies array
      const msgEmpty = JSON.stringify({
        type: 'bodyFrame',
        bodyFrame: {bodies: []},
      });
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          try {
            client.send(msgEmpty);
          } catch (err) {
            console.error('Error sending empty bodyFrame:', err);
          }
        }
      }
      return;
    }

    // Clone and augment bodyFrame with color-space joint coords to avoid changing original objects
    const mapped = {
      bodies: bodiesArray
        .map((body) => {
          if (!body) return null;
          const newBody = {...body, joints: {}};
          const jointKeys = body.joints ? Object.keys(body.joints) : [];
          for (const jt of jointKeys) {
            const j = body.joints[jt];
            if (!j) {
              newBody.joints[jt] = j;
              continue;
            }
            const mappedPoint = mapJointToColor(j);
            // attach colorX/colorY in pixels (fallbacks handled in mapper)
            newBody.joints[jt] = {
              depthX: j.depthX,
              depthY: j.depthY,
              cameraX: j.cameraX,
              cameraY: j.cameraY,
              cameraZ: j.cameraZ,
              trackingState: j.trackingState,
              colorX: mappedPoint.x,
              colorY: mappedPoint.y,
            };
          }
          // include hand states too
          newBody.leftHandState = body.leftHandState;
          newBody.rightHandState = body.rightHandState;
          newBody.tracked = body.tracked;
          newBody.trackingId = body.trackingId;
          return newBody;
        })
        .filter(Boolean),
    };

    const msg = JSON.stringify({type: 'bodyFrame', bodyFrame: mapped});
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        try {
          client.send(msg);
        } catch (err) {
          console.error('Error sending bodyFrame to client:', err);
        }
      }
    }
  } catch (err) {
    console.error('Error processing bodyFrame:', err);
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  try {
    await kinect.closeBodyReader();
  } catch (e) {}
  process.exit();
});
