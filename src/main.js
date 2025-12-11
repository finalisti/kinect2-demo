let depthWidth = 1920;
let depthHeight = 1080;

let ws = null;
let streaming = false;
// helper: send control commands to server (A/D/W)
// Updated to send hand position for delta-based mouse movement
function sendInputBridge(cmd, data = {}) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({cmd, ...data}));
  } catch (e) {
    // non-fatal
  }
}
// DOM canvas + context
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext && canvas.getContext('2d');
canvas.width = depthWidth;
canvas.height = depthHeight;

// track per-body hand-raised state to detect transitions
const handRaisedStates = {};
const handExtendedStates = {};

// on-screen indicator element (created dynamically so HTML doesn't need edits)
const kinectIndicator = document.createElement('div');
kinectIndicator.id = 'kinect-indicator';
document.body.appendChild(kinectIndicator);

function showIndicator(text) {
  kinectIndicator.textContent = text;
  kinectIndicator.classList.add('kinect-indicator-visible');
}

function hideIndicator() {
  kinectIndicator.classList.remove('kinect-indicator-visible');
}

function startStreaming() {
  if (ws) return;
  ws = new WebSocket('ws://localhost:8081');

  ws.addEventListener('open', () => {
    streaming = true;
  });

  ws.addEventListener('message', (evt) => {
    if (typeof evt.data !== 'string') return;
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (e) {
      return;
    }

    if (msg.type === 'constants') {
      if (msg.depthWidth && msg.depthHeight) {
        depthWidth = msg.depthWidth;
        depthHeight = msg.depthHeight;
        canvas.width = depthWidth;
        canvas.height = depthHeight;
      }
      window.__KINECT_CONSTS = msg;
    } else if (msg.type === 'bodyFrame') {
      drawBodyFrame(msg.bodyFrame);
    }
  });

  ws.addEventListener('close', () => {
    ws = null;
    streaming = false;
  });

  ws.addEventListener('error', (err) => {
    console.error('WebSocket error', err);
  });
}

function stopStreaming() {
  if (!ws) return;
  try {
    ws.close();
  } catch (e) {}
  ws = null;
  streaming = false;
}

// auto-start
startStreaming();

// drawing helpers
const colors = [
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#00ffff',
  '#ff00ff',
];
const HANDSIZE = 20;
const HANDCLOSEDCOLOR = 'red';
const HANDOPENCOLOR = 'green';
const HANDLASSOCOLOR = 'blue';

function drawBodyFrame(bodyFrame) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!bodyFrame || !Array.isArray(bodyFrame.bodies)) return;
  const K = window.__KINECT_CONSTS || {};
  const TrackingState = K.TrackingState || {};
  const JointType = K.JointType || {};
  // robust lookup for JointType keys: try several casings
  const jtLookup = (name) =>
    JointType[name] ??
    JointType[name.charAt(0).toUpperCase() + name.slice(1)] ??
    JointType[name.toUpperCase()] ??
    null;
  let idx = 0;
  for (const body of bodyFrame.bodies) {
    if (!body || !body.tracked) continue;
    // draw skeleton bones (lines) first so joints/hands render on top
    (function drawBones() {
      // robust lookup for JointType keys: try several casings
      const jtLookup = (name) =>
        JointType[name] ??
        JointType[name.charAt(0).toUpperCase() + name.slice(1)] ??
        JointType[name.toUpperCase()] ??
        null;

      const pairs = [
        ['spineBase', 'spineMid'],
        ['spineMid', 'spineShoulder'],
        ['spineShoulder', 'neck'],
        ['neck', 'head'],

        ['spineShoulder', 'shoulderLeft'],
        ['shoulderLeft', 'elbowLeft'],
        ['elbowLeft', 'wristLeft'],
        ['wristLeft', 'handLeft'],
        ['handLeft', 'handTipLeft'],

        ['spineShoulder', 'shoulderRight'],
        ['shoulderRight', 'elbowRight'],
        ['elbowRight', 'wristRight'],
        ['wristRight', 'handRight'],
        ['handRight', 'handTipRight'],

        ['spineBase', 'hipLeft'],
        ['hipLeft', 'kneeLeft'],
        ['kneeLeft', 'ankleLeft'],
        ['ankleLeft', 'footLeft'],

        ['spineBase', 'hipRight'],
        ['hipRight', 'kneeRight'],
        ['kneeRight', 'ankleRight'],
        ['ankleRight', 'footRight'],
      ];

      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';

      for (const [aName, bName] of pairs) {
        const aId = jtLookup(aName);
        const bId = jtLookup(bName);
        if (aId == null || bId == null) continue;
        const a = body.joints[aId];
        const b = body.joints[bId];
        if (!a || !b) continue;
        const tsNotTracked =
          TrackingState.notTracked !== undefined ? TrackingState.notTracked : 0;
        if (a.trackingState <= tsNotTracked || b.trackingState <= tsNotTracked)
          continue;
        const ax = a.colorX != null ? a.colorX : a.depthX * canvas.width;
        const ay = a.colorY != null ? a.colorY : a.depthY * canvas.height;
        const bx = b.colorX != null ? b.colorX : b.depthX * canvas.width;
        const by = b.colorY != null ? b.colorY : b.depthY * canvas.height;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.closePath();
      }
    })();
    for (const jt of Object.keys(body.joints || {})) {
      const joint = body.joints[jt];
      if (!joint) continue;
      const tsNotTracked =
        TrackingState.notTracked !== undefined ? TrackingState.notTracked : 0;
      if (joint.trackingState <= tsNotTracked) continue;
      ctx.fillStyle = colors[idx % colors.length];
      let size = 4;
      const tsTracked =
        TrackingState.tracked !== undefined ? TrackingState.tracked : 2;
      if (joint.trackingState === tsTracked) size = 12;
      const x =
        joint.colorX != null ? joint.colorX : joint.depthX * canvas.width;
      const y =
        joint.colorY != null ? joint.colorY : joint.depthY * canvas.height;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    updateHandState(body.leftHandState, body.joints[JointType.handLeft]);
    updateHandState(body.rightHandState, body.joints[JointType.handRight]);
    // detect hand-above-head and print "W (left/right/both)" while raised (throttled)
    try {
      const bodyId = body.trackingId != null ? body.trackingId : idx;
      const torso = body.joints[jtLookup('spineMid')];
      const leftElbow = body.joints[jtLookup('elbowLeft')];
      const rightElbow = body.joints[jtLookup('elbowRight')];
      const head = body.joints[jtLookup('head')];
      const leftHand = body.joints[jtLookup('handLeft')];
      const rightHand = body.joints[jtLookup('handRight')];
      const getY = (j) => {
        if (!j) return null;
        return j.colorY != null ? j.colorY : j.depthY * canvas.height;
      };
      const getX = (j) => {
        if (!j) return null;
        return j.colorX != null ? j.colorX : j.depthX * canvas.width;
      };
      const headY = getY(head);
      const lhY = getY(leftHand);
      const lhX = getX(leftHand);
      const rhY = getY(rightHand);
      const rhX = getX(rightHand);
      const torsoY = getY(torso);
      const leX = getX(leftElbow);
      const leY = getY(leftElbow);
      const reX = getX(rightElbow);
      const reY = getY(rightElbow);
      const nowLeftExtended =
        lhX != null && leX != null && lhX < leX && lhY != null && lhY < torsoY;
      const nowRightExtended =
        rhX != null && reX != null && rhX > reX && rhY != null && rhY < torsoY;
      const nowLeftRaised = lhY != null && headY != null && lhY < headY;
      const nowRightRaised = rhY != null && headY != null && rhY < headY;
      const now = Date.now();
      const MIN_INTERVAL = 500; // ms between logs per state
      const prev = handRaisedStates[bodyId] || {
        left: {raised: false, last: 0},
        right: {raised: false, last: 0},
        both: {raised: false, last: 0},
        any: {raised: false, last: 0},
      };
      const prevExt = handExtendedStates[bodyId] || {
        left: {extended: false, last: 0},
        right: {extended: false, last: 0},
        both: {extended: false, last: 0},
      };

      // LEFT HAND: Send when LEFT hand extends (moves mouse LEFT)
      if (nowLeftExtended) {
        if (!prevExt.left.extended || now - prevExt.left.last >= MIN_INTERVAL) {
          const normalizedX = lhX ? lhX / canvas.width : 0.5;
          sendInputBridge('MOUSE_MOVE', {x: normalizedX, y: 0.5});
          prevExt.left.last = now;
        }
        prevExt.left.extended = true;
        showIndicator('A');
      } else {
        prevExt.left.extended = false;
      }
      // RIGHT HAND: Send when RIGHT hand extends (moves mouse RIGHT)
      if (nowRightExtended) {
        if (
          !prevExt.right.extended ||
          now - prevExt.right.last >= MIN_INTERVAL
        ) {
          const normalizedX = rhX ? rhX / canvas.width : 0.5;
          sendInputBridge('MOUSE_MOVE', {x: normalizedX, y: 0.5});
          prevExt.right.last = now;
        }
        prevExt.right.extended = true;
        showIndicator('D');
      } else {
        prevExt.right.extended = false;
      }
      // hide indicator if neither hand is extended
      if (!nowLeftExtended && !nowRightExtended) {
        hideIndicator();
      }

      // unified "any hand raised" logic: hold W while any hand is raised
      const nowAnyRaised = nowLeftRaised || nowRightRaised;
      // handle both/left/right indicators as before, but only send W_DOWN/W_UP once
      const nowBothRaised = nowLeftRaised && nowRightRaised;
      if (nowBothRaised) {
        if (!prev.both.raised || now - prev.both.last >= MIN_INTERVAL) {
          prev.both.last = now;
        }
        prev.both.raised = true;
        prev.left.raised = true;
        prev.right.raised = true;
        showIndicator('W (both)');
      } else {
        prev.both.raised = false;
        if (nowLeftRaised) {
          if (!prev.left.raised || now - prev.left.last >= MIN_INTERVAL) {
            prev.left.last = now;
          }
          prev.left.raised = true;
          showIndicator('W (left)');
        } else {
          prev.left.raised = false;
        }
        if (nowRightRaised) {
          if (!prev.right.raised || now - prev.right.last >= MIN_INTERVAL) {
            prev.right.last = now;
          }
          prev.right.raised = true;
          if (!nowLeftRaised) showIndicator('W (right)');
        } else {
          prev.right.raised = false;
        }
        if (!nowLeftRaised && !nowRightRaised) {
          hideIndicator();
        }
      }

      // send W_DOWN when any hand becomes raised; send W_UP when none are raised
      if (nowAnyRaised) {
        if (!prev.any.raised || now - prev.any.last >= MIN_INTERVAL) {
          sendInputBridge('W_DOWN');
          prev.any.last = now;
        }
        prev.any.raised = true;
      } else {
        if (prev.any.raised) {
          sendInputBridge('W_UP');
        }
        prev.any.raised = false;
      }

      handRaisedStates[bodyId] = prev;
      handExtendedStates[bodyId] = prevExt;
    } catch (e) {
      // ignore errors in optional detection step
    }
    idx++;
  }
}

function updateHandState(handState, jointPoint) {
  if (!jointPoint) return;
  const K = window.__KINECT_CONSTS || {};
  const HandState = K.HandState || {};
  switch (handState) {
    case HandState.closed:
      drawHand(jointPoint, HANDCLOSEDCOLOR);
      break;
    case HandState.open:
      drawHand(jointPoint, HANDOPENCOLOR);
      break;
    case HandState.lasso:
      drawHand(jointPoint, HANDLASSOCOLOR);
      break;
    default:
      break;
  }
}

function drawHand(jointPoint, handColor) {
  if (!jointPoint) return;
  const x =
    jointPoint.colorX != null
      ? jointPoint.colorX
      : jointPoint.depthX * canvas.width;
  const y =
    jointPoint.colorY != null
      ? jointPoint.colorY
      : jointPoint.depthY * canvas.height;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.fillStyle = handColor;
  ctx.arc(x, y, HANDSIZE, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
  ctx.globalAlpha = 1;
}
