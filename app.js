const API_URL = `https://script.google.com/macros/s/AKfycbzP-qBzVytXwMXTU67z8i4MFUYENUvtVOgoBicXOv-b1-zGi4QgvoKj9gdu_jHJZEhg/exec`.trim();

const app = {
    data: { vencido: [], curso: [], entrante: [] },
    configs: { curso: {}, entrante: {} },
    shifts: ["M", "T", "N", "RT", "RM", "F", "-"],
    
    // Convertimos strings para que sean 100% seguros dentro de atributos HTML nativos
    escapeAttr: function(str) {
        if (!str) return "";
        return str.toString()
                  .replace(/&/g, '&amp;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;')
                  .replace(/[\r\n\u2028\u2029]+/g, ' '); // Destruye cualquier salto de línea oculto
    },

    init: async function() {
        this.bindEvents();
        await this.fetchData();
        this.renderAll();
    },

    bindEvents: function() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.target).classList.add('active');
            });
        });
    },

    fetchData: async function() {
        try {
            const res = await fetch(API_URL);
            const json = await res.json();
            this.data.vencido = json["Calendario mes vencido"] || [];
            this.data.curso = json["Calendario mes en curso "] || [];
            this.data.entrante = json["Calendario mes entrante "] || [];
            
            if(this.data.curso.length > 1) this.buildDefaultConfig('curso');
            if(this.data.entrante.length > 1) this.buildDefaultConfig('entrante');
        } catch(e) {
            console.error("Error cargando datos", e);
        }
    },

    buildDefaultConfig: function(tab) {
        const matrix = this.data[tab];
        for(let i = 1; i < matrix.length; i++) {
            // Limpieza profunda de la celda de Sheets antes de usarla como clave JS
            if(matrix[i][0]) {
                matrix[i][0] = matrix[i][0].toString().replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
            }
            const name = matrix[i][0];
            if(!name) continue;
            
            this.configs[tab][name] = {
                disp: 'Disponible', dispDays: '', category: 'Titular',
                prefs: { M:true, T:true, N:true, RT:true, RM:true, F:true },
                limits: { M:{min:'', max:'', prio:''}, T:{min:'', max:'', prio:''}, N:{min:'', max:'', prio:''}, RT:{min:'', max:'', prio:''}, RM:{min:'', max:'', prio:''} },
                nnff: false, weekends: '1'
            };
        }
    },

    renderAll: function() {
        this.renderTable('vencido', true);
        this.renderTable('curso', false);
        this.renderTable('entrante', false);
        this.renderConfigPanel('curso');
        this.renderConfigPanel('entrante');
        this.loadHistorical();
    },

    renderTable: function(tab, readOnly) {
        const container = document.getElementById(`table-${tab}`);
        const matrix = this.data[tab];
        if(!matrix || matrix.length === 0) { container.innerHTML = "<p>Sin datos</p>"; return; }

        let html = "<table><thead><tr>";
        matrix[0].forEach((cell) => {
            html += `<th>${cell}</th>`;
        });
        html += "</tr></thead><tbody>";

        for(let i = 1; i < matrix.length; i++) {
            html += "<tr>";
            matrix[i].forEach((cell, j) => {
                if(j === 0) {
                    html += `<td>${cell}</td>`;
                } else {
                    const val = cell || "";
                    const safeVal = this.escapeAttr(val);
                    if(readOnly) html += `<td>${val}</td>`;
                    else html += `<td><input type="text" data-row="${i}" data-col="${j}" data-tab="${tab}" value="${safeVal}" onchange="app.updateCell(this)"></td>`;
                }
            });
            html += "</tr>";
        }
        html += "</tbody></table>";
        container.innerHTML = html;
    },

    updateCell: function(input) {
        const val = input.value.toUpperCase();
        if(val !== "" && !this.shifts.includes(val)) {
            this.showAlert("Error", "Turno no válido. Use: M, T, N, RT, RM, F, -");
            input.value = "";
            return;
        }
        this.data[input.dataset.tab][input.dataset.row][input.dataset.col] = val;
    },

    renderConfigPanel: function(tab) {
        const container = document.getElementById(`panel-${tab}`);
        const conf = this.configs[tab];
        let html = "";
        
        const safeTab = this.escapeAttr(tab);

        for(let name in conf) {
            const safeName = this.escapeAttr(name);
            const workerConf = conf[name];
            
            html += `
            <div class="worker-row">
                <div class="worker-name">${name}</div>
                <div><select data-tab="${safeTab}" data-name="${safeName}" data-key="disp" onchange="app.updateConf(this)">
                    <option value="Disponible" ${workerConf.disp === 'Disponible' ? 'selected' : ''}>Disponible</option>
                    <option value="Parcial" ${workerConf.disp === 'Parcial' ? 'selected' : ''}>Disp. Parcial</option>
                    <option value="No" ${workerConf.disp === 'No' ? 'selected' : ''}>No Disponible</option>
                </select></div>
                <div><select data-tab="${safeTab}" data-name="${safeName}" data-key="category" onchange="app.updateConf(this)">
                    <option ${workerConf.category === 'Titular' ? 'selected' : ''}>Titular</option>
                    <option ${workerConf.category === 'Refuerzo' ? 'selected' : ''}>Refuerzo</option>
                    <option ${workerConf.category === 'Comodín 1' ? 'selected' : ''}>Comodín 1</option>
                    <option ${workerConf.category === 'Comodín 2' ? 'selected' : ''}>Comodín 2</option>
                    <option ${workerConf.category === 'Soporte nocturno' ? 'selected' : ''}>Soporte nocturno</option>
                </select></div>
                <div>
                    M<input type="checkbox" data-tab="${safeTab}" data-name="${safeName}" data-shift="M" ${workerConf.prefs.M ? 'checked' : ''} onchange="app.updatePref(this)"> 
                    T<input type="checkbox" data-tab="${safeTab}" data-name="${safeName}" data-shift="T" ${workerConf.prefs.T ? 'checked' : ''} onchange="app.updatePref(this)"> 
                    N<input type="checkbox" data-tab="${safeTab}" data-name="${safeName}" data-shift="N" ${workerConf.prefs.N ? 'checked' : ''} onchange="app.updatePref(this)">
                </div>
                <div>Prioridades (Auto)</div>
                <div>NNFF <input type="checkbox" data-tab="${safeTab}" data-name="${safeName}" data-key="nnff" ${workerConf.nnff ? 'checked' : ''} onchange="app.updateConf(this)"></div>
                <div>Fines de semana <select data-tab="${safeTab}" data-name="${safeName}" data-key="weekends" onchange="app.updateConf(this)">
                    <option ${workerConf.weekends === '1' ? 'selected' : ''}>1</option>
                    <option ${workerConf.weekends === '2' ? 'selected' : ''}>2</option>
                    <option ${workerConf.weekends === '3' ? 'selected' : ''}>3</option>
                </select></div>
            </div>`;
        }
        container.innerHTML = html;
    },

    updateConf: function(el) { 
        const tab = el.dataset.tab;
        const name = el.dataset.name;
        const key = el.dataset.key;
        const val = el.type === 'checkbox' ? el.checked : el.value;
        this.configs[tab][name][key] = val; 
    },
    
    updatePref: function(el) { 
        const tab = el.dataset.tab;
        const name = el.dataset.name;
        const shift = el.dataset.shift;
        this.configs[tab][name].prefs[shift] = el.checked; 
    },

    initMonth: function(tab) {
        const mes = prompt("Ingrese MES (ej: ENERO):", "").toUpperCase();
        const año = prompt("Ingrese AÑO (ej: 2026):", "");
        if(!mes || !año) return;

        const daysInMonth = new Date(año, this.getMonthIndex(mes) + 1, 0).getDate();
        const matrix = this.data[tab];
        matrix[0][0] = `${mes}\n${año}`;
        
        matrix[0].length = daysInMonth + 1;
        for(let j=1; j<=daysInMonth; j++) {
            const date = new Date(año, this.getMonthIndex(mes), j);
            const diaLetra = ['D','L','M','M','J','V','S'][date.getDay()];
            matrix[0][j] = `${j.toString().padStart(2, '0')}\n${diaLetra}`;
        }
        for(let i=1; i<matrix.length; i++) matrix[i].length = daysInMonth + 1;
        
        this.renderTable(tab, false);
    },

    getMonthIndex: function(mes) {
        const meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
        return meses.indexOf(mes);
    },

    clearSchedule: function(tab) {
        const matrix = this.data[tab];
        for(let i=1; i<matrix.length; i++) {
            for(let j=1; j<matrix[i].length; j++) {
                matrix[i][j] = "";
            }
        }
        this.renderTable(tab, false);
    },

    saveData: async function(tab) {
        const sheetMap = { "curso": "Calendario mes en curso ", "entrante": "Calendario mes entrante " };
        const payload = { action: "save", sheetName: sheetMap[tab], matrix: this.data[tab] };
        
        try {
            await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
            alert("Guardado exitoso");
        } catch(e) {
            this.showAlert("Error", "No se pudo guardar en Google Sheets.");
        }
    },

    autoComplete: function(tab) {
        const matrix = this.data[tab];
        const conf = this.configs[tab];
        const rows = matrix.length;
        const cols = matrix[0].length;
        
        let disponibles = 0;
        for(let name in conf) { if(conf[name].disp !== 'No') disponibles++; }
        
        if (disponibles < 12) { 
            this.showAlert("Error Matemático", `Personal insuficiente. Se requieren mínimo 12 personas activas para cubrir cuotas y descansos diarios. Disponibles: ${disponibles}.`);
            return;
        }

        const cuotasDiarias = { M:3, T:3, N:2, RT:1, RM:1 };
        
        for (let day = 1; day < cols; day++) {
            let asignadosHoy = { M:0, T:0, N:0, RT:0, RM:0, F:0 };
            
            for (let i = 1; i < rows; i++) {
                const val = matrix[i][day];
                if (val && asignadosHoy[val] !== undefined) asignadosHoy[val]++;
            }

            for (let shift in cuotasDiarias) {
                while (asignadosHoy[shift] < cuotasDiarias[shift]) {
                    let bestWorkerIdx = this.findBestWorkerForShift(matrix, conf, day, shift);
                    if (bestWorkerIdx === -1) break; 
                    
                    matrix[bestWorkerIdx][day] = shift;
                    asignadosHoy[shift]++;
                }
            }

            for (let i = 1; i < rows; i++) {
                const name = matrix[i][0];
                if (!matrix[i][day]) {
                    if (conf[name].disp === 'No') matrix[i][day] = "-";
                    else matrix[i][day] = "F";
                }
            }
        }
        
        this.renderTable(tab, false);
    },

    findBestWorkerForShift: function(matrix, conf, day, shift) {
        let bestScore = -999;
        let bestIdx = -1;

        for (let i = 1; i < matrix.length; i++) {
            const name = matrix[i][0];
            const workerConf = conf[name];

            if (matrix[i][day]) continue; 
            if (workerConf.disp === 'No') continue;
            if (!workerConf.prefs[shift]) continue;
            
            const yesterday = day > 1 ? matrix[i][day-1] : "";
            if (shift === 'N' && (yesterday === 'M' || yesterday === 'T')) continue;

            if (workerConf.nnff && shift === 'N') {
                if (yesterday === 'N' && day > 2 && matrix[i][day-2] === 'N') continue; 
            }

            let score = 0;
            if (shift === 'M' || shift === 'T') {
                if (workerConf.category === 'Titular') score += 10;
                else if (workerConf.category === 'Refuerzo') score += 8;
            }
            if (shift === 'N') {
                if (workerConf.category === 'Soporte nocturno' || workerConf.category === 'Titular') score += 10;
            }
            
            if (yesterday === 'F') score += 5;

            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }
        return bestIdx;
    },

    loadHistorical: async function() {
        try {
            const res = await fetch(`${API_URL}?action=getFiles`);
            const files = await res.json();
            const container = document.getElementById('history-container');
            container.innerHTML = files.map(f => `
                <div class="history-card">
                    <p>${f.name}</p>
                    <a href="${f.url}" target="_blank">Ver Archivo</a>
                </div>
            `).join('');
        } catch(e) { }
    },

    showAlert: function(title, message) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-message').innerText = message;
        document.getElementById('modal-alert').classList.remove('hidden');
    },

    closeModal: function() {
        document.getElementById('modal-alert').classList.add('hidden');
    }
};

window.onload = () => app.init();
