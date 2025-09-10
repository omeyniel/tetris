// Tetris — near-classic rules (SRS kicks, 7-bag randomizer)
// Board 10x20 visible; internal height includes buffer rows for spawn handling.
(() => {
  const COLS = 10, ROWS = 20, HIDDEN_ROWS = 2;
  const TILE = 30;
  const GRAVITY_LEVEL_MS = [1000, 793, 617, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 12, 8];
  const LINES_PER_LEVEL = 10;

  const LINE_SCORES = {1: 100, 2: 300, 3: 500, 4: 800};
  const SOFT_DROP_POINT = 1;
  const HARD_DROP_POINT = 2;

  // Standard SRS kicks for JLTSZ pieces
  function standardKicks(){
    return {
      "0>R":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
      "R>0":[[0,0],[1,0],[1,-1],[0,2],[1,2]],
      "R>2":[[0,0],[1,0],[1,-1],[0,2],[1,2]],
      "2>R":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
      "2>L":[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
      "L>2":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
      "L>0":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
      "0>L":[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    };
  }

  const TETROMINOES = {
    I: {
      color: "#00ffff",
      kicks: {
        "0>R":[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
        "R>0":[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
        "R>2":[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
        "2>R":[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
        "2>L":[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
        "L>2":[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
        "L>0":[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
        "0>L":[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
      },
      shapes: [
        [[-1,0],[0,0],[1,0],[2,0]],
        [[1,-1],[1,0],[1,1],[1,2]],
        [[-1,1],[0,1],[1,1],[2,1]],
        [[0,-1],[0,0],[0,1],[0,2]],
      ]
    },
    O: {
      color: "#ffff00",
      kicks: {},
      shapes: [
        [[0,0],[1,0],[0,1],[1,1]],
        [[0,0],[1,0],[0,1],[1,1]],
        [[0,0],[1,0],[0,1],[1,1]],
        [[0,0],[1,0],[0,1],[1,1]],
      ]
    },
    T: {
      color: "#aa00ff",
      kicks: standardKicks(),
      shapes: [
        [[-1,0],[0,0],[1,0],[0,1]],
        [[0,-1],[0,0],[1,0],[0,1]],
        [[-1,0],[0,0],[1,0],[0,-1]],
        [[0,-1],[-1,0],[0,0],[0,1]],
      ]
    },
    J: {
      color: "#0000ff",
      kicks: standardKicks(),
      shapes: [
        [[-1,0],[0,0],[1,0],[-1,1]],
        [[0,-1],[0,0],[0,1],[1,1]],
        [[1,-1],[-1,0],[0,0],[1,0]],
        [[0,-1],[0,0],[0,1],[-1,-1]],
      ]
    },
    L: {
      color: "#ff7f00",
      kicks: standardKicks(),
      shapes: [
        [[-1,0],[0,0],[1,0],[1,1]],
        [[0,-1],[0,0],[0,1],[-1,1]],
        [[-1,-1],[-1,0],[0,0],[1,0]],
        [[0,-1],[0,0],[0,1],[1,-1]],
      ]
    },
    S: {
      color: "#00ff00",
      kicks: standardKicks(),
      shapes: [
        [[0,0],[1,0],[-1,1],[0,1]],
        [[0,-1],[0,0],[1,0],[1,1]],
        [[0,-1],[1,-1],[-1,0],[0,0]],
        [[-1,-1],[-1,0],[0,0],[0,1]],
      ]
    },
    Z: {
      color: "#ff0000",
      kicks: standardKicks(),
      shapes: [
        [[-1,0],[0,0],[0,1],[1,1]],
        [[1,-1],[0,0],[1,0],[0,1]],
        [[-1,-1],[0,-1],[0,0],[1,0]],
        [[0,-1],[-1,0],[0,0],[-1,1]],
      ]
    },
  };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCanvas = document.getElementById('hold');
  const holdCtx = holdCanvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlayText');

  const board = createMatrix(COLS, ROWS + HIDDEN_ROWS, 0);
  let bag = [];
  let nextQueue = [];
  let holdPiece = null;
  let canHold = true;

  let current = null;
  let dropCounter = 0;
  let lastTime = 0;
  let dropInterval = GRAVITY_LEVEL_MS[0];
  let paused = false;
  let started = false;

  const state = {
    score: 0,
    level: 1,
    lines: 0,
  };

  function createMatrix(w,h,fill=0){
    const a = [];
    for(let y=0;y<h;y++){
      a[y] = new Array(w).fill(fill);
    }
    return a;
  }

  function newBag(){
    const pieces = Object.keys(TETROMINOES);
    const b = [];
    while(pieces.length){
      const idx = (Math.random()*pieces.length)|0;
      b.push(pieces.splice(idx,1)[0]);
    }
    return b;
  }

  function refillQueue(){
    while(nextQueue.length < 5){
      if(!bag.length) bag = newBag();
      nextQueue.push(bag.shift());
    }
  }

  function spawnPiece(){
    refillQueue();
    const type = nextQueue.shift();
    const t = TETROMINOES[type];
    const piece = {
      type,
      rot: 0,
      x: (COLS/2|0),
      y: 0,
      cells: t.shapes[0].map(([x,y]) => ({x,y})),
      color: t.color,
    };
    piece.y = HIDDEN_ROWS - 1;
    if(collides(piece, board)) {
      gameOver();
      return null;
    }
    canHold = true;
    return piece;
  }

  function rotate(piece, dir){
    const t = TETROMINOES[piece.type];
    if(piece.type === "O") return;
    const from = piece.rot;
    const to = (from + (dir>0?1:3))%4;
    const shape = t.shapes[to];
    const key = `${["0","R","2","L"][from]}>${["0","R","2","L"][to]}`;
    const kicks = t.kicks[key] || [[0,0]];
    for(const [kx,ky] of kicks){
      const test = {
        type: piece.type,
        rot: to,
        x: piece.x + kx,
        y: piece.y + ky,
        color: piece.color,
        cells: shape.map(([x,y]) => ({x,y}))
      };
      if(!collides(test, board)){
        piece.rot = to;
        piece.x = test.x;
        piece.y = test.y;
        piece.cells = test.cells;
        return;
      }
    }
  }

  function collides(piece, grid){
    for(const c of piece.cells){
      const x = piece.x + c.x;
      const y = piece.y + c.y;
      if(x < 0 || x >= COLS || y >= ROWS + HIDDEN_ROWS) return true;
      if(y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  function merge(piece, grid){
    for(const c of piece.cells){
      const x = piece.x + c.x;
      const y = piece.y + c.y;
      if(y >= 0) grid[y][x] = piece.color;
    }
  }

  function clearLines(){
    let cleared = 0;
    for(let y=HIDDEN_ROWS;y<ROWS+HIDDEN_ROWS;y++){
      if(board[y].every(v => v)){
        board.splice(y,1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
      }
    }
    if(cleared){
      state.lines += cleared;
      const base = LINE_SCORES[cleared] || 0;
      state.score += base * state.level;
      const newLevel = 1 + Math.floor(state.lines / LINES_PER_LEVEL);
      if(newLevel !== state.level){
        state.level = newLevel;
        const idx = Math.min(state.level-1, GRAVITY_LEVEL_MS.length-1);
        dropInterval = GRAVITY_LEVEL_MS[idx];
      }
      updateHUD();
    }
  }

  function hardDrop(){
    let dist = 0;
    while(true){
      const test = {...current, y: current.y+1};
      if(collides(test, board)) break;
      current.y++;
      dist++;
    }
    state.score += dist * HARD_DROP_POINT;
    lockPiece();
  }

  function softDrop(){
    const test = {...current, y: current.y+1};
    if(!collides(test, board)){
      current.y++;
      state.score += SOFT_DROP_POINT;
    }else{
      lockPiece();
    }
  }

  function move(dx){
    const test = {...current, x: current.x+dx};
    if(!collides(test, board)){
      current.x += dx;
    }
  }

  function lockPiece(){
    merge(current, board);
    clearLines();
    current = spawnPiece();
  }

  function hold(){
    if(!canHold) return;
    canHold = false;
    if(holdPiece === null){
      holdPiece = current.type;
      current = spawnPiece();
    }else{
      const temp = holdPiece;
      holdPiece = current.type;
      current = createPiece(temp);
      current.x = (COLS/2|0);
      current.y = HIDDEN_ROWS - 1;
      if(collides(current, board)){
        gameOver();
        return;
      }
    }
  }

  function createPiece(type){
    const t = TETROMINOES[type];
    return {
      type,
      rot: 0,
      x: 0,
      y: 0,
      color: t.color,
      cells: t.shapes[0].map(([x,y]) => ({x,y})),
    };
  }

  function update(time=0){
    if(!started || paused) return;
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if(dropCounter > dropInterval){
      const test = {...current, y: current.y+1};
      if(!collides(test, board)){
        current.y++;
      }else{
        lockPiece();
      }
      dropCounter = 0;
    }
    draw();
    requestAnimationFrame(update);
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let y=HIDDEN_ROWS;y<ROWS+HIDDEN_ROWS;y++){
      for(let x=0;x<COLS;x++){
        const v = board[y][x];
        if(v) drawCell(ctx, x, y-HIDDEN_ROWS, v);
        else drawGridCell(ctx, x, y-HIDDEN_ROWS);
      }
    }
    const ghostY = ghostDropY();
    drawPiece(current, {alpha:0.25, yOverride: ghostY});
    drawPiece(current);
    drawNext();
    drawHold();
  }

  function drawGridCell(ctx,x,y){
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(x*TILE+0.5, y*TILE+0.5, TILE-1, TILE-1);
    ctx.restore();
  }

  function drawCell(ctx,x,y,color){
    const px = x*TILE, py = y*TILE;
    const r = 6;
    ctx.save();
    const grd = ctx.createLinearGradient(px, py, px, py+TILE);
    grd.addColorStop(0, lighten(color, 0.35));
    grd.addColorStop(1, color);
    roundRect(ctx, px+1, py+1, TILE-2, TILE-2, r);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#fff";
    roundRect(ctx, px+4, py+4, TILE-8, TILE-14, r/2);
    ctx.fill();
    ctx.restore();
  }

  function drawPiece(piece, opts={}){
    if(!piece) return;
    const {alpha=1, yOverride=null} = opts;
    ctx.save();
    ctx.globalAlpha = alpha;
    for(const c of piece.cells){
      const x = piece.x + c.x;
      const y = (yOverride !== null ? yOverride : piece.y) + c.y;
      if(y >= HIDDEN_ROWS){
        drawCell(ctx, x, y-HIDDEN_ROWS, piece.color);
      }
    }
    ctx.restore();
  }

  function ghostDropY(){
    let y = current.y;
    while(true){
      const test = {...current, y: y+1};
      if(collides(test, board)) break;
      y++;
    }
    return y;
  }

  function drawNext(){
    nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    const cell = 20;
    let yOff = 10;
    nextQueue.slice(0,5).forEach(type => {
      drawMini(nextCtx, TETROMINOES[type], cell, 10, yOff);
      yOff += 52;
    });
  }

  function drawHold(){
    holdCtx.clearRect(0,0,holdCanvas.width, holdCanvas.height);
    if(holdPiece){
      drawMini(holdCtx, TETROMINOES[holdPiece], 22, 14, 10+12);
    }
  }

  function drawMini(c, tet, size, ox, oy){
    const cells = tet.shapes[0];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cells.forEach(([x,y]) => {
      if(x<minX) minX=x;
      if(x>maxX) maxX=x;
      if(y<minY) minY=y;
      if(y>maxY) maxY=y;
    });
    const width = (maxX-minX+1);
    const height = (maxY-minY+1);
    const startX = ox + ((120 - width*size)/2|0);
    const startY = oy + ((52 - height*size)/2|0);
    for(const [x,y] of cells){
      drawMiniCell(c, startX + (x-minX)*size, startY + (y-minY)*size, size, tet.color);
    }
  }

  function drawMiniCell(c,x,y,s,color){
    c.save();
    const grd = c.createLinearGradient(x,y,x,y+s);
    grd.addColorStop(0, lighten(color, 0.35));
    grd.addColorStop(1, color);
    roundRect(c, x+1, y+1, s-2, s-2, 5);
    c.fillStyle = grd;
    c.fill();
    c.restore();
  }

  function lighten(hex, amt){
    const {r,g,b} = hexToRgb(hex);
    const l = v => Math.min(255, Math.max(0, Math.round(v + 255*amt)));
    return `rgb(${l(r)}, ${l(g)}, ${l(b)})`;
  }

  function hexToRgb(hex){
    let h = hex.replace('#','');
    if(h.length===3){
      h = h.split('').map(c=>c+c).join('');
    }
    const num = parseInt(h,16);
    return {r:(num>>16)&255, g:(num>>8)&255, b:num&255};
  }

  function roundRect(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
  }

  function updateHUD(){
    scoreEl.textContent = state.score;
    levelEl.textContent = state.level;
    linesEl.textContent = state.lines;
  }

  function reset(){
    for(let y=0;y<ROWS+HIDDEN_ROWS;y++){
      board[y].fill(0);
    }
    bag = [];
    nextQueue = [];
    holdPiece = null;
    canHold = true;
    state.score = 0;
    state.level = 1;
    state.lines = 0;
    dropInterval = GRAVITY_LEVEL_MS[0];
    updateHUD();
    current = spawnPiece();
    lastTime = 0;
    dropCounter = 0;
  }

  function pauseToggle(){
    if(!started) return;
    paused = !paused;
    overlay.classList.toggle('hidden', !paused);
    overlayText.textContent = paused ? "Paused (Press P)" : "";
    if(!paused){
      lastTime = performance.now();
      requestAnimationFrame(update);
    }
  }

  function gameOver(){
    started = false;
    overlay.classList.remove('hidden');
    overlayText.innerHTML = `Game Over<br>Score: ${state.score}<br>Press R to Restart`;
  }

  document.addEventListener('keydown', e => {
    if(e.code === 'Enter' && !started){
      overlay.classList.add('hidden');
      started = true;
      reset();
      requestAnimationFrame(update);
      return;
    }
    if(!started) return;
    if(e.repeat) e.preventDefault();
    switch(e.code){
      case 'ArrowLeft': move(-1); e.preventDefault(); break;
      case 'ArrowRight': move(1); e.preventDefault(); break;
      case 'ArrowDown': softDrop(); e.preventDefault(); break;
      case 'Space': hardDrop(); e.preventDefault(); break;
      case 'ArrowUp': rotate(current, 1); e.preventDefault(); break;
      case 'KeyX': rotate(current, 1); e.preventDefault(); break;
      case 'KeyZ': rotate(current, -1); e.preventDefault(); break;
      case 'KeyC': hold(); e.preventDefault(); break;
      case 'KeyP': pauseToggle(); e.preventDefault(); break;
      case 'KeyR': reset(); e.preventDefault(); break;
    }
  });

  overlay.classList.remove('hidden');
  overlayText.textContent = "Press Enter to Start";
  updateHUD();
})();
