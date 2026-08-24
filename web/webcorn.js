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

function read_run_response(response) {
    if(!response) {console.log('no response from run'); return};
    var to_return = '';
    const instructions = response.split('@');
    instructions.forEach(instr => {
        if(instr.startsWith('FRAG ')) {
            const space = instr.indexOf(' ', 5);
            const target = instr.slice(5, space);
            const content = instr.slice(space + 1);
            document.querySelectorAll('#'+target).forEach(el => {
                el.outerHTML = content;
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


