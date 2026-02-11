import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

let app, db, docRef;

async function initApp() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Config fetch failed');
        const firebaseConfig = await res.json();

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("App loaded. Secure Mode.");

        setupRealtimeSync();
    } catch (e) {
        console.error("Init Error:", e);
    }
}

initApp();

const propertyList = document.getElementById('property-list');
// const addPropertyBtn = document.getElementById('add-property'); // Kept in DOM structure but hidden
const loadCalendarBtn = document.getElementById('load-calendar');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const currentMonthEl = document.getElementById('current-month');
const calendarGrid = document.getElementById('calendar-grid');
const adminLockBtn = document.getElementById('admin-lock-btn');

let isAdmin = false;
const ADMIN_PASSWORD = "JohnsonAirbnb";

let currentDate = new Date();
// Structure: { dateString: [ { propertyName, color, type: 'cleaning' } ] }
let calendarEvents = {};

const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700', '#00FFFF'];

// State - Now synced from Firebase
let properties = [];
let manualCleanings = {};
let removedCleanings = {};

async function setupRealtimeSync() {
    docRef = doc(db, "appData", "airbnb_secure_calendar_2024");

    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            properties = data.properties || [];
            manualCleanings = data.manualCleanings || {};
            removedCleanings = data.removedCleanings || {};

            console.log("Data synced from Firebase!");

            renderProperties();
            renderLegend();
            renderCalendar();

            // Auto-fetch if properties exist
            if (properties.some(p => p.url)) {
                fetchAllCalendars();
            }
        } else {
            console.log("No remote data found, starting fresh.");
        }
    });
}

async function saveData() {
    try {
        await setDoc(docRef, {
            properties: properties,
            manualCleanings: manualCleanings,
            removedCleanings: removedCleanings
        });
        console.log("Data saved to Firebase!");
    } catch (e) {
        console.error("Error saving to Firebase: ", e);
        alert("Error saving data. Check console.");
    }
}

function saveProperties() {
    saveData();
}

function saveManualData() {
    saveData();
}

function renderProperties() {
    propertyList.innerHTML = '';
    properties.forEach((prop, index) => {
        const div = document.createElement('div');
        div.className = 'property-item';
        div.innerHTML = `
            <div class="property-color" style="background-color: ${prop.color}"></div>
            <div class="property-inputs">
                <input type="text" class="item-name" placeholder="Name" value="${prop.name}" data-id="${prop.id}">
                <input type="text" class="item-url" placeholder="iCal URL" value="${prop.url}" data-id="${prop.id}">
            </div>
            <button class="remove-prop" data-id="${prop.id}">&times;</button>
        `;
        propertyList.appendChild(div);

        // Color picker visual only for now, logic rotates colors
    });

    // Add event listeners for inputs
    document.querySelectorAll('.item-name').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            const prop = properties.find(p => p.id === id);
            if (prop) {
                prop.name = e.target.value;
                saveProperties();
                renderLegend();
            }
        });
    });

    document.querySelectorAll('.item-url').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            const prop = properties.find(p => p.id === id);
            if (prop) {
                prop.url = e.target.value;
                saveProperties();
            }
        });
    });

    document.querySelectorAll('.remove-prop').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            properties = properties.filter(p => p.id !== id);
            saveProperties();
            renderProperties();
            renderLegend(); // Update legend
        });
    });
}

function renderLegend() {
    const legendContainer = document.getElementById('calendar-legend');
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    properties.forEach(prop => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color" style="background-color: ${prop.color}"></div>
            <span>${prop.name}</span>
        `;
        legendContainer.appendChild(item);
    });
}

// Button listeners (Add Prop logic removed from UI access but kept in func if needed later)
// addPropertyBtn event listener removed as button is hidden/inaccessible easily
const addPropertyBtn = document.getElementById('add-property');
if (addPropertyBtn) {
    addPropertyBtn.addEventListener('click', () => {
        const newColor = colors[properties.length % colors.length];
        properties.push({
            id: Date.now(),
            name: `Property ${properties.length + 1}`,
            url: '',
            color: newColor
        });
        saveProperties();
        renderProperties();
        renderLegend(); // Update legend on add
    });
}

loadCalendarBtn.addEventListener('click', () => {
    fetchAllCalendars();
});

prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

async function fetchAllCalendars() {
    calendarEvents = {}; // Reset events

    const promises = properties.map(async (prop) => {
        if (!prop.url) return;

        try {
            const proxyUrl = `/api/calendar?url=${encodeURIComponent(prop.url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Failed');
            const data = await response.text();
            parseICal(data, prop);
        } catch (error) {
            console.error(`Error loading ${prop.name}:`, error);
        }
    });

    await Promise.all(promises);
    renderCalendar();

    // Update Last Updated Timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Last Updated: ${timeString}`;
    }
}

const togglePropertiesBtn = document.getElementById('toggle-properties');
const propertiesContainer = document.getElementById('properties-container');

if (togglePropertiesBtn) {
    togglePropertiesBtn.addEventListener('click', () => {
        propertiesContainer.classList.toggle('hidden');
        if (propertiesContainer.style.display === 'none') {
            propertiesContainer.style.display = 'block'; // Override inline style if present
            propertiesContainer.classList.remove('hidden');
        } else {
            propertiesContainer.style.display = 'none';
            propertiesContainer.classList.add('hidden');
        }
    });
}

const modal = document.getElementById('add-cleaning-modal');
const modalDateDisplay = document.getElementById('modal-date-display');
const modalPropertyList = document.getElementById('modal-property-list');
const closeModalBtn = document.getElementById('close-modal');

let selectedDateForManual = null; // 'YYYY-MM-DD'
// Removed local initialization as it depends on Firebase now

// Helper to get unique key for event
function getEventKey(dateStr, propertyName) {
    return `${dateStr}|${propertyName}`;
}

// Update parseICal to respect removedCleanings
function parseICal(data, property) {
    try {
        const jcalData = ICAL.parse(data);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            let cleaningDate = event.endDate.toJSDate();

            // Use UTC methods to ensure consistent date handling relative to the iCal data
            // preventing local timezone shifts (e.g. 00:00:00 becoming 23:00:00 previous day)
            const yyyy = cleaningDate.getUTCFullYear();
            const mm = String(cleaningDate.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(cleaningDate.getUTCDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;

            console.log(`Parsed Event: ${event.summary} ending on ${dateStr} (Raw: ${event.endDate})`);

            // Filter out "Blocked" events which are just calendar availability blocks, not actual reservations requiring cleaning
            if (event.summary && event.summary.toLowerCase().includes('blocked')) {
                console.log(`Skipping Blocked event: ${dateStr}`);
                return;
            }

            // Check if this specific cleaning was manually removed
            if (removedCleanings[getEventKey(dateStr, property.name)]) {
                return; // Skip adding this event
            }

            if (!calendarEvents[dateStr]) {
                calendarEvents[dateStr] = [];
            }

            // Avoid duplicates if re-parsing or overlapping
            const exists = calendarEvents[dateStr].find(e => e.propertyName === property.name && e.type === 'auto');
            if (!exists) {
                calendarEvents[dateStr].push({
                    propertyName: property.name,
                    color: property.color,
                    type: 'auto'
                });
            }
        });
    } catch (e) {
        console.error('Error parsing iCal', e);
    }
}

// Update renderCalendar to include manual cleanings and interactions
function renderCalendar() {
    calendarGrid.innerHTML = '';

    // Merge Manual Cleanings into calendarEvents for rendering
    // We shouldn't modify calendarEvents directly if we want to re-render easily? 
    // Actually, calendarEvents is rebuilt on fetch.
    // But manual cleanings need to be added EVERY render.

    const displayEvents = JSON.parse(JSON.stringify(calendarEvents)); // Deep copy for rendering

    Object.keys(manualCleanings).forEach(dateStr => {
        if (!displayEvents[dateStr]) displayEvents[dateStr] = [];

        manualCleanings[dateStr].forEach(propId => {
            const prop = properties.find(p => p.id === propId);
            if (prop) {
                // Check if already exists (e.g. if we added manually on top of auto - though usually we wouldn't)
                const exists = displayEvents[dateStr].find(e => e.propertyName === prop.name);
                if (!exists) {
                    displayEvents[dateStr].push({
                        propertyName: prop.name,
                        color: prop.color,
                        type: 'manual'
                    });
                }
            }
        });
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    currentMonthEl.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const el = document.createElement('div');
        el.className = 'day header';
        el.textContent = day;
        calendarGrid.appendChild(el);
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    for (let i = 0; i < startingDay; i++) {
        const el = document.createElement('div');
        el.className = 'day empty';
        calendarGrid.appendChild(el);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const el = document.createElement('div');
        el.className = 'day';
        el.dataset.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = i;
        el.appendChild(dayNumber);

        const dateStr = el.dataset.date;

        // Add click listener to day for adding cleaning
        el.addEventListener('click', (e) => {
            if (!isAdmin) return; // Guard
            // Prevent triggering when clicking a badge
            if (e.target.classList.contains('cleaning-badge')) return;
            openAddModal(dateStr);
        });

        if (displayEvents[dateStr]) {
            el.classList.add('has-cleaning'); // Just a visual marker class

            displayEvents[dateStr].forEach(evt => {
                const badge = document.createElement('div');
                badge.className = 'cleaning-badge';
                badge.textContent = evt.propertyName;
                badge.style.backgroundColor = evt.color;
                badge.style.color = '#fff';

                // Add click listener to badge for removing
                badge.addEventListener('click', (e) => {
                    if (!isAdmin) return; // Guard
                    e.stopPropagation();
                    if (confirm(`Remove cleaning for ${evt.propertyName} on ${dateStr}?`)) {
                        removeCleaning(dateStr, evt);
                    }
                });

                el.appendChild(badge);
            });
        }

        calendarGrid.appendChild(el);
    }
}

function openAddModal(dateStr) {
    selectedDateForManual = dateStr;
    modalDateDisplay.textContent = new Date(dateStr).toDateString();
    modalPropertyList.innerHTML = '';

    properties.forEach(prop => {
        const btn = document.createElement('button');
        btn.className = 'modal-prop-btn';
        btn.textContent = prop.name;
        btn.style.backgroundColor = prop.color;
        btn.onclick = () => {
            addManualCleaning(selectedDateForManual, prop.id);
            closeModal();
        };
        modalPropertyList.appendChild(btn);
    });

    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    selectedDateForManual = null;
}

closeModalBtn.addEventListener('click', closeModal);

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

function addManualCleaning(dateStr, propertyId) {
    if (!manualCleanings[dateStr]) manualCleanings[dateStr] = [];
    if (!manualCleanings[dateStr].includes(propertyId)) {
        manualCleanings[dateStr].push(propertyId);
        saveManualData();
        renderCalendar();
    }
}

function removeCleaning(dateStr, evt) {
    if (evt.type === 'manual') {
        // Remove from manualCleanings
        const prop = properties.find(p => p.name === evt.propertyName);
        if (prop && manualCleanings[dateStr]) {
            manualCleanings[dateStr] = manualCleanings[dateStr].filter(id => id !== prop.id);
            if (manualCleanings[dateStr].length === 0) delete manualCleanings[dateStr];
            saveManualData();
            renderCalendar();
        }
    } else {
        // It's an auto event, mark as removed
        removedCleanings[getEventKey(dateStr, evt.propertyName)] = true;
        saveManualData();
        // We need to re-fetch/re-parse or just force re-render logic?
        // Re-parsing is safest to filter it out, or we can filter in render.
        // Let's filter in render for simplicity if modified parse logic isn't enough OR
        // actually we strictly need to filter in parseICal because we rebuild calendarEvents on fetch.
        // But since we are not re-fetching right now, we should just re-run parse logic or reload.
        // For immediate feedback, let's just trigger a re-parse of everything.
        fetchAllCalendars();
    }
}

// Initial render
renderProperties();
renderLegend();
updateAdminUI();

// Initial fetch handled in setupRealtimeSync now

// Re-add updateAdminUI function definition correctly
function updateAdminUI() {
    if (isAdmin) {
        document.body.classList.add('admin-enabled');
        adminLockBtn.textContent = '🔓';
        adminLockBtn.classList.add('unlocked');
        adminLockBtn.title = "Lock Admin Mode";
    } else {
        document.body.classList.remove('admin-enabled');
        adminLockBtn.textContent = '🔒';
        adminLockBtn.classList.remove('unlocked');
        adminLockBtn.title = "Unlock Admin Mode";
    }
}

adminLockBtn.addEventListener('click', () => {
    if (isAdmin) {
        // Lock
        isAdmin = false;
        updateAdminUI();
    } else {
        // Unlock
        const password = prompt("Enter Admin Password:");
        if (password === ADMIN_PASSWORD) {
            isAdmin = true;
            updateAdminUI();
        } else if (password !== null) {
            alert("Incorrect Password");
        }
    }
});

// Data Migration Logic
const exportBtn = document.getElementById('export-data');
const importBtn = document.getElementById('import-btn');
const importInput = document.getElementById('import-data');

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const data = {
            properties: properties,
            manualCleanings: manualCleanings,
            removedCleanings: removedCleanings,
            timestamp: new Date().toISOString()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "airbnb_calendar_backup.json");
        document.body.appendChild(downloadAnchorNode); // Required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
}

if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
        importInput.click();
    });

    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonObj = JSON.parse(event.target.result);
                if (jsonObj.properties && jsonObj.manualCleanings) {
                    if (confirm(`Restore backup from ${new Date(jsonObj.timestamp).toLocaleString()}? This will overwrite current data.`)) {
                        properties = jsonObj.properties;
                        manualCleanings = jsonObj.manualCleanings;
                        removedCleanings = jsonObj.removedCleanings || {};

                        saveProperties();
                        saveManualData();

                        // Re-render
                        renderProperties();
                        renderLegend();
                        renderCalendar();
                        fetchAllCalendars(); // Fetch fresh data

                        alert('Backup restored successfully!');
                    }
                } else {
                    alert('Invalid backup file format.');
                }
            } catch (err) {
                console.error('Error importing data:', err);
                alert('Failed to parse backup file.');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be selected again if needed
        importInput.value = '';
    });
}
