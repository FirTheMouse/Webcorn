function getel(id) { return document.getElementById(id); }

function resetWebrunner() {
    fetch(window.location.pathname, {
        method: "RESET",
        body: ""
    }).then(r => r.text()).then(html => {
        window.location.reload();
    });
}

function run(ptr, ...captures) {
    const body = [ptr, ...captures].join('@'); //@ is the delmiter we use for runs
    fetch(window.location.pathname, {
        method: 'RUN',
        body: body
    }).then(r => r.text()).then(response => {
        if(!response) return;
        const instructions = response.split('@');
        instructions.forEach(instr => {
            if(instr.startsWith('FRAG ')) {
                const space = instr.indexOf(' ', 5);
                const target = instr.slice(5, space);
                const content = instr.slice(space + 1);
                const el = document.getElementById(target);
                if(el) el.outerHTML = content;
            } else if(instr.startsWith('LOG ')) {
                console.log('[TwigSnap]', instr.slice(4));
            } else if(instr === 'RELOAD') {
                window.location.reload();
            } else if(instr.startsWith('RUN ')) {
                console.log('RUNNNING:'+instr);
                eval(instr.slice(4));
            }
        });
    });
    //Single id version
    // }).then(r => r.text()).then(html => {
    //     if(!html) return;
    //     const parser = new DOMParser();
    //     const doc = parser.parseFromString(html, 'text/html');
    //     const newEl = doc.body.firstChild;
    //     if(newEl && newEl.id) {
    //         document.getElementById(newEl.id).outerHTML = newEl.outerHTML;
    //     }
    // });
}

function run_raw(...args) {
    const body = args.join('').replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
    fetch(window.location.pathname, {
        method: "RUN_RAW",
        body: body
    }).then(r => r.text()).then(html => {
        if(!html) {console.log("Returning, html empty"); return;}
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newEl = doc.body.firstChild;
        console.log("NEW EL:", newEl);
        console.log("NEW EL ID:", newEl?.id);
        console.log("TARGET:", document.getElementById(newEl?.id));
        if(newEl && newEl.id) {
            const target = document.getElementById(newEl.id);
            if(!target) {console.log("Target not found in DOM"); return;}
            target.outerHTML = newEl.outerHTML;
        }
    });
}

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