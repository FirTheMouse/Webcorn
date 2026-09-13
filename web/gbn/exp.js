

const basicBehaviour = "+js_lit(basic_behaviour)+";
function broadcast(msg) {
    eval(fill_capture(
        basicBehaviour,
        JSON.stringify(msg)
    ));
}

//WORLD

const viewport = getel("+js_lit(capture_node(viewport))+");
const world = getel("+js_lit(capture_node(world))+");

window.boardView = {
    panX: 0,
    panY: 0,
    scale: 1
};

let panX = 0;
let panY = 0;
let scale = 1;

function updateWorld() {
    world.style.transform =
        `translate(${panX}px, ${panY}px) scale(${scale})`;

    window.boardView.panX = panX;
    window.boardView.panY = panY;
    window.boardView.scale = scale;
}

let panning = false;
let startX = 0;
let startY = 0;

viewport.addEventListener('pointerdown', (e) => {
    if(e.target.closest('button')) return;
    if(e.target.closest('.ab_token')) return;

    panning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;

    viewport.setPointerCapture(e.pointerId);
    viewport.style.cursor = 'grabbing';
});

viewport.addEventListener('pointermove', (e) => {
    if(!panning) return;

    panX = e.clientX - startX;
    panY = e.clientY - startY;

    updateWorld();
});

viewport.addEventListener('pointerup', (e) => {
    panning = false;
    viewport.style.cursor = 'grab';

    if(viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
    }
});

viewport.addEventListener('pointercancel', () => {
    panning = false;
    viewport.style.cursor = 'grab';
});

viewport.addEventListener('wheel', (e) => {
    e.preventDefault();

    const oldScale = scale;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;

    scale = Math.max(0.25, Math.min(8, scale * factor));

    const rect = viewport.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - panX) / oldScale;
    const worldY = (mouseY - panY) / oldScale;

    panX = mouseX - worldX * scale;
    panY = mouseY - worldY * scale;

    updateWorld();
}, { passive: false });

updateWorld();


//GRID

const grid = getel("+js_lit(capture_node(grid))+");
let gridSize = 50;
let gridOffsetX = 0;
let gridOffsetY = 0;
function updateGrid() {
    grid.style.backgroundImage = `
        linear-gradient(
            to right,
            rgba(255,255,255,0.35) 1px,
            transparent 1px
        ),
        linear-gradient(
            to bottom,
            rgba(255,255,255,0.35) 1px,
            transparent 1px
        )
    `;
    grid.style.backgroundSize =
        `${gridSize}px ${gridSize}px`;

    grid.style.backgroundPosition =
        `${gridOffsetX}px ${gridOffsetY}px`;
}
updateGrid();

//WALLS

const walls = [];

let wallDrawing = false;
let wallStart = null;
let wallPreview = null;

const Tworld = getel("+js_lit(capture_node(world))+");
const Tviewport = getel("+js_lit(capture_node(viewport))+");

function screenToWorld(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();

    return {
        x: (
            clientX -
            rect.left -
            window.boardView.panX
        ) / window.boardView.scale,

        y: (
            clientY -
            rect.top -
            window.boardView.panY
        ) / window.boardView.scale
    };
}

function toggleWallDrawing() {
    wallDrawing = !wallDrawing;
    console.log('Wall drawing: ',wallDrawing);
    Tworld.style.cursor =
        wallDrawing
            ? 'crosshair'
            : 'grab';
    if(!wallDrawing) finishWallChain();
}


const wallSvg = document.getElementById('wall_svg');

function makeSvg(tag) {
    return document.createElementNS(
        'http://www.w3.org/2000/svg',
        tag
    );
}

function drawWall(wall) {
    const line = makeSvg('line');

    line.setAttribute('x1', wall.x1);
    line.setAttribute('y1', wall.y1);
    line.setAttribute('x2', wall.x2);
    line.setAttribute('y2', wall.y2);

    line.setAttribute('stroke', 'red');
    line.setAttribute('stroke-width', '3');
    line.setAttribute('class', 'ab_wall');

    wallSvg.appendChild(line);
}

function drawWallPoint(p) {
    const circle = makeSvg('circle');

    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', 'gold');
    circle.setAttribute('class', 'wall_trace_mark');

    wallSvg.appendChild(circle);
}

function updateWallPreview(p) {
    if(!wallStart)
        return;

    if(!wallPreview) {
        wallPreview = makeSvg('line');

        wallPreview.setAttribute('stroke', 'gold');
        wallPreview.setAttribute('stroke-width', '2');
        wallPreview.setAttribute(
            'stroke-dasharray',
            '6 4'
        );

        wallSvg.appendChild(wallPreview);
    }

    wallPreview.setAttribute('x1', wallStart.x);
    wallPreview.setAttribute('y1', wallStart.y);
    wallPreview.setAttribute('x2', p.x);
    wallPreview.setAttribute('y2', p.y);
}

function finishWallChain() {
    wallStart = null;

    if(wallPreview) {
        wallPreview.remove();
        wallPreview = null;
    }

    document
        .querySelectorAll('.wall_trace_mark')
        .forEach(el => el.remove());
}

function handleWallPointerDown(e) {
    if(!wallDrawing)
        return;

    if(e.button !== 0)
        return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const p = screenToWorld(
        e.clientX,
        e.clientY
    );

    if(!wallStart) {
        wallStart = p;
        drawWallPoint(p);
        return;
    }

    const wall = {
        x1: wallStart.x,
        y1: wallStart.y,
        x2: p.x,
        y2: p.y
    };

    walls.push(wall);
    drawWall(wall);

    wallStart = p;
    drawWallPoint(p);

    //updateVisibilityForEveryone();
}

function handleWallPointerMove(e) {
    if(!wallDrawing)
        return;

    if(!wallStart)
        return;

    const p = screenToWorld(
        e.clientX,
        e.clientY
    );

    updateWallPreview(p);
}

window.addEventListener('keydown', e => {
    if(e.key === 'Escape') {
        finishWallChain();
        toggleWallDrawing();
    }
});

Tworld.addEventListener('contextmenu', e => {
    if(!wallDrawing)
        return;
    e.preventDefault();
    finishWallChain();
});
Tworld.addEventListener(
    'pointerdown',
    handleWallPointerDown,
    true
);

Tworld.addEventListener(
    'pointermove',
    handleWallPointerMove,
    true
);

//VISIBILITY

function raySegmentIntersection(ox, oy, dx, dy, wall) {
    const x1 = wall.x1;
    const y1 = wall.y1;
    const x2 = wall.x2;
    const y2 = wall.y2;

    const sx = x2 - x1;
    const sy = y2 - y1;

    const denom = dx * sy - dy * sx;

    // Parallel
    if(Math.abs(denom) < 0.000001)
        return null;

    const wx = x1 - ox;
    const wy = y1 - oy;

    const t = (wx * sy - wy * sx) / denom;
    const u = (wx * dy - wy * dx) / denom;

    // t >= 0 = in front of ray
    // u 0..1 = somewhere along wall segment
    if(t >= 0 && u >= 0 && u <= 1) {
        return {
            x: ox + dx * t,
            y: oy + dy * t,
            distance: t
        };
    }

    return null;
}
function castRay(ox, oy, angle, radius) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let nearest = {
        x: ox + dx * radius,
        y: oy + dy * radius,
        distance: radius
    };

    for(const wall of walls) {
        const hit = raySegmentIntersection(
            ox, oy,
            dx, dy,
            wall
        );

        if(hit && hit.distance < nearest.distance) {
            nearest = hit;
        }
    }

    return nearest;
}
function calculateVisibility(ox, oy, radius) {
    const points = [];
    const rayCount = 360;

    for(let i = 0; i < rayCount; i++) {
        const angle =
            (i / rayCount) * Math.PI * 2;

        points.push(
            castRay(ox, oy, angle, radius)
        );
    }

    return points;
}
function updateVisibility(x, y) {
    const radius = 500;

    const points =
        calculateVisibility(x, y, radius);

    const polygon =
        document.getElementById('visibility_polygon');

    polygon.setAttribute(
        'points',
        points
            .map(p => `${p.x},${p.y}`)
            .join(' ')
    );
}
function updateTokenVisibility(token) {
    const x =
        (parseFloat(token.style.left) || 0) +
        token.offsetWidth / 2;

    const y =
        (parseFloat(token.style.top) || 0) +
        token.offsetHeight / 2;

    updateVisibility(x, y);
}

//TOKENS

const myColor =
    '#' + Math.floor(Math.random() * 0xFFFFFF)
        .toString(16)
        .padStart(6, '0');
        
    function snapToGrid(x, y) {
        return {
            x:
                Math.round((x - gridOffsetX) / gridSize)
                    * gridSize + gridOffsetX,

            y:
                Math.round((y - gridOffsetY) / gridSize)
                    * gridSize + gridOffsetY
        };
    }

(() => {
    const world = getel("+js_lit(capture_node(world))+");
    const viewport = getel("+js_lit(capture_node(viewport))+");

    let activeToken = null;
    let activePointer = null;
    let offsetX = 0;
    let offsetY = 0;


    world.addEventListener('pointerdown', e => {
        const token = e.target.closest('.ab_token');

        if(!token) return;

        e.stopPropagation();

        activeToken = token;
        activePointer = e.pointerId;

        const p = screenToWorld(e.clientX, e.clientY);

        const tokenX = parseFloat(token.style.left) || 0;
        const tokenY = parseFloat(token.style.top) || 0;

        offsetX = p.x - tokenX;
        offsetY = p.y - tokenY;

        token.setPointerCapture(e.pointerId);
        token.style.cursor = 'grabbing';

        broadcast(
            `RUN const sq=getel(${JSON.stringify(token.id)});
            sq.style.border='4px solid ${myColor}';`
        );
    });

    world.addEventListener('pointermove', e => {
        if(!activeToken) return;
        if(e.pointerId !== activePointer) return;
        let x = 0;
        let y = 0;

        const p = screenToWorld(e.clientX, e.clientY);

        if(e.shiftKey) {
            x = p.x - offsetX;
            y = p.y - offsetY;
        } else {
            const rawX = p.x - offsetX;
            const rawY = p.y - offsetY;
            const snapped = snapToGrid(rawX, rawY);
            x = snapped.x;
            y = snapped.y;
        }

        activeToken.style.left = x + 'px';
        activeToken.style.top = y + 'px';

        updateTokenVisibility(activeToken);

        broadcast(
            `RUN const sq=getel(${JSON.stringify(activeToken.id)});
            sq.style.left='${x}px';
            sq.style.top='${y}px';`
        );
    });

    function releaseToken(e) {
        if(!activeToken) return;
        if(e.pointerId !== activePointer) return;

        const token = activeToken;

        if(token.hasPointerCapture(e.pointerId)) {
            token.releasePointerCapture(e.pointerId);
        }

        token.style.cursor = 'grab';

        broadcast(
            `RUN const sq=getel(${JSON.stringify(token.id)});
            sq.style.border='';`
        );

        activeToken = null;
        activePointer = null;
    }

    world.addEventListener('pointerup', releaseToken);
    world.addEventListener('pointercancel', releaseToken);
})();










