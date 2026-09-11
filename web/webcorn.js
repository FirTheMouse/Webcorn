function getel(id) { return document.getElementById(id); }

function resetWebrunner() {
    fetch(window.location.pathname, {
        method: "RESET",
        body: ""
    }).then(r => r.text()).then(html => {
        window.location.reload();
    });
}

function apply_theme(el, css) {
    css.split(';').forEach(rule => {
        const [prop, val] = rule.split(':');
        if(prop && val) el.style.setProperty(prop.trim(), val.trim());
    });
}

function fill_capture(run, ...args) {
    for (const arg of args) {
        run = run.replace('[ANY]',arg);
    }
    return run;
}

function getCursorOffset(el) {
    const sel = window.getSelection();
    if(!sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const parent = range.startContainer?.parentElement;

    let offset = range.startOffset;

    for(const child of el.children) {
        if(child === parent)
            break;
        offset += child.innerText.length;
    }

    return offset;
}

function setCursorOffset(el, offset) {
    const sel = window.getSelection();
    const range = document.createRange();
    let remaining = offset;
    
    for(const child of el.children) {

        const len = child.innerText.length;
        if(remaining-len==1) {
            remaining-=1;
        }
        if(remaining <= len) {
            const text = child.firstChild;
            if(text) {
                range.setStart(text, remaining);
                range.collapse(true);

                sel.removeAllRanges();
                sel.addRange(range);
            }
            return;
        }
        remaining -= len;
    }
}



function read_run_response(response) {
    if(!response) {console.log('no response from run'); return};
    var to_return = '';
    const instructions = response.split('@');
    instructions.forEach(instr => {
        instr = instr.replace(/&AT/g, '@');
        if(instr.startsWith('FRAG ')) {
            const space = instr.indexOf(' ', 5);
            const target = instr.slice(5, space);
            const content = instr.slice(space + 1);
            document.querySelectorAll('#'+target).forEach(el => {

                const editable = el.matches('[contenteditable="true"]')
                    ? el
                    : el.querySelector('[contenteditable="true"]');


                if(editable) {
                    const offset = getCursorOffset(editable);
                    editable.innerHTML = content;
                    setCursorOffset(editable, offset);
                } else {
                    el.outerHTML = content;
                }


                
                document.querySelectorAll('#'+target+' script').forEach(old => {
                    const script = document.createElement('script');
                    script.textContent = old.textContent;
                    document.body.appendChild(script);
                    document.body.removeChild(script);
                });
            });
        } else if(instr.startsWith('LOG ')) {
            console.log('[TwigSnap]', instr.slice(4));
        } else if(instr === 'RELOAD') {
            window.location.reload();
        } else if(instr.startsWith('RUN ')) {
            console.log('RUNNING:'+instr);
            eval(instr.slice(4));
        } else if(instr.startsWith('RETURN ')) {
            to_return+=instr.slice(7);
        }
    });
    return to_return;
}

function run(ptr, ...captures) {
    const body = [ptr, ...captures].join('@'); //@ is the delmiter we use for runs

    if(window.ws && window.ws.readyState === WebSocket.OPEN) {
        window.ws.send('RUN '+body);
        return Promise.resolve();
    }

    return fetch(window.location.pathname, {
        method: 'RUN',
        body: body
    }).then(r => r.text()).then(response => {
        return read_run_response(response);
    });
}

function emit_reload(el) {
    fetch(window.location.pathname, {
        method: 'JSRELOAD',
        body: el.dataset.ptr
    }).then(r => r.text()).then(response => {
        return read_run_response(response);
    });
}

function make_snap(el) {
    el.joint = null;
    el.unlockJoint = false;
    el.snap_children = [];
    el.snap_parent = null;

    el.updateTransform = function() {
        let doUpdate = true;
        if(!this.unlockJoint && this.joint) {
            doUpdate = this.joint();
        }
        for(const c of this.snap_children) {
            c.updateTransform();
        }
        if(!doUpdate) return;
    };

    el.addSnapChild = function(child) {
        make_snap(child);
        child.snap_parent = this;
        this.snap_children.push(child);
    };

    return el;
}

const snap_roots = [];

function make_snap_root(el) {
    make_snap(el);
    el.joint = function() {return true;}
    snap_roots.push(el);
    return el;
}

function update_all_transforms() {
    for(const root of snap_roots) {
        root.updateTransform();
    }
}

window.addEventListener('resize', update_all_transforms);
window.addEventListener('scroll', update_all_transforms, true);
window.addEventListener('load', update_all_transforms);

// let mouse_x = 0;
// let mouse_y = 0;
// document.addEventListener('mousemove', (e) => {
//     mouse_x = e.clientX;
//     mouse_y = e.clientY;
//     update_all_transforms();
// });

function fragthree(target, instruction, content) {
    fetch(window.location.pathname, {
        method: "FRAG",
        body: target+" "+instruction+" "+content
    })
    .then(r => r.text())
    .then(html => {
        document.getElementById(target).outerHTML = html;
        document.querySelectorAll('#'+target+' script').forEach(old => {
            const script = document.createElement('script');
            script.textContent = old.textContent;
            old.replaceWith(script);
        });
    });
}

function goTo(route) {
    window.location.href = route;
}


function frag(target, instruction = "") {
    fetch(window.location.pathname, {
        method: "FRAG",
        body: target + (instruction ? " " + instruction : "")
    })
    .then(r => r.text())
    .then(html => {
        document.getElementById(target).outerHTML = html;
    });
}

function post(body) {
    fetch(window.location.pathname, {
        method: "POST",
        body: body
    })
}
async function postAsset(file) {
    const header = `ASSET ${file.type}\n`;

    const payload = new Blob(
        [header, file],
        { type: "application/octet-stream" }
    );

    if(window.ws &&window.ws.readyState === WebSocket.OPEN) {
        const wsPayload = new Blob([
            "POST ",
            payload
        ]);
        window.ws.send(wsPayload);
        return;
    }

    const response = await fetch(window.location.href, {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream"
        },
        body: payload
    });

    if(!response.ok) {
        throw new Error(
            `Asset POST failed: ${response.status}`
        );
    }

    return response.text();
}

function cell_post(input, label, col, row, target) {
    fetch(window.location.pathname, {
        method: "POST",
        body: label + " " + col + " " + row + " " + target + " " + input.value
    }).then(() => frag(target));
}

function postForm(fields) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = window.location.pathname;
    Object.entries(fields).forEach(([k,v]) => {
        const input = document.createElement('input');
        input.name = k; input.value = v;
        form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
}


