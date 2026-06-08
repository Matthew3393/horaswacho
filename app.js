const RATE = 4100;
const SUPABASE_URL = 'https://vchntmdlfvmzoapdfasn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_klrBgqz11NEB3zChxsp4Ug_bSSCAb-N';

let entries = [];

const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

async function fetchHoras() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/horas`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) {
            // Error silently if table doesn't exist yet so it doesn't break everything visually
            console.error('Error al obtener datos o la tabla no existe.');
            return;
        }
        const data = await response.json();
        entries = data.map(d => ({
            id: d.id,
            date: d.date,
            start: d.start_time,
            end: d.end_time,
            hours: parseFloat(d.hours),
            obs: d.obs || '-'
        }));
        render();
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

async function addHoraToDB(entry) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/horas`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                date: entry.date,
                start_time: entry.start,
                end_time: entry.end,
                hours: entry.hours,
                obs: entry.obs
            })
        });
        if (!response.ok) throw new Error('Error al guardar datos');
        await fetchHoras();
    } catch (error) {
        console.error("Error guardando dato:", error);
        alert("Hubo un error al guardar. Asegurate de haber corrido el código SQL en Supabase para crear la tabla.");
    }
}

async function deleteHoraFromDB(id) {
    if(!confirm("¿Eliminar este registro?")) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/horas?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) throw new Error('Error al eliminar datos');
        await fetchHoras();
    } catch (error) {
        console.error("Error eliminando dato:", error);
    }
}

function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    return `${d.getDate().toString().padStart(2, '0')} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function getDayName(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    return daysOfWeek[d.getDay()];
}

function groupIntoQuincenas(data) {
    const groups = {};
    
    data.forEach(entry => {
        const d = new Date(entry.date + "T12:00:00");
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const day = d.getDate();
        
        let key = '';
        let label = '';
        
        if (entry.date <= '2026-05-31') {
            key = '0000-01';
            label = '1ª Quincena';
        } else if (entry.date >= '2026-06-01' && entry.date <= '2026-06-15') {
            key = '0000-02';
            label = '2ª Quincena';
        } else {
            let q = day <= 15 ? 1 : 2;
            key = `${year}-${month.toString().padStart(2, '0')}-Q${q}`;
            label = `${q}ª Quincena | Mes ${month}`;
        }
        
        if (!groups[key]) {
            groups[key] = {
                id: key,
                label: label,
                entries: [],
                totalHours: 0
            };
        }
        groups[key].entries.push(entry);
        groups[key].totalHours += entry.hours;
    });

    return Object.values(groups).sort((a, b) => a.id.localeCompare(b.id));
}

function render() {
    const container = document.getElementById('table-container');
    container.innerHTML = '';
    
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const quincenas = groupIntoQuincenas(sortedEntries);
    
    // Group quincenas into Months
    const monthsData = {};
    
    quincenas.forEach(q => {
        let monthKey = '';
        let monthLabel = '';
        
        if (q.id === '0000-01' || q.id === '0000-02') {
            monthKey = '0000';
            monthLabel = 'Mes de Arranque (Mayo/Junio 2026)';
        } else {
            // q.id is like YYYY-MM-Q1
            const parts = q.id.split('-');
            const year = parts[0];
            const monthNum = parseInt(parts[1], 10);
            monthKey = `${year}-${parts[1]}`;
            monthLabel = `${months[monthNum - 1]} ${year}`;
        }
        
        if (!monthsData[monthKey]) {
            monthsData[monthKey] = {
                id: monthKey,
                label: monthLabel,
                quincenas: [],
                totalHours: 0
            };
        }
        
        monthsData[monthKey].quincenas.push(q);
        monthsData[monthKey].totalHours += q.totalHours;
    });
    
    const sortedMonths = Object.values(monthsData).sort((a, b) => a.id.localeCompare(b.id));

    sortedMonths.forEach(m => {
        let monthHtml = `<div class="month-block"><h2 class="month-title">${m.label}</h2>`;
        
        m.quincenas.forEach(q => {
            let label = q.label;
            let statusClass = "status-open";
            let statusText = "En Curso";
            
            if (q.id === '0000-01') {
                statusClass = "status-closed";
                statusText = "Cerrada – A Cobrar";
            }

            const money = q.totalHours * RATE;

            let rowsHtml = '';
            q.entries.forEach((e, i) => {
                rowsHtml += `
                    <tr>
                        <td class="col-id">${i + 1}</td>
                        <td class="col-date">${formatDateDisplay(e.date)}</td>
                        <td class="col-day">${getDayName(e.date)}</td>
                        <td class="col-schedule">${e.start} - ${e.end}</td>
                        <td class="col-hours">${e.hours}</td>
                        <td class="col-obs">${e.obs || '-'}</td>
                        <td class="col-actions">
                            <button class="btn-danger" onclick="deleteHoraFromDB(${e.id})" title="Eliminar">✕</button>
                        </td>
                    </tr>
                `;
            });

            monthHtml += `
                <div class="table-wrapper">
                    <div class="period-header">
                        <span>${label}</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th class="col-id">#</th>
                                <th class="col-date">Fecha</th>
                                <th class="col-day">Día</th>
                                <th class="col-schedule">Horario</th>
                                <th class="col-hours">Horas</th>
                                <th class="col-obs">Observaciones</th>
                                <th class="col-actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            <tr class="subtotal-row">
                                <td colspan="4" class="subtotal-label">Subtotal ${label}:</td>
                                <td colspan="3">
                                    <span class="subtotal-value">${q.totalHours} hrs</span>
                                    <span class="money-value">$${money.toLocaleString('es-AR')}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        // Add Month Total
        const monthMoney = m.totalHours * RATE;
        monthHtml += `
            <div class="month-total-wrapper">
                <div class="month-total-label">Cierre del Mes</div>
                <div style="text-align: right;">
                    <div class="month-total-value">${m.totalHours} hrs</div>
                    <div class="month-total-money">$${monthMoney.toLocaleString('es-AR')}</div>
                </div>
            </div>
        </div>`;
        
        container.innerHTML += monthHtml;
    });
}

// Modal Logic
const modal = document.getElementById('modalAdd');
const btnAdd = document.getElementById('btnAddHours');
const btnClose = document.getElementById('btnCloseModal');
const form = document.getElementById('addHoursForm');

btnAdd.addEventListener('click', () => {
    document.getElementById('inputDate').valueAsDate = new Date();
    modal.classList.add('active');
});

btnClose.addEventListener('click', () => {
    modal.classList.remove('active');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Change button state to show loading
    const btnSubmit = form.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = "Guardando...";
    btnSubmit.disabled = true;

    const date = document.getElementById('inputDate').value;
    const start = document.getElementById('inputStart').value;
    const end = document.getElementById('inputEnd').value;
    const obs = document.getElementById('inputObs').value;

    const tStart = new Date(`1970-01-01T${start}:00`);
    const tEnd = new Date(`1970-01-01T${end}:00`);
    let diff = (tEnd - tStart) / (1000 * 60 * 60);
    if (diff < 0) diff += 24; // Handle over midnight

    await addHoraToDB({
        date: date,
        start: start,
        end: end,
        hours: diff,
        obs: obs || '-'
    });
    
    modal.classList.remove('active');
    form.reset();
    btnSubmit.textContent = originalText;
    btnSubmit.disabled = false;
});

// Init
fetchHoras();
