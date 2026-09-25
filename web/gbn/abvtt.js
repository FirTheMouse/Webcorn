let gridScale = 50;
let gridWidth = 3000;
let gridHeight = 2000;
let gridOffsetX = 0;
let gridOffsetY = 0;
    function updateGrid() {
        grid.style.width = `${gridWidth}px`;
        grid.style.height = `${gridHeight}px`;
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
        grid.style.backgroundSize = `${gridScale}px ${gridScale}px`;
        grid.style.backgroundPosition = `${gridOffsetX}px ${gridOffsetY}px`;
    }
    updateGrid();


let panX = 0;
let panY = 0;
let scale = 1;

    function updateWorld() {
        world_root.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;

        window.boardView.panX = panX;
        window.boardView.panY = panY;
        window.boardView.scale = scale;
    }

let panning = false;
let startX = 0;
let startY = 0;

    viewport.addEventListener('pointerdown', (e) => {
        if(e.button !== 0) return;
        if(e.target.closest('.ab_clickable')) return;
        if(e.target.closest('button')) return;
        if(e.target.closest('p')) return;
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
    function snapToGrid(x, y) {
        return {
            x: Math.round((x - gridOffsetX) / gridScale)* gridScale + gridOffsetX,
            y: Math.round((y - gridOffsetY) / gridScale)* gridScale + gridOffsetY
        };
    }


let activeThing = null;
let activePointer = null;
let grabX = 0;
let grabY = 0;

    function updateVisualTransform(thing) {
        thing.el.style.left = thing.x + 'px';
        thing.el.style.top = thing.y + 'px';
        thing.el.style.zIndex = thing.z;
        thing.el.style.transform = `rotate(${thing.rot}rad) scale(${thing.scale})`;
    }
    function setThingTransform(i,x,y,z,rot,scale) {
        const thing = world.Things[i];
        thing.x = x;
        thing.y = y;
        thing.z = z;
        thing.rot = rot;
        thing.scale = scale;
        updateVisualTransform(thing);
        if(selectedThing === thing) {
            updateThingHandles();
        }
    }
    function syncThingTransform(thing) {
        updateVisualTransform(thing);
        updateThingHandles();
        updateAcornTransform(thing);
        broadcast(`RUN setThingTransform(${thing.i},${thing.x},${thing.y},${thing.z},${thing.rot},${thing.scale});`);
    }

    function registerThing(thing, el) {
        thing.el = el;
        el.addEventListener('pointerdown', e => {
            if(e.button !== 0) return;
            if(!('locked' in thing)||thing.locked===false) {
                selectedThing = thing;
                updateThingHandles();
                startThingDrag(e);
            }
        });
        el.oncontextmenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
    
            context_selected_thing = thing.i;
            selectContextPage('context_content_thing');
            contextPanelIn();
        };
        el.addEventListener('dragstart', e => e.preventDefault());
    }
    function addThing(eid,ptr,asset,x,y,z,rot,scale) {
        const thing = {i: eid, ptr, x, y, z, rot, scale};
        const el = document.createElement("img");
        el.className = "ab_entity";
        el.dataset.eidx = eid;
        el.src = asset;
        el.draggable = false;
        el.style.position = "absolute";
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.zIndex = z;
        el.style.transformOrigin = "center center";
        el.style.transform = `rotate(${rot}rad) scale(${scale})`;
        getel('world_root').appendChild(el);
        world.Things[eid] = thing;
        registerThing(thing, el);
    }
    function registerThings() {
        document.querySelectorAll('.ab_entity').forEach(el => {
            const i = Number(el.dataset.eidx);
            registerThing(world.Things[i], el);
        });
    }
    registerThings();

    function startThingDrag(e) {
        console.log('starting thing drag');
        if(e.button !== 0) return;
        e.stopPropagation();
        const i = Number(e.currentTarget.dataset.eidx);
        activeThing = world.Things[i];
        activePointer = e.pointerId;
        const p = screenToWorld(e.clientX, e.clientY);
        grabX = p.x - activeThing.x;
        grabY = p.y - activeThing.y;
        e.currentTarget.setPointerCapture(e.pointerId);
    }
    function moveThingDrag(e) {
        if(!activeThing || e.pointerId !== activePointer) return;
        let x = 0;
        let y = 0;
        const p = screenToWorld(e.clientX, e.clientY);
        if(e.shiftKey) {
            x = p.x - grabX;
            y = p.y - grabY;
        } else {
            const rawX = p.x - grabX;
            const rawY = p.y - grabY;
            const snapped = snapToGrid(rawX, rawY);
            x = snapped.x;
            y = snapped.y;
        }
        activeThing.x = x;
        activeThing.y = y;
        syncThingTransform(activeThing);
    }
    function endThingDrag(e) {
        if(!activeThing || e.pointerId !== activePointer) return;
        activeThing = null;
        activePointer = null;
    }

let selectedThing = null;
let scalingThing = null;
let scalePointer = null;
let startScale = 1;
let startScaleDistance = 1;
let rotatingThing = null;
let rotatePointer = null;
let rotateOffset = 0;

const scaleHandle = getel('scale_handle');
const rotateHandle = getel('rotate_handle');

    function thingCenter(thing) {
        return {
            x: thing.x + thing.el.offsetWidth / 2,
            y: thing.y + thing.el.offsetHeight / 2
        };
    }

    function rotateVector(x, y, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);

        return {
            x: x * c - y * s,
            y: x * s + y * c
        };
    }

    function updateThingHandles() {
        if(!selectedThing) {
            scaleHandle.style.display = 'none';
            rotateHandle.style.display = 'none';
            return;
        }
        const thing = selectedThing;
        const center = thingCenter(thing);
        const halfW = thing.el.offsetWidth * thing.scale / 2;
        const halfH = thing.el.offsetHeight * thing.scale / 2;
        const scaleOffset = rotateVector(halfW, halfH, thing.rot);
        scaleHandle.style.left = (center.x + scaleOffset.x - 7) + 'px';
        scaleHandle.style.top = (center.y + scaleOffset.y - 7) + 'px';
        const rotateOffset = rotateVector(0,-halfH - 30,thing.rot);
        rotateHandle.style.left = (center.x + rotateOffset.x - 7) + 'px';
        rotateHandle.style.top = (center.y + rotateOffset.y - 7) + 'px';
        scaleHandle.style.display = 'block';
        rotateHandle.style.display = 'block';
    }

    scaleHandle.addEventListener('pointerdown', e => {
        if(!selectedThing) return;
        if(e.button !== 0) return;
        e.stopPropagation();
        scalingThing = selectedThing;
        scalePointer = e.pointerId;
        const p = screenToWorld(e.clientX,e.clientY);
        const center = thingCenter(scalingThing);
        startScaleDistance = Math.hypot(p.x - center.x,p.y - center.y);
        startScale = scalingThing.scale;
        scaleHandle.setPointerCapture(e.pointerId);
    });
    rotateHandle.addEventListener('pointerdown', e => {
        if(!selectedThing) return;
        if(e.button !== 0) return;
        e.stopPropagation();
        rotatingThing = selectedThing;
        rotatePointer = e.pointerId;
        const p = screenToWorld(e.clientX,e.clientY);
        const center = thingCenter(rotatingThing);
        const pointerAngle = Math.atan2(p.y - center.y,p.x - center.x);
        rotateOffset = pointerAngle - rotatingThing.rot;
        rotateHandle.setPointerCapture(e.pointerId);
    });
    document.addEventListener('pointermove', e => {
        if(scalingThing &&e.pointerId === scalePointer) {
            const p = screenToWorld(e.clientX,e.clientY);
            const center = thingCenter(scalingThing);
            const distance = Math.hypot(p.x - center.x, p.y - center.y);
            scalingThing.scale = startScale * (distance / startScaleDistance);
            scalingThing.scale = Math.max(0.05, scalingThing.scale);
            syncThingTransform(scalingThing);
            return;
        }
        if(rotatingThing&&e.pointerId === rotatePointer) {
            const p = screenToWorld(e.clientX,e.clientY);
            const center = thingCenter(rotatingThing);
            rotatingThing.rot = Math.atan2(p.y - center.y,p.x - center.x) - rotateOffset;
            syncThingTransform(rotatingThing);
            return;
        }
        moveThingDrag(e);
    });
    document.addEventListener('pointerup', e => {
        if(e.pointerId === scalePointer) {
            scalingThing = null;
            scalePointer = null;
        }
        if(e.pointerId === rotatePointer) {
            rotatingThing = null;
            rotatePointer = null;
        }
        endThingDrag(e);
    });
    document.addEventListener('pointercancel', endThingDrag);
