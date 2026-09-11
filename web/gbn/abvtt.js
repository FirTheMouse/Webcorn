let activeThing = null;
let activePointer = null;
let grabX = 0;
let grabY = 0;


function acornFloat(n) {
    if(!Number.isFinite(n)) {
        throw new Error("Invalid Acorn float: " + n);
    }

    let s = String(n);

    if(s.includes('.')) return s;

    const e = s.search(/[eE]/);
    if(e !== -1) {
        return s.slice(0, e) + ".0" + s.slice(e);
    }

    return s + ".0";
}

function thingTransform(
    new_x,
    new_y,
    new_z,
    new_rot,
    new_scale
) {
    transform_thing(
        this.i,
        acornFloat(new_x),
        acornFloat(new_y),
        new_z,
        acornFloat(new_rot),
        acornFloat(new_scale)
    );
}


function applyThingState(
    i,
    x,
    y,
    z,
    rot,
    scale
) {
    const thing = world.Things[i];

    thing.x = x;
    thing.y = y;
    thing.z = z;
    thing.rot = rot;
    thing.scale = scale;

    applyThingTransform(thing);

    if(selectedThing === thing) {
        updateThingHandles();
    }
}


function syncThingTransform(thing) {
    const i = thing.i;

    const x     = acornFloat(thing.x);
    const y     = acornFloat(thing.y);
    const z     = thing.z;
    const rot   = acornFloat(thing.rot);
    const scale = acornFloat(thing.scale);

    thing.transform(
        thing.x,
        thing.y,
        thing.z,
        thing.rot,
        thing.scale
    );

    const js =
        `RUN applyThingState(` +
        `${i},${x},${y},${z},${rot},${scale}` +
        `);`;

    broadcast(js);
}

function registerThing(thing, el) {
    thing.el = el;
    thing.transform = thingTransform;
    el.addEventListener('pointerdown', e => {
        selectedThing = thing;
        updateThingHandles();
        startThingDrag(e);
    });
    el.addEventListener('dragstart', e => e.preventDefault());
}

function addThing(
    eid,
    ptr,
    asset,
    x,
    y,
    z,
    rot,
    scale
) {
    const thing = {
        i: eid,
        ptr,
        x,
        y,
        z,
        rot,
        scale
    };

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
    el.style.transform =
        `rotate(${rot}rad) scale(${scale})`;

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


function startThingDrag(e) {
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

    const p = screenToWorld(e.clientX, e.clientY);

    activeThing.x = p.x - grabX;
    activeThing.y = p.y - grabY;
    
    applyThingTransform(activeThing);
    updateThingHandles();
    
    syncThingTransform(activeThing);
}


function endThingDrag(e) {
    if(!activeThing || e.pointerId !== activePointer) return;

    activeThing = null;
    activePointer = null;
}


let selectedThing = null;

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

    const halfW =
        thing.el.offsetWidth * thing.scale / 2;

    const halfH =
        thing.el.offsetHeight * thing.scale / 2;

    // Bottom-right corner.
    const scaleOffset =
        rotateVector(halfW, halfH, thing.rot);

    scaleHandle.style.left =
        (center.x + scaleOffset.x - 7) + 'px';

    scaleHandle.style.top =
        (center.y + scaleOffset.y - 7) + 'px';


    // Above top-center.
    const rotateOffset =
        rotateVector(
            0,
            -halfH - 30,
            thing.rot
        );

    rotateHandle.style.left =
        (center.x + rotateOffset.x - 7) + 'px';

    rotateHandle.style.top =
        (center.y + rotateOffset.y - 7) + 'px';


    scaleHandle.style.display = 'block';
    rotateHandle.style.display = 'block';
}

let scalingThing = null;
let scalePointer = null;
let startScale = 1;
let startScaleDistance = 1;

scaleHandle.addEventListener('pointerdown', e => {
    if(!selectedThing) return;

    e.stopPropagation();

    scalingThing = selectedThing;
    scalePointer = e.pointerId;

    const p = screenToWorld(
        e.clientX,
        e.clientY
    );

    const center = thingCenter(scalingThing);

    startScaleDistance = Math.hypot(
        p.x - center.x,
        p.y - center.y
    );

    startScale = scalingThing.scale;

    scaleHandle.setPointerCapture(e.pointerId);
});

let rotatingThing = null;
let rotatePointer = null;
let rotateOffset = 0;


rotateHandle.addEventListener('pointerdown', e => {
    if(!selectedThing) return;

    e.stopPropagation();

    rotatingThing = selectedThing;
    rotatePointer = e.pointerId;

    const p = screenToWorld(
        e.clientX,
        e.clientY
    );

    const center = thingCenter(rotatingThing);

    const pointerAngle = Math.atan2(
        p.y - center.y,
        p.x - center.x
    );

    rotateOffset =
        pointerAngle - rotatingThing.rot;

    rotateHandle.setPointerCapture(e.pointerId);
});

function applyThingPosition(i, x, y) {
    const thing = world.Things[i];

    thing.x = x;
    thing.y = y;

    thing.el.style.left = x + 'px';
    thing.el.style.top = y + 'px';
}

function applyThingTransform(thing) {
    thing.el.style.left =
        thing.x + 'px';

    thing.el.style.top =
        thing.y + 'px';

    thing.el.style.zIndex =
        thing.z;

    thing.el.style.transform =
        `rotate(${thing.rot}rad) scale(${thing.scale})`;
}


function syncThingPosition(thing) {
    const i = thing.i;
    const x = acornFloat(thing.x);
    const y = acornFloat(thing.y);
    thing.transform(thing.x,thing.y,thing.z,thing.rot,thing.scale)
    const js = `RUN applyThingPosition(${i},${x},${y});`;
    broadcast(js);
}



document.addEventListener('pointermove', e => {
    if(
        scalingThing &&
        e.pointerId === scalePointer
    ) {
        const p = screenToWorld(
            e.clientX,
            e.clientY
        );

        const center = thingCenter(scalingThing);

        const distance = Math.hypot(
            p.x - center.x,
            p.y - center.y
        );

        scalingThing.scale =
            startScale *
            (distance / startScaleDistance);
        
        scalingThing.scale =
            Math.max(0.05, scalingThing.scale);
        
        applyThingTransform(scalingThing);
        updateThingHandles();
        
        syncThingTransform(scalingThing);
        return;
    }


    if(
        rotatingThing &&
        e.pointerId === rotatePointer
    ) {
        const p = screenToWorld(
            e.clientX,
            e.clientY
        );

        const center = thingCenter(rotatingThing);

        rotatingThing.rot =
            Math.atan2(
                p.y - center.y,
                p.x - center.x
            ) - rotateOffset;
        
        applyThingTransform(rotatingThing);
        updateThingHandles();
        
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
